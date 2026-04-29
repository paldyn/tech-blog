---
title: "structuredClone()"
description: "ES2022 전역 함수 structuredClone()으로 객체를 깊은 복사하는 방법, 지원 타입과 지원하지 않는 타입, JSON.parse/JSON.stringify 방식과의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ES2022", "structuredClone", "깊은 복사", "Deep Clone", "객체 복사"]
featured: false
draft: false
---

[지난 글](/posts/js-error-cause/)에서 Error cause를 살펴봤습니다. 이번에는 ES2022에 전역 함수로 추가된 **`structuredClone()`**을 다룹니다. 이 함수는 JavaScript의 구조적 복제 알고리즘(Structured Clone Algorithm)을 직접 노출해, 깊은 복사(deep clone)를 손쉽게 수행할 수 있게 합니다.

## 얕은 복사와 깊은 복사

![얕은 복사 vs 깊은 복사](/assets/posts/js-structured-clone-comparison.svg)

얕은 복사(`{...obj}`, `Object.assign`)는 최상위 프로퍼티만 새 객체에 복사하고, 중첩된 객체는 **참조를 공유**합니다.

```javascript
const original = { name: 'Alice', scores: [90, 85] };
const shallow = { ...original };

shallow.scores.push(100);
console.log(original.scores); // [90, 85, 100] ← 원본 변경됨!
```

`structuredClone()`은 **모든 깊이의 중첩 구조를 재귀적으로 복사**하여 완전히 독립된 복사본을 만듭니다.

```javascript
const original = { name: 'Alice', scores: [90, 85] };
const clone = structuredClone(original);

clone.scores.push(100);
console.log(original.scores); // [90, 85] ← 원본 불변!
```

## 기존 방식과 비교

### JSON.parse(JSON.stringify())

가장 흔히 쓰이던 깊은 복사 방법이지만 여러 단점이 있습니다.

```javascript
const obj = {
  date: new Date(),
  re: /abc/,
  fn: () => {},
  undef: undefined,
};

const copy = JSON.parse(JSON.stringify(obj));
// date → 문자열로 변환됨 (Date 인스턴스 소실)
// re → {} (빈 객체)
// fn → 제거됨
// undef → 제거됨
```

### structuredClone()

```javascript
const obj = {
  date: new Date(),
  map: new Map([['key', 'val']]),
  set: new Set([1, 2, 3]),
};

const clone = structuredClone(obj);
clone.date instanceof Date; // true ✓
clone.map instanceof Map;  // true ✓
```

## 지원 타입

![structuredClone 지원 타입](/assets/posts/js-structured-clone-types.svg)

`structuredClone()`은 다양한 타입을 지원하지만 함수와 DOM 노드는 지원하지 않습니다.

```javascript
// ✓ 지원
structuredClone({ a: 1, b: [2, 3] });
structuredClone(new Date());
structuredClone(new Map([['k', 'v']]));
structuredClone(new Set([1, 2]));
structuredClone(new ArrayBuffer(16));
structuredClone(new Uint8Array([1, 2, 3]));
structuredClone(/regex/gi); // RegExp

// ✓ 순환 참조도 처리
const a = {};
a.self = a;
structuredClone(a); // OK — JSON.stringify는 에러

// ✗ 지원 안 됨 → DataCloneError
structuredClone(() => {});         // 함수
structuredClone(document.body);    // DOM 노드
```

## 클래스 인스턴스 주의사항

사용자 정의 클래스 인스턴스는 복사되지만 **프로토타입 체인이 소실**됩니다.

```javascript
class Point {
  constructor(x, y) { this.x = x; this.y = y; }
  toString() { return `(${this.x}, ${this.y})`; }
}

const p = new Point(1, 2);
const clone = structuredClone(p);

clone.x; // 1 ✓
clone instanceof Point; // false ✗
clone.toString(); // TypeError ✗
```

## Transferable 객체

`structuredClone()`의 두 번째 인자로 `{ transfer: [...] }`를 전달하면, 지정된 `ArrayBuffer`를 복사 대신 **이전(transfer)**할 수 있습니다. 이전된 버퍼는 원본에서 사용할 수 없게 됩니다.

```javascript
const buffer = new ArrayBuffer(1024);
const view = new Uint8Array(buffer);
view[0] = 42;

const clone = structuredClone(buffer, { transfer: [buffer] });

new Uint8Array(clone)[0]; // 42 ✓
buffer.byteLength;        // 0  — 이전됨
```

이 기능은 Web Worker 간 메모리 복사 없이 데이터를 공유하는 데 특히 유용합니다.

---

**지난 글:** [Error cause (ES2022)](/posts/js-error-cause/)

**다음 글:** [Object.groupBy()](/posts/js-object-groupby/)

<br>
읽어주셔서 감사합니다. 😊
