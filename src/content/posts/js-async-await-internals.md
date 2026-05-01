---
title: "async/await 내부 동작 — 제너레이터와 Promise의 결합"
description: "async/await가 내부적으로 Promise 체이닝으로 변환되는 디슈가링 원리, await의 실행 흐름, 직렬·병렬 패턴, forEach 함정, return/return await 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "async", "await", "Promise", "비동기", "제너레이터", "디슈가링"]
featured: false
draft: false
---

[지난 글](/posts/js-promise-combinators/)에서 Promise.all, allSettled, race, any를 살펴봤습니다. 이번에는 이 모든 Promise 조작을 동기 코드처럼 작성하게 해주는 **async/await**의 내부 동작을 파헤칩니다.

## async 함수는 항상 Promise를 반환

`async` 키워드를 붙이면 그 함수는 **항상 Promise를 반환**합니다.

```js
async function greet() {
  return 'hello'; // fulfilled('hello') 로 자동 래핑
}

greet().then(console.log); // 'hello'
```

명시적으로 Promise를 반환해도 됩니다. 이미 Promise라면 그대로 전달되고(동화 규칙), 원시 값이면 `fulfilled(value)`로 래핑됩니다.

## await의 정확한 동작

`await` 표현식에 도달하면 다음이 일어납니다.

1. **현재 async 함수 실행 일시 중지** — 나머지 코드로 제어권 반환
2. **이벤트 루프가 다른 태스크 처리 가능**
3. **await 대상 Promise가 settled 되면** 마이크로태스크로 재개
4. fulfilled면 값이 표현식 결과, rejected면 예외로 전파

```js
async function demo() {
  console.log('A');
  const val = await Promise.resolve(42); // 여기서 일시 중지
  console.log('C:', val);
}

demo();
console.log('B');
// 출력: A → B → C: 42
```

`'B'`가 `'C'` 앞에 오는 이유는 `await` 이후 코드가 마이크로태스크로 예약되기 때문입니다.

## async/await 디슈가링

![async/await 디슈가링 — Promise 체이닝과 비교](/assets/posts/js-async-await-internals-desugaring.svg)

`async/await`는 제너레이터 + Promise를 결합한 문법 설탕입니다. 트랜스파일러(Babel)는 이를 `.then` 체이닝으로 변환합니다.

```js
// async/await
async function loadData(id) {
  const user = await fetchUser(id);
  const posts = await fetchPosts(user.id);
  return posts;
}

// 근사적 동등물 (단순화)
function loadData(id) {
  return fetchUser(id)
    .then(user => fetchPosts(user.id))
    .then(posts => posts);
}
```

실제로는 제너레이터 프로토콜을 사용하거나, 최신 엔진은 네이티브로 최적화합니다.

## 직렬 vs 병렬 — 흔한 성능 함정

![직렬 await와 병렬 처리 패턴](/assets/posts/js-async-await-internals-traps.svg)

```js
// 직렬 (잘못된 패턴 — 순서 의존성 없을 때)
const a = await fetchA(); // fetchA 완료까지 대기
const b = await fetchB(); // 그 다음 fetchB 시작

// 병렬 (올바른 패턴)
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

두 요청이 독립적이라면 `Promise.all`로 병렬화해야 합니다. 직렬 패턴은 두 요청의 실행 시간이 합산됩니다.

```js
// 선 시작, 후 await — 병렬성 보장
const pA = fetchA();
const pB = fetchB(); // fetchA 완료 기다리지 않고 즉시 시작
const a = await pA;
const b = await pB;
```

## forEach 함정

`Array.prototype.forEach`는 비동기를 인식하지 못합니다.

```js
// 잘못된 패턴 — forEach는 반환된 Promise를 무시
items.forEach(async (item) => {
  await process(item); // 에러가 전파되지 않음
});
// forEach는 완료를 기다리지 않음

// 순차 처리
for (const item of items) {
  await process(item);
}

// 병렬 처리
await Promise.all(items.map(item => process(item)));
```

## return vs return await

함수 마지막에 `return await`를 쓰면 스택 트레이스가 개선되지만 성능에는 차이가 없습니다.

```js
// return promise (try/catch 맥락 없을 때 동일)
async function fetchDirect() {
  return fetchData(); // 에러가 함수 외부에서 발생
}

// return await (try/catch와 함께 — 차이 있음)
async function fetchWithCatch() {
  try {
    return await fetchData(); // 에러가 여기 catch로 잡힘
  } catch (e) {
    handleError(e);
  }
}
```

`try/catch` 블록 안에서 `return await`를 생략하면 catch가 작동하지 않습니다. `try/catch` 안에서는 항상 `return await`를 쓰세요.

## 최상위 await (Top-Level Await)

ES2022부터 모듈 최상위 레벨에서 `await`를 사용할 수 있습니다.

```js
// module.js
const config = await fetch('/config.json').then(r => r.json());
export const API_URL = config.apiUrl;
```

이를 import하는 모듈은 해당 모듈이 완전히 초기화될 때까지 자동으로 대기합니다. CJS에서는 불가하며 ESM에서만 동작합니다.

---

**지난 글:** [Promise 조합 — all·allSettled·race·any](/posts/js-promise-combinators/)

**다음 글:** [async/await 에러 처리 패턴 — try/catch·에러 래핑·fallback](/posts/js-async-error-handling/)

<br>
읽어주셔서 감사합니다. 😊
