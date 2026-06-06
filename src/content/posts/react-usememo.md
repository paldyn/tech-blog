---
title: "useMemo 완전 정복 — 계산 결과 메모이제이션"
description: "useMemo의 동작 원리, 의존성 배열, 언제 쓰고 언제 피해야 하는지 기준을 코드 예제와 함께 정리합니다. React.memo, useCallback과의 관계도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["React", "useMemo", "메모이제이션", "성능최적화", "hooks"]
featured: false
draft: false
---

[지난 글](/posts/react-data-fetching-patterns/)에서 데이터 페칭 패턴을 비교했다. 이번에는 관점을 바꿔 렌더링 성능으로 넘어간다. `useMemo`는 비용이 큰 계산 결과를 캐싱해 불필요한 재계산을 막는 훅이다.

## useMemo 기본 구조

```jsx
const memoizedValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);
```

`useMemo`는 두 인수를 받는다.

1. **계산 함수**: 캐싱할 값을 반환하는 함수. 순수 함수여야 한다.
2. **의존성 배열**: 이 배열 안의 값이 바뀔 때만 계산 함수가 다시 실행된다.

초기 렌더 시 계산 함수를 실행해 결과를 캐싱한다. 이후 렌더에서는 의존성 배열을 이전 렌더와 비교(`Object.is`)해서 모두 동일하면 캐시된 값을 그대로 반환한다. 하나라도 다르면 계산 함수를 다시 실행하고 결과를 업데이트한다.

![useMemo 동작 원리](/assets/posts/react-usememo-concept.svg)

## 실제 예제: 대용량 목록 필터링

```jsx
function ProductList({ products, maxPrice, searchText }) {
  // products나 maxPrice가 바뀔 때만 재계산
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => p.price <= maxPrice)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, maxPrice]);

  // searchText는 filteredProducts 계산에 필요 없으므로 deps 제외
  const displayProducts = useMemo(() => {
    if (!searchText) return filteredProducts;
    return filteredProducts.filter(p =>
      p.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [filteredProducts, searchText]);

  return (
    <ul>
      {displayProducts.map(p => (
        <li key={p.id}>{p.name} — {p.price}원</li>
      ))}
    </ul>
  );
}
```

`searchText`를 입력할 때마다 첫 번째 `useMemo`(`filteredProducts`)는 실행되지 않는다. `products`와 `maxPrice`는 변하지 않았으므로 캐시를 그대로 쓴다. 두 번째 `useMemo`만 재실행된다.

## React.memo와 함께 쓸 때

자식 컴포넌트에 객체나 배열을 prop으로 넘길 때 `useMemo`가 중요해진다.

```jsx
function ParentComponent({ items }) {
  // useMemo 없이 매 렌더마다 새 배열 생성
  // → React.memo로 감싼 자식도 항상 리렌더됨
  const filtered = items.filter(i => i.active); // ❌

  // useMemo 사용 → items가 바뀔 때만 새 배열
  const filteredMemo = useMemo(
    () => items.filter(i => i.active),
    [items]
  ); // ✅

  return <ExpensiveChild data={filteredMemo} />;
}

const ExpensiveChild = React.memo(({ data }) => {
  // data 레퍼런스가 같으면 리렌더 생략
  return <div>{data.length} 항목</div>;
});
```

`React.memo`는 prop의 **레퍼런스**를 비교한다. `useMemo` 없이 인라인으로 배열을 만들면 매 렌더마다 새 레퍼런스가 생겨 `React.memo`가 무의미해진다.

## useEffect 의존성에 객체 넘길 때

```jsx
function SearchResults({ query }) {
  // useMemo 없으면 매 렌더마다 새 객체 → useEffect 무한 실행 위험
  const options = useMemo(
    () => ({ page: 1, pageSize: 20, query }),
    [query]
  );

  useEffect(() => {
    fetchResults(options);
  }, [options]); // options 레퍼런스 기준으로 실행 여부 결정

  // ...
}
```

`query`가 바뀔 때만 `options` 객체가 새로 만들어지고, 그때만 Effect가 실행된다.

## 언제 쓰고, 언제 피할까

![useMemo 사용 기준](/assets/posts/react-usememo-when-to-use.svg)

**써야 할 때**:
- 수천 개 항목을 정렬·필터링하는 계산
- DevTools Profiler에서 렌더링 병목으로 확인된 컴포넌트
- `React.memo`로 감싼 자식에 넘기는 객체/배열
- `useEffect` 의존성 배열에 넣는 객체/배열

**피해야 할 때**:
- 단순 덧셈이나 문자열 연결처럼 마이크로초 단위 계산
- 원시값(숫자, 문자열, 불리언) 반환
- 자식에 prop으로 넘기지 않는 값
- React.memo로 감싸지 않은 자식의 prop

메모이제이션도 비용이 있다. 의존성 비교(`Object.is` 호출), 이전 값 메모리 보관, 로직 복잡도 증가. 단순한 계산에 `useMemo`를 남발하면 오히려 성능이 나빠질 수 있다.

## 흔한 실수 — 의존성 누락

```jsx
// ❌ 잘못된 예: count가 deps에 없음
const doubled = useMemo(() => count * 2, []); // 항상 0 반환

// ✅ 올바른 예
const doubled = useMemo(() => count * 2, [count]);
```

ESLint 플러그인 `eslint-plugin-react-hooks`의 `exhaustive-deps` 규칙이 의존성 누락을 자동으로 경고해준다.

## useMemo vs useCallback

두 훅 모두 메모이제이션이지만 대상이 다르다.

```jsx
// useMemo: 값을 메모이제이션
const sortedList = useMemo(() => [...list].sort(), [list]);

// useCallback: 함수를 메모이제이션
const handleClick = useCallback((id) => {
  setSelected(id);
}, []);
// useCallback(fn, deps) === useMemo(() => fn, deps)
```

`useCallback`은 다음 글에서 상세히 다룬다.

---

**지난 글:** [데이터 페칭 패턴 비교 — useEffect, SWR, TanStack Query](/posts/react-data-fetching-patterns/)

**다음 글:** [useCallback 완전 정복 — 함수 메모이제이션](/posts/react-usecallback/)

<br>
읽어주셔서 감사합니다. 😊
