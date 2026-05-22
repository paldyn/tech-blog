---
title: "펑터와 모나드 입문 — 함수형 프로그래밍의 핵심 추상"
description: "펑터(Functor)와 모나드(Monad)의 개념을 JavaScript의 Array, Promise, Optional Chaining을 통해 실용적으로 설명합니다. 수학 이론 없이 코드로 이해하는 FP 핵심 추상."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "함수형프로그래밍", "Functor", "Monad", "Maybe", "FP", "체인"]
featured: false
draft: false
---

[지난 글](/posts/fp-pure-immutable/)에서 순수 함수와 불변성의 토대를 다뤘습니다. 이번에는 함수형 프로그래밍에서 자주 등장하는 두 추상 개념, **펑터(Functor)** 와 **모나드(Monad)** 를 살펴봅니다. 수학적 정의보다는 JavaScript 코드로 직관적으로 이해하는 데 집중합니다.

## 펑터(Functor)

펑터는 간단히 말해 **`map` 메서드를 가진 컨테이너**입니다. 컨테이너 안의 값에 함수를 적용하고, 결과를 같은 종류의 컨테이너에 담아 돌려줍니다.

![펑터와 모나드 개념](/assets/posts/fp-functor-monad-intro-concept.svg)

```js
// Array는 펑터 — map이 있음
[1, 2, 3].map(x => x * 2); // [2, 4, 6]

// Promise도 펑터 — then이 map 역할
Promise.resolve(5).then(x => x + 1); // Promise<6>
```

펑터의 핵심은 **함수를 컨테이너 안으로 들여보낸다**는 것입니다. 컨테이너의 구조(배열의 길이, Promise의 비동기성 등)는 유지하면서 안의 값만 변환합니다.

### 펑터가 만족해야 할 법칙

```js
// 1. 항등 법칙: map(x => x) === 원본과 동일한 구조
arr.map(x => x); // arr와 동일한 값

// 2. 합성 법칙: map(f ∘ g) === map(g).map(f)
arr.map(x => double(increment(x)));
// 아래와 동일
arr.map(increment).map(double);
```

## 모나드(Monad)

모나드는 **펑터에 `flatMap`(또는 `chain`, `bind`) 능력을 추가**한 것입니다. 왜 필요할까요? 펑터의 `map`에 컨테이너를 반환하는 함수를 넣으면 컨테이너가 중첩됩니다.

```js
// 문제: map에 Promise를 반환하는 함수
const doubled = Promise.resolve(5).then(x => Promise.resolve(x * 2));
// doubled는 Promise<Promise<10>> 이 아니라 Promise<10>
// → Promise.then은 자동으로 flatMap처럼 동작 (모나드)
```

JavaScript의 `Promise.then`은 반환값이 Promise면 자동으로 평탄화합니다. 이것이 모나드적 동작입니다.

```js
// Array.flatMap = 모나드의 flatMap
[[1, 2], [3, 4]].flatMap(x => x); // [1, 2, 3, 4]

// 중복 제거 패턴
const words = ['hello world', 'foo bar'];
words.flatMap(s => s.split(' ')); // ['hello', 'world', 'foo', 'bar']
```

## Maybe 모나드 — null 안전 체인

가장 실용적인 모나드 예시는 **Maybe**(또는 Option)입니다. null/undefined 처리를 체이닝 속으로 숨겨줍니다.

![Maybe 모나드 — null 안전 체인](/assets/posts/fp-functor-monad-intro-maybe.svg)

```js
class Maybe {
  constructor(value) {
    this._value = value;
  }

  static of(value) {
    return new Maybe(value);
  }

  isNothing() {
    return this._value == null;
  }

  map(fn) {
    return this.isNothing() ? this : Maybe.of(fn(this._value));
  }

  flatMap(fn) {
    return this.isNothing() ? this : fn(this._value);
  }

  getOrElse(defaultValue) {
    return this.isNothing() ? defaultValue : this._value;
  }
}

// 사용 예
const city = Maybe.of(user)
  .map(u => u.address)
  .map(a => a.city)
  .getOrElse('Unknown');
// 어느 단계에서 null이 나와도 안전
```

JavaScript에는 이미 언어 차원의 Maybe가 있습니다. **Optional Chaining(`?.`)** 과 **Nullish Coalescing(`??`)** 입니다.

```js
// JS 내장 Maybe 패턴
const city = user?.address?.city ?? 'Unknown';
```

## Either 모나드 — 에러를 값으로

Either 모나드는 성공(Right)과 실패(Left)를 명시적으로 구분합니다. 예외 대신 에러를 값으로 처리합니다.

```js
class Either {
  static right(value) { return { type: 'Right', value }; }
  static left(error)  { return { type: 'Left', error }; }

  static map(either, fn) {
    return either.type === 'Right'
      ? Either.right(fn(either.value))
      : either; // Left는 그대로 전파
  }
}

function parseJSON(str) {
  try {
    return Either.right(JSON.parse(str));
  } catch (e) {
    return Either.left(e.message);
  }
}

const result = parseJSON('{"name":"Alice"}');
const name = Either.map(result, obj => obj.name);
// result가 Left였다면 에러가 자동 전파됨
```

## IO 모나드 — 부수효과 격리

IO 모나드는 부수효과가 있는 연산을 **지연 실행**으로 포장해 순수성을 유지합니다.

```js
class IO {
  constructor(fn) { this._fn = fn; }

  static of(value) {
    return new IO(() => value);
  }

  map(fn) {
    return new IO(() => fn(this._fn()));
  }

  run() {
    return this._fn(); // 실제 실행은 명시적으로
  }
}

const readEnv = new IO(() => process.env.NODE_ENV);
const uppercaseEnv = readEnv.map(s => s?.toUpperCase());

// 여기까지는 순수 — 실제 실행이 없음
console.log(uppercaseEnv.run()); // "PRODUCTION"
```

## JavaScript에서의 실용적 접근

순수 FP 라이브러리(`fantasy-land`, `folktale`, `fp-ts`)는 엄격한 모나드 구현을 제공하지만, 대부분의 실무 JavaScript 코드에서는 다음으로 충분합니다.

```js
// Promise 체인 = 모나드 체인
const pipeline = fetch('/api/user')
  .then(res => res.json())
  .then(user => fetchUserPosts(user.id))  // Promise 반환
  .then(posts => posts.filter(p => p.published))
  .catch(err => ({ error: err.message }));

// Optional chaining = Maybe
const value = data?.nested?.deeply?.value ?? 'default';

// Array.flatMap = 배열 모나드
const allTags = posts.flatMap(post => post.tags);
```

## 정리

펑터는 "map을 가진 컨테이너"이고, 모나드는 "flatMap까지 가진 컨테이너"입니다. JavaScript의 Array, Promise, Optional Chaining은 이미 모나드적 패턴을 내장합니다. 커스텀 Maybe/Either 구현은 null 처리와 에러 전파를 선언적으로 다루는 강력한 도구입니다.

---

**지난 글:** [순수 함수와 불변성 — 함수형 프로그래밍의 기초](/posts/fp-pure-immutable/)

**다음 글:** [Ramda와 lodash/fp — 함수형 유틸리티 라이브러리](/posts/fp-ramda-lodash-fp/)

<br>
읽어주셔서 감사합니다. 😊
