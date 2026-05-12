---
title: "WebAssembly + Worker · 고성능 연산 통합"
description: "Web Worker 내에서 WebAssembly 모듈을 로딩하고 실행하는 방법, instantiateStreaming, 선형 메모리로 JS ↔ Wasm 데이터 교환, SharedArrayBuffer와의 조합, 실전 활용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "WebAssembly", "Wasm", "Web Worker", "instantiateStreaming", "선형 메모리", "고성능"]
featured: false
draft: false
---

[지난 글](/posts/worker-structured-clone-transferable/)에서 Worker와 Main Thread 사이 데이터 전달 전략을 살펴봤습니다. 이번에는 **WebAssembly와 Web Worker의 조합**을 다룹니다. CPU 집약적 연산을 Worker에 위임하면서 동시에 Wasm의 네이티브급 성능을 활용하는 패턴입니다.

---

## 왜 Worker 안에서 Wasm을 실행하는가

WebAssembly는 Main Thread에서도 실행할 수 있지만, 오래 실행되는 Wasm 함수는 UI를 블로킹합니다. Worker는 별도 스레드에서 실행되므로 Wasm을 Worker에 넣으면 두 가지를 동시에 얻습니다.

- Main Thread 블로킹 없는 무거운 연산
- C/C++/Rust로 작성한 알고리즘의 네이티브 수준 성능

![WebAssembly + Worker 아키텍처](/assets/posts/worker-wasm-integration-arch.svg)

---

## Wasm 모듈 로딩 — instantiateStreaming

```js
// wasm-worker.js
async function initWasm() {
  // fetch + compile + instantiate 파이프라인을 한 번에
  const { instance } = await WebAssembly.instantiateStreaming(
    fetch('/wasm/math.wasm'),
    {
      env: {
        // JS 함수를 Wasm에 import
        log: (val) => console.log('[wasm]', val),
        memory: new WebAssembly.Memory({ initial: 16 }),
      },
    }
  );
  return instance.exports;
}
```

`instantiateStreaming`은 HTTP 스트림을 읽으면서 동시에 컴파일하므로 `fetch().then(r => r.arrayBuffer())` 방식보다 빠릅니다. 서버가 `application/wasm` Content-Type을 반환해야 합니다.

---

## Worker에서 Wasm 사용 패턴

![Worker 내 Wasm 로딩 패턴](/assets/posts/worker-wasm-integration-code.svg)

```js
// main.js
const worker = new Worker('./wasm-worker.js');
worker.postMessage({ n: 40 }); // 피보나치 40번째 계산 요청

worker.onmessage = ({ data }) => {
  console.log('fib(40) =', data.result); // Main Thread 블로킹 없이 결과 수신
};
```

Worker는 첫 메시지를 받을 때 Wasm을 초기화하고, 이후 메시지에서는 이미 초기화된 exports를 재사용합니다.

---

## 선형 메모리 — JS ↔ Wasm 데이터 교환

Wasm의 선형 메모리(Linear Memory)는 JS와 공유되는 `ArrayBuffer`입니다. 문자열이나 복잡한 데이터를 Wasm에 넘길 때 이 메모리에 직접 씁니다.

```js
// wasm-worker.js (Wasm 메모리 직접 조작)
const { instance } = await WebAssembly.instantiateStreaming(
  fetch('/wasm/string.wasm')
);
const { memory, processString, malloc, free } = instance.exports;

function callWithString(str) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  // Wasm 선형 메모리에서 공간 할당
  const ptr = malloc(bytes.length + 1);
  const memView = new Uint8Array(memory.buffer, ptr, bytes.length + 1);
  memView.set(bytes);
  memView[bytes.length] = 0; // null terminator

  const resultPtr = processString(ptr, bytes.length);

  const resultLen = new Uint32Array(memory.buffer, resultPtr - 4, 1)[0];
  const result = new TextDecoder().decode(
    new Uint8Array(memory.buffer, resultPtr, resultLen)
  );

  free(ptr); // 할당 해제
  return result;
}
```

---

## SharedArrayBuffer + Wasm — 멀티스레드 Wasm

Wasm 모듈이 `shared: true` 메모리를 사용하면 여러 Worker가 같은 Wasm 메모리를 공유할 수 있습니다. Wasm의 `memory.atomic` 명령어와 JS의 `Atomics`를 함께 사용할 수 있습니다.

```js
// 공유 메모리 생성 (COOP/COEP 헤더 필요)
const sharedMemory = new WebAssembly.Memory({
  initial: 32,
  maximum: 128,
  shared: true, // SharedArrayBuffer 기반
});

// 여러 Worker에 같은 메모리 전달
for (let i = 0; i < navigator.hardwareConcurrency; i++) {
  const w = new Worker('./wasm-thread.js');
  w.postMessage({ memory: sharedMemory, workerId: i });
}
```

```js
// wasm-thread.js
self.onmessage = async ({ data: { memory, workerId } }) => {
  const { instance } = await WebAssembly.instantiateStreaming(
    fetch('/wasm/parallel.wasm'),
    { env: { memory } }
  );
  // 각 Worker가 독립된 청크를 처리
  instance.exports.processChunk(workerId);
};
```

---

## 실전 활용 사례

```js
// 1) SQLite in Wasm (wa-sqlite, sql.js)
const SQL = await initSqlJs({ locateFile: f => `/wasm/${f}` });
const db = new SQL.Database();
db.run('CREATE TABLE users (id INTEGER, name TEXT)');

// 2) 이미지 처리 — 픽셀 조작
// Rust로 작성한 grayscale 필터를 Worker Wasm으로 실행
const { grayscale } = wasmExports;
const imageData = ctx.getImageData(0, 0, width, height);
const ptr = malloc(imageData.data.length);
new Uint8Array(memory.buffer, ptr).set(imageData.data);
grayscale(ptr, width, height); // Wasm에서 처리
ctx.putImageData(
  new ImageData(
    new Uint8ClampedArray(memory.buffer, ptr, imageData.data.length),
    width, height
  ),
  0, 0
);
free(ptr);

// 3) 암호화 — WebCrypto 미지원 알고리즘
const { blake3 } = wasmExports;
const hash = blake3(dataPtr, dataLen);
```

---

## Wasm 모듈 캐싱

컴파일된 Wasm은 `WebAssembly.Module` 객체로 캐싱해 같은 모듈을 여러 Worker에서 재사용할 수 있습니다. `Module`은 Transferable이므로 복사 없이 전달됩니다.

```js
// main.js — Wasm 모듈을 한 번 컴파일 후 모든 Worker에 공유
const response = await fetch('/wasm/heavy.wasm');
const moduleBytes = await response.arrayBuffer();
const compiledModule = await WebAssembly.compile(moduleBytes);

for (let i = 0; i < 4; i++) {
  const w = new Worker('./wasm-worker.js');
  // Module은 Transferable — 복사 없이 이전
  w.postMessage({ module: compiledModule }, [compiledModule]);
}

// wasm-worker.js
self.onmessage = async ({ data: { module } }) => {
  const instance = await WebAssembly.instantiate(module);
  // 인스턴스 별로 독립적인 상태 유지
};
```

---

**지난 글:** [Structured Clone & Transferable · Worker 데이터 전송](/posts/worker-structured-clone-transferable/)

**다음 글:** [Node.js 아키텍처 · V8·libuv·이벤트 루프](/posts/node-architecture/)

<br>
읽어주셔서 감사합니다. 😊
