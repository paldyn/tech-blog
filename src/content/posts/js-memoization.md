---
title: "메모이제이션"
description: "순수 함수의 결과를 캐싱하는 메모이제이션 기법을 구현하고, TTL 캐시·재귀 최적화·React useMemo까지 실전 패턴을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "메모이제이션", "캐싱", "성능 최적화", "순수 함수"]
featured: false
draft: false
---

[지난 글](/posts/js-currying-partial-application/)에서 커링과 부분 적용으로 인자를 나누어 고정하는 법을 배웠습니다. 이번에는 **메모이제이션(Memoization)** 을 다룹니다. 메모이제이션은 순수 함수의 결과를 캐싱해서 동일한 인자로 다시 호출할 때 재계산 없이 즉시 반환하는 최적화 기법입니다.

## 핵심 아이디어

순수 함수는 동일한 입력에 대해 항상 동일한 출력을 내놓습니다. 이 특성 덕분에 결과를 안전하게 캐싱할 수 있습니다.

```javascript
// 메모이제이션 없는 피보나치 — 지수 시간 O(2^n)
function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

fib(40); // 약 165,580,141 번 재귀 호출
```

`fib(40)`을 계산하려면 `fib(39)`와 `fib(38)`이 필요하고, 이 둘은 각각 더 작은 값을 중복 계산합니다. 메모이제이션은 이 중복을 제거합니다.

![메모이제이션 동작 원리](/assets/posts/js-memoization-concept.svg)

## 범용 memoize 헬퍼

```javascript
function memoize(fn) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key); // 캐시 히트: 즉시 반환
    }

    const result = fn.apply(this, args); // 캐시 미스: 계산
    cache.set(key, result);
    return result;
  };
}
```

`JSON.stringify(args)`를 키로 사용하면 여러 인자도 단일 문자열로 표현할 수 있습니다. 단, 객체 키의 순서, 순환 참조, 함수·심볼 같은 JSON 직렬화 불가능 값을 주의해야 합니다.

## 재귀 함수 메모이제이션

범용 헬퍼를 피보나치에 적용하면 함수 이름(`fib`)으로 재귀 호출할 때 캐시가 공유되지 않는 문제가 생깁니다. 클로저로 직접 구현하는 것이 안전합니다.

```javascript
function makeFib() {
  const memo = new Map();

  return function fib(n) {
    if (memo.has(n)) return memo.get(n);
    const result = n <= 1 ? n : fib(n - 1) + fib(n - 2);
    memo.set(n, result);
    return result;
  };
}

const fib = makeFib();
fib(40); // 단 41번 호출 — O(n)
fib(40); // 즉시 반환 (캐시 히트)
```

![메모이제이션 심화 패턴](/assets/posts/js-memoization-patterns.svg)

## TTL(만료 시간) 캐시

API 응답처럼 시간이 지나면 낡아지는 데이터에는 만료 시간을 결합합니다.

```javascript
function memoWithTTL(fn, ttl) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);
    const hit = cache.get(key);

    if (hit && Date.now() < hit.expiry) {
      return hit.value; // 아직 유효한 캐시
    }

    const value = fn(...args);
    cache.set(key, { value, expiry: Date.now() + ttl });
    return value;
  };
}

// 1분 캐시
const cachedFetch = memoWithTTL(
  (url) => fetch(url).then(r => r.json()),
  60_000
);
```

TTL이 지난 항목은 덮어쓰이고, 이전 항목은 Map에 남아 메모리를 차지합니다. 장기 실행 서버에서는 주기적으로 만료 항목을 제거하는 정리 로직이 필요합니다.

## WeakMap과 객체 키

키가 원시값이 아닌 **객체**라면 WeakMap을 활용할 수 있습니다. WeakMap은 키가 가비지 컬렉션될 때 항목도 함께 제거되어 메모리 누수 걱정이 없습니다.

```javascript
const resultCache = new WeakMap();

function expensiveProcess(config) {
  if (resultCache.has(config)) {
    return resultCache.get(config);
  }
  const result = /* 무거운 작업 */ config.factor * 42;
  resultCache.set(config, result);
  return result;
}

const cfg = { factor: 10 };
expensiveProcess(cfg); // 계산
expensiveProcess(cfg); // 캐시 반환
// cfg가 더 이상 참조되지 않으면 캐시도 자동 해제
```

`JSON.stringify`가 불필요하고, 객체를 키로 직접 사용하므로 직렬화 한계를 우회할 수 있습니다.

## React와 useMemo

React는 컴포넌트 레벨 메모이제이션을 훅으로 제공합니다.

```jsx
import { useMemo } from 'react';

function ProductList({ products, minPrice }) {
  // products나 minPrice가 바뀔 때만 재계산
  const filtered = useMemo(
    () => products.filter(p => p.price >= minPrice),
    [products, minPrice]
  );

  return <ul>{filtered.map(p => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

`useMemo`는 의존성 배열의 값이 바뀌지 않으면 이전 계산 결과를 재사용합니다. 모든 계산에 무조건 적용하면 오히려 의존성 비교 오버헤드가 생기므로 **실제로 비용이 큰 계산**에만 사용합니다.

## 언제 쓰고 언제 피할까?

**적합한 경우:**
- 같은 인자로 반복 호출되는 순수 함수
- 계산 비용이 높고 결과가 자주 재사용되는 경우
- 피보나치·경로 탐색 같은 재귀 알고리즘

**피해야 할 경우:**
- 인자가 매번 다른 함수 (캐시가 계속 커지기만 함)
- 부수 효과가 있는 함수 (낡은 캐시가 문제 유발)
- 메모리가 매우 제한된 환경

메모이제이션은 시간-공간 트레이드오프입니다. 속도를 위해 메모리를 사용합니다. 다음 글에서는 메모이제이션과 커링이 결합되는 **함수 합성(Function Composition)** 을 살펴봅니다.

---

**지난 글:** [커링과 부분 적용](/posts/js-currying-partial-application/)

**다음 글:** [함수 합성](/posts/js-function-composition/)

<br>
읽어주셔서 감사합니다. 😊
