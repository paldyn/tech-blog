---
title: "SharedArrayBuffer & Atomics · 워커 메모리 공유"
description: "SharedArrayBuffer로 Web Worker 간 메모리를 공유하는 방법, Atomics API의 원자적 연산, CAS 기반 뮤텍스 패턴, race condition 방지, 그리고 COOP/COEP 보안 헤더까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "SharedArrayBuffer", "Atomics", "Web Worker", "멀티스레드", "뮤텍스", "메모리 공유"]
featured: false
draft: false
---

[지난 글](/posts/worker-dedicated-vs-shared/)에서 Dedicated Worker와 Shared Worker의 차이를 살펴봤습니다. 이번에는 **SharedArrayBuffer와 Atomics API**를 다룹니다. 일반 `postMessage`가 데이터를 복사하는 것과 달리, SharedArrayBuffer는 여러 스레드가 같은 메모리 영역을 직접 읽고 쓸 수 있게 해줍니다. 이 강력한 기능에는 race condition 위험과 보안 요구사항이 따라옵니다.

---

## 왜 SharedArrayBuffer인가

`postMessage`는 데이터를 구조적 복제(Structured Clone)해 전송합니다. 1MB 배열을 전달하면 1MB가 복사됩니다. 반면 **SharedArrayBuffer**는 실제 메모리 주소를 공유하므로 복사 비용이 없습니다. 여러 Worker가 동시에 같은 버퍼를 읽고 쓸 수 있어, 공유 메모리 기반 병렬 알고리즘을 구현할 수 있습니다.

![SharedArrayBuffer 메모리 공유 모델](/assets/posts/worker-shared-array-buffer-atomics-memory.svg)

---

## SharedArrayBuffer 생성과 공유

```js
// main.js
const sab = new SharedArrayBuffer(4 * 4); // 16바이트 (Int32 4개)
const worker1 = new Worker('./worker1.js');
const worker2 = new Worker('./worker2.js');

// postMessage로 전달할 때 transfer list 불필요 — sab은 '공유'이므로
worker1.postMessage({ sab });
worker2.postMessage({ sab });
```

```js
// worker1.js
self.onmessage = ({ data: { sab } }) => {
  const view = new Int32Array(sab);
  Atomics.add(view, 0, 1); // index 0을 원자적으로 +1
  console.log('Worker1 읽음:', Atomics.load(view, 0));
};
```

`SharedArrayBuffer`는 `ArrayBuffer`와 API가 같지만 `transfer`가 아닌 **공유**입니다. Worker가 `Int32Array`, `Float64Array` 등의 TypedArray 뷰를 통해 접근합니다. 동일한 `sab`에서 만든 뷰들은 **같은 메모리 바이트**를 가리킵니다.

---

## Race Condition

공유 메모리에 일반 `++` 연산을 적용하면 race condition이 발생합니다.

```js
// 위험한 코드 — race condition 발생 가능
view[0]++;
// 내부적으로: 읽기 → 증가 → 쓰기 (3단계)
// 두 Worker가 동시에 실행하면 증분이 유실됨
```

`Atomics.add`는 읽기-수정-쓰기를 **원자적**으로(분리 불가능하게) 실행해 이 문제를 해결합니다.

```js
Atomics.add(view, 0, 1);    // index 0을 +1, 이전 값 반환
Atomics.sub(view, 0, 1);    // index 0을 -1
Atomics.and(view, 0, 0xFF); // 비트 AND
Atomics.or(view, 0, 0x01);  // 비트 OR
Atomics.xor(view, 0, 0xFF); // 비트 XOR
Atomics.exchange(view, 0, 99); // 새 값으로 교체, 이전 값 반환
```

---

## compareExchange — CAS 연산

**Compare-And-Swap(CAS)**은 락-프리(lock-free) 알고리즘의 핵심입니다. "현재 값이 기대값과 같으면 새 값으로 교체하고, 이전 값을 반환"합니다.

