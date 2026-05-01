---
title: "Promise 체이닝과 에러 처리 — .then·.catch·.finally"
description: "Promise 체이닝의 값 전달 메커니즘, .catch와 .finally의 정확한 동작, 중첩 안티패턴, return 누락 실수, 에러 복구 패턴을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Promise", "체이닝", ".then", ".catch", ".finally", "에러 처리", "비동기"]
featured: false
draft: false
---

[지난 글](/posts/js-promise-states/)에서 Promise의 세 가지 상태와 상태 불변성을 살펴봤습니다. 이번에는 Promise를 실제로 조합하는 방법인 **체이닝**과 그 과정에서 에러를 처리하는 패턴을 정리합니다.

## .then — 값 변환과 체이닝

`.then(onFulfilled, onRejected)`은 항상 **새 Promise**를 반환합니다. `onFulfilled`가 반환하는 값이 다음 `.then`으로 전달됩니다.

```js
Promise.resolve(1)
  .then(v => v * 2)      // fulfilled(2)
  .then(v => v + 10)     // fulfilled(12)
  .then(console.log);    // 12
```

`.then` 콜백에서 예외가 발생하면 반환되는 Promise는 rejected 상태가 됩니다.

```js
Promise.resolve(1)
  .then(v => { throw new Error('oops'); })
  .catch(e => console.error(e.message)); // 'oops'
```

![Promise 체이닝 값과 에러 흐름](/assets/posts/js-promise-chaining-error-chain.svg)

## return을 빠뜨리면 생기는 문제

체이닝에서 가장 흔한 실수는 `.then` 콜백에서 Promise를 **반환하지 않는** 것입니다.

```js
// 잘못된 패턴
fetchUser(id)
  .then(user => {
    fetchPosts(user.id); // return 없음!
    // fetchPosts가 실패해도 바깥에서 catch 불가
  })
  .then(posts => render(posts)); // posts === undefined

// 올바른 패턴
fetchUser(id)
  .then(user => fetchPosts(user.id)) // return (화살표 함수 암묵 return)
  .then(posts => render(posts));
```

반환된 Promise가 settled 되면 그 값/에러가 다음 `.then`/.catch로 전달됩니다. 반환하지 않으면 다음 단계는 `undefined`를 받습니다.

## .catch — 에러 포착과 복구

`.catch(fn)`은 `.then(undefined, fn)`의 축약입니다. 체인 어느 위치에서든 발생한 rejected 상태를 잡습니다.

```js
fetchUser(id)
  .then(user => fetchPosts(user.id))
  .then(posts => render(posts))
  .catch(err => {
    // fetchUser, fetchPosts, render 어느 단계의 에러도 여기서 처리
    showErrorMessage(err.message);
  });
```

`.catch` 콜백이 값을 반환하면 체인이 fulfilled 상태로 복구됩니다.

```js
fetchData()
  .catch(err => {
    console.warn('Fallback 사용:', err.message);
    return defaultData; // 복구 — 이후 .then은 정상 실행
  })
  .then(data => render(data)); // defaultData 또는 정상 data
```

`.catch` 콜백에서 다시 throw하거나 rejected Promise를 반환하면 에러가 계속 전파됩니다.

## .finally — 정리 작업

`.finally(fn)`은 성공/실패에 무관하게 실행되며, 이전 Promise의 값이나 에러를 **그대로 통과**시킵니다.

```js
showLoading();

fetchData()
  .then(render)
  .catch(showError)
  .finally(hideLoading); // 항상 호출됨, 반환값 무시
```

`.finally`에서 예외가 발생하거나 rejected Promise를 반환하면 그 에러가 체인에 주입됩니다. 정리 함수에서의 예외가 본래 에러를 덮을 수 있으므로 `.finally` 내부는 항상 안전하게 작성해야 합니다.

## 중첩 패턴 vs 평탄 체이닝

![Promise 중첩 vs 평탄 체이닝](/assets/posts/js-promise-chaining-error-nested.svg)

```js
// 피해야 할 중첩 패턴
fetch(url).then(res => {
  res.json().then(data => {      // return 없는 중첩
    process(data).then(show);
  });
});

// 권장: 평탄 체이닝
fetch(url)
  .then(res => res.json())
  .then(data => process(data))
  .then(show)
  .catch(handleError);
```

중첩 패턴은 내부 Promise의 에러가 외부 `.catch`에 전달되지 않고, 코드 가독성도 나빠집니다.

## .then의 두 번째 인자 vs .catch

`.then(onFulfilled, onRejected)`의 `onRejected`는 이전 단계의 에러만 잡고, 같은 `.then`의 `onFulfilled`에서 발생한 에러는 잡지 못합니다.

```js
p.then(
  val => { throw new Error('here'); },
  err => { /* 'here' 에러를 잡지 못함 */ }
);

// .catch를 분리하면 onFulfilled 에러도 잡힘
p.then(val => { throw new Error('here'); })
 .catch(err => console.error(err.message)); // 'here'
```

일반적으로 `.then` 두 번째 인자보다 `.catch`를 분리하는 것이 더 안전하고 의도가 명확합니다.

## 에러 식별

에러 처리 시 어떤 단계에서 실패했는지 구분이 필요하면 커스텀 에러 클래스나 `cause` 필드를 활용합니다.

```js
class NetworkError extends Error {
  constructor(msg, { cause } = {}) {
    super(msg);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

fetchUser(id)
  .catch(err => {
    throw new NetworkError('사용자 로드 실패', { cause: err });
  })
  .catch(err => {
    if (err instanceof NetworkError) {
      // 특정 에러 처리
    }
  });
```

---

**지난 글:** [Promise 상태 — pending·fulfilled·rejected의 전이](/posts/js-promise-states/)

**다음 글:** [Promise 조합 — all·allSettled·race·any](/posts/js-promise-combinators/)

<br>
읽어주셔서 감사합니다. 😊
