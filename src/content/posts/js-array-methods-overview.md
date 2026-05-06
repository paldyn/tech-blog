---
title: "배열 메서드 총람 — 순회·변환·검색·집계"
description: "JavaScript 배열의 주요 메서드를 순회·변환·검색·집계·정렬·구조변경으로 분류하고, map·filter·reduce 체이닝 패턴과 각 메서드의 특성을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Array", "map", "filter", "reduce", "배열메서드", "체이닝"]
featured: false
draft: false
---

[지난 글](/posts/js-nan-comparison/)에서 NaN과 특수 숫자값의 비교 동작을 살펴봤습니다. 이번에는 JavaScript 배열이 제공하는 메서드들을 체계적으로 분류합니다. 배열 메서드는 종류가 많아 혼란스러울 수 있지만, 역할에 따라 분류하면 어떤 상황에 무엇을 써야 하는지 명확해집니다.

---

## 카테고리로 보는 배열 메서드

![배열 메서드 카테고리 맵](/assets/posts/js-array-methods-overview-map.svg)

배열 메서드는 크게 **원본을 변경하지 않는 메서드**와 **원본을 변경하는 메서드**로 나뉩니다. 함수형 프로그래밍 관점에서는 원본을 변경하지 않는 메서드를 선호합니다.

---

## 순회 메서드

`forEach`는 각 요소에 부수효과(side effect)를 적용할 때 씁니다. 반환값이 `undefined`이므로 체이닝할 수 없습니다.

```javascript
const arr = [1, 2, 3];

// forEach — 부수효과 전용
arr.forEach((val, idx) => {
  console.log(idx, val);
});

// entries, keys, values — 이터레이터 반환
for (const [i, v] of arr.entries()) {
  console.log(i, v); // 0 1, 1 2, 2 3
}
```

`for...of`와 `forEach`의 차이: `for...of`는 `break`·`continue`·`return`이 가능하지만 `forEach`는 중간에 멈출 수 없습니다. 루프를 멈춰야 한다면 `for...of`를 쓰거나 `find`·`some`을 활용합니다.

---

## 변환 메서드

`map`은 각 요소를 변환해 새 배열을 만듭니다. 원본 배열과 길이가 같습니다. `filter`는 조건을 통과한 요소만 모읍니다. 두 메서드 모두 원본을 변경하지 않습니다.

```javascript
const nums = [1, 2, 3, 4, 5];

nums.map(n => n * 2);          // [2, 4, 6, 8, 10]
nums.filter(n => n % 2 === 0); // [2, 4]
nums.slice(1, 3);              // [2, 3] — 원본 그대로
nums.concat([6, 7]);           // [1, 2, 3, 4, 5, 6, 7]
nums.join(', ');               // "1, 2, 3, 4, 5"
```

`flatMap`은 `map` 후 1단계 평탄화를 한 번에 수행합니다. 각 요소에서 배열을 생성하고 합치는 패턴에서 `map + flat(1)` 보다 효율적입니다.

```javascript
const sentences = ['hello world', 'foo bar'];
sentences.flatMap(s => s.split(' ')); // ['hello', 'world', 'foo', 'bar']

// 조건부로 0개 또는 여러 개를 생성할 때도 유용
[1, 2, 3].flatMap(n => n % 2 ? [n, n * 10] : []); // [1, 10, 3, 30]
```

---

## 검색 메서드

![map·filter·reduce 체이닝 흐름](/assets/posts/js-array-methods-overview-chaining.svg)

검색에는 목적에 따라 다른 메서드를 씁니다.

```javascript
const users = [
  { id: 1, name: 'Alice', age: 25 },
  { id: 2, name: 'Bob',   age: 17 },
  { id: 3, name: 'Carol', age: 30 },
];

// 첫 번째 일치 요소
users.find(u => u.age < 18);        // { id: 2, name: 'Bob', age: 17 }
users.findIndex(u => u.age < 18);   // 1

// 마지막 일치 요소 (ES2023)
users.findLast(u => u.age > 20);    // { id: 3, name: 'Carol', age: 30 }

// 존재 여부만
users.some(u => u.age < 18);        // true
users.every(u => u.age >= 18);      // false

// 원시값 포함 여부
[1, 2, NaN].includes(NaN);          // true  (Object.is 기반)
[1, 2, NaN].indexOf(NaN);           // -1   (=== 기반, NaN 못 찾음)
```

