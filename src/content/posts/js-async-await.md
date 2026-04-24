---
title: "async/await — 비동기를 동기처럼 쓰다"
description: "ES2017에 도입된 async/await 문법이 Promise 위에서 어떻게 동작하는지, 오류 처리와 실행 흐름, 주의해야 할 함정까지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-24"
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "async", "await", "Promise", "ES2017", "비동기", "에러처리"]
featured: false
draft: false
---

지난 글에서 Promise가 콜백 헬을 어떻게 해결하는지 살펴봤습니다. `.then()` 체이닝으로 비동기 흐름을 선형으로 표현할 수 있게 되었습니다. 그런데 복잡한 로직, 특히 조건 분기나 반복문이 섞이면 `.then()` 체인도 금세 읽기 어려워집니다.

**async/await**는 Promise 위에 씌운 문법적 설탕(syntactic sugar)입니다. ECMAScript 2017(ES8)에서 표준으로 채택되었으며, 비동기 코드를 마치 동기 코드처럼 위에서 아래로 읽고 쓸 수 있게 해줍니다. 내부적으로는 완전히 Promise로 동작합니다. 새로운 비동기 모델이 아니라 더 나은 표현 방법입니다.

---

## async 함수

`async` 키워드를 함수 앞에 붙이면 그 함수는 **항상 Promise를 반환**합니다. 명시적으로 값을 반환하면 그 값으로 이행된 Promise를 반환합니다. 함수 내부에서 예외가 던져지면 그 예외로 거부된 Promise를 반환합니다.

```js
async function greet() {
  return "안녕하세요";
}

greet().then(console.log); // "안녕하세요"
```

`return "안녕하세요"`는 내부적으로 `return Promise.resolve("안녕하세요")`와 동일합니다. async 함수를 호출하면 항상 Promise가 나옵니다. 이것이 async 함수의 계약입니다.

---

## await 키워드

`await`는 `async` 함수 안에서만 쓸 수 있습니다. Promise 앞에 붙이면 그 Promise가 settle될 때까지 **현재 async 함수의 실행을 일시 정지**합니다. Promise가 이행되면 그 값을 반환하고 실행을 재개합니다.

```js
async function loadUser(id) {
  const res = await fetch(`/api/user/${id}`);
  const user = await res.json();
  return user;
}
```

`fetch()`는 Promise를 반환합니다. `await`가 그 Promise를 기다리고, 이행되면 Response 객체를 `res`에 담습니다. 다음 줄도 마찬가지입니다. 마치 동기 코드처럼 읽히지만, 실제로는 비동기로 실행됩니다.

중요한 것은 `await`가 **현재 함수만** 일시 정지시킨다는 점입니다. 이벤트 루프를 막지 않습니다. 다른 작업이 계속 실행될 수 있습니다.

---

## Promise 체이닝과 async/await 비교

![Promise 체이닝 vs async/await — 동일한 로직](/assets/posts/js-async-await-syntax.svg)

두 방식은 완전히 동일하게 동작합니다. async/await는 Promise 체이닝의 다른 표현일 뿐입니다. 차이는 가독성에 있습니다. 특히 중간 결과를 여러 단계에서 참조해야 할 때 async/await가 압도적으로 유리합니다.

```js
// Promise 체이닝 — 중간 값 전달이 어색
fetch("/api/user")
  .then((res) => res.json())
  .then((user) => Promise.all([user, getOrders(user.id)]))
  .then(([user, orders]) => render(user, orders));

// async/await — 중간 값을 변수에 그냥 담으면 됨
const res = await fetch("/api/user");
const user = await res.json();
const orders = await getOrders(user.id);
render(user, orders);
```

---

## 오류 처리

async/await에서 오류 처리는 동기 코드와 동일하게 `try/catch`를 씁니다. `await`하는 Promise가 거부되면 `catch` 블록으로 제어가 이동합니다.

![async/await 에러 처리 패턴 3가지](/assets/posts/js-async-await-error.svg)

**try/catch** 방식이 가장 일반적입니다. 여러 `await` 문을 하나의 `try` 블록으로 감싸서 오류를 한 곳에서 처리합니다.

**await + .catch()** 방식은 특정 단계의 오류만 별도로 처리하고 싶을 때 씁니다. 해당 Promise에만 `.catch()`를 붙여 null을 반환하도록 한 뒤, 이후 코드에서 null 체크를 합니다.

