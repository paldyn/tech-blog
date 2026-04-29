---
title: "findLast와 findLastIndex"
description: "ES2023 Array.prototype.findLast()와 findLastIndex()로 배열 끝에서부터 역방향 탐색을 수행하는 방법과 기존 방식과의 성능 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ES2023", "Array", "findLast", "findLastIndex", "배열", "탐색"]
featured: false
draft: false
---

[지난 글](/posts/js-object-hasown/)에서 `Object.hasOwn()`을 살펴봤습니다. 이번에는 ES2023에 추가된 `Array.prototype.findLast()`와 `findLastIndex()`를 다룹니다. `find()`와 `findIndex()`의 역방향 버전으로, 배열 끝에서부터 조건을 만족하는 요소를 찾는 메서드입니다.

## 역방향 탐색의 필요성

로그, 이벤트 히스토리, 타임라인처럼 **가장 최근 항목을 찾아야 하는** 상황은 흔합니다. 기존에는 배열을 복사·반전한 뒤 `find()`를 호출하거나, `reduceRight`를 사용해야 했습니다.

```javascript
const logs = [
  { level: 'info',  msg: 'start'  },
  { level: 'error', msg: 'db err' },
  { level: 'info',  msg: 'retry'  },
  { level: 'error', msg: 'timeout'},
];

// 기존 방식 — 복사 후 반전
const lastError = [...logs].reverse().find(l => l.level === 'error');
// { level: 'error', msg: 'timeout' }

// findLast — 복사 없이 역방향 탐색
const lastError2 = logs.findLast(l => l.level === 'error');
// { level: 'error', msg: 'timeout' }
```

## findLast()

![findLast 역방향 탐색 방향](/assets/posts/js-find-last-direction.svg)

`findLast(predicate)`는 배열을 **마지막 인덱스에서 0번으로** 역순으로 순회하며 콜백이 `true`를 반환하는 첫 번째 요소를 반환합니다. 찾지 못하면 `undefined`를 반환합니다.

```javascript
const nums = [1, 2, 3, 4, 5, 4, 3, 2, 1];

nums.find(n => n > 3);     // 4  (앞에서 첫 번째)
nums.findLast(n => n > 3); // 4  (뒤에서 첫 번째 → 인덱스 5)
```

## findLastIndex()

`findLastIndex(predicate)`는 조건에 맞는 요소의 **인덱스**를 반환하고, 없으면 `-1`을 반환합니다.

![findLast 실전 예제](/assets/posts/js-find-last-examples.svg)

```javascript
const prices = [100, 200, 150, 200, 300];

prices.findIndex(p => p === 200);     // 1
prices.findLastIndex(p => p === 200); // 3

// 못 찾을 때
prices.findLastIndex(p => p > 1000); // -1
```

## 기존 방식과 성능 비교

`[...arr].reverse().find()`는 배열 복사본을 만들고 반전하므로 추가 메모리가 필요합니다. `findLast()`는 원본을 변경하지 않으면서 O(n) 탐색만 수행합니다.

```javascript
// ❌ 비효율 — 복사 + 반전
const last = [...hugeArray].reverse().find(pred);

// ✓ 효율 — 복사 없이 역탐색
const last2 = hugeArray.findLast(pred);
```

## TypedArray도 지원

`findLast()`와 `findLastIndex()`는 `Int8Array`, `Uint8Array` 등 TypedArray에도 추가되었습니다.

```javascript
const buffer = new Uint8Array([10, 20, 30, 20, 10]);
buffer.findLast(v => v > 15); // 20 (인덱스 3)
```

## 콜백 인자

콜백 시그니처는 `find()`와 동일합니다. `(element, index, array)` 세 인자를 받습니다.

```javascript
const items = ['a', 'b', 'c', 'b', 'a'];

items.findLast((el, idx) => {
  console.log(idx, el); // 4, 'a' → 3, 'b' → ...
  return el === 'b';
});
// idx: 3, el: 'b' → 반환
```

## 브라우저 지원

Chrome 97+, Firefox 104+, Safari 15.4+, Node.js 18+에서 지원됩니다. 레거시 환경에서는 `Array.from(arr).reverse().find()`로 대체할 수 있습니다.

---

**지난 글:** [Object.hasOwn()](/posts/js-object-hasown/)

**다음 글:** [Error cause (ES2022)](/posts/js-error-cause/)

<br>
읽어주셔서 감사합니다. 😊
