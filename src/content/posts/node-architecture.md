---
title: "Node.js 아키텍처 · V8·libuv·이벤트 루프"
description: "Node.js의 내부 구조를 레이어별로 해부합니다. V8 JavaScript 엔진, libuv 비동기 I/O 라이브러리, 이벤트 루프 6단계, 마이크로태스크 우선순위, 스레드 풀 동작 방식을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "V8", "libuv", "이벤트 루프", "비동기 I/O", "아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/worker-wasm-integration/)에서 Web Worker와 WebAssembly 통합 패턴을 살펴봤습니다. 이번부터는 Node.js 심화 시리즈입니다. Node.js가 **어떻게 단일 스레드로 수천 개의 동시 연결을 처리하는지**, 그 구조를 레이어별로 분해합니다.

---

## Node.js란 무엇인가

Node.js는 **V8 JavaScript 엔진**과 **libuv** 위에 구축된 비동기 이벤트 기반 JavaScript 런타임입니다. 브라우저 밖에서 JS를 실행하며, 특히 I/O 집약적인 서버 애플리케이션에 적합합니다.

핵심 설계 철학은 **논 블로킹 I/O**입니다. 파일 읽기, 네트워크 요청 같은 작업을 기다리는 동안 CPU를 다른 작업에 사용합니다.

![Node.js 아키텍처](/assets/posts/node-architecture-diagram.svg)

---

## 레이어 구조

**Layer 1 — JavaScript 코드**: 사용자가 작성하는 코드, npm 패키지, Express 같은 프레임워크가 이 층에 있습니다.

**Layer 2 — Node.js 표준 라이브러리 (JS)**: `fs`, `http`, `net`, `crypto`, `stream` 등 Node.js가 JS로 구현한 모듈들입니다. 일부는 순수 JS고 일부는 C++ 바인딩을 호출합니다.

**Layer 3 — Node.js 바인딩 (C++)**: JS 레이어와 V8/libuv 사이의 접착제입니다. N-API, V8 C++ API를 통해 저수준 기능을 JS로 노출합니다.

**Layer 4 — V8 + libuv**: V8은 JS를 실행하고, libuv는 비동기 I/O와 이벤트 루프를 담당합니다.

**Layer 5 — OS**: epoll(Linux), kqueue(macOS), IOCP(Windows)를 통해 OS 커널의 비동기 I/O 기능을 사용합니다.

---

## V8 엔진

V8은 Google Chrome과 코드베이스를 공유하는 고성능 JavaScript 엔진입니다.

```js
// V8이 하는 일
// 1. JS 파싱 → AST
// 2. Ignition 인터프리터로 바이트코드 생성
// 3. TurboFan JIT 컴파일러로 핫 코드 최적화
// 4. Hidden Class로 객체 레이아웃 최적화
// 5. Garbage Collection (Mark-and-Sweep + Generational)
```

Node.js와 Chrome이 같은 V8을 사용하므로 JS 실행 성능은 거의 동일합니다.

---

## libuv — 비동기 I/O의 심장

libuv는 C로 작성된 멀티플랫폼 비동기 I/O 라이브러리입니다.

- **이벤트 루프 구현체**: Node.js 이벤트 루프의 실제 구현
- **스레드 풀**: 기본 4개(최대 1024개) 스레드로 `fs` 작업, DNS, crypto 같은 블로킹 연산 처리
- **I/O 비동기화**: 네트워크 소켓, 파일 감시, 타이머

```js
// libuv 스레드 풀 크기 조정 (환경변수)
// UV_THREADPOOL_SIZE=8 node server.js

// CPU 수에 맞게 최적화
const os = require('os');
process.env.UV_THREADPOOL_SIZE = os.cpus().length;
```

---

## 이벤트 루프 6단계

Node.js의 이벤트 루프는 6개 단계를 순환합니다. 각 단계에는 FIFO 큐가 있으며, 큐가 소진되거나 최대 콜백 수에 도달하면 다음 단계로 넘어갑니다.

![Node.js 이벤트 루프 6단계](/assets/posts/node-architecture-eventloop.svg)

```js
const fs = require('fs');

setTimeout(() => console.log('1. timer'), 0);       // ① timers
setImmediate(() => console.log('2. immediate'));     // ⑤ check

fs.readFile(__filename, () => {
  // I/O 콜백(poll) 안에서는 setImmediate가 setTimeout보다 먼저
  setTimeout(() => console.log('3. timer in I/O'), 0);
  setImmediate(() => console.log('4. immediate in I/O')); // 먼저 출력
});
// 출력: 1 또는 2 (외부: 순서 불확실), 4, 3 (I/O 내부: immediate가 먼저)
```

---

## 마이크로태스크 — 단계 사이의 우선 실행

각 이벤트 루프 단계가 끝날 때(정확히는 각 콜백 실행 후) **마이크로태스크 큐**가 완전히 비워집니다.

```js
Promise.resolve().then(() => console.log('2. microtask'));
process.nextTick(() => console.log('1. nextTick'));
setTimeout(() => console.log('3. timer'), 0);

// 출력: 1. nextTick → 2. microtask → 3. timer
```

`process.nextTick`은 마이크로태스크 큐보다도 먼저 실행되는 별도 큐입니다. 남용하면 I/O 처리를 기아(starve) 상태로 만들 수 있습니다.

```js
// 위험: 재귀적 nextTick은 I/O를 차단함
function bad() {
  process.nextTick(bad); // 이벤트 루프가 poll 단계에 영원히 도달 못 함
}

// 안전: setImmediate는 다음 이터레이션으로 미룸
function good() {
  setImmediate(good);
}
```

---

## 스레드 풀 — 블로킹 작업 처리

모든 I/O가 논 블로킹인 건 아닙니다. 파일 시스템 작업 일부와 DNS 조회는 OS가 비동기 API를 지원하지 않아 **스레드 풀**에서 처리됩니다.

```js
// 스레드 풀을 사용하는 작업
// - fs.readFile, fs.writeFile, fs.stat 등 (대부분의 fs)
// - dns.lookup (dns.resolve는 async)
// - crypto.pbkdf2, crypto.randomBytes
// - zlib 압축

// 스레드 풀을 사용하지 않는 작업 (OS 비동기 API 직접 사용)
// - TCP/UDP 소켓 I/O
// - HTTP/HTTPS
// - child_process.spawn의 파이프
```

---

## Worker Threads vs 이벤트 루프

CPU 집약적 작업(암호화 해싱, 이미지 처리, 파싱)은 이벤트 루프를 블로킹합니다. 이 경우 `worker_threads`를 사용합니다.

```js
const { Worker, isMainThread, parentPort } = require('worker_threads');

if (isMainThread) {
  const worker = new Worker(__filename);
  worker.on('message', result => console.log('결과:', result));
  worker.postMessage({ n: 45 }); // 피보나치 계산 위임
} else {
  parentPort.on('message', ({ n }) => {
    // 이 코드는 별도 스레드에서 실행 — 이벤트 루프 블로킹 없음
    function fib(n) { return n < 2 ? n : fib(n-1) + fib(n-2); }
    parentPort.postMessage(fib(n));
  });
}
```

---

**지난 글:** [WebAssembly + Worker · 고성능 연산 통합](/posts/worker-wasm-integration/)

**다음 글:** [CommonJS & require() · Node.js 모듈 시스템](/posts/node-cjs-require/)

<br>
읽어주셔서 감사합니다. 😊
