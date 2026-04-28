---
title: "고차 함수 완전 정복"
description: "JavaScript 고차 함수(Higher-Order Function)의 정의와 map·filter·reduce 동작 원리, once·debounce·memoize 같은 데코레이터 패턴, flatMap과 배열 메서드 체이닝 기법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "고차함수", "higher-order-function", "map", "filter", "reduce", "debounce", "memoize", "함수형프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/js-iife/)에서 IIFE와 모듈 패턴을 살펴봤습니다. 이번에는 함수형 프로그래밍의 핵심인 **고차 함수(Higher-Order Function)**를 집중적으로 다룹니다. 고차 함수는 함수를 인수로 받거나 함수를 반환하는 함수입니다. `map`, `filter`, `reduce`는 가장 흔히 쓰이는 내장 고차 함수이고, `debounce`, `once`, `memoize` 같은 패턴은 고차 함수로 구현하는 대표적 유틸리티입니다.

## 고차 함수란

함수를 인수로 받거나 반환하는 함수를 고차 함수라고 합니다. JavaScript에서 함수는 일급 객체이므로 값처럼 전달하고 반환할 수 있습니다.

```javascript
// 함수를 인수로 받는 고차 함수
function applyTwice(fn, x) {
  return fn(fn(x));
}
applyTwice(x => x * 2, 3); // 12 (3 → 6 → 12)

// 함수를 반환하는 고차 함수
function multiplier(n) {
  return x => x * n;
}
const triple = multiplier(3);
triple(5); // 15
```

## map — 변환

배열의 각 요소를 변환한 새 배열을 반환합니다. 원본 배열은 변경하지 않으며 길이는 항상 같습니다.

```javascript
const prices = [100, 200, 300];

// 기본 사용
const discounted = prices.map(p => p * 0.9); // [90, 180, 270]

// 인덱스 활용
const indexed = prices.map((p, i) => `${i+1}. ₩${p}`);
// ['1. ₩100', '2. ₩200', '3. ₩300']

// 객체 배열 변환
const users = [{ name: 'Kim', age: 30 }, { name: 'Lee', age: 25 }];
const names = users.map(({ name }) => name); // ['Kim', 'Lee']
```

## filter — 선별

조건을 만족하는 요소만 담은 새 배열을 반환합니다.

```javascript
const scores = [85, 42, 90, 67, 78];

const passed = scores.filter(s => s >= 70);  // [85, 90, 78]
const failed = scores.filter(s => s < 70);   // [42, 67]

// 빈값 제거
const data = ['a', '', null, 'b', undefined, 'c'];
const clean = data.filter(Boolean); // ['a', 'b', 'c']
```

## reduce — 집계

배열을 순회하며 누적값을 만들어 최종 단일 값을 반환합니다. 초기값을 반드시 명시하는 것이 안전합니다.

```javascript
const nums = [1, 2, 3, 4, 5];

// 합계
const sum = nums.reduce((acc, n) => acc + n, 0);  // 15

// 최대값
const max = nums.reduce((a, b) => a > b ? a : b);  // 5

// 배열 → 객체 집계
const votes = ['A', 'B', 'A', 'C', 'B', 'A'];
const tally = votes.reduce((acc, v) => ({
  ...acc, [v]: (acc[v] ?? 0) + 1
}), {});
// { A: 3, B: 2, C: 1 }

// 2차원 배열 평탄화 (flatMap이 더 적합)
const nested = [[1,2], [3,4], [5]];
const flat = nested.reduce((acc, arr) => acc.concat(arr), []);
// [1, 2, 3, 4, 5]
```

![고차 함수 map·filter·reduce](/assets/posts/js-higher-order-functions-map-filter-reduce.svg)

## flatMap — map + 평탄화

`map` 후 1단계 평탄화를 합칩니다. 하나의 요소에서 여러 값을 생성할 때 유용합니다.

```javascript
const sentences = ['hello world', 'foo bar'];

// map → flatten
sentences.map(s => s.split(' ')).flat();

// flatMap (더 효율적)
sentences.flatMap(s => s.split(' '));
// ['hello', 'world', 'foo', 'bar']

// 조건부 변환 + 필터 결합
const results = [1, 2, 3, 4, 5].flatMap(n =>
  n % 2 === 0 ? [n, n * 10] : []
);
// [2, 20, 4, 40]
```

## 데코레이터 패턴 — once

함수를 받아 "단 한 번만 실행"을 보장하는 함수를 반환합니다.

```javascript
function once(fn) {
  let called = false;
  let result;
  return function(...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

const init = once(() => {
  console.log('초기화 완료');
  return { ready: true };
});

init(); // '초기화 완료' → { ready: true }
init(); // 출력 없음 → { ready: true } (캐시)
init(); // 출력 없음 → { ready: true }
```

## 데코레이터 패턴 — memoize

동일한 인수로 다시 호출할 때 계산 없이 캐시된 값을 반환합니다.

```javascript
function memoize(fn) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (!cache.has(key)) {
      cache.set(key, fn.apply(this, args));
    }
    return cache.get(key);
  };
}

const fib = memoize(function(n) {
  return n <= 1 ? n : fib(n - 1) + fib(n - 2);
});

fib(40); // 빠른 결과 (재귀 반복 캐시)
```

`JSON.stringify`는 순환 참조나 함수 타입 인수에 한계가 있습니다. 프로덕션에서는 WeakMap + 커스텀 키 전략을 고려하세요.

## 데코레이터 패턴 — debounce

연속 호출 중 마지막 호출만 실행합니다. 검색 입력, 리사이즈 이벤트 등에 사용합니다.

```javascript
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const onSearch = debounce((query) => {
  fetch(`/api/search?q=${query}`).then(/* ... */);
}, 300);

input.addEventListener('input', e => onSearch(e.target.value));
// 300ms 동안 입력이 없을 때만 API 호출
```

![고차 함수 직접 구현](/assets/posts/js-higher-order-functions-custom.svg)

## 메서드 체이닝과 성능

배열 메서드를 체이닝하면 읽기 좋지만, 각 메서드가 새 배열을 생성합니다. 매우 큰 배열에서는 단일 `reduce`가 더 효율적입니다.

```javascript
// 읽기 좋음, 중간 배열 2개 생성
const result = data
  .filter(x => x.active)
  .map(x => x.value)
  .reduce((a, b) => a + b, 0);

// 중간 배열 없음, 대용량에서 유리
const result2 = data.reduce((acc, x) => {
  return x.active ? acc + x.value : acc;
}, 0);
```

수백만 개 요소가 아니라면 가독성 우선으로 체이닝을 선택하세요. 프로파일링 후 최적화하세요.

---

**지난 글:** [IIFE — 즉시 실행 함수 표현식 완전 정복](/posts/js-iife/)

<br>
읽어주셔서 감사합니다. 😊
