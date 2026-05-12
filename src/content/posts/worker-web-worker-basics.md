---
title: "Web Worker 기초 · 멀티스레드 JavaScript"
description: "Web Worker의 아키텍처, Worker 생성과 종료, postMessage 구조화 복제와 Transferable, MessageChannel, 인라인 Worker(Blob URL), Promise 래퍼 패턴, 실전 사용 사례까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Web Worker", "멀티스레드", "postMessage", "Transferable", "구조화 복제", "성능", "CPU"]
featured: false
draft: false
---

[지난 글](/posts/net-web-share/)에서 Web Share API로 OS 공유 시트를 사용하는 방법을 살펴봤습니다. 이번에는 **Web Worker**를 정리합니다. JavaScript는 단일 스레드 언어이지만, Web Worker를 사용하면 별도 스레드에서 코드를 실행해 메인 스레드(UI 스레드)를 블로킹하지 않고 CPU 집중 작업을 처리할 수 있습니다.

---

## Web Worker가 필요한 이유

브라우저는 자바스크립트 실행·DOM 렌더링·이벤트 처리를 **하나의 메인 스레드**에서 순차적으로 처리합니다. CPU를 많이 사용하는 연산(이미지 처리·암호화·대용량 정렬·물리 시뮬레이션)을 메인 스레드에서 실행하면 렌더링이 멈추고 UI가 응답하지 않습니다.

Web Worker를 사용하면:
- CPU 집중 작업을 **별도 스레드**에서 실행
- 메인 스레드는 UI 렌더링·이벤트 처리에 집중
- 멀티코어 CPU를 활용

---

## 아키텍처 개요

![Web Worker 아키텍처](/assets/posts/worker-web-worker-basics-architecture.svg)

메인 스레드와 Worker 스레드는 **독립된 실행 컨텍스트**입니다. 메모리를 공유하지 않으며, `postMessage()`와 `onmessage`로만 통신합니다. Worker는 DOM에 접근할 수 없지만 `fetch`, `IndexedDB`, `WebSocket`, WebAssembly 등 대부분의 Web API를 사용할 수 있습니다.

---

## Worker 생성과 기본 통신

![Web Worker 메시지 패턴](/assets/posts/worker-web-worker-basics-patterns.svg)

```js
// main.js
const worker = new Worker('./worker.js');

// 데이터 전송 (구조화 복제 — 깊은 복사)
worker.postMessage({ type: 'COMPUTE', input: [5, 3, 1, 4, 2] });

// 결과 수신
worker.onmessage = ({ data }) => {
  console.log('정렬 결과:', data.result);
  worker.terminate(); // 더 이상 필요 없으면 종료
};

worker.onerror = (errorEvent) => {
  console.error('Worker 오류:', errorEvent.message);
  console.error('파일:', errorEvent.filename, '줄:', errorEvent.lineno);
};
```

```js
// worker.js
self.onmessage = ({ data }) => {
  const { type, input } = data;
  if (type === 'COMPUTE') {
    const result = [...input].sort((a, b) => a - b);
    self.postMessage({ result });
  }
};
```

Worker 전역 객체는 `self`(WorkerGlobalScope)입니다. `window`는 존재하지 않습니다.

---

## 구조화 복제 vs Transferable

`postMessage()`는 기본적으로 데이터를 **구조화 복제(Structured Clone)**합니다. 원본과 독립적인 복사본이 전달됩니다.

```js
// 구조화 복제 (기본) — 복사 비용 발생
worker.postMessage({ data: largeArray }); // largeArray 복사

// Transferable로 전송 — zero-copy (원본 접근 불가)
const buffer = new ArrayBuffer(1024 * 1024 * 100); // 100MB
worker.postMessage({ data: buffer }, [buffer]);
// buffer는 Worker로 이전됨. 이후 메인에서 buffer.byteLength === 0
```

**Transferable** 객체: `ArrayBuffer`, `MessagePort`, `ImageBitmap`, `OffscreenCanvas`, `ReadableStream`, `WritableStream` 등. 전송 후 원본 컨텍스트에서는 사용 불가능합니다.

---

## ESM Worker

```js
// type: 'module'로 생성하면 Worker 스크립트에서 import 사용 가능
const worker = new Worker('./worker.js', { type: 'module' });
```

```js
// worker.js (ESM Worker)
import { heavyCompute } from './utils.js';

self.onmessage = async ({ data }) => {
  const result = await heavyCompute(data);
  self.postMessage(result);
};
```