```js
// Atomics.compareExchange(typedArray, index, expectedValue, replacementValue)
const old = Atomics.compareExchange(view, 0, 0, 1);
if (old === 0) {
  // 성공: 0이었던 값을 1로 교체 (락 획득)
} else {
  // 실패: 이미 다른 값 (락 이미 점유됨)
}
```

---

## Atomics.wait / notify — 뮤텍스 구현

`Atomics.wait`은 특정 인덱스의 값이 바뀔 때까지 현재 Worker 스레드를 재우는 API입니다(Main Thread에서는 사용 불가).

![Atomics API · 뮤텍스 패턴](/assets/posts/worker-shared-array-buffer-atomics-atomics.svg)

```js
// worker.js — Mutex 구현 예시
const sab = new SharedArrayBuffer(4);
const lock = new Int32Array(sab); // lock[0] = 0: 해제, 1: 획득

function acquire() {
  while (Atomics.compareExchange(lock, 0, 0, 1) !== 0) {
    // 이미 잠겨 있으면 lock[0]이 1로 바뀔 때까지 대기
    Atomics.wait(lock, 0, 1);
  }
}

function release() {
  Atomics.store(lock, 0, 0);    // 해제
  Atomics.notify(lock, 0, 1);   // 대기 중인 스레드 1개 깨우기
}

acquire();
// 임계 구역 (critical section)
view[1] += 100; // 다른 Worker가 접근 못함
release();
```

`Atomics.notify(typedArray, index, count)`는 해당 인덱스를 `wait` 중인 스레드를 `count`개만큼 깨웁니다. `Infinity`를 전달하면 모두 깨웁니다.

---

## Atomics.waitAsync — Main Thread에서 대기

Main Thread에서 `Atomics.wait`은 블로킹이라 허용되지 않습니다. **`Atomics.waitAsync`**는 Promise를 반환해 Main Thread나 이미 await 중인 컨텍스트에서도 사용할 수 있습니다.

```js
// main.js
const result = Atomics.waitAsync(view, 0, 0); // 현재 값이 0이면 대기
result.value.then(() => {
  console.log('Worker가 notify함, 현재 값:', Atomics.load(view, 0));
});
```

---

## 보안 요구사항 — COOP/COEP

Spectre 취약점 대응으로 `SharedArrayBuffer`는 **Cross-Origin Isolation** 환경에서만 활성화됩니다. 서버가 다음 헤더를 응답에 포함해야 합니다.

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

```js
// 현재 환경이 cross-origin isolated인지 확인
if (crossOriginIsolated) {
  const sab = new SharedArrayBuffer(1024); // 정상 생성
} else {
  console.warn('SharedArrayBuffer 사용 불가 — COOP/COEP 헤더 필요');
}
```

---

## 실전 활용 패턴

```js
// WASM + SharedArrayBuffer: 여러 Worker가 동일 Wasm 메모리를 공유
const memory = new WebAssembly.Memory({ initial: 16, shared: true });
// memory.buffer는 SharedArrayBuffer — Worker에 전달 가능

// 진행률 공유 (Producer/Consumer)
const progress = new Float64Array(new SharedArrayBuffer(8));
// Worker에서 Atomics.store(progress, 0, pct)
// Main에서 requestAnimationFrame 루프로 Atomics.load(progress, 0) 읽기
```

SharedArrayBuffer는 WebAssembly 병렬 컴파일, 이미지/오디오 처리, 물리 엔진 등 고성능 연산에 활용됩니다. 단, 복잡한 동기화 로직이 필요하므로 단순 데이터 전달에는 `postMessage` + Transferable을 우선 고려하세요.

---

**지난 글:** [Dedicated Worker vs Shared Worker · 스레드 공유 패턴](/posts/worker-dedicated-vs-shared/)

**다음 글:** [Structured Clone & Transferable · Worker 데이터 전송](/posts/worker-structured-clone-transferable/)

<br>
읽어주셔서 감사합니다. 😊
