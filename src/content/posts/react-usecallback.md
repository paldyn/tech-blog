---
title: "useCallback 완전 정복 — 함수 메모이제이션"
description: "useCallback의 동작 원리, React.memo와 세트로 써야 효과가 있는 이유, useEffect 의존성에 함수를 넣을 때의 패턴, 그리고 언제 쓰면 안 되는지를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["React", "useCallback", "메모이제이션", "성능최적화", "hooks", "React.memo"]
featured: false
draft: false
---

[지난 글](/posts/react-usememo/)에서 `useMemo`로 계산 결과를 캐싱하는 방법을 배웠다. `useCallback`은 같은 원리로 함수 자체를 캐싱한다. 두 훅은 쌍둥이처럼 자주 함께 등장한다.

## useCallback 기본 구조

```jsx
const memoizedFn = useCallback(fn, [deps]);
// === useMemo(() => fn, [deps])
```

`useCallback(fn, deps)`는 `fn` 함수를 deps가 바뀔 때까지 캐싱한다. JavaScript에서 함수는 객체이므로 매 렌더마다 새로 생성된다. `useCallback`은 이 레퍼런스를 고정한다.

![useCallback 동작 원리](/assets/posts/react-usecallback-concept.svg)

## 왜 함수 레퍼런스가 문제인가

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  // 매 렌더마다 새 함수 객체 생성
  const handleClick = () => console.log('clicked');

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <Child onClick={handleClick} />
    </>
  );
}

const Child = React.memo(({ onClick }) => {
  console.log('Child 렌더');
  return <button onClick={onClick}>클릭</button>;
});
```

`count`가 바뀔 때마다 `Parent`가 리렌더되고, 그때마다 `handleClick`은 새 함수 객체로 생성된다. `React.memo`로 감싼 `Child`는 prop을 비교하지만, `onClick` prop의 레퍼런스가 매번 달라져서 결국 항상 리렌더된다.

`useCallback`으로 고정하면 이 문제가 사라진다.

```jsx
const handleClick = useCallback(() => {
  console.log('clicked');
}, []); // deps가 빈 배열 → 컴포넌트 수명 동안 동일 함수
```

이제 `count`가 바뀌어도 `handleClick`의 레퍼런스가 유지되고, `Child`는 리렌더되지 않는다.

## React.memo와 useCallback은 세트

`useCallback`만 쓰면 효과가 없다. `React.memo`로 감싼 자식에 넘길 때만 의미가 있다.

```jsx
// ❌ 효과 없음 — Child가 React.memo로 감싸지지 않음
function Parent() {
  const handleClick = useCallback(() => {}, []);
  return <Child onClick={handleClick} />;
}

function Child({ onClick }) { // React.memo 없음
  return <button onClick={onClick}>클릭</button>;
}
```

`React.memo` 없이 일반 함수 컴포넌트는 부모가 렌더될 때 항상 함께 렌더된다. prop 비교 자체를 하지 않기 때문에 `useCallback`이 무의미하다.

## useEffect 의존성에 함수 넣기

콜백 함수를 `useEffect` 의존성으로 넣어야 할 때 `useCallback`이 필요하다.

```jsx
function SearchBox({ onSearch }) {
  const [query, setQuery] = useState('');

  // onSearch가 렌더마다 새로 만들어지면 useEffect가 무한 실행될 수 있음
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]); // onSearch를 deps에 포함

  return (
    <input value={query} onChange={e => setQuery(e.target.value)} />
  );
}

// 부모에서 useCallback으로 안정화
function Parent() {
  const handleSearch = useCallback((q) => {
    fetch(`/api/search?q=${q}`).then(/* ... */);
  }, []); // 의존성 없으면 항상 동일

  return <SearchBox onSearch={handleSearch} />;
}
```

![useCallback 패턴](/assets/posts/react-usecallback-patterns.svg)

## 커스텀 훅 내에서

커스텀 훅이 함수를 반환할 때 `useCallback`으로 감싸면 사용처에서 안정성이 보장된다.

```jsx
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => {
    setCount(c => c + 1);
  }, []); // setCount는 안정적이므로 deps 불필요

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  return { count, increment, reset };
}
```

`increment`와 `reset`을 `useCallback`으로 감싸면 훅을 사용하는 컴포넌트가 이 함수들을 `useEffect` deps나 `React.memo` 자식 prop에 안전하게 사용할 수 있다.

## 흔한 실수 — deps에 상태 누락

```jsx
// ❌ 잘못된 예: count가 deps에 없음
const increment = useCallback(() => {
  setCount(count + 1); // 클로저의 count가 0으로 고정됨
}, []);

// ✅ 올바른 방법 1: deps 포함
const increment = useCallback(() => {
  setCount(count + 1);
}, [count]);

// ✅ 올바른 방법 2: 함수형 업데이트로 deps 제거
const increment = useCallback(() => {
  setCount(c => c + 1); // count를 참조하지 않으므로 deps 불필요
}, []);
```

함수형 업데이트(`c => c + 1`)는 현재 state 값을 인수로 받아 계산하므로 클로저 문제가 없다. `useCallback` + 상태 업데이트 조합에서 자주 쓰이는 패턴이다.

## useMemo vs useCallback 정리

```jsx
// useMemo: 값을 캐싱
const sortedList = useMemo(() => [...list].sort(), [list]);

// useCallback: 함수를 캐싱
const handleSort = useCallback(() => {
  setSorted(s => !s);
}, []);

// useCallback은 useMemo의 특수 케이스
// useCallback(fn, deps) === useMemo(() => fn, deps)
```

실제로 React 내부에서 `useCallback`은 `useMemo`를 함수용으로 특화한 것이다.

---

**지난 글:** [useMemo 완전 정복 — 계산 결과 메모이제이션](/posts/react-usememo/)

**다음 글:** [커스텀 훅 만들기 — 로직을 훅으로 분리하는 법](/posts/react-custom-hooks/)

<br>
읽어주셔서 감사합니다. 😊
