---
title: "메모이제이션 패턴 — 계산 결과 캐싱으로 성능 향상"
description: "메모이제이션의 원리, 범용 memoize 구현, Map 기반 캐시 관리, React useMemo·useCallback·React.memo 올바른 사용 기준, 그리고 주의해야 할 함정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "성능", "메모이제이션", "캐싱", "useMemo", "useCallback", "React.memo", "최적화"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "perf-debounce-throttle"
  title: "디바운스와 스로틀 — 이벤트 호출 빈도 제어"
next:
  slug: "perf-request-idle-callback"
  title: "requestIdleCallback — 유휴 시간 활용"
---

[지난 글](/posts/perf-debounce-throttle/)에서 이벤트 호출 빈도를 줄이는 디바운스·스로틀을 살펴봤습니다. 이번에는 호출 횟수와 무관하게 **같은 입력에 대한 계산을 생략**하는 메모이제이션 패턴을 다룹니다. 순수 함수의 결과를 캐싱해두면 동일한 인자로 재호출할 때 계산을 건너뛸 수 있습니다.

---

## 원리

메모이제이션은 **함수 호출 결과를 키-값 형태로 저장**하고, 같은 인자가 들어오면 저장된 값을 반환하는 패턴입니다. 순수 함수(같은 입력 → 항상 같은 출력)에만 적용할 수 있습니다.

![메모이제이션 캐시 흐름](/assets/posts/perf-memoization-pattern-flow.svg)

```js
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// 피보나치 — 재귀 호출을 캐싱으로 최적화
const fib = memoize(function (n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
});

console.log(fib(40)); // 2ms (캐싱 없이 ~2000ms)
```

`JSON.stringify(args)`로 인자를 직렬화해 키를 만듭니다. 인자가 객체나 배열이면 참조가 달라도 내용이 같으면 같은 키로 취급합니다.

---

## 캐시 크기 제한 (LRU)

메모이제이션의 주요 위험은 **메모리 누수**입니다. 인자 조합이 무한히 다르다면 캐시가 끝없이 커집니다. 실용적인 방법은 LRU(Least Recently Used) 방식으로 캐시 크기를 제한하는 것입니다.

```js
function memoizeWithLimit(fn, maxSize = 100) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      // 최근 사용으로 갱신 (LRU: 삭제 후 재삽입)
      const val = cache.get(key);
      cache.delete(key);
      cache.set(key, val);
      return val;
    }
    const result = fn.apply(this, args);
    if (cache.size >= maxSize) {
      // Map은 삽입 순서 유지 — 첫 번째 키가 가장 오래됨
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, result);
    return result;
  };
}
```

JavaScript의 `Map`은 삽입 순서를 유지하므로 `keys().next().value`가 항상 가장 오래된 항목을 가리킵니다. LRU 캐시를 직접 구현할 때 자주 쓰이는 트릭입니다.

---

## React 메모이제이션 API

React에는 메모이제이션을 위한 세 가지 내장 도구가 있습니다.

![React 메모이제이션 API 비교](/assets/posts/perf-memoization-pattern-react.svg)

### useMemo — 계산 결과 캐싱

```js
const expensiveResult = useMemo(() => {
  return items
    .filter(item => item.active)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}, [items]); // items가 바뀔 때만 재계산
```

의존 배열의 값이 바뀌지 않으면 이전 결과를 그대로 반환합니다. 렌더마다 수백 개의 항목을 정렬·필터링하는 경우 유효합니다. 단순한 덧셈이나 짧은 배열에는 `useMemo`의 비교 비용 자체가 오히려 무거울 수 있습니다.

### useCallback — 함수 참조 안정화

```js
const handleSubmit = useCallback((data) => {
  dispatch({ type: 'SUBMIT', payload: data });
}, [dispatch]);

// React.memo로 감싼 자식에 전달
<ExpensiveForm onSubmit={handleSubmit} />
```

`useCallback`은 함수를 **메모이제이션**하는 것이 아니라, 함수 **참조**를 안정화합니다. `React.memo`로 감싼 자식에 콜백을 전달할 때, 참조가 바뀌지 않아야 자식 재렌더를 막을 수 있습니다. `React.memo` 없이 `useCallback`만 쓰는 것은 의미가 없습니다.

### React.memo — 컴포넌트 재렌더 방지

```js
const ItemRow = React.memo(({ item, onDelete }) => {
  return <div onClick={() => onDelete(item.id)}>{item.name}</div>;
});

// props(item, onDelete)가 얕은 비교로 같으면 재렌더 생략
```

부모 컴포넌트가 렌더링될 때 props가 바뀌지 않았다면 `ItemRow`는 재렌더되지 않습니다. 렌더 비용이 큰 순수 컴포넌트에 효과적입니다.

---

## 언제 쓰고 언제 쓰지 말아야 하나

메모이제이션에는 **비교 비용**이 항상 따릅니다. 의존 배열 비교, `JSON.stringify`, 얕은 비교 모두 작은 비용이지만 0은 아닙니다.

```js
// ❌ 불필요한 useMemo — 단순 연산에 오버헤드만 추가
const doubled = useMemo(() => count * 2, [count]);

// ✅ 그냥 계산하면 충분
const doubled = count * 2;

// ✅ useMemo가 의미 있는 경우
const sortedAndFiltered = useMemo(
  () => largeList.filter(predicate).sort(comparator),
  [largeList, predicate, comparator]
);
```

적용 기준은 단순합니다. **"이 계산이 프로파일러에서 병목으로 나타났는가?"** 여기에 해당될 때 적용하고, 그렇지 않으면 생략합니다.

---

## 정리

- 메모이제이션은 순수 함수에만 의미가 있습니다. 부작용이 있는 함수에 적용하면 부작용이 최초 1회만 실행됩니다.
- 캐시 키는 인자의 직렬화된 표현이므로, 같은 내용의 다른 객체 참조는 동일 키로 처리됩니다.
- React의 `useMemo`·`useCallback`은 성능 문제가 실제로 관측된 곳에만 적용합니다.
- 캐시 크기를 제한하지 않으면 메모리 누수의 원인이 됩니다.

---

**지난 글:** [디바운스와 스로틀 — 이벤트 호출 빈도 제어](/posts/perf-debounce-throttle/)

**다음 글:** [requestIdleCallback — 유휴 시간 활용](/posts/perf-request-idle-callback/)

<br>
읽어주셔서 감사합니다. 😊
