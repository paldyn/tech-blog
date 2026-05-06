---
title: "배열 메서드 — 변경 vs 비변경 완전 정복"
description: "JavaScript 배열 메서드를 원본 변경 여부로 분류하고, ES2023 toSorted·toReversed·toSpliced·with의 등장 배경과 불변 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Array", "불변성", "toSorted", "toReversed", "ES2023", "mutating"]
featured: false
draft: false
---

[지난 글](/posts/js-array-methods-overview/)에서 배열 메서드를 순회·변환·검색·집계·정렬·구조변경으로 분류했습니다. 이번에는 가장 혼란을 유발하는 분류인 **원본 변경(mutating) vs 비변경(non-mutating)** 을 집중적으로 파고듭니다. React state나 함수형 프로그래밍에서 원본 변경은 예측하기 어려운 버그를 낳습니다.

---

## 왜 이 구분이 중요한가

JavaScript 배열은 객체이며, 변수에는 배열의 참조가 저장됩니다. 메서드가 원본을 변경하면 같은 배열을 참조하는 모든 곳에 영향을 미칩니다.

```javascript
const a = [3, 1, 2];
const b = a;         // 같은 배열을 참조

a.sort();            // a, b 모두 변경됨
console.log(b);      // [1, 2, 3] — 의도하지 않은 변경

// 반면
const c = [3, 1, 2];
const d = c.toSorted(); // c 그대로, d만 정렬됨
console.log(c);      // [3, 1, 2] ✓
```

React에서 `useState`로 관리하는 배열을 직접 `sort`하면 상태 변경이 감지되지 않아 렌더링이 일어나지 않는 대표적인 버그가 발생합니다.

---

## 원본을 변경하는 메서드

![변경 메서드 vs 비변경 메서드](/assets/posts/js-array-mutating-vs-non-comparison.svg)

```javascript
const arr = ['a', 'b', 'c', 'd'];

// push / pop
arr.push('e');          // arr: ['a','b','c','d','e'], 반환: 5 (length)
arr.pop();              // arr: ['a','b','c','d'],     반환: 'e'

// shift / unshift
arr.unshift('z');       // arr: ['z','a','b','c','d'], 반환: 5
arr.shift();            // arr: ['a','b','c','d'],     반환: 'z'

// splice(시작, 삭제수, ...삽입할것)
arr.splice(1, 2, 'x', 'y'); // arr: ['a','x','y','d'], 반환: ['b','c']

// fill
arr.fill('*', 1, 3);    // arr: ['a','*','*','d']

// sort, reverse
[3,1,2].sort((a,b) => a-b); // [1,2,3] — 원본 변경
[1,2,3].reverse();           // [3,2,1] — 원본 변경
```

`sort`와 `reverse`는 원본을 변경하면서 **동시에 this(원본)를 반환**합니다. 반환값을 새 변수에 저장해도 같은 배열입니다.

---

## 원본을 변경하지 않는 메서드

```javascript
const arr = [1, 2, 3, 4, 5];

// 새 배열 반환
arr.map(n => n * 2);           // [2,4,6,8,10] — arr 그대로
arr.filter(n => n > 2);        // [3,4,5]       — arr 그대로
arr.slice(1, 3);               // [2,3]          — arr 그대로
arr.concat([6, 7]);            // [1,2,3,4,5,6,7]

// 단일 값 반환
arr.reduce((s, n) => s + n, 0); // 15
arr.some(n => n > 4);           // true
arr.every(n => n > 0);          // true
arr.find(n => n > 3);           // 4
arr.includes(3);                // true
arr.indexOf(3);                 // 2

// join — 문자열 반환
arr.join('-');                  // "1-2-3-4-5"
```

이 메서드들은 원본 배열을 절대 건드리지 않습니다. 부수효과 없이 새 값을 생성하므로 함수형 패턴에서 자유롭게 체이닝할 수 있습니다.

---

## ES2023: 불변 버전 추가

배열 메서드의 변경/비변경 혼재 문제를 해결하기 위해 ES2023에서 네 가지 새 메서드가 추가되었습니다.

```javascript
const arr = [3, 1, 2];

// toSorted — sort의 불변 버전
const sorted = arr.toSorted((a, b) => a - b); // [1,2,3]
arr; // [3,1,2] ✓

// toReversed — reverse의 불변 버전
const reversed = arr.toReversed(); // [2,1,3]
arr; // [3,1,2] ✓

// toSpliced — splice의 불변 버전
const spliced = arr.toSpliced(1, 1, 99); // [3,99,2]
arr; // [3,1,2] ✓

// with — 특정 인덱스 교체
const replaced = arr.with(0, 100); // [100,1,2]
arr; // [3,1,2] ✓
```

`with`는 특히 유용합니다. 이전에는 인덱스로 하나의 요소만 교체하려면 `map`이나 스프레드를 조합해야 했습니다.

---

## 불변 조작 패턴

![불변 배열 조작 패턴](/assets/posts/js-array-mutating-vs-non-patterns.svg)

ES2023을 쓸 수 없는 환경을 위한 폴백 패턴도 알아둡니다.

```javascript
const arr = [1, 2, 3, 4, 5];
const idx = 2;

// 삭제
const withoutIdx = arr.filter((_, i) => i !== idx); // [1,2,4,5]

// 교체
const withNewVal = arr.map((v, i) => i === idx ? 99 : v); // [1,2,99,4,5]

// 앞/뒤 삽입
const withInserted = [
  ...arr.slice(0, idx),
  'new',
  ...arr.slice(idx),
]; // [1,2,'new',3,4,5]

// 정렬 (폴백)
const sortedCopy = [...arr].sort((a, b) => b - a); // [5,4,3,2,1]
arr; // [1,2,3,4,5] ✓
```

---

## 어떤 것을 써야 할까

| 상황 | 사용 |
|------|------|
| React state 업데이트 | `toSorted` / `toReversed` / `filter` / `map` |
| 성능 중심, 참조 공유 없음 | `sort` / `splice` 직접 사용 가능 |
| 레거시 환경 (ES2023 미지원) | `[...arr].sort()` 등 스프레드 복사 |
| 단순 추가 | `[...arr, item]` 또는 `concat` |

핵심 규칙은 하나입니다: **외부에서 참조될 수 있는 배열은 변경하지 않는다.** 특히 함수 인수로 받은 배열, 컴포넌트 props, store의 state는 반드시 복사 후 조작합니다.

---

**지난 글:** [배열 메서드 총람 — 순회·변환·검색·집계](/posts/js-array-methods-overview/)

**다음 글:** [문자열 메서드와 정규식 활용](/posts/js-string-methods-regex/)

<br>
읽어주셔서 감사합니다. 😊
