---
title: "useDeferredValue로 후순위 업데이트 분리"
description: "useDeferredValue의 동작 원리, memo와 함께 사용하는 방법, stale UI 감지 패턴, 디바운스와의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["React", "useDeferredValue", "동시성", "성능최적화", "memo", "디바운스"]
featured: false
draft: false
---

[지난 글](/posts/react-usetransition/)에서 `useTransition`으로 상태 업데이트 우선순위를 조절하는 방법을 살펴봤다. 이번에는 비슷하지만 다른 용도의 **useDeferredValue** 를 다룬다.

## useTransition vs useDeferredValue

두 훅은 모두 "일부 업데이트를 후순위로 처리"하지만, 적용 위치가 다르다.

| | useTransition | useDeferredValue |
|---|---|---|
| 제어 위치 | setState 호출 시 | 값을 소비하는 쪽 |
| 대상 | 내 컴포넌트의 setState | prop, context 등 외부 값 |
| 로딩 표시 | `isPending` | `value !== deferredValue` |

`useTransition`은 내가 직접 setState를 호출하는 경우에 사용하고, `useDeferredValue`는 부모나 외부에서 넘어온 값을 지연 처리할 때 사용한다.

## 기본 사용법

![useDeferredValue 동작 원리](/assets/posts/react-usedeferredvalue-how.svg)

```tsx
import { useState, useDeferredValue, memo, useMemo } from 'react';

const SlowList = memo(function SlowList({ query }: { query: string }) {
  const items = useMemo(() => expensiveFilter(query), [query]);
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
});

function SearchBox() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="검색..."
      />
      <SlowList query={deferredQuery} />
    </div>
  );
}
```

`query`는 input의 즉각적인 값이고, `deferredQuery`는 약간 뒤처진 버전이다. `SlowList`는 `deferredQuery`를 받으므로, 타이핑 중에는 이전 쿼리로 표시된 상태를 유지하다가 렌더링 여유가 생기면 업데이트된다.

### memo가 반드시 필요한 이유

`useDeferredValue` 단독으로는 최적화가 안 된다. `SlowList`를 `memo`로 감싸지 않으면, 부모(`SearchBox`)가 리렌더될 때마다 `SlowList`도 함께 렌더된다 — `deferredQuery`가 바뀌지 않았어도.

`memo`가 있어야 `SlowList`는 `deferredQuery` prop이 실제로 바뀔 때만 렌더링된다.

## stale UI 표시

![stale UI 패턴](/assets/posts/react-usedeferredvalue-stale.svg)

현재 표시 중인 결과가 최신 검색어와 다를 때 시각적으로 표시할 수 있다:

```tsx
function SearchPage() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const isStale = query !== deferredQuery;
  const results = useMemo(() => search(deferredQuery), [deferredQuery]);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div
        style={{
          opacity: isStale ? 0.6 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {isStale && <small>결과 업데이트 중...</small>}
        <ResultList results={results} />
      </div>
    </div>
  );
}
```

`query !== deferredQuery`이면 결과 목록이 현재 입력과 맞지 않는 stale 상태다. opacity를 낮춰 사용자에게 업데이트 중임을 알린다.

## 디바운스와의 비교

검색 입력을 최적화할 때 자주 사용하는 디바운스와 비교하면:

```tsx
// 디바운스 방식
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

// useDeferredValue 방식
const deferredQuery = useDeferredValue(query);
```

차이점:

- **디바운스**: `delay`ms를 무조건 기다림. 빠른 기기에서도 동일하게 지연
- **useDeferredValue**: 브라우저가 idle 상태일 때 바로 처리. 빠른 기기에서는 즉각 반응, 느린 기기에서 자동으로 지연

디바운스는 네트워크 요청 수를 줄이는 데 더 적합하고, `useDeferredValue`는 CPU 집약적 렌더링을 최적화하는 데 적합하다.

## Suspense와 함께 사용

`useDeferredValue`를 Suspense와 함께 쓰면, 이전 데이터를 표시하면서 새 데이터를 백그라운드에서 로드할 수 있다:

```tsx
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div style={{ opacity: isStale ? 0.6 : 1 }}>
      <Suspense fallback={<ResultsSkeleton />}>
        {/* deferredQuery가 바뀔 때만 새 데이터 페칭 */}
        <ResultsList query={deferredQuery} />
      </Suspense>
    </div>
  );
}
```

`deferredQuery`가 바뀔 때 `ResultsList`가 suspend되어도 Suspense는 이전 결과를 유지하다가(stale 표시) 새 결과가 준비되면 교체한다.

## 초기값 설정

React 19부터 `useDeferredValue`에 초기값을 설정할 수 있다:

```tsx
// 초기 렌더에서는 '' 사용, 이후 query를 지연 적용
const deferredQuery = useDeferredValue(query, '');
```

SSR이나 첫 렌더 시 유용하다. 초기값과 실제 값이 다르면 두 번 렌더링된다.

## 언제 useDeferredValue를 쓸까?

```
✓ prop이나 context로 받은 값을 기반으로 무거운 연산/렌더가 있을 때
✓ setState를 직접 제어할 수 없는 상황 (외부 라이브러리, 부모 컴포넌트)
✓ 검색 결과 목록처럼 타이핑 중 즉각 반응이 필요한 input과 조합할 때

✗ 네트워크 요청 수를 줄이고 싶다면 → debounce 사용
✗ 내가 직접 setState를 호출한다면 → useTransition이 더 적절
```

---

**지난 글:** [useTransition으로 UI 응답성 개선](/posts/react-usetransition/)

**다음 글:** [useTransition vs useDeferredValue 비교](/posts/react-transition-vs-deferred/)

<br>
읽어주셔서 감사합니다. 😊
