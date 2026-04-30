---
title: "스프레드와 나머지 파라미터 완전 정복"
description: "JavaScript ... 문법의 두 얼굴 — 스프레드 연산자로 배열·객체를 펼치고, 나머지 파라미터로 가변 인수를 수집하는 방법과 실전 불변 업데이트 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 11
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "spread", "rest", "스프레드", "나머지파라미터", "불변업데이트", "ES6"]
featured: false
draft: false
---

[지난 글](/posts/js-bitwise/)에서 비트 연산자로 저수준 숫자 처리를 다뤘습니다. 이번에는 ES2015가 가져온 `...` 문법을 집중적으로 살펴봅니다. 같은 점 세 개이지만 **스프레드(spread)**와 **나머지 파라미터(rest parameter)**는 정반대의 동작을 합니다. 스프레드는 배열이나 객체를 펼쳐서 개별 요소로 만들고, 나머지 파라미터는 개별 인수를 모아 배열로 만듭니다.

## 스프레드 연산자 — 이터러블 펼치기

스프레드 연산자는 **이터러블(iterable)** 을 개별 요소로 분해합니다. 배열 리터럴, 함수 호출, 배열 구조 분해 세 가지 위치에서 사용할 수 있습니다.

```javascript
const nums = [1, 2, 3];

// 배열 리터럴
const more = [...nums, 4, 5];      // [1, 2, 3, 4, 5]
const copy = [...nums];            // 얕은 복사

// 함수 호출 인수
Math.max(...nums);                 // 3
console.log(...nums);              // 1 2 3

// 배열 결합
const a = [1, 2];
const b = [3, 4];
const merged = [...a, ...b];      // [1, 2, 3, 4]
```

`...` 앞에는 이터러블이어야 합니다. 문자열, Set, Map, NodeList, 제너레이터 반환값 모두 스프레드 가능합니다.

```javascript
[...'hello'];                     // ['h','e','l','l','o']
[...new Set([1, 2, 2, 3])];       // [1, 2, 3] (중복 제거)
[...new Map([[1,'a']])];          // [[1, 'a']]
```

일반 객체(`{}`)는 이터러블이 아니므로 배열 스프레드에 사용할 수 없습니다. `[...{}]`는 TypeError를 던집니다.

![스프레드 vs 나머지 문법 비교](/assets/posts/js-spread-rest-syntax.svg)

## 객체 스프레드 — 얕은 복사와 병합

ES2018에서 객체 리터럴에도 스프레드가 추가되었습니다. 객체의 **own enumerable** 속성을 복사합니다.

```javascript
const base = { host: 'localhost', port: 3000 };

// 복사 후 필드 추가/덮어쓰기
const dev  = { ...base, debug: true };
const prod = { ...base, port: 443 };

// 병합 — 뒤에 오는 속성이 앞을 덮어씀
const config = { ...defaults, ...userConfig };
```

스프레드 순서가 중요합니다. `{ ...userConfig, debug: false }`는 `userConfig.debug`가 무엇이든 항상 `false`가 됩니다. 기본값 제공 시 `{ ...defaults, ...user }`로, 강제 덮어쓰기 시 `{ ...user, ...overrides }`로 사용합니다.

## 나머지 파라미터 — 가변 인수 수집

나머지 파라미터는 함수 파라미터 목록의 **마지막**에 위치하며, 나머지 인수를 **진짜 배열**로 수집합니다.

```javascript
function sum(first, ...rest) {
  return rest.reduce((acc, n) => acc + n, first);
}
sum(1, 2, 3, 4);   // 10
sum(5);            // 5 (rest는 빈 배열 [])
```

`arguments` 객체와 달리 나머지 파라미터는 진짜 배열이므로 `map`, `filter`, `reduce` 등 배열 메서드를 바로 쓸 수 있습니다. 또한 화살표 함수에서도 사용 가능합니다(화살표 함수에는 `arguments`가 없습니다).

```javascript
const logger = (level, ...messages) => {
  console[level](...messages);
};
logger('warn', 'value:', 42);    // console.warn('value:', 42)
```

나머지 파라미터는 반드시 마지막이어야 합니다. `function f(...a, b)`는 SyntaxError입니다.

## 실전 패턴 — 불변 업데이트

React나 상태 관리 라이브러리에서 불변 업데이트는 스프레드 없이 설명이 어렵습니다.

```javascript
// 배열 — 요소 추가
const addItem  = (arr, item) => [...arr, item];

// 배열 — 특정 인덱스 교체
const replaceAt = (arr, idx, val) =>
  [...arr.slice(0, idx), val, ...arr.slice(idx + 1)];

// 배열 — 인덱스 삭제
const removeAt = (arr, idx) =>
  [...arr.slice(0, idx), ...arr.slice(idx + 1)];

// 객체 — 필드 업데이트
const updateField = (obj, key, val) => ({ ...obj, [key]: val });

// 객체 — 필드 제거 (나머지 파라미터 + 구조 분해)
const omit = (obj, key) => {
  const { [key]: _, ...rest } = obj;
  return rest;
};
```

![스프레드 실전 패턴](/assets/posts/js-spread-rest-patterns.svg)

## 얕은 복사 주의사항

스프레드는 **1단계 깊이**만 복사합니다. 중첩 객체는 참조가 공유됩니다.

```javascript
const state  = { user: { name: 'Kim', age: 30 } };
const next   = { ...state };

next.user.age = 99;
console.log(state.user.age); // 99 — 공유됨!

// 중첩 불변 업데이트
const safe = {
  ...state,
  user: { ...state.user, age: 99 }
};
```

깊은 복사가 필요하다면 `structuredClone(obj)`(ES2022)을 사용하세요. JSON 왕복 방법(`JSON.parse(JSON.stringify(...))`)은 `Date`, `undefined`, `Map`, `Set`, 순환 참조를 처리하지 못합니다.

## 성능 고려사항

스프레드는 내부적으로 이터레이터를 순회하므로 대용량 배열에서는 `Array.prototype.push.apply(target, source)`보다 느릴 수 있습니다. 그러나 가독성 이점이 크고, 보통 수백만 개 이상의 요소가 아니면 실측 차이는 무시할 수준입니다. 먼저 명확한 코드를 작성하고, 프로파일링으로 병목이 확인된 곳에서만 최적화하세요.

---

**지난 글:** [비트 연산자 완전 정복](/posts/js-bitwise/)

**다음 글:** [구조 분해 할당 완전 정복](/posts/js-destructuring/)

<br>
읽어주셔서 감사합니다. 😊