`find`는 일치하는 첫 요소 자체를 반환하고, `findIndex`는 그 인덱스를 반환합니다. 일치하는 것이 없으면 각각 `undefined`와 `-1`을 반환합니다.

---

## 집계 메서드: reduce

`reduce`는 배열을 단일 값으로 줄입니다. 강력하지만 복잡한 로직에 남용하면 가독성이 떨어집니다.

```javascript
const nums = [1, 2, 3, 4, 5];

// 합계
nums.reduce((acc, n) => acc + n, 0); // 15

// 최대값
nums.reduce((max, n) => n > max ? n : max, -Infinity); // 5
// Math.max(...nums) 가 더 간결

// 그룹핑 — reduce의 전형적 활용
const people = [
  { name: 'Alice', dept: 'eng' },
  { name: 'Bob',   dept: 'hr' },
  { name: 'Carol', dept: 'eng' },
];

const byDept = people.reduce((acc, p) => {
  (acc[p.dept] ??= []).push(p.name);
  return acc;
}, {});
// { eng: ['Alice', 'Carol'], hr: ['Bob'] }
```

초기값을 항상 제공하는 것이 안전합니다. 초기값을 생략하면 빈 배열에서 `TypeError`가 발생합니다.

---

## 정렬 메서드

`sort`는 원본을 변경합니다. 기본 정렬은 요소를 문자열로 변환해 UTF-16 코드 포인트 기준으로 정렬하므로, 숫자 배열은 반드시 비교 함수를 제공해야 합니다.

```javascript
// 기본 정렬 함정
[10, 9, 2, 21].sort();           // [10, 2, 21, 9] — 문자열 정렬
[10, 9, 2, 21].sort((a, b) => a - b); // [2, 9, 10, 21] ✓

// 원본 보존하면서 정렬 (ES2023)
const original = [3, 1, 2];
const sorted = original.toSorted((a, b) => a - b); // [1, 2, 3]
original; // [3, 1, 2] — 변경 없음

// 역순 (ES2023)
[1, 2, 3].toReversed(); // [3, 2, 1] — 원본 유지
```

---

## 구조변경 메서드

원본을 변경하는 메서드들입니다. 불변성이 중요한 상황(React state 등)에서는 사용 전에 배열을 복사합니다.

```javascript
const arr = [1, 2, 3];

// push / pop — 끝
arr.push(4);     // arr: [1, 2, 3, 4], 반환값: 4 (새 length)
arr.pop();       // arr: [1, 2, 3], 반환값: 4 (제거된 요소)

// shift / unshift — 앞
arr.unshift(0);  // arr: [0, 1, 2, 3], 반환값: 4 (새 length)
arr.shift();     // arr: [1, 2, 3], 반환값: 0

// splice — 임의 위치 삽입·삭제
arr.splice(1, 1, 10, 20); // arr: [1, 10, 20, 3], 반환: [2]

// with (ES2023) — 특정 인덱스만 교체, 원본 유지
[1, 2, 3].with(1, 99); // [1, 99, 3]
```

---

## 정리

| 분류 | 원본 변경 | 대표 메서드 |
|------|-----------|-------------|
| 순회 | 없음 | `forEach`, `for...of` |
| 변환 | 없음 | `map`, `filter`, `flatMap`, `slice` |
| 검색 | 없음 | `find`, `findIndex`, `some`, `every`, `includes` |
| 집계 | 없음 | `reduce`, `reduceRight` |
| 정렬 | **있음** | `sort`, `reverse` → `toSorted`, `toReversed` 권장 |
| 구조변경 | **있음** | `push`, `pop`, `splice` |

---

**지난 글:** [NaN과 특수 숫자값 비교 — 자기 자신과 같지 않은 값](/posts/js-nan-comparison/)

**다음 글:** [배열 메서드 — 변경 vs 비변경 완전 정복](/posts/js-array-mutating-vs-non/)

<br>
읽어주셔서 감사합니다. 😊