`type: 'module'`은 Chrome 80+, Firefox 114+, Safari 15+에서 지원됩니다. 번들러(Vite·webpack)를 사용하면 빌드 시 처리되어 브라우저 지원에 무관합니다.

---

## 인라인 Worker (Blob URL)

별도 파일 없이 문자열로 Worker를 만들 수 있습니다.

```js
const workerCode = `
  self.onmessage = ({ data }) => {
    // 피보나치 수열 계산
    function fib(n) {
      if (n <= 1) return n;
      return fib(n - 1) + fib(n - 2);
    }
    self.postMessage(fib(data));
  };
`;

const blob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);
const worker = new Worker(workerUrl);

worker.postMessage(40); // fib(40) 계산 (비동기)
worker.onmessage = ({ data }) => {
  URL.revokeObjectURL(workerUrl); // 메모리 해제
  console.log('fib(40):', data);
};
```

---

## Promise 래퍼 패턴

Worker 통신을 Promise로 감싸면 `async/await`으로 편리하게 사용할 수 있습니다.

```js
function createWorkerPromise(workerUrl) {
  const worker = new Worker(workerUrl);
  const pending = new Map();
  let idCounter = 0;

  worker.onmessage = ({ data }) => {
    const { id, result, error } = data;
    const { resolve, reject } = pending.get(id);
    pending.delete(id);
    error ? reject(new Error(error)) : resolve(result);
  };

  return {
    async call(type, payload) {
      const id = idCounter++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, type, payload });
      });
    },
    terminate() { worker.terminate(); }
  };
}

// 사용
const myWorker = createWorkerPromise('./worker.js');
const sorted = await myWorker.call('SORT', [5, 3, 1]);
```

---

## MessageChannel — 직접 채널

```js
const channel = new MessageChannel();
const { port1, port2 } = channel;

// port2를 Worker로 전달
worker.postMessage({ port: port2 }, [port2]);

// port1로 직접 통신
port1.onmessage = ({ data }) => console.log('직접 수신:', data);
port1.postMessage('hello from main');
```

Worker가 다른 Worker와 직접 통신할 때, 또는 iframe과 페이지가 직접 통신할 때 사용합니다.

---

## 실전 사용 사례

**이미지 처리**: `createImageBitmap()`으로 이미지를 디코딩하고 Worker에서 필터·리사이즈를 적용한 뒤 OffscreenCanvas로 렌더링합니다.

**암호화**: PBKDF2·bcrypt 같은 비용이 큰 해시 연산을 Worker에서 실행합니다.

**대용량 데이터 파싱**: CSV·JSON 수십만 행을 Worker에서 파싱하고 필터링합니다.

**물리/게임 엔진**: 충돌 감지·물리 시뮬레이션을 Worker에서 계산하고 결과를 메인 스레드로 전달합니다.

```js
// 이미지 필터를 Worker에서 처리하는 예시
const imageWorker = new Worker('./image-worker.js');

async function applyFilter(imageData) {
  const buffer = imageData.data.buffer;
  imageWorker.postMessage(
    { buffer, width: imageData.width, height: imageData.height },
    [buffer] // Transferable: zero-copy
  );
  return new Promise(resolve => {
    imageWorker.onmessage = ({ data }) => {
      resolve(new ImageData(
        new Uint8ClampedArray(data.buffer),
        data.width, data.height
      ));
    };
  });
}
```

---

## Worker 풀 패턴

```js
class WorkerPool {
  #workers;
  #queue = [];

  constructor(url, size = navigator.hardwareConcurrency) {
    this.#workers = Array.from({ length: size }, () => ({
      worker: new Worker(url),
      busy: false
    }));
    this.#workers.forEach(w => {
      w.worker.onmessage = (e) => this.#onResult(w, e.data);
    });
  }

  run(task) {
    const free = this.#workers.find(w => !w.busy);
    if (free) return this.#dispatch(free, task);
    return new Promise(resolve => this.#queue.push({ task, resolve }));
  }

  #dispatch(entry, { payload, resolve }) {
    entry.busy = true;
    entry.resolve = resolve;
    entry.worker.postMessage(payload);
  }

  #onResult(entry, result) {
    entry.resolve(result);
    entry.busy = false;
    if (this.#queue.length) this.#dispatch(entry, this.#queue.shift());
  }
}
```

---

**지난 글:** [Web Share API · 네이티브 공유 다이얼로그](/posts/net-web-share/)

**다음 글:** [Dedicated Worker vs Shared Worker · 스레드 공유 패턴](/posts/worker-dedicated-vs-shared/)

<br>
읽어주셔서 감사합니다. 😊
