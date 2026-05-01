---
title: "JavaScript 동시성 모델 — 싱글 스레드가 멈추지 않는 이유"
description: "JavaScript가 싱글 스레드임에도 비동기 I/O를 처리할 수 있는 런타임 구조(JS 엔진·Web APIs·큐·이벤트 루프)를 개념 수준에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "동시성", "이벤트 루프", "싱글 스레드", "비동기", "Call Stack", "Web APIs"]
featured: false
draft: false
---

[지난 글](/posts/js-module-cache-cycles/)에서 모듈 캐시와 순환 의존성을 살펴봤습니다. 이제 JavaScript의 실행 모델 자체로 들어가봅니다. "JavaScript는 싱글 스레드인데 어떻게 비동기가 가능한가?"라는 질문은 언어 자체보다 **런타임 환경** 을 이해해야 답할 수 있습니다.

## 싱글 스레드 언어의 의미

JavaScript 엔진은 단 하나의 **콜 스택(Call Stack)** 만 갖습니다. 함수가 호출되면 스택에 쌓이고, 반환되면 제거됩니다. 스택이 하나라는 것은 한 번에 하나의 함수만 실행된다는 뜻입니다.

```js
function bar() { return 1; }
function foo() { return bar(); }
foo();
// Call Stack: [main] → [foo] → [bar] → [foo] → []
```

이 스택이 비워지지 않으면 다음 작업이 시작될 수 없습니다. 무거운 동기 계산이 3초 걸리면 그 3초 동안 UI와 이벤트 처리가 모두 멈춥니다.

![JavaScript 런타임 구조](/assets/posts/js-concurrency-model-overview.svg)

## 런타임 = 엔진 + 환경

JavaScript **엔진**(V8, SpiderMonkey 등)은 힙과 콜 스택만 담당합니다. `setTimeout`, `fetch`, DOM 이벤트 같은 비동기 기능은 엔진이 아니라 **런타임 환경**(브라우저 또는 Node.js)이 제공합니다.

브라우저 기준으로 런타임은 이렇게 구성됩니다.

| 구성 요소 | 역할 |
|---|---|
| JS 엔진 | 코드 파싱·컴파일·실행 (단일 스레드) |
| Web APIs | `setTimeout`, `fetch`, DOM, XHR 등 — C++ 레이어에서 별도 처리 |
| Task Queue | 완료된 Web API 콜백을 담는 매크로태스크 큐 |
| Microtask Queue | Promise `.then`, `queueMicrotask` 콜백 |
| Event Loop | 콜 스택이 비면 큐에서 꺼내 실행 |

Node.js에서는 Web APIs 대신 **libuv**가 파일 I/O, 네트워크, 타이머를 처리하고, 완료 콜백을 큐에 넣습니다.

## 비동기가 동작하는 흐름

```js
console.log('1');
setTimeout(() => console.log('3'), 0);
console.log('2');
// 출력: 1 → 2 → 3
```

1. `console.log('1')` — 스택에 push → 실행 → pop
2. `setTimeout(cb, 0)` — Web API에 등록, 즉시 반환
3. `console.log('2')` — 실행
4. 스택 비워짐 → 이벤트 루프 순회
5. Task Queue에서 `cb` 꺼내어 스택에 push → `console.log('3')` 실행

타이머가 0ms라도 현재 콜 스택이 비워진 후에야 실행됩니다.

## 블로킹 vs 논블로킹

![동기 블로킹 vs 비동기 논블로킹](/assets/posts/js-concurrency-model-blocking.svg)

동기 작업이 콜 스택을 점유하는 동안은 이벤트 루프가 순회할 수 없습니다. 반면 비동기 작업은 Web API 레이어에 위임 후 즉시 반환되므로 스택이 즉시 비워지고, 이벤트 루프는 다른 콜백을 처리할 수 있습니다.

```js
// 잘못된 패턴 — 이벤트 루프 차단
function blockFor(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}
blockFor(3000); // 3초 동안 UI 완전 차단

// 올바른 패턴 — yield하며 양도
async function processItems(items) {
  for (const item of items) {
    await processOne(item); // 각 항목 처리 후 루프로 제어 반환
  }
}
```

## Microtask vs Macrotask

이벤트 루프는 **매크로태스크 하나를 처리한 후 마이크로태스크 큐를 전부 비웁니다.** 그 다음 렌더링이 일어나고, 다시 다음 매크로태스크를 꺼냅니다.

```js
setTimeout(() => console.log('macro'), 0);
Promise.resolve().then(() => console.log('micro'));
console.log('sync');
// 출력: sync → micro → macro
```

마이크로태스크가 무한히 추가되면 매크로태스크(렌더링 포함)가 영원히 실행되지 않을 수 있습니다. 재귀적으로 마이크로태스크를 쌓는 패턴은 피해야 합니다.

## Web Workers — 진짜 병렬

싱글 스레드의 한계를 넘어야 할 때 **Web Worker**를 사용합니다. Worker는 완전히 별도의 스레드에서 JS를 실행하며, 메인 스레드와 `postMessage`로만 통신합니다.

```js
const worker = new Worker('./heavy.js');
worker.postMessage({ data: largeArray });
worker.onmessage = (e) => console.log(e.data); // 결과 수신
```

Worker 내부에도 독립적인 이벤트 루프가 존재합니다. DOM 접근은 불가하지만 CPU 집약적인 작업을 오프로드하기에 적합합니다.

다음 글에서는 이 구조의 핵심 메커니즘인 **이벤트 루프**를 더 깊이 파고들어, 각 페이즈와 정확한 실행 순서를 살펴봅니다.

---

**지난 글:** [모듈 캐시와 순환 의존성 — 한 번 로드, 영원한 공유](/posts/js-module-cache-cycles/)

**다음 글:** [이벤트 루프 완전 해부 — 태스크·마이크로태스크·렌더링](/posts/js-event-loop/)

<br>
읽어주셔서 감사합니다. 😊
