---
title: "useRef — DOM 참조와 렌더 사이 값 유지"
description: "useRef의 두 가지 역할인 DOM 직접 참조와 렌더 간 값 유지, useState와의 차이, 렌더 중 .current 접근 금지 규칙, 그리고 이전 값 저장 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["React", "useRef", "DOM참조", "렌더링", "useState", "이전값", "타이머"]
featured: false
draft: false
---

[지난 글](/posts/react-effect-cleanup/)에서 cleanup 함수가 Effect를 어떻게 되돌리는지 살펴봤다. 이번에는 `useRef`를 다룬다. useRef는 이름에 "ref"가 있어서 DOM 참조 전용으로 오해하기 쉽지만, 실제로는 두 가지 역할을 한다. 하나는 DOM을 직접 참조하는 것이고, 다른 하나는 렌더를 유발하지 않고 렌더 사이에 값을 유지하는 것이다.

## useRef의 구조

`useRef(initialValue)`는 `{ current: initialValue }` 형태의 단순한 객체를 반환한다. 이 객체는 컴포넌트 생애 동안 **동일한 참조**를 유지한다.

```jsx
const ref = useRef(null);
// ref === { current: null } — 항상 같은 객체
```

`ref.current`를 바꿔도 React는 알지 못한다. 리렌더가 일어나지 않는다. 이 점이 `useState`와의 가장 큰 차이다.

![useRef의 두 가지 용도](/assets/posts/react-useref-overview.svg)

## DOM 직접 참조

가장 흔한 사용 패턴은 JSX의 `ref` prop에 연결해 DOM 요소를 직접 가리키는 것이다.

```jsx
function SearchBar() {
  const inputRef = useRef(null);

  function handleClick() {
    // DOM 메서드 직접 호출
    inputRef.current.focus();
  }

  return (
    <>
      <input ref={inputRef} type="text" />
      <button onClick={handleClick}>검색창 포커스</button>
    </>
  );
}
```

React는 컴포넌트가 마운트되면 `inputRef.current`에 해당 DOM 요소를 연결하고, 언마운트되면 다시 `null`로 돌린다. 따라서 Effect 내부에서 DOM을 접근하면 항상 실제 요소를 얻을 수 있다.

```jsx
useEffect(() => {
  inputRef.current.focus(); // 마운트 후 자동 포커스
}, []);
```

## useRef vs useState

두 훅의 차이를 명확히 이해하는 것이 중요하다.

![useRef vs useState 비교](/assets/posts/react-useref-vs-state.svg)

```jsx
function Counter() {
  const [count, setCount] = useState(0);  // 변경 시 리렌더
  const countRef = useRef(0);             // 변경 시 리렌더 없음

  function handleClick() {
    setCount(c => c + 1);     // UI 업데이트
    countRef.current += 1;   // 값만 바뀜, 화면 변화 없음
  }
}
```

규칙은 단순하다. **화면에 표시되는 값**은 `useState`, **화면에 영향 없는 값**은 `useRef`.

## 렌더 중 .current 접근 금지

중요한 제약이 하나 있다. **렌더 함수 본문에서 `ref.current`를 읽거나 쓰면 안 된다**.

```jsx
// 잘못된 코드
function MyComponent({ value }) {
  const ref = useRef(0);
  ref.current = value; // 렌더 중 쓰기 — 금지

  return <div>{ref.current}</div>; // 렌더 중 읽기 — 금지
}
```

React는 Concurrent Mode에서 동일한 렌더를 여러 번 실행할 수 있다. 렌더 중 ref를 쓰면 동일 렌더가 반복될 때 예측 불가능한 값이 된다. ref는 **이벤트 핸들러나 Effect 내부**에서만 읽고 쓴다.

```jsx
// 올바른 코드 — Effect에서 접근
useEffect(() => {
  ref.current = value; // Effect는 커밋 후 실행 — 안전
});
```

## 렌더 간 값 유지 패턴들

### 타이머 ID 저장

```jsx
function Debounce({ onSearch }) {
  const timerRef = useRef(null);

  function handleChange(e) {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(e.target.value);
    }, 300);
  }

  return <input onChange={handleChange} />;
}
```

타이머 ID는 UI에 표시할 필요가 없으므로 `useRef`가 적합하다. `useState`로 저장하면 `clearTimeout` 호출할 때마다 불필요한 리렌더가 생긴다.

### 이전 값 저장

```jsx
function usePrevious(value) {
  const ref = useRef(undefined);

  useEffect(() => {
    ref.current = value; // 렌더 후 업데이트
  });

  return ref.current; // 이번 렌더 시작 시점의 이전 값
}

function Counter() {
  const [count, setCount] = useState(0);
  const prevCount = usePrevious(count);

  return (
    <p>현재: {count}, 이전: {prevCount}</p>
  );
}
```

`useEffect`는 렌더 후 실행되므로 `ref.current` 업데이트는 다음 렌더에서 `usePrevious`를 호출할 때 반영된다. 현재 렌더에서는 이전 값을 읽고, Effect 후에 현재 값으로 업데이트되는 구조다.

### 외부 시스템 참조 (불변 참조)

```jsx
function Map({ center }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null); // 지도 라이브러리 인스턴스

  useEffect(() => {
    if (instanceRef.current === null) {
      instanceRef.current = new MapLibrary(mapRef.current);
    }
  }, []);

  useEffect(() => {
    instanceRef.current?.setCenter(center);
  }, [center]);

  return <div ref={mapRef} style={{ height: 400 }} />;
}
```

외부 라이브러리 인스턴스를 ref에 저장하는 패턴은 자주 쓰인다. 인스턴스를 `useState`에 넣으면 불필요한 리렌더가 생기고, 전역 변수로 두면 여러 인스턴스가 충돌한다.

## null 체크

DOM ref는 마운트 전이나 조건부 렌더 상황에서 `null`일 수 있으므로 optional chaining을 쓰는 습관이 좋다.

```jsx
// null 체크 없음 — 마운트 전 접근 시 에러
inputRef.current.focus(); // TypeError 가능

// 안전한 패턴
inputRef.current?.focus();

// Effect 내부에서는 마운트 후 보장
useEffect(() => {
  inputRef.current.focus(); // 여기서는 항상 DOM이 있음
}, []);
```

---

**지난 글:** [cleanup 함수 — Effect를 되돌리는 반환값](/posts/react-effect-cleanup/)

**다음 글:** [forwardRef — 부모가 자식 DOM을 제어하는 방법](/posts/react-forwardref/)

<br>
읽어주셔서 감사합니다. 😊
