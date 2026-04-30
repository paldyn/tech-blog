---
title: "객체 순회 완전 정복 — for...in부터 Reflect.ownKeys까지"
description: "JavaScript 객체를 순회하는 6가지 방법(for...in, Object.keys/values/entries, for...of, Reflect.ownKeys)의 차이와 실무 선택 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 21
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "object", "for-in", "Object.keys", "Object.entries", "Reflect.ownKeys", "enumerable", "iteration"]
featured: false
draft: false
---

[지난 글](/posts/js-object-cloning-structured/)에서 객체 복사의 다양한 방법을 살펴봤습니다. 복사만큼 자주 쓰이는 작업이 바로 **순회(iteration)**입니다. JavaScript에는 객체 프로퍼티를 열거하는 방법이 여러 가지 있고, 각각 프로토타입 체인 포함 여부, Symbol 키 처리 방식, 반환 타입이 제각각입니다. 잘못 고르면 의도치 않은 프로퍼티가 섞이거나 Symbol 키가 누락될 수 있습니다.

![객체 순회 메서드 비교](/assets/posts/js-object-iteration-methods.svg)

## 열거 가능(enumerable) 이란

JavaScript의 모든 프로퍼티는 **프로퍼티 디스크립터**를 가집니다. 그 중 `enumerable` 플래그가 `false`이면 `for...in`, `Object.keys()` 같은 열거 기반 API에서 무시됩니다.

```javascript
const obj = {};
Object.defineProperty(obj, 'hidden', {
  value: 42,
  enumerable: false,
});

console.log(obj.hidden);        // 42 (접근은 가능)
console.log(Object.keys(obj));  // [] (열거 불가)
for (const k in obj) {
  console.log(k); // 출력 없음
}
```

배열 메서드(`map`, `filter` 등)나 JSON.stringify가 무시하는 프로퍼티도 같은 이유입니다. 반면 `Reflect.ownKeys()`는 enumerable 여부와 무관하게 자신의 모든 키를 반환합니다.

## for...in — 프로토타입 체인까지 열거

`for...in`은 열거 가능한 프로퍼티를 **프로토타입 체인을 포함**해서 순회합니다. 오래된 코드에서 자주 보이지만 현대 실무에서는 사용을 자제하는 편이 좋습니다.

```javascript
function Animal(name) { this.name = name; }
Animal.prototype.type = 'animal';

const dog = new Animal('바둑이');
for (const key in dog) {
  console.log(key); // name, type (프로토타입 포함!)
}

// 자신 소유 프로퍼티만 걸러내려면
for (const key in dog) {
  if (Object.hasOwn(dog, key)) {
    console.log(key); // name 만 출력
  }
}
```

`for...in`을 쓸 때는 반드시 `Object.hasOwn()` 가드를 달아야 합니다. 그렇지 않으면 서드파티 라이브러리가 `Object.prototype`을 건드린 경우 예상치 못한 키가 섞입니다.

## Object.keys / values / entries

ES5에서 도입된 세 API는 **자신의 소유(own) 열거 가능 프로퍼티**만 다루며, 프로토타입 체인을 따라가지 않습니다.

```javascript
const person = { name: 'Alice', age: 30 };

Object.keys(person);    // ['name', 'age']
Object.values(person);  // ['Alice', 30]
Object.entries(person); // [['name', 'Alice'], ['age', 30]]
```

셋 중 `Object.entries()`가 가장 유연합니다. 키와 값을 동시에 받아 구조 분해 할당과 궁합이 좋고, `Map` 생성자에도 바로 넘길 수 있습니다.

```javascript
// 구조 분해 + for...of 조합
for (const [key, value] of Object.entries(person)) {
  console.log(`${key}: ${value}`);
}

// 객체 → Map 변환
const map = new Map(Object.entries(person));
```

![for...in vs Object.entries() 코드 비교](/assets/posts/js-object-iteration-code.svg)

## Reflect.ownKeys — Symbol까지 포함

`Object.keys()`는 문자열 키만 반환하고 Symbol 키를 무시합니다. Symbol 키까지 모두 가져오려면 `Reflect.ownKeys()`를 사용합니다.

```javascript
const sym = Symbol('id');
const obj = { name: 'Bob', [sym]: 42 };

Object.keys(obj);            // ['name']
Object.getOwnPropertyNames(obj); // ['name']
Reflect.ownKeys(obj);        // ['name', Symbol(id)]
```

`Reflect.ownKeys()`는 열거 불가능한 프로퍼티도 반환합니다. 즉, 프로토타입 체인은 제외하고, Symbol 포함, enumerable 무관하게 **자신의 모든 키**를 반환합니다.

## 실무에서 어떤 걸 써야 할까

실무에서 객체를 순회하는 경우 90% 이상은 `Object.entries()` + `for...of` 조합이면 충분합니다.

| 상황 | 추천 |
|---|---|
| 키·값 쌍 모두 필요 | `Object.entries()` |
| 키만 필요 | `Object.keys()` |
| 값만 필요 | `Object.values()` |
| Symbol 키 포함 | `Reflect.ownKeys()` |
| 프로토타입 포함 (레거시 코드 분석) | `for...in` + hasOwn 가드 |

**변환 파이프라인**에 특히 유용한 패턴: 객체를 entries로 풀고, 배열 메서드로 변환한 뒤, `Object.fromEntries()`로 다시 조립하는 방식입니다.

```javascript
const prices = { apple: 1200, banana: 800, cherry: 3000 };

// 값이 1000 이상인 것만 필터링 + 10% 인상
const result = Object.fromEntries(
  Object.entries(prices)
    .filter(([, v]) => v >= 1000)
    .map(([k, v]) => [k, v * 1.1])
);
// { apple: 1320, cherry: 3300 }
```

## for...of로 직접 순회하려면

일반 객체(plain object)는 이터러블이 아니므로 `for...of`로 직접 순회할 수 없습니다. `Object.entries()`나 `Object.values()`가 반환하는 배열을 거쳐야 합니다.

```javascript
const data = { a: 1, b: 2 };

// 에러: data is not iterable
// for (const x of data) { ... }

// 올바른 방법
for (const [k, v] of Object.entries(data)) {
  console.log(k, v);
}
```

직접 `for...of`를 지원하려면 객체에 `Symbol.iterator`를 구현해야 하는데, 이는 [이터러블 프로토콜](/posts/js-iterable-protocol/) 글에서 자세히 다룹니다.

## 순서 보장

ES2015 이후 스펙에서 프로퍼티 순서는 다음 규칙을 따릅니다.

1. 정수 인덱스(양의 정수 문자열): 오름차순 정렬
2. 문자열 키: 삽입 순서
3. Symbol 키: 삽입 순서

```javascript
const obj = { b: 2, '10': 10, a: 1, '2': 2 };
Object.keys(obj); // ['2', '10', 'b', 'a']
// 정수 키(2, 10)가 먼저 오름차순, 나머지는 삽입 순서
```

이 순서는 V8, SpiderMonkey, JavaScriptCore 모두 동일하게 구현합니다.

---

**지난 글:** [객체 복사 완전 가이드 — 얕은 복사부터 structuredClone까지](/posts/js-object-cloning-structured/)

**다음 글:** [클래스 문법 입문 — ES6 class 키워드 완전 이해](/posts/js-class-syntax/)

<br>
읽어주셔서 감사합니다. 😊
