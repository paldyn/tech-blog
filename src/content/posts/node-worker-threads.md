---
title: "Worker Threads · Node.js 멀티스레드"
description: "Node.js worker_threads 모듈로 CPU 집약 작업을 별도 스레드에 분리하는 방법을 설명합니다. isMainThread·workerData·parentPort·MessageChannel·SharedArrayBuffer·Atomics까지 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "Worker Threads", "멀티스레드", "SharedArrayBuffer", "Atomics", "병렬처리"]
featured: false
draft: false
---

[지난 글](/posts/node-event-emitter/)에서 Node.js EventEmitter를 살펴봤습니다. Node.js는 싱글 스레드 이벤트 루프로 동작하지만, **CPU 집약 작업**은 이벤트 루프를 블로킹합니다. `worker_threads` 모듈은 별도 V8 인스턴스와 이벤트 루프를 갖는 스레드를 생성해 이 문제를 해결합니다.

---

## isMainThread — 파일 하나로 양쪽 역할

```js
import { isMainThread, workerData, parentPort, Worker }
  from 'worker_threads';

if (isMainThread) {
  // 메인 스레드 영역
  const worker = new Worker(new URL(import.meta.url), {
    workerData: { n: 40 },
  });
  worker.on('message', (v) => console.log('fib(40) =', v));
  worker.on('error', console.error);
} else {
  // 워커 스레드 영역
  function fib(n) { return n <= 1 ? n : fib(n - 1) + fib(n - 2); }
  parentPort.postMessage(fib(workerData.n));
}
```

`import.meta.url`을 사용하면 별도 파일 없이 같은 파일에서 main/worker 분기를 구현합니다.

---

## Worker 생성 옵션

![Worker Threads 아키텍처](/assets/posts/node-worker-threads-arch.svg)

```js
const worker = new Worker('./compute.js', {
  workerData: { input: largeArray },  // 구조적 복제(복사)
  resourceLimits: {
    maxOldGenerationSizeMb: 128,      // V8 힙 제한
    maxYoungGenerationSizeMb: 16,
    codeRangeSizeMb: 32,
  },
  env: { NODE_ENV: 'production' },    // 독립 환경 변수
});
```

`workerData`는 **구조적 복제**로 전달됩니다. 복사 비용이 큰 대형 배열은 `SharedArrayBuffer`나 Transferable을 사용하세요.

---

## MessageChannel — 워커 간 직접 통신

```js
import { Worker, MessageChannel } from 'worker_threads';

const { port1, port2 } = new MessageChannel();

const worker = new Worker('./worker.js', {
  workerData: { port: port1 },
  transferList: [port1],   // 이전(transfer) — 복사 없음
});

port2.on('message', (msg) => console.log('워커 응답:', msg));
port2.postMessage('ping');
```

`transferList`에 포함된 객체는 호출 측에서 소유권이 제거됩니다. 제로 복사로 대용량 데이터를 전달할 수 있습니다.

---

## SharedArrayBuffer + Atomics

![Worker Thread 생성 패턴](/assets/posts/node-worker-threads-code.svg)

`SharedArrayBuffer`는 메인 스레드와 워커가 **같은 메모리 영역을 공유**합니다. 경쟁 조건을 방지하려면 `Atomics`를 사용합니다.

```js
// 메인 스레드
const sab = new SharedArrayBuffer(4);   // 4바이트
const view = new Int32Array(sab);

const worker = new Worker('./worker.js', {
  workerData: { sab },   // SharedArrayBuffer는 복사 없이 공유
});

// 워커가 값을 쓸 때까지 대기
Atomics.wait(view, 0, 0);   // view[0] === 0 동안 블록
console.log('워커가 쓴 값:', view[0]);
```

```js
// worker.js
import { workerData } from 'worker_threads';
const view = new Int32Array(workerData.sab);

// 무거운 계산 후 결과 저장
Atomics.store(view, 0, 42);
Atomics.notify(view, 0, 1);  // 대기 중인 스레드 1개 깨우기
```

`Atomics.wait()`는 워커 스레드에서는 블로킹 호출이지만, 메인 스레드에서는 사용이 금지됩니다. 메인 스레드에서는 `Atomics.waitAsync()`를 사용하세요.

---

## 워커 풀 패턴

반복적으로 워커를 생성·소멸하는 것은 비효율적입니다. 풀을 만들어 재사용합니다.

```js
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';

class WorkerPool extends EventEmitter {
  #workers = [];
  #queue = [];
  #size;

  constructor(script, size = 4) {
    super();
    this.#size = size;
    for (let i = 0; i < size; i++) this.#addWorker(script);
  }

  #addWorker(script) {
    const worker = new Worker(script);
    worker.on('message', (result) => {
      const { resolve } = this.#queue.shift() ?? {};
      resolve?.(result);
      // 남은 작업 처리
      if (this.#queue.length > 0) {
        const { task, resolve: r } = this.#queue[0];
        worker.postMessage(task);
        this.#queue[0].resolve = r;
      }
    });
    this.#workers.push(worker);
  }

  run(task) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ task, resolve, reject });
      const idle = this.#workers.find(
        (w) => w.threadId && this.#queue.length === 1,
      );
      idle?.postMessage(task);
    });
  }

  async destroy() {
    await Promise.all(this.#workers.map((w) => w.terminate()));
  }
}
```

실무에서는 `piscina` 같은 검증된 워커 풀 라이브러리를 사용하는 것이 더 안정적입니다.

---

## 성능 고려 사항

| 상황 | 권장 |
|------|------|
| CPU 집약 (암호화, 이미지 처리, 피보나치) | `worker_threads` |
| I/O 집약 (파일, 네트워크) | 비동기 I/O (기본값) |
| 다중 프로세스 필요 | `cluster` 또는 `child_process` |
| 공유 메모리 접근 | `SharedArrayBuffer` + `Atomics` |

---

**지난 글:** [EventEmitter · Node.js 이벤트 패턴](/posts/node-event-emitter/)

**다음 글:** [Cluster · Node.js 멀티프로세스](/posts/node-cluster/)

<br>
읽어주셔서 감사합니다. 😊
