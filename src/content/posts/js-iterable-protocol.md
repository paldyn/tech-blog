---
title: "이터러블 프로토콜"
description: "JavaScript 이터러블 프로토콜의 구조와 내장 이터러블 목록, 그리고 Symbol.iterator를 직접 구현해 커스텀 이터러블을 만드는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 32
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "이터러블", "iterable", "Symbol.iterator", "for...of", "프로토콜"]
featured: false
draft: false
---

[지난 글](/posts/js-for-loops/)에서 `for...of`가 배열·문자열·Map·Set을 자유롭게 순회하는 모습을 봤습니다. 이 모든 것이 가능한 이유는 이터러블 프로토콜 덕분입니다. 이번 글에서는 이 프로토콜이 어떻게 설계됐고, 우리가 직접 구현할 수 있는 이유를 살펴봅니다.

## 이터러블이란?

이터러블(Iterable)은 **`[Symbol.iterator]()` 메서드를 가진 객체**입니다. 이 메서드를 호출하면 이터레이터(Iterator)를 반환합니다. `for...of`는 내부적으로 이 메서드를 찾아 호출합니다.

```javascript
const arr = [1, 2, 3];

// for...of가 내부적으로 하는 일
const iterator = arr[Symbol.iterator]();
console.log(iterator.next()); // { value: 1, done: false }
console.log(iterator.next()); // { value: 2, done: false }
console.log(iterator.next()); // { value: 3, done: false }
console.log(iterator.next()); // { value: undefined, done: true }
```

`done: true`가 반환되는 순간 순회가 종료됩니다.

![이터러블 프로토콜 구조](/assets/posts/js-iterable-protocol-overview.svg)

## IteratorResult 객체

`next()`는 두 속성을 가진 일반 객체를 반환합니다.

| 속성 | 타입 | 의미 |
|---|---|---|
| `value` | any | 현재 값. 완료 후에는 보통 `undefined` |
| `done` | boolean | 순회 완료 여부 |

```javascript
// 문자열도 이터러블
const str = 'hi';
const it = str[Symbol.iterator]();
it.next(); // { value: 'h', done: false }
it.next(); // { value: 'i', done: false }
it.next(); // { value: undefined, done: true }
```

## 내장 이터러블

JavaScript의 내장 타입 중 이터러블을 지원하는 것들입니다.

- `Array` — 인덱스 순서로 값
- `String` — 유니코드 코드 포인트 단위 (이모지 등 서로게이트 쌍 지원)
- `Map` — `[key, value]` 쌍을 삽입 순서로
- `Set` — 고유 값을 삽입 순서로
- `TypedArray` — `Uint8Array` 등
- `NodeList` / `HTMLCollection` — DOM 컬렉션
- `arguments` — 함수 내 인자 객체
- 제너레이터 객체 — `yield` 값을 순차 반환

반면 일반 객체(`{}`)는 이터러블이 아닙니다.

```javascript
const obj = { a: 1, b: 2 };
for (const v of obj) {} // TypeError: obj is not iterable
```

## 이터러블을 소비하는 구문

이터러블을 인자로 받는 구문과 함수가 여러 곳에 있습니다.

```javascript
const set = new Set([1, 2, 3]);

// 스프레드
const arr = [...set]; // [1, 2, 3]

// 구조 분해
const [first, second] = set; // 1, 2

// Array.from
const copy = Array.from(set); // [1, 2, 3]

// Map 생성자
const map = new Map([['a', 1], ['b', 2]]);
```

`Promise.all`, `Promise.race`, `Promise.allSettled`도 이터러블을 인자로 받습니다.

## 커스텀 이터러블 구현

`[Symbol.iterator]()` 메서드만 정의하면 어떤 객체든 이터러블로 만들 수 있습니다.

![커스텀 이터러블 구현 예제](/assets/posts/js-iterable-protocol-custom.svg)

```javascript
const range = {
  from: 1,
  to: 5,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        if (current <= last)
          return { value: current++, done: false };
        return { value: undefined, done: true };
      },
    };
  },
};

for (const n of range) console.log(n); // 1 2 3 4 5
console.log([...range]); // [1, 2, 3, 4, 5]
```

## 이터러블이자 이터레이터 (Self-Iterator)

이터레이터 자신이 `[Symbol.iterator]`를 반환하면 스스로가 이터러블이기도 합니다. 이를 **self-iterator** 패턴이라 부릅니다.

```javascript
function makeCounter(limit) {
  let count = 0;
  return {
    [Symbol.iterator]() { return this; }, // self
    next() {
      if (count < limit) return { value: count++, done: false };
      return { value: undefined, done: true };
    },
  };
}

const counter = makeCounter(3);
for (const n of counter) console.log(n); // 0, 1, 2
```

내장 이터레이터들(배열 이터레이터, 맵 이터레이터 등)은 모두 이 패턴을 따릅니다.

## 이터러블의 일회성

이터레이터는 상태를 유지하므로 한 번 소진하면 재사용할 수 없습니다.

```javascript
const arr = [1, 2, 3];
const it = arr[Symbol.iterator]();

for (const n of it) console.log(n); // 1, 2, 3
for (const n of it) console.log(n); // 아무것도 출력되지 않음 (소진됨)

// 반면 이터러블(arr) 자체는 재사용 가능
for (const n of arr) console.log(n); // 다시 1, 2, 3
```

다음 글에서는 이터레이터 프로토콜의 나머지 부분인 `return()`, `throw()` 메서드와 이터레이터를 더 정밀하게 제어하는 방법을 살펴봅니다.

---

**지난 글:** [JavaScript 반복문 완전 정리](/posts/js-for-loops/)

**다음 글:** [이터레이터 프로토콜](/posts/js-iterator-protocol/)

<br>
읽어주셔서 감사합니다. 😊
