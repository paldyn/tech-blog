---
title: "이벤트 루프 — 싱글 스레드가 비동기를 다루는 방법"
description: "JavaScript 런타임의 핵심인 이벤트 루프를 콜 스택·Web API·마이크로태스크 큐·태스크 큐로 나눠 이해하고, 비동기 코드의 실행 순서가 왜 그렇게 되는지 파악합니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "이벤트루프", "비동기", "콜스택", "마이크로태스크", "태스크큐", "싱글스레드"]
featured: false
draft: false
---

JavaScript는 **싱글 스레드(single-threaded)** 언어입니다. 한 번에 한 가지 일만 합니다. 그런데 우리는 버튼 클릭을 기다리면서 동시에 타이머를 돌리고, 서버에서 데이터를 받아오면서 UI를 업데이트합니다. 싱글 스레드인데 어떻게 가능한 걸까요?

그 비결이 **이벤트 루프(Event Loop)** 입니다. JavaScript 엔진 자체는 싱글 스레드이지만, 브라우저(또는 Node.js)는 그 주변에 여러 메커니즘을 붙여 비동기 작업을 처리할 수 있게 합니다.

---

## 런타임의 구성 요소

JavaScript 런타임은 크게 네 부분으로 구성됩니다.

**콜 스택(Call Stack)**: 현재 실행 중인 함수들이 쌓이는 공간. 앞의 글에서 다뤘습니다. 함수가 호출될 때 push, 반환될 때 pop.

**Web API (또는 Node.js API)**: 타이머(`setTimeout`), 네트워크 요청(`fetch`), DOM 이벤트 등 브라우저나 Node.js가 제공하는 비동기 기능. JavaScript 엔진 바깥에서 동작합니다.

**태스크 큐(Task Queue, 매크로태스크 큐)**: `setTimeout`, `setInterval`, DOM 이벤트 콜백이 완료 후 대기하는 FIFO 큐.

**마이크로태스크 큐(Microtask Queue)**: `Promise.then`, `queueMicrotask`, `MutationObserver` 콜백이 대기하는 큐. 태스크 큐보다 우선순위가 높습니다.

**이벤트 루프**: 콜 스택이 비어있으면 큐에서 다음 작업을 꺼내 스택에 올립니다.

![JavaScript 이벤트 루프 전체 구조](/assets/posts/js-event-loop-diagram.svg)

---

## setTimeout(fn, 0)은 즉시 실행이 아니다

흔한 오해 중 하나입니다. 지연 시간을 0으로 설정해도 즉시 실행되지 않습니다.

```js
console.log("A");
setTimeout(() => console.log("C"), 0);
console.log("B");
// 출력: A → B → C
```

`setTimeout`의 콜백은 Web API가 타이머를 처리한 뒤 **태스크 큐**에 들어갑니다. 이벤트 루프는 콜 스택이 완전히 비어야 큐에서 꺼냅니다. `console.log("B")`가 실행되는 시점에 콜 스택이 아직 비어있지 않으므로, `"C"`는 `"B"` 이후에 출력됩니다.

---

## 마이크로태스크 큐의 우선순위

이벤트 루프는 **매 태스크가 완료된 뒤 마이크로태스크 큐를 먼저 소진**합니다. 마이크로태스크 큐가 빌 때까지 다음 태스크로 넘어가지 않습니다.

```js
console.log("1");
setTimeout(() => console.log("4. setTimeout"), 0);
Promise.resolve().then(() => console.log("3. Promise"));
queueMicrotask(() => console.log("3. queueMicrotask"));
console.log("2");
```

실행 순서를 예측해보면:

1. `"1"` — 동기 코드, 즉시 실행
2. `setTimeout` 콜백 — Web API에 위임, 태스크 큐 대기 예정
3. `Promise.resolve().then(...)` — 마이크로태스크 큐에 등록
4. `queueMicrotask(...)` — 마이크로태스크 큐에 등록
5. `"2"` — 동기 코드, 즉시 실행
6. 콜 스택 비워짐. 이벤트 루프: 마이크로태스크 큐 확인
7. `"3. Promise"`, `"3. queueMicrotask"` — 마이크로태스크 소진
8. 태스크 큐에서 setTimeout 콜백 꺼냄
9. `"4. setTimeout"`

![마이크로태스크와 매크로태스크 실행 순서 비교](/assets/posts/js-event-loop-ordering.svg)

`setTimeout(fn, 0)`은 "최소한 다음 태스크 사이클"을 의미합니다. Promise 콜백은 "현재 태스크 직후"에 실행됩니다.

---

## 렌더링과 이벤트 루프

브라우저는 화면을 그리는 렌더링 작업도 이벤트 루프와 연동됩니다. 렌더링은 태스크 사이, 즉 하나의 태스크가 끝나고 다음 태스크가 시작되기 전 시점에 발생할 수 있습니다. 마이크로태스크는 렌더링 전에 모두 소진됩니다.

이것이 동기 코드를 너무 오래 실행하면 UI가 멈추는 이유입니다. 콜 스택이 비지 않으면 이벤트 루프가 렌더링 기회를 얻지 못합니다.

```js
// 이 코드는 UI를 약 5초간 블로킹합니다
const end = Date.now() + 5000;
while (Date.now() < end) {} // 바쁜 대기 (busy wait)
console.log("5초 후 실행");
```

무거운 연산을 작은 청크로 나눠 `setTimeout`이나 `requestAnimationFrame`으로 분산하거나, Web Worker를 사용하는 것이 방법입니다.

---

## Node.js의 이벤트 루프

Node.js도 이벤트 루프 기반이지만 브라우저와 약간 다릅니다. `libuv` 라이브러리를 통해 여러 단계(phase)로 구성된 루프가 돌아갑니다.

- **timers**: `setTimeout`, `setInterval` 콜백 실행
- **I/O callbacks**: 파일 I/O, 네트워크 등 콜백
- **poll**: 새 I/O 이벤트 대기
- **check**: `setImmediate` 콜백
- **close callbacks**: 소켓 닫기 등

`process.nextTick`은 마이크로태스크 큐보다도 먼저 처리되는 특수한 큐에 들어갑니다. Node.js에서 실행 순서를 다룰 때 주의해야 할 부분입니다.

---

## await는 어디서 일시정지하는가

`async/await` 코드에서 `await` 키워드를 만나면 해당 함수의 나머지 부분이 마이크로태스크 큐에 등록됩니다. 현재 함수 실행을 일시정지하고 콜 스택을 비워 다른 동기 코드가 실행될 기회를 줍니다.

```js
async function fetchData() {
  console.log("A");
  await Promise.resolve(); // 여기서 일시정지
  console.log("C");        // 마이크로태스크로 재개
}

fetchData();
console.log("B");
// 출력: A → B → C
```

`await` 뒤 코드는 `Promise.then` 콜백과 동일하게 마이크로태스크 큐에서 처리됩니다. 이벤트 루프와 마이크로태스크 큐를 이해하면 `async/await`의 실행 순서가 자연스럽게 이해됩니다.

---

이벤트 루프는 JavaScript 비동기의 모든 것이 작동하는 기반입니다. 다음 글에서는 **콜백 패턴**을 살펴봅니다. JavaScript 비동기의 가장 원시적인 형태이자, Promise와 async/await가 왜 등장했는지를 이해하는 출발점입니다.

---

**다음 글:** 콜백 패턴 — 비동기의 시작과 콜백 헬

<br>
읽어주셔서 감사합니다. 😊
