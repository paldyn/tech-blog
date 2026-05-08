---
title: "typeof · instanceof의 한계와 올바른 타입 판별"
description: "typeof null === 'object' 버그, instanceof의 cross-realm 문제 등 JavaScript 타입 연산자의 함정과 정확한 타입 판별 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "typeof", "instanceof", "타입판별", "cross-realm", "Array.isArray"]
featured: false
draft: false
---

[지난 글](/posts/js-closure-and-memory/)에서 클로저가 메모리를 붙잡는 구조를 살펴봤습니다. 이번에는 JavaScript에서 값의 타입을 알아내는 두 가지 연산자 `typeof`와 `instanceof`의 동작 방식과 함정, 그리고 올바른 타입 판별 방법을 정리합니다.

## typeof — 연산자와 반환값

`typeof`는 단항 연산자로, 피연산자의 타입을 문자열로 반환합니다. 7가지 값을 반환하며, 선언되지 않은 변수에도 안전하게 사용할 수 있습니다.

```js
typeof 42           // "number"
typeof 'hello'      // "string"
typeof true         // "boolean"
typeof undefined    // "undefined"
typeof Symbol()     // "symbol"
typeof 9n           // "bigint"
typeof function(){} // "function"
typeof {}           // "object"
typeof []           // "object" — 배열도 객체!
typeof null         // "object" ⚠ 유명한 버그
typeof NaN          // "number" ⚠ NaN도 number 타입
```

![typeof — 반환값 표와 함정](/assets/posts/js-typeof-instanceof-limits-typeof.svg)

### typeof null === "object" — 역사적 버그

JavaScript 초기 구현에서 값은 타입 태그와 함께 저장됐습니다. `null`은 null 포인터(`0x00`)를 나타냈고, 객체의 타입 태그도 `000`이었습니다. 따라서 `typeof null`이 `"object"`를 반환하게 됐습니다. **수정 제안이 있었으나 웹 호환성 문제로 영구히 유지됩니다.**

```js
// null 올바른 판별
const isNull = (v) => v === null;

// 미선언 변수 안전 확인
if (typeof window !== 'undefined') {
  // 브라우저 환경
}
// 미선언 변수에 그냥 접근하면 ReferenceError지만
// typeof는 ReferenceError 없이 "undefined" 반환
```

## instanceof — 프로토타입 체인 검사

`instanceof`는 객체의 프로토타입 체인에 생성자 함수의 `prototype`이 존재하는지 확인합니다.

```js
class Animal {}
class Dog extends Animal {}

const d = new Dog();
d instanceof Dog    // true
d instanceof Animal // true  — 체인 탐색
d instanceof Object // true  — 모든 객체의 최상위

// 동작 원리 (단순화)
function instanceOf(obj, Ctor) {
  let proto = Object.getPrototypeOf(obj);
  while (proto !== null) {
    if (proto === Ctor.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

![instanceof 동작과 한계](/assets/posts/js-typeof-instanceof-limits-instanceof.svg)

### 한계 1 — Cross-Realm (iframe, Node.js vm 모듈)

```js
// 브라우저: iframe의 Array는 부모 프레임의 Array와 다름
const iframeArr = iframe.contentWindow.eval('[1, 2, 3]');
iframeArr instanceof Array; // false!
Array.isArray(iframeArr);   // true ✅ — cross-realm 안전

// Node.js vm 모듈도 동일한 문제
const { runInNewContext } = require('vm');
const arr = runInNewContext('[1,2,3]');
arr instanceof Array; // false
Array.isArray(arr);   // true ✅
```

### 한계 2 — 프로토타입 교체

```js
function Foo() {}
const f = new Foo();

Foo.prototype = {}; // 프로토타입 교체

f instanceof Foo; // false — 체인이 이미 끊김
```

### 한계 3 — 원시값에는 항상 false

```js
42 instanceof Number;    // false
'hi' instanceof String;  // false
true instanceof Boolean; // false
// 원시값은 객체가 아니므로 프로토타입 체인 없음
```

## 정밀한 타입 판별: Object.prototype.toString

`Object.prototype.toString.call(v)`는 내부 `[[Class]]` 슬롯을 반영해 정밀한 타입 문자열을 반환합니다. Cross-realm에서도 올바르게 동작합니다.

```js
const type = (v) =>
  Object.prototype.toString.call(v).slice(8, -1).toLowerCase();

type(42)          // "number"
type('hi')        // "string"
type(null)        // "null"
type(undefined)   // "undefined"
type([])          // "array"    — instanceof보다 정확!
type({})          // "object"
type(new Date())  // "date"
type(/regex/)     // "regexp"
type(new Map())   // "map"
type(new Set())   // "set"
type(Promise.resolve()) // "promise"
```

### Symbol.toStringTag로 커스텀 태그

```js
class MyCollection {
  get [Symbol.toStringTag]() { return 'MyCollection'; }
}

const c = new MyCollection();
Object.prototype.toString.call(c); // "[object MyCollection]"
type(c); // "mycollection"
```

## 상황별 권장 방법

```js
// null 판별
v === null

// undefined 판별
v === undefined  또는  typeof v === 'undefined'

// 배열 판별 (가장 중요)
Array.isArray(v)

// 함수 판별
typeof v === 'function'

// 객체 (null·함수 제외) 판별
v !== null && typeof v === 'object' && !Array.isArray(v)

// 정밀한 내장 타입 판별
Object.prototype.toString.call(v)

// TypeScript 사용 시 — 타입 가드 권장
function isDate(v: unknown): v is Date {
  return v instanceof Date && !isNaN(v.getTime());
}
```

## 정리

- `typeof`: 7종 문자열 반환. `null → "object"` 버그, 배열/날짜 모두 `"object"`
- `instanceof`: 프로토타입 체인 검사. cross-realm, 프로토타입 교체, 원시값에서 오동작
- 배열 판별: `Array.isArray()` (cross-realm 안전)
- null 판별: `=== null`
- 정밀 타입: `Object.prototype.toString.call(v)`
- `Symbol.toStringTag`로 사용자 정의 타입 이름 지정 가능

---

**지난 글:** [클로저와 메모리 — 스코프가 메모리를 어떻게 붙잡는가](/posts/js-closure-and-memory/)

**다음 글:** [명시적 형변환 — Number, String, Boolean](/posts/js-explicit-conversion/)

<br>
읽어주셔서 감사합니다. 😊
