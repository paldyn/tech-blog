---
title: "Promise 상태 — pending·fulfilled·rejected의 전이"
description: "Promise의 세 가지 상태(pending, fulfilled, rejected), 상태 불변성, resolve에 Promise를 넘길 때의 동화(assimilation) 동작, 정적 메서드로 즉시 settled Promise 만들기를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Promise", "비동기", "pending", "fulfilled", "rejected", "thenable"]
featured: false
draft: false
---

[지난 글](/posts/js-timers-comparison/)에서 스케줄링 API의 차이를 비교했습니다. 이번 글부터 비동기 처리의 핵심인 **Promise**를 깊이 파고들어갑니다. 시작은 가장 기본, Promise가 가질 수 있는 상태들입니다.

## Promise의 세 가지 상태

Promise 객체는 반드시 세 상태 중 하나입니다.

- **pending**: 초기 상태. 아직 이행도 거부도 되지 않음
- **fulfilled**: 작업이 성공적으로 완료됨. resolve 값을 가짐
- **rejected**: 작업이 실패함. reject 이유(reason)를 가짐

```js
const p1 = new Promise((resolve) => {
  setTimeout(() => resolve(42), 1000);
});
// 생성 직후: pending
// 1초 후: fulfilled(42)
```

fulfilled와 rejected를 합쳐 **settled** 상태라고 부릅니다.

![Promise 상태 전이 다이어그램](/assets/posts/js-promise-states-diagram.svg)

## 상태는 불변 — 한 번 settled 되면 끝

가장 중요한 특성입니다. `resolve`나 `reject`를 여러 번 호출해도 첫 번째 호출만 적용됩니다.

```js
const p = new Promise((resolve, reject) => {
  resolve('first');   // fulfilled('first')
  resolve('second');  // 무시됨
  reject(new Error()); // 무시됨
});

p.then(console.log); // 'first'
```

이 불변성 덕분에 Promise는 안전하게 여러 곳에서 `.then()`을 붙일 수 있습니다.

## Promise 생성자

```js
const p = new Promise((resolve, reject) => {
  // 이 executor 함수는 동기적으로 즉시 실행됨
  doAsyncWork((err, data) => {
    if (err) reject(err);
    else resolve(data);
  });
});
```

executor 함수는 `new Promise(...)` 시점에 **동기적으로** 실행됩니다. 단, `resolve`/`reject` 호출 후 `.then` 콜백은 **마이크로태스크로 비동기 실행**됩니다.

```js
const p = Promise.resolve(1);
p.then(v => console.log('B:', v));
console.log('A');
// 출력: A → B: 1
```

## resolve에 Promise를 넘기면 — 동화(assimilation)

`resolve` 함수에 원시 값이 아닌 **Promise**(또는 thenable)를 넘기면, 그 Promise가 settled 될 때까지 기다렸다가 외부 Promise가 동일하게 settled 됩니다.

```js
const inner = new Promise(res => setTimeout(() => res(99), 500));

const outer = new Promise(resolve => {
  resolve(inner); // inner가 fulfilled 되면 outer도 fulfilled(99)
});

outer.then(v => console.log(v)); // 500ms 후 99
```

![Thenable 동화와 resolve(Promise)](/assets/posts/js-promise-states-thenable.svg)

`reject`에 Promise를 넘기면 동화되지 않고 Promise 객체 자체가 reason이 됩니다. `reject`와 `resolve`의 비대칭성이므로 주의하세요.

```js
const p = new Promise((_, reject) => {
  reject(Promise.resolve(1)); // reason = Promise 객체, 숫자 1이 아님!
});
```

## Thenable — Promise 호환성

Promise는 `.then()` 메서드를 가진 모든 객체(thenable)를 Promise처럼 취급합니다. 이 덕분에 jQuery Deferred, 블루버드 등 다른 Promise 라이브러리와도 상호 운용됩니다.

```js
const thenable = {
  then(resolve, reject) {
    resolve('hello');
  }
};

Promise.resolve(thenable).then(console.log); // 'hello'
```

thenable의 `then` 메서드 실행 중 예외가 발생하면 해당 Promise는 rejected 상태가 됩니다.

## 정적 메서드로 즉시 settled Promise

```js
Promise.resolve(42);        // fulfilled(42)
Promise.reject(new Error()); // rejected(Error)
```

특히 `Promise.resolve`는 이미 Promise를 받으면 그대로 반환합니다 (새 Promise를 만들지 않음). 다만 thenable이면 새 Promise로 감쌉니다.

```js
const p = Promise.resolve(42);
Promise.resolve(p) === p; // true — 동일 객체 반환
```

이 특성을 이용해 함수 인자가 Promise인지 확인할 때 `Promise.resolve(val).then(...)`으로 안전하게 정규화할 수 있습니다.

## 상태 확인

순수 JavaScript에서 Promise 상태를 직접 읽는 표준 API는 없습니다. 상태 확인이 필요하면 외부 변수로 추적하거나, `Promise.race`와 즉시 settled Promise를 조합하는 패턴을 사용합니다.

```js
function isResolved(p) {
  return Promise.race([p, Promise.resolve(false)])
    .then(v => v !== false);
}
```

다음 글에서는 Promise를 실제로 사용하는 방법인 **체이닝과 에러 처리**를 살펴봅니다.

---

**지난 글:** [타이머 완전 비교 — setTimeout·setInterval·queueMicrotask·rAF](/posts/js-timers-comparison/)

**다음 글:** [Promise 체이닝과 에러 처리 — .then·.catch·.finally](/posts/js-promise-chaining-error/)

<br>
읽어주셔서 감사합니다. 😊
