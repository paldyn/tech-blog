---
title: "Structured Clone & Transferable · Worker 데이터 전송"
description: "postMessage의 Structured Clone 알고리즘 동작 원리, 복제 가능/불가 타입, ArrayBuffer 소유권 이전(Transferable), MessagePort·ImageBitmap·OffscreenCanvas 활용, structuredClone() 전역 함수까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Structured Clone", "Transferable", "ArrayBuffer", "postMessage", "Web Worker", "OffscreenCanvas"]
featured: false
draft: false
---

[지난 글](/posts/worker-shared-array-buffer-atomics/)에서 SharedArrayBuffer와 Atomics로 Worker 간 메모리를 직접 공유하는 방법을 살펴봤습니다. 이번에는 `postMessage`가 데이터를 전달하는 두 가지 방식, **Structured Clone(복사)** 과 **Transferable(소유권 이전)** 을 자세히 분석합니다.

---

## Structured Clone 알고리즘

`postMessage(data)`를 호출하면 런타임은 `data`를 **Structured Clone 알고리즘**으로 직렬화해 대상 컨텍스트에 역직렬화합니다. JSON과 비슷하지만 훨씬 많은 타입을 지원하고, **순환 참조**도 처리합니다.

![Structured Clone · 지원 타입과 제외 타입](/assets/posts/worker-structured-clone-transferable-clone.svg)

중요한 제약이 있습니다. **함수**, **DOM 노드**, **Proxy**, **클래스 인스턴스의 프로토타입**은 복제할 수 없습니다. 클래스 인스턴스를 전달하면 프로토타입이 소실되고 일반 `Object`가 도착합니다.

```js
class Vector {
  constructor(x, y) { this.x = x; this.y = y; }
  magnitude() { return Math.hypot(this.x, this.y); }
}

const v = new Vector(3, 4);
worker.postMessage(v);

// Worker 쪽에서 수신
self.onmessage = ({ data }) => {
  console.log(data instanceof Vector); // false — 일반 Object
  console.log(data.magnitude);         // undefined — 메서드 소실
  console.log(data.x, data.y);         // 3, 4 — 데이터 프로퍼티만 유지
};
```

---

## structuredClone() — 전역 복제 함수

Node 17+와 모던 브라우저는 `structuredClone()`을 전역 함수로 제공합니다. `postMessage` 없이도 깊은 복사(deep clone)를 수행합니다.

```js
const original = {
  date: new Date(),
  map: new Map([['key', [1, 2, 3]]]),
  buf: new ArrayBuffer(16),
};

const clone = structuredClone(original);
clone.date === original.date;         // false — 별개 Date 객체
clone.map.get('key') === original.map.get('key'); // false — 배열도 복제

// 순환 참조 처리
const circular = {};
circular.self = circular;
const cloneCirc = structuredClone(circular); // 정상 동작 (JSON.stringify는 에러)
```

---

## Transferable — 소유권 이전 (Zero-Copy)

1 MB짜리 `ArrayBuffer`를 복제해 전달하면 1 MB를 새로 할당합니다. **Transferable**을 사용하면 메모리 할당 없이 소유권만 넘깁니다. 전달 후 원본은 **neutered** 상태가 되어 `byteLength === 0`이 됩니다.

![Transferable · 소유권 이전 (Zero-Copy)](/assets/posts/worker-structured-clone-transferable-transfer.svg)

```js
// main.js
const buf = new ArrayBuffer(1024 * 1024); // 1 MB
const view = new Uint8Array(buf);
view.fill(255);

// 두 번째 인수가 transfer list
worker.postMessage({ buffer: buf }, [buf]);

// 전달 후 원본은 사용 불가
console.log(buf.byteLength); // 0 (neutered)
```

```js
// worker.js
self.onmessage = ({ data }) => {
  const { buffer } = data;
  console.log(buffer.byteLength); // 1048576 — Worker가 소유권 획득
};
```

---

## MessageChannel — 양방향 포트

`MessageChannel`은 두 개의 `MessagePort`를 생성합니다. 포트를 Worker에 전달해 직접 채널을 구성할 수 있습니다.

```js
// main.js
const { port1, port2 } = new MessageChannel();

// port2를 Worker에 이전 (Transfer)
worker.postMessage({ port: port2 }, [port2]);

port1.onmessage = ({ data }) => console.log('Worker →', data);
port1.postMessage('안녕 Worker');

// worker.js
self.onmessage = ({ data: { port } }) => {
  port.onmessage = ({ data }) => {
    console.log('Main →', data);
    port.postMessage('안녕 Main');
  };
};
```

---

## OffscreenCanvas — 렌더링 위임

`OffscreenCanvas`는 Worker에서 2D/WebGL 렌더링을 수행할 수 있는 Transferable입니다. Main Thread를 차단하지 않고 렌더링 작업을 분리할 수 있습니다.

```js
// main.js
const canvas = document.getElementById('myCanvas');
const offscreen = canvas.transferControlToOffscreen();
worker.postMessage({ canvas: offscreen }, [offscreen]);

// worker.js
self.onmessage = ({ data: { canvas } }) => {
  const ctx = canvas.getContext('2d');
  // Worker에서 직접 그리기 — Main Thread 부담 없음
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#55c555';
    ctx.fillRect(Math.random() * 400, Math.random() * 300, 50, 50);
    setTimeout(draw, 16); // ~60fps
  }
  draw();
};
```

---

## ImageBitmap — GPU 이미지 이전

`ImageBitmap`은 디코딩된 이미지를 GPU 메모리에 올린 상태로 Transfer할 수 있습니다. 이미지를 다시 디코딩하지 않아 효율적입니다.

```js
// main.js
const response = await fetch('/large-image.jpg');
const blob = await response.blob();
const bitmap = await createImageBitmap(blob);

// GPU 비트맵을 Worker에 이전
worker.postMessage({ bitmap }, [bitmap]);

// worker.js (OffscreenCanvas와 조합)
self.onmessage = ({ data: { bitmap, canvas } }) => {
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close(); // 사용 후 GPU 메모리 해제
};
```

---

## 전략 선택 가이드

| 시나리오 | 권장 방식 |
|---------|----------|
| 소량 데이터 (< 64 KB) | 복사 (기본 postMessage) |
| 대용량 바이너리 | Transferable (ArrayBuffer) |
| Worker 간 공유 상태 | SharedArrayBuffer + Atomics |
| 양방향 통신 채널 | MessageChannel |
| Canvas 렌더링 위임 | OffscreenCanvas Transfer |

---

**지난 글:** [SharedArrayBuffer & Atomics · 워커 메모리 공유](/posts/worker-shared-array-buffer-atomics/)

**다음 글:** [WebAssembly + Worker · 고성능 연산 통합](/posts/worker-wasm-integration/)

<br>
읽어주셔서 감사합니다. 😊
