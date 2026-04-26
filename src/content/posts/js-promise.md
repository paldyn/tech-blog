---
title: "Promise — 비동기를 값으로 다루다"
description: "콜백 헬의 대안으로 설계된 Promise의 상태 모델, 체이닝, 오류 처리 방식을 이해하고, 제어의 역전 문제가 어떻게 해결되는지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-24"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "Promise", "비동기", "체이닝", "ES6", "마이크로태스크", "비동기패턴"]
featured: false
draft: false
---

지난 글에서 콜백 패턴의 근본적인 문제를 살펴봤습니다. 순차 비동기 처리는 피라미드 모양의 중첩을 만들고, 더 심각하게는 **제어의 역전**이 발생한다고 했습니다. 콜백을 넘기면 언제, 몇 번, 어떤 인자로 호출될지를 내가 아닌 상대방 코드가 결정합니다.

**Promise**는 이 문제에 대한 정면 돌파입니다. "비동기 작업의 미래 결과"를 하나의 **값**으로 표현하고, 그 값을 내가 직접 다룰 수 있게 합니다. ES6(ECMAScript 2015)에서 언어 표준으로 도입되었으며, 현대 JavaScript 비동기 처리의 근간입니다.

---

## Promise란 무엇인가

Promise를 가장 정확하게 표현한 문장은 이것입니다: **"아직 완료되지 않은 작업의 결과를 나타내는 객체"**.

직역하면 "약속"입니다. "나는 이 작업이 끝나면 그 결과나 실패 이유를 전달하겠다고 약속한다"는 계약 같은 것입니다. 중요한 점은 이 약속 객체 자체를 변수에 담고, 전달하고, 나중에 쓸 수 있다는 겁니다.

```js
const promise = new Promise((resolve, reject) => {
  setTimeout(() => resolve("완료!"), 1000);
});

promise.then((value) => console.log(value)); // 1초 후 "완료!"
```

`new Promise(executor)`로 생성합니다. executor 함수는 즉시 실행되며, `resolve`와 `reject` 두 함수를 인자로 받습니다. 작업이 성공하면 `resolve(값)`을, 실패하면 `reject(이유)`를 호출합니다.

---

## 세 가지 상태

Promise는 딱 세 가지 상태만 가집니다.

![Promise 상태 전이 다이어그램 — Pending, Fulfilled, Rejected](/assets/posts/js-promise-states.svg)

**Pending(대기)**은 초기 상태입니다. executor가 실행 중이거나 아직 결과가 나오지 않은 상태입니다.

**Fulfilled(이행)**은 `resolve`가 호출된 상태입니다. 성공 값을 가지며, `.then()` 핸들러가 호출됩니다.

**Rejected(거부)**는 `reject`가 호출되거나 executor 내부에서 예외가 던져진 상태입니다. 실패 이유를 가지며, `.catch()` 핸들러가 호출됩니다.

한 번 Fulfilled나 Rejected가 되면 상태는 **변하지 않습니다**. 이미 이행된 Promise에 아무리 `resolve`나 `reject`를 다시 호출해도 상태는 고정입니다. 이것이 콜백 패턴과의 결정적 차이입니다. 콜백은 여러 번 호출될 수 있지만, Promise는 한 번만 settle됩니다.

---

## 제어의 역전 해소

Promise가 콜백 패턴의 제어의 역전 문제를 어떻게 해결하는지 살펴봅시다.

콜백 방식에서는 "함수를 넘기고 나서 상대방이 그것을 호출한다"는 구조였습니다. Promise는 반대입니다. 나는 함수를 넘기지 않습니다. 대신 상대방이 Promise 객체를 반환하고, 나는 그 객체를 통해 결과를 **요청**합니다.

```js
// 콜백: 제어를 넘긴다
thirdPartyLib.doSomething(data, myCallback);

// Promise: 값을 받아서 내가 처리한다
const p = thirdPartyLib.doSomething(data);
p.then(result => handle(result));
```

신뢰할 수 없는 라이브러리가 `.then()`을 몇 번 호출할지 걱정할 필요가 없습니다. Promise 명세가 보장합니다. 이행 핸들러는 정확히 한 번, 비동기적으로 호출됩니다.

---

## 체이닝 — 비동기의 흐름을 선형으로

Promise의 가장 강력한 특성은 **체이닝**입니다. `.then()`은 새 Promise를 반환하기 때문에 연속해서 연결할 수 있습니다.

![Promise 체이닝 — 성공 경로와 오류 경로](/assets/posts/js-promise-chaining.svg)

각 `.then()`은 이전 단계의 값을 받아서 다음 단계로 전달합니다. 핸들러에서 값을 반환하면 그 값이 다음 `.then()`으로 흘러갑니다. 핸들러에서 Promise를 반환하면 그 Promise가 resolve될 때까지 기다린 후 다음으로 이동합니다.

```js
fetch("/api/user")
  .then((res) => res.json())
  .then((user) => getOrders(user.id))
  .then((orders) => render(orders))
  .catch((err) => showError(err));
```

