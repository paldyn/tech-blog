---
title: "Promise 조합 — all·allSettled·race·any"
description: "Promise.all, allSettled, race, any 네 가지 조합 API의 동작 차이, 각각의 적합한 사용 사례, 타임아웃 패턴, allSettled로 부분 실패 처리하는 실용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Promise", "Promise.all", "Promise.race", "Promise.any", "allSettled", "비동기", "병렬"]
featured: false
draft: false
---

[지난 글](/posts/js-promise-chaining-error/)에서 Promise 체이닝과 에러 처리를 살펴봤습니다. 여러 Promise를 조합해서 병렬로 실행하거나 경쟁시킬 때는 JavaScript가 제공하는 네 가지 정적 메서드를 사용합니다.

## 네 가지 조합 API 한눈에 보기

![Promise 조합 API 비교](/assets/posts/js-promise-combinators-overview.svg)

| API | fulfilled 조건 | rejected 조건 |
|---|---|---|
| `Promise.all` | 전부 fulfilled | 하나라도 rejected |
| `Promise.allSettled` | 전부 settled (항상) | 없음 |
| `Promise.race` | 가장 먼저 settled | 가장 먼저 settled(rejected) |
| `Promise.any` | 가장 먼저 fulfilled | 전부 rejected |

## Promise.all — 전부 성공해야 할 때

```js
const [user, posts, comments] = await Promise.all([
  fetchUser(id),
  fetchPosts(id),
  fetchComments(id),
]);
```

세 요청이 병렬로 실행되며, 하나라도 실패하면 즉시 rejected 됩니다. 순서는 입력 배열 순서를 따릅니다.

중요한 특성: 하나가 rejected 되더라도 **나머지 Promise 자체는 계속 실행**됩니다. 취소 메커니즘은 없습니다(AbortController 사용 필요).

```js
// 에러 처리
try {
  const results = await Promise.all([fetchA(), fetchB()]);
} catch (err) {
  // 먼저 실패한 하나의 에러만 받음
  console.error('어느 하나 실패:', err);
}
```

## Promise.allSettled — 모두 완료될 때까지 기다릴 때

ES2020 추가. 하나가 실패해도 나머지를 기다린 후, 모든 결과를 `{ status, value/reason }` 배열로 반환합니다.

```js
const results = await Promise.allSettled([fetchA(), fetchB(), fetchC()]);

const succeeded = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);

const failed = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason);

console.log('성공:', succeeded.length, '실패:', failed.length);
```

`allSettled`는 절대 rejected가 되지 않으므로 `.catch` 없이 사용해도 안전합니다.

## Promise.race — 가장 빠른 결과가 필요할 때

가장 먼저 settled(fulfilled 또는 rejected)된 Promise의 결과를 반환합니다.

```js
// 타임아웃 구현
function withTimeout(promise, ms) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${ms}ms 초과`)), ms)
  );
  return Promise.race([promise, timer]);
}

const data = await withTimeout(fetchData(), 5000);
```

![타임아웃과 allSettled 실용 패턴](/assets/posts/js-promise-combinators-patterns.svg)

주의: `race`의 패배자 Promise는 계속 실행됩니다. 타임아웃 시 fetch를 실제로 취소하려면 `AbortController`를 함께 사용해야 합니다.

```js
function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}
```

## Promise.any — 하나라도 성공하면 되는 경우

ES2021 추가. 가장 먼저 fulfilled 된 결과를 반환합니다. 모두 rejected 되어야만 `AggregateError`로 rejected 됩니다.

```js
// 여러 CDN 중 가장 빠른 응답 사용
const script = await Promise.any([
  fetch('https://cdn1.example.com/lib.js'),
  fetch('https://cdn2.example.com/lib.js'),
  fetch('https://cdn3.example.com/lib.js'),
]);

// 모두 실패하면
try {
  await Promise.any([fail1(), fail2()]);
} catch (e) {
  console.log(e instanceof AggregateError); // true
  console.log(e.errors); // [err1, err2]
}
```

`Promise.race`는 먼저 rejected 되어도 그 에러가 전파되지만, `Promise.any`는 하나라도 fulfilled 되면 그걸로 resolved 됩니다.

## 빈 배열 처리

각 API가 빈 배열을 받으면 어떻게 되는지 알아두면 버그를 예방할 수 있습니다.

```js
await Promise.all([]);        // fulfilled([]) — 빈 배열로 즉시
await Promise.allSettled([]); // fulfilled([]) — 즉시
await Promise.race([]);       // 영원히 pending (주의!)
await Promise.any([]);        // 즉시 rejected(AggregateError)
```

`Promise.race([])`는 영원히 pending 상태로 남으므로 빈 배열을 넘기지 않도록 주의해야 합니다.

## 병렬 처리 시 주의점

```js
// 직렬 실행 (느림 — 순서 보장 필요 시 사용)
const a = await fetchA();
const b = await fetchB();

// 병렬 실행 (빠름 — 의존성 없을 때 사용)
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

서로 독립적인 비동기 작업은 항상 `Promise.all`로 병렬화하세요. 각 작업의 실행 시간이 `n`ms라면, 직렬은 `n * count`ms, 병렬은 `max(n1, n2, ...)`ms가 걸립니다.

---

**지난 글:** [Promise 체이닝과 에러 처리 — .then·.catch·.finally](/posts/js-promise-chaining-error/)

**다음 글:** [async/await 내부 동작 — 제너레이터와 Promise의 결합](/posts/js-async-await-internals/)

<br>
읽어주셔서 감사합니다. 😊
