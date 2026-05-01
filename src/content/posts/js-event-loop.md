---
title: "이벤트 루프 완전 해부 — 태스크·마이크로태스크·렌더링"
description: "브라우저와 Node.js 이벤트 루프의 실행 순서(매크로태스크 → 마이크로태스크 전부 → 렌더링), Node.js 페이즈별 동작, 마이크로태스크 기아 문제를 상세히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "이벤트 루프", "Event Loop", "마이크로태스크", "매크로태스크", "Promise", "Node.js"]
featured: false
draft: false
---

[지난 글](/posts/js-concurrency-model/)에서 JavaScript 런타임의 큰 그림(엔진·Web APIs·큐·이벤트 루프)을 살펴봤습니다. 이번 글에서는 이벤트 루프가 실제로 어떤 순서로 동작하는지, 그리고 Node.js가 브라우저와 어떻게 다른지를 구체적으로 파헤칩니다.

## 이벤트 루프의 한 사이클

브라우저 이벤트 루프는 크게 세 단계로 구성됩니다.

1. **매크로태스크 하나 실행** — Task Queue에서 콜백을 하나 꺼내어 콜 스택이 빌 때까지 실행
2. **마이크로태스크 전부 소진** — Microtask Queue에 있는 모든 콜백을 순서대로 실행 (새로 추가된 것 포함)
3. **렌더링 기회** — 필요하면 rAF 콜백 → Layout → Paint

이 세 단계가 하나의 "틱(tick)"을 이루고, 루프는 이 틱을 무한 반복합니다.

![이벤트 루프 실행 순서](/assets/posts/js-event-loop-phases.svg)

## 실행 순서 추적

```js
console.log('sync-1');

setTimeout(() => console.log('timeout'), 0);

Promise.resolve()
  .then(() => {
    console.log('micro-1');
    queueMicrotask(() => console.log('micro-2'));
  });

console.log('sync-2');

// 출력 순서:
// sync-1
// sync-2
// micro-1
// micro-2    ← micro-1 안에서 추가된 마이크로태스크도 이번 소진 단계에서 처리
// timeout
```

핵심은 **마이크로태스크 큐가 완전히 빌 때까지** (새로 추가된 것 포함) 처리한 후에야 다음 매크로태스크로 넘어간다는 점입니다.

## 매크로태스크 vs 마이크로태스크

| 분류 | 등록 방법 |
|---|---|
| 매크로태스크 | `setTimeout`, `setInterval`, `MessageChannel`, 마우스 클릭 이벤트 등 |
| 마이크로태스크 | `Promise.then/catch/finally`, `queueMicrotask`, `MutationObserver`, `async/await` |

`async`/`await`는 내부적으로 Promise 마이크로태스크를 사용하므로 `await` 이후의 코드는 마이크로태스크로 재개됩니다.

```js
async function demo() {
  console.log('A');
  await Promise.resolve();
  console.log('C'); // 마이크로태스크로 재개
}

demo();
console.log('B');
// 출력: A → B → C
```

## 마이크로태스크 기아(Starvation)

마이크로태스크가 무한히 자기 자신을 다시 큐에 넣으면 매크로태스크와 렌더링이 영원히 실행되지 않습니다.

```js
// 절대 하지 말 것
function starvation() {
  Promise.resolve().then(starvation);
}
starvation(); // 이후 setTimeout 콜백, 클릭 이벤트, 렌더링 모두 차단됨
```

CPU 집약적 반복을 마이크로태스크로 구현하면 이 문제가 생깁니다. `setTimeout`이나 `scheduler.postTask()`로 매크로태스크에 분산시켜야 합니다.

## Node.js 이벤트 루프 — 6개 페이즈

Node.js는 libuv 기반으로 이벤트 루프를 여러 **페이즈**로 구성합니다.

![Node.js 이벤트 루프 페이즈](/assets/posts/js-event-loop-nodejs.svg)

| 페이즈 | 처리 내용 |
|---|---|
| **timers** | `setTimeout`, `setInterval` 만료된 콜백 |
| **pending callbacks** | 이전 루프에서 미처 처리 못한 I/O 에러 콜백 |
| **idle, prepare** | 내부 전용 |
| **poll** | 새 I/O 이벤트 수집 · 대기 (가장 오래 머무는 페이즈) |
| **check** | `setImmediate` 콜백 |
| **close callbacks** | `socket.on('close', ...)` 등 |

각 페이즈 전환 시 `process.nextTick` → Promise 마이크로태스크 순서로 마이크로태스크 큐가 소진됩니다.

### process.nextTick vs setImmediate

```js
setImmediate(() => console.log('setImmediate'));
process.nextTick(() => console.log('nextTick'));

// 출력: nextTick → setImmediate
```

`process.nextTick`은 마이크로태스크로 동작하며, 현재 페이즈가 끝나기 전 즉시 처리됩니다. `setImmediate`는 poll 페이즈 완료 후 check 페이즈에서 실행됩니다.

I/O 콜백 내부에서는 `setImmediate`가 `setTimeout(fn, 0)`보다 항상 먼저 실행됩니다.

```js
const fs = require('fs');
fs.readFile('file', () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
// 항상: immediate → timeout
```

## 렌더링과 requestAnimationFrame

브라우저에서는 매크로태스크 처리 후, 마이크로태스크 소진 후, 다음 vsync 타이밍이 맞으면 rAF 콜백 → 레이아웃 → 페인트 순서로 렌더링이 일어납니다. 렌더링은 필요할 때만(보통 60fps 기준 약 16ms마다) 일어납니다.

```js
function animate() {
  // 렌더링 직전 호출 보장
  requestAnimationFrame(animate);
  draw();
}
requestAnimationFrame(animate);
```

`requestAnimationFrame`을 사용하면 렌더링 직전 시점에 DOM 변경을 모아 처리할 수 있어, `setTimeout(fn, 16)` 방식보다 훨씬 안정적인 애니메이션을 만들 수 있습니다.

이벤트 루프의 동작 순서를 이해하면 `setTimeout`, `Promise`, `queueMicrotask` 등의 실행 타이밍 퍼즐을 정확하게 풀 수 있고, 성능 문제의 원인을 찾기도 훨씬 쉬워집니다.

---

**지난 글:** [JavaScript 동시성 모델 — 싱글 스레드가 멈추지 않는 이유](/posts/js-concurrency-model/)

**다음 글:** [타이머 완전 비교 — setTimeout·setInterval·queueMicrotask·rAF](/posts/js-timers-comparison/)

<br>
읽어주셔서 감사합니다. 😊
