---
title: "Object.groupBy() — 배열 그룹화"
description: "ES2024 Object.groupBy()와 Map.groupBy()로 배열을 키 기준으로 분류하는 방법, reduce를 사용하던 기존 방식과의 비교, 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ES2024", "Object.groupBy", "Map.groupBy", "배열", "그룹화", "분류"]
featured: false
draft: false
---

[지난 글](/posts/js-structured-clone/)에서 `structuredClone()`을 살펴봤습니다. 이번에는 ES2024에 추가된 **`Object.groupBy()`**와 **`Map.groupBy()`**를 다룹니다. 배열을 특정 기준으로 분류하는 작업을 위해 매번 `reduce()`를 직접 구현하던 번거로움을 해결하는 내장 메서드입니다.

## 배열 그룹화란?

배열 요소를 어떤 기준(카테고리, 상태, 범위 등)에 따라 분류해 각 그룹별 배열로 묶는 작업입니다.

```javascript
// 기존 방식 — reduce로 직접 구현
const grouped = items.reduce((acc, item) => {
  const key = item.status;
  (acc[key] ??= []).push(item);
  return acc;
}, {});
```

매번 이 패턴을 반복하는 대신, `Object.groupBy()`가 같은 작업을 선언적으로 처리합니다.

## Object.groupBy()

![Object.groupBy 그룹화 개념](/assets/posts/js-object-groupby-concept.svg)

`Object.groupBy(iterable, callbackFn)` 형식으로 사용합니다. 콜백이 반환하는 **문자열 키**를 기준으로 요소를 분류하고, **null 프로토타입**을 가진 객체를 반환합니다.

```javascript
const products = [
  { name: '노트북', category: '전자제품', price: 1_200_000 },
  { name: '키보드', category: '전자제품', price: 80_000   },
  { name: '책상',   category: '가구',    price: 350_000   },
  { name: '의자',   category: '가구',    price: 200_000   },
  { name: '마우스', category: '전자제품', price: 40_000   },
];

const byCategory = Object.groupBy(products, p => p.category);

byCategory['전자제품'];
// [노트북, 키보드, 마우스]
byCategory['가구'];
// [책상, 의자]
```

## Map.groupBy()

![Object.groupBy vs Map.groupBy](/assets/posts/js-object-groupby-examples.svg)

키가 **문자열이 아닌 임의 타입**(객체, 숫자 등)이어야 할 때는 `Map.groupBy()`를 사용합니다.

```javascript
const EXPENSIVE = { label: '고가', min: 500_000 };
const MIDRANGE  = { label: '중가', min: 100_000 };
const BUDGET    = { label: '저가', min: 0        };

const byPriceRange = Map.groupBy(products, p => {
  if (p.price >= 500_000) return EXPENSIVE;
  if (p.price >= 100_000) return MIDRANGE;
  return BUDGET;
});

byPriceRange.get(EXPENSIVE); // [노트북]
byPriceRange.get(MIDRANGE);  // [책상]
byPriceRange.get(BUDGET);    // [키보드, 의자, 마우스]
```

## null 프로토타입 반환의 의미

`Object.groupBy()`가 반환하는 객체는 `Object.create(null)`로 만들어진 null 프로토타입 객체입니다.

```javascript
const g = Object.groupBy(['a', 'b', 'a'], x => x);
Object.getPrototypeOf(g); // null

// 주의: hasOwnProperty 같은 메서드 없음
g.hasOwnProperty; // undefined
// Object.hasOwn()을 사용해야 함
Object.hasOwn(g, 'a'); // true
```

## 다양한 그룹화 기준

```javascript
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// 홀수/짝수
const byParity = Object.groupBy(numbers,
  n => n % 2 === 0 ? 'even' : 'odd'
);
// { even: [2,4,6,8,10], odd: [1,3,5,7,9] }

// 범위별
const byRange = Object.groupBy(numbers, n => {
  if (n <= 3)  return 'low';
  if (n <= 7)  return 'mid';
  return 'high';
});
// { low: [1,2,3], mid: [4,5,6,7], high: [8,9,10] }
```

## 이터러블 지원

두 메서드는 배열뿐만 아니라 `Set`, `Map`, 제너레이터 등 모든 이터러블을 첫 번째 인자로 받습니다.

```javascript
const set = new Set(['apple', 'banana', 'avocado', 'blueberry']);

const byFirstLetter = Object.groupBy(set, s => s[0]);
// { a: ['apple', 'avocado'], b: ['banana', 'blueberry'] }
```

## 지원 환경

Chrome 117+, Firefox 119+, Safari 17.4+, Node.js 21+에서 지원됩니다. 이전 환경에서는 `core-js`의 폴리필 또는 `Array.prototype.reduce()`로 대체할 수 있습니다.

---

**지난 글:** [structuredClone()](/posts/js-structured-clone/)

**다음 글:** [배열 불변 메서드 (toSorted, toReversed, with)](/posts/js-array-immutable-methods/)

<br>
읽어주셔서 감사합니다. 😊
