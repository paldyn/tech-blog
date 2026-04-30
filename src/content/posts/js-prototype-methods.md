---
title: "프로토타입 메서드 총정리 — 객체 탐색과 복제 도구"
description: "Object.keys/values/entries, getOwnPropertyNames, Reflect.ownKeys, Object.assign, structuredClone 등 객체를 탐색하고 복제하는 주요 메서드를 비교·정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 19
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "Object.keys", "Object.entries", "Reflect.ownKeys", "Object.assign", "structuredClone", "prototype-methods"]
featured: false
draft: false
---

[지난 글](/posts/js-prototype-inheritance/)에서 `extends`와 `super`가 구성하는 두 개의 prototype 체인을 살펴봤습니다. 이번에는 JavaScript 개발에서 자주 사용하는 `Object` 정적 메서드들을 카테고리별로 정리합니다. 각 메서드가 **어느 범위까지 탐색하는지**, **무엇을 포함하는지** 명확히 파악하면 의도치 않은 버그를 예방할 수 있습니다.

---

## 열거 범위 메서드 비교

```javascript
const proto = { inherited: 1 };
const obj = Object.create(proto);
obj.own = 2;

const sym = Symbol('s');
Object.defineProperty(obj, sym, { value: 3, enumerable: true });
Object.defineProperty(obj, 'hidden', { value: 4, enumerable: false });

// for...in: 열거 가능 + 체인 포함
for (const k in obj) k; // 'own', 'inherited'

// Object.keys: 열거 가능 own 키만
Object.keys(obj); // ['own']

// Object.values: 열거 가능 own 값만
Object.values(obj); // [2]

// Object.entries: 열거 가능 own [k, v] 쌍
Object.entries(obj); // [['own', 2]]

// getOwnPropertyNames: non-enumerable 포함, Symbol 제외
Object.getOwnPropertyNames(obj); // ['own', 'hidden']

// getOwnPropertySymbols: Symbol 키만
Object.getOwnPropertySymbols(obj); // [Symbol(s)]

// Reflect.ownKeys: 모든 own 키 (non-enum + Symbol 포함)
Reflect.ownKeys(obj); // ['own', 'hidden', Symbol(s)]
```

![열거 범위 비교](/assets/posts/js-prototype-methods-iteration.svg)

---

## Object.fromEntries — entries의 역변환

```javascript
// entries → 객체
const map = new Map([['a', 1], ['b', 2]]);
Object.fromEntries(map); // { a: 1, b: 2 }

// 객체 변환 파이프라인
const prices = { apple: 100, banana: 50, cherry: 200 };
const discounted = Object.fromEntries(
  Object.entries(prices).map(([k, v]) => [k, v * 0.9])
);
// { apple: 90, banana: 45, cherry: 180 }
```

---

## Object.assign — 얕은 복사

```javascript
const defaults = { color: 'red', size: 'M', visible: true };
const custom = { color: 'blue', extra: 'value' };

const merged = Object.assign({}, defaults, custom);
// { color: 'blue', size: 'M', visible: true, extra: 'value' }
// color: custom이 defaults를 덮어씀

// 주의: getter는 실행된 값으로 복사됨
const src = {
  _x: 10,
  get x() { return this._x * 2; }
};
const copy = Object.assign({}, src);
copy.x; // 20 (숫자, getter 사라짐)
```

---

## Object.hasOwn — 안전한 own 프로퍼티 확인

```javascript
// 구형: hasOwnProperty (Object.create(null)에서 위험)
const dict = Object.create(null);
dict.key = 'value';
// dict.hasOwnProperty('key'); // TypeError: not a function

// 신형: Object.hasOwn (ES2022, 어디서나 안전)
Object.hasOwn(dict, 'key');   // true
Object.hasOwn(dict, 'other'); // false

// 일반 객체에서도 동일하게 사용
const obj = { a: 1 };
Object.hasOwn(obj, 'a');          // true
Object.hasOwn(obj, 'toString');   // false (prototype에 있음)
```

![Object 정적 메서드 분류](/assets/posts/js-prototype-methods-overview.svg)

---

## isPrototypeOf와 instanceof

```javascript
class Animal {}
class Dog extends Animal {}
const dog = new Dog();

// isPrototypeOf: 프로토타입 체인에 있는지 검사
Animal.prototype.isPrototypeOf(dog);  // true
Dog.prototype.isPrototypeOf(dog);     // true
Object.prototype.isPrototypeOf(dog);  // true

// instanceof: 내부적으로 Symbol.hasInstance 또는 prototype 비교
dog instanceof Dog;    // true
dog instanceof Animal; // true
```

두 방법의 차이는 `instanceof`가 `Symbol.hasInstance`를 통해 커스터마이징 가능하다는 점입니다.

```javascript
class Range {
  static [Symbol.hasInstance](val) {
    return typeof val === 'number' && val >= 0 && val <= 100;
  }
}

50 instanceof Range; // true
150 instanceof Range; // false
```

---

## Object.getOwnPropertyDescriptor(s)

```javascript
const obj = { x: 1 };
Object.defineProperty(obj, 'y', { value: 2, enumerable: false });

// 단일 프로퍼티 디스크립터
Object.getOwnPropertyDescriptor(obj, 'x');
// { value: 1, writable: true, enumerable: true, configurable: true }

Object.getOwnPropertyDescriptor(obj, 'y');
// { value: 2, writable: false, enumerable: false, configurable: false }

// 모든 프로퍼티 디스크립터
Object.getOwnPropertyDescriptors(obj);
// { x: {...}, y: {...} }
```

---

## 프로퍼티 순서

`Object.keys`, `for...in` 등이 프로퍼티를 반환하는 순서는 ECMAScript 명세에 정의된 규칙을 따릅니다.

```javascript
const obj = { b: 1, a: 2, 2: 3, 1: 4, c: 5 };
Object.keys(obj);
// ['1', '2', 'b', 'a', 'c']
// 정수 인덱스 키 먼저 (숫자 오름차순)
// 그 다음 문자열 키 (삽입 순서)
// Symbol 키는 별도로 getOwnPropertySymbols로 접근
```

이 순서는 `Reflect.ownKeys`에도 적용됩니다.

다음 글에서는 객체를 복사하는 다양한 방법과 `structuredClone`의 깊은 복사 메커니즘을 살펴봅니다.

---

**지난 글:** [프로토타입 상속 심화 — extends와 super의 내부 동작](/posts/js-prototype-inheritance/)

**다음 글:** [객체 복사 완전 가이드 — 얕은 복사부터 structuredClone까지](/posts/js-object-cloning-structured/)

<br>
읽어주셔서 감사합니다. 😊
