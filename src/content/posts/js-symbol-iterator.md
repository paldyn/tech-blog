---
title: "Symbol.iterator 심화"
description: "Symbol.iterator를 직접 재정의해 커스텀 이터러블을 만들고, 스프레드·구조 분해·for...of와 어떻게 통합되는지 심층적으로 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 35
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Symbol.iterator", "이터러블", "커스텀 이터러블", "스프레드", "구조 분해"]
featured: false
draft: false
---

[지난 글](/posts/js-generator-applications/)에서 제너레이터를 활용한 파이프라인·상태 기계 패턴을 살펴봤습니다. 이번 글에서는 `Symbol.iterator`를 직접 정의해 어떤 객체든 이터러블로 만드는 방법과 그 활용 범위를 깊이 탐구합니다.

## Symbol.iterator의 역할

`Symbol.iterator`는 **well-known Symbol** 중 하나로, 이터레이터를 반환하는 메서드의 이름으로 약속된 키입니다. 엔진은 `for...of`, 스프레드(`...`), 구조 분해, `Array.from`, `Promise.all` 등을 처리할 때 이 키로 메서드를 찾습니다.

```javascript
const arr = [10, 20, 30];

// for...of가 내부적으로 하는 일
const iteratorMethod = arr[Symbol.iterator];
const iterator = iteratorMethod.call(arr);

let result;
while (!(result = iterator.next()).done) {
  console.log(result.value); // 10, 20, 30
}
```

## *[Symbol.iterator]() — 제너레이터 메서드 단축 문법

클래스나 객체 리터럴에서 `*[Symbol.iterator]()` 형태로 제너레이터 메서드를 정의하면 이터러블을 간결하게 만들 수 있습니다.

```javascript
class Range {
  constructor(start, end, step = 1) {
    this.start = start;
    this.end = end;
    this.step = step;
  }

  *[Symbol.iterator]() {
    for (let i = this.start; i <= this.end; i += this.step) {
      yield i;
    }
  }
}

const r = new Range(0, 10, 2);
console.log([...r]);         // [0, 2, 4, 6, 8, 10]
console.log(Math.max(...r)); // 10
const [first] = r;            // 0
```

![Symbol.iterator 재정의 패턴](/assets/posts/js-symbol-iterator-override.svg)

## 역순 이터러블 래퍼

기존 배열 자체를 수정하지 않고 역순 순회를 지원하는 래퍼입니다.

```javascript
class Reversed {
  constructor(arr) { this.arr = arr; }

  *[Symbol.iterator]() {
    for (let i = this.arr.length - 1; i >= 0; i--) {
      yield this.arr[i];
    }
  }
}

const rev = new Reversed([1, 2, 3]);
console.log([...rev]); // [3, 2, 1]

// 원본은 변경되지 않음
const original = [1, 2, 3];
console.log([...new Reversed(original)]); // [3, 2, 1]
console.log(original); // [1, 2, 3]
```

## 스프레드와 구조 분해 통합

`Symbol.iterator`를 구현하면 JavaScript 문법 전체와 자동으로 통합됩니다.

![Symbol.iterator와 스프레드/구조 분해](/assets/posts/js-symbol-iterator-spread.svg)

```javascript
class SortedSet {
  #items;
  constructor(iterable = []) {
    this.#items = [...new Set(iterable)].sort((a, b) => a - b);
  }
  *[Symbol.iterator]() { yield* this.#items; }
}

const ss = new SortedSet([5, 1, 3, 1, 2]);

console.log([...ss]);                  // [1, 2, 3, 5]
const [min, , , max] = ss;             // min=1, max=5
console.log(new Array(...ss));         // [1, 2, 3, 5]
console.log(new Set(ss));              // Set {1, 2, 3, 5}
```

## String.prototype[Symbol.iterator] — 유니코드 안전

문자열의 기본 이터레이터는 UTF-16 코드 유닛이 아닌 **유니코드 코드 포인트** 단위로 순회합니다. 이모지처럼 서로게이트 쌍으로 표현되는 문자를 올바르게 처리합니다.

```javascript
const emoji = '😀😎';
console.log(emoji.length);       // 4 (UTF-16 코드 유닛)
console.log([...emoji].length);  // 2 (코드 포인트)
console.log([...emoji]);         // ['😀', '😎']
```

## 이터러블 프로토콜 준수 확인

런타임에 이터러블 여부를 확인하는 함수입니다.

```javascript
function isIterable(value) {
  return value != null && typeof value[Symbol.iterator] === 'function';
}

isIterable([1, 2, 3]);  // true
isIterable('hello');    // true
isIterable(new Map());  // true
isIterable(42);         // false
isIterable({});         // false
```

## 주의: 내장 타입 프로토타입 수정 금지

`Array.prototype[Symbol.iterator]`를 직접 수정하는 것은 전역 사이드 이펙트를 유발해 절대 권장하지 않습니다. 새 클래스나 래퍼 객체를 만들어 동작을 커스터마이징하세요.

```javascript
// ❌ 절대 금지
Array.prototype[Symbol.iterator] = function* () { /* ... */ };

// ✅ 래퍼 클래스 사용
class MyArray extends Array { /* ... */ }
```

다음 글에서는 비동기 이터러블(`Symbol.asyncIterator`)과 `for await...of` 루프를 다룹니다.

---

**지난 글:** [제너레이터 응용 패턴](/posts/js-generator-applications/)

**다음 글:** [비동기 이터러블](/posts/js-async-iterable/)

<br>
읽어주셔서 감사합니다. 😊