**to() 유틸리티** 방식은 try/catch를 완전히 없애고 싶을 때 씁니다. `[error, data]` 튜플을 반환하는 래퍼 함수를 만들어 Go 언어 스타일로 오류를 처리합니다. `await-to-js` 같은 라이브러리가 이 패턴을 제공합니다.

---

## 실행 흐름 이해하기

async/await의 실행 흐름을 정확히 이해하는 것이 중요합니다.

```js
async function main() {
  console.log("A");
  const result = await Promise.resolve("B");
  console.log(result);
  console.log("C");
}

main();
console.log("D");
```

출력 순서는 A → D → B → C입니다. `await`를 만나면 함수 실행이 일시 정지되고, 제어가 호출자로 돌아갑니다. "D"가 먼저 출력되고, 마이크로태스크 큐에 들어있던 Promise 재개 작업이 처리되면서 "B"와 "C"가 순서대로 출력됩니다.

await는 항상 한 번의 마이크로태스크 처리를 거칩니다. 이미 이행된 Promise를 await해도 즉시 실행되지 않고 마이크로태스크 큐를 거칩니다.

---

## 흔한 함정 — for 루프와 await

async/await에서 가장 많이 실수하는 부분이 배열 순회입니다.

```js
// 잘못된 예: forEach는 await를 기다리지 않음
async function processAll(items) {
  items.forEach(async (item) => {
    await process(item); // 이 await는 forEach 콜백 내부에만 영향
  });
  // 이 시점에 process가 완료됐다고 보장할 수 없음!
}

// 올바른 예: for...of는 await를 정확히 기다림
async function processAll(items) {
  for (const item of items) {
    await process(item);
  }
}
```

`forEach`에 async 콜백을 넘기면 각 콜백은 독립적인 async 함수가 됩니다. `forEach`는 그 반환된 Promise들을 기다리지 않습니다. 순차 처리가 필요하면 반드시 `for...of`나 `for` 루프를 써야 합니다.

---

## 병렬 처리와 await

async/await를 쓰다 보면 무의식적으로 모든 것을 순차적으로 실행하는 실수를 합니다.

```js
// 비효율: 2초 소요
const a = await fetchA(); // 1초
const b = await fetchB(); // 1초

// 효율적: 1초 소요
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

A와 B가 서로 독립적이라면 동시에 시작해야 합니다. `await`를 연달아 쓰면 앞 작업이 완료된 후에야 다음 작업이 시작됩니다. 독립적인 작업은 `Promise.all()`로 묶어 병렬 실행해야 합니다.

---

## 최상위 await (Top-level await)

ES2022부터 ES 모듈(`.mjs` 또는 `type="module"`) 최상위 레벨에서 `await`를 쓸 수 있게 되었습니다. 모듈 로딩 단계에서 비동기 초기화를 수행할 때 유용합니다.

```js
// config.mjs
const config = await fetch("/api/config").then((r) => r.json());
export default config;
```

이 모듈을 import하는 쪽은 `config`가 완전히 로드된 후에야 모듈을 사용할 수 있습니다. 데이터베이스 연결, 설정 파일 로딩 같은 초기화 코드를 모듈 수준에서 처리할 때 편리합니다.

---

## async 함수가 Promise를 반환하는 함의

async 함수가 Promise를 반환한다는 사실을 잊으면 버그가 생깁니다.

```js
async function getUser() {
  return { name: "지민" };
}

const user = getUser(); // Promise, not { name: "지민" }!
console.log(user.name); // undefined
```

async 함수의 결과를 쓰려면 반드시 `await`하거나 `.then()`을 써야 합니다. 이것이 비동기 함수를 동기처럼 쓸 수 없는 근본적인 이유입니다. async/await는 비동기를 편하게 쓰는 도구이지, 비동기를 동기로 바꾸는 마법이 아닙니다.

---

async/await는 Promise의 힘을 유지하면서도 코드의 가독성을 극적으로 높여줍니다. `try/catch`로 오류를 처리하고, 일반 변수에 결과를 담으며, 조건문과 반복문을 자유롭게 쓸 수 있습니다. 단, 병렬 처리와 실행 흐름을 정확히 이해해야 합니다. 다음 글에서는 **비동기 패턴들** — 순차/병렬/재시도/타임아웃 등 실전에서 자주 마주치는 패턴들을 체계적으로 정리합니다.

---

**다음 글:** 비동기 패턴 — 병렬, 순차, 재시도, 타임아웃

<br>
읽어주셔서 감사합니다. 😊