콜백 헬과 비교하면 극적인 차이입니다. 들여쓰기 깊이가 일정하고, 흐름이 위에서 아래로 읽힙니다. 오류 처리는 체인 끝의 `.catch()` 하나로 중앙화됩니다. 어디서 오류가 발생하든 `.catch()`로 수렴합니다.

---

## 오류 전파 메커니즘

`.catch()`가 체인 끝에 하나만 있어도 되는 이유를 이해하는 것이 중요합니다.

체인 중간 어디서든 오류가 발생하면, 그 이후의 `.then()` 핸들러들은 모두 건너뜁니다. 오류는 체인을 따라 흘러 내려가다가 처음 만나는 `.catch()`에서 포착됩니다.

```js
fetch("/api/user")
  .then((res) => {
    throw new Error("파싱 실패"); // 의도적 예외
  })
  .then((data) => process(data))  // 건너뜀
  .then((result) => render(result)) // 건너뜀
  .catch((err) => console.error(err)); // 여기서 포착
```

`.catch()` 자체도 Promise를 반환합니다. catch 핸들러가 정상적으로 완료되면 이후 체인이 이행 경로로 다시 복귀합니다. 이를 이용해 오류 발생 시 기본값을 반환하는 폴백 패턴을 만들 수 있습니다.

---

## 마이크로태스크 큐

Promise 핸들러는 이벤트 루프의 **마이크로태스크 큐**에서 실행됩니다. 이전 글에서 살펴봤듯이, 마이크로태스크 큐는 태스크 큐보다 우선순위가 높습니다. 콜 스택이 비는 순간 바로 실행됩니다.

```js
console.log("1");

Promise.resolve().then(() => console.log("3 (마이크로태스크)"));

setTimeout(() => console.log("4 (태스크)"), 0);

console.log("2");

// 출력 순서: 1, 2, 3, 4
```

이 실행 순서를 이해하면 예상치 못한 동작을 디버깅할 때 크게 도움이 됩니다.

---

## Promise.resolve와 Promise.reject

이미 알고 있는 값으로 이행된 Promise를 즉시 만들어야 할 때 사용합니다.

```js
// 즉시 이행된 Promise
const p1 = Promise.resolve(42);
p1.then((v) => console.log(v)); // 42

// 즉시 거부된 Promise
const p2 = Promise.reject(new Error("실패"));
p2.catch((e) => console.error(e));
```

`Promise.resolve()`는 전달한 값이 이미 Promise인 경우 그것을 그대로 반환합니다. 동기/비동기가 섞인 인터페이스를 통일할 때 유용합니다.

---

## 정적 메서드 — 여러 Promise 조합

Promise는 여러 비동기 작업을 조합하는 정적 메서드를 제공합니다.

`Promise.all([...])` — 배열의 모든 Promise가 이행되면 결과 배열로 이행됩니다. 하나라도 거부되면 즉시 거부됩니다. 독립적인 여러 요청을 병렬로 처리할 때 씁니다.

`Promise.allSettled([...])` — 모든 Promise가 완료(이행 또는 거부)되면, 각각의 상태와 결과를 담은 배열로 이행됩니다. ES2020에서 추가되었습니다. 실패해도 다른 작업을 중단하면 안 될 때 유용합니다.

`Promise.race([...])` — 가장 먼저 settle된 Promise의 결과(이행이든 거부든)를 따릅니다. 타임아웃 구현에 자주 씁니다.

`Promise.any([...])` — 가장 먼저 **이행**된 Promise의 값을 반환합니다. 전부 거부될 때만 `AggregateError`로 거부됩니다. ES2021에 추가되었습니다.

---

## 주의할 점 — Promise를 잊지 마라

Promise 작업에서 가장 흔한 실수는 `.then()`을 호출하지 않거나, 생성한 Promise를 변수에 담지 않아 오류를 놓치는 것입니다.

```js
// 잘못된 예: Promise를 반환하지 않아 체인이 끊김
function loadUser() {
  fetch("/api/user") // Promise를 반환하지 않음!
    .then((res) => res.json());
}

loadUser().then(...); // TypeError!
```

또한 `.catch()`를 붙이지 않은 Promise에서 오류가 발생하면 **UnhandledPromiseRejection** 경고가 납니다. Node.js 최신 버전에서는 프로세스가 종료될 수도 있습니다. 모든 Promise 체인의 끝에는 `.catch()`를 붙이는 습관을 들이는 것이 중요합니다.

---

Promise는 콜백의 제어의 역전 문제를 해결하고, 체이닝으로 비동기 흐름을 선형으로 표현하게 해줍니다. 하지만 여전히 `.then()`과 `.catch()` 메서드를 계속 써야 하고, 복잡한 로직에서는 코드가 길어지는 단점이 있습니다. 다음 글에서는 **async/await**를 살펴봅니다. Promise를 더 동기 코드처럼 자연스럽게 다루는 문법적 완성입니다.

---

**다음 글:** async/await — 비동기를 동기처럼 쓰다

<br>
읽어주셔서 감사합니다. 😊
