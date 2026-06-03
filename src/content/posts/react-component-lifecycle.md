---
title: "함수형 컴포넌트 생명주기 — 마운트, 업데이트, 언마운트"
description: "함수형 컴포넌트의 생명주기 세 단계(마운트·업데이트·언마운트)를 useEffect와 useLayoutEffect의 실행 타이밍과 함께 설명하고, 각 단계에서 cleanup 함수가 어떻게 작동하는지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["React", "생명주기", "Lifecycle", "useEffect", "useLayoutEffect", "마운트", "언마운트"]
featured: false
draft: false
---

[지난 글](/posts/react-render-model/)에서 Render 단계와 Commit 단계로 나뉘는 React 렌더링 모델을 살펴봤다. 이번에는 컴포넌트의 생명주기를 살펴본다. 클래스 컴포넌트에서는 `componentDidMount`, `componentDidUpdate`, `componentWillUnmount` 같은 메서드로 관리했지만, 함수형 컴포넌트에서는 `useEffect`가 이 역할을 대신한다.

## 생명주기 세 단계

함수형 컴포넌트의 생명주기는 세 단계로 구성된다.

**마운트(Mount)**: 컴포넌트가 처음 DOM에 추가될 때다. 컴포넌트 함수가 처음 실행되고, DOM이 만들어지며, `useEffect(fn, [])`가 실행된다.

**업데이트(Update)**: state나 props가 변경되어 리렌더링이 발생할 때다. 컴포넌트 함수가 다시 실행되고, 변경된 부분만 DOM에 반영된다.

**언마운트(Unmount)**: 컴포넌트가 DOM에서 제거될 때다. `useEffect`가 반환한 cleanup 함수가 실행된다.

![함수형 컴포넌트 생명주기 — 마운트·업데이트·언마운트](/assets/posts/react-component-lifecycle-stages.svg)

## useEffect로 생명주기 다루기

`useEffect`는 의존성 배열에 따라 다른 생명주기 단계에서 실행된다.

```jsx
function UserCard({ userId }) {
  const [user, setUser] = useState(null);

  // 마운트 시 1회 실행
  useEffect(() => {
    initializeAnalytics();
    return () => cleanupAnalytics(); // 언마운트 시 실행
  }, []);

  // userId 변경 시마다 실행
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  // 매 렌더마다 실행 (의존성 배열 없음)
  useEffect(() => {
    document.title = user ? user.name : '로딩 중...';
  });

  return user ? <div>{user.name}</div> : <Spinner />;
}
```

## Cleanup 함수의 실행 타이밍

cleanup 함수는 두 가지 시점에 실행된다.

1. **언마운트 시**: 컴포넌트가 DOM에서 제거될 때
2. **effect 재실행 직전**: 의존성이 변경되어 effect가 다시 실행되기 전에 이전 effect의 cleanup이 먼저 호출된다

두 번째 케이스가 중요하다. 예를 들어 `userId`가 변경될 때 이전 userId로 연 WebSocket을 닫고 새 userId로 연결을 시작해야 한다.

```jsx
useEffect(() => {
  const ws = new WebSocket(`wss://example.com/user/${userId}`);
  ws.onmessage = handleMessage;

  return () => {
    ws.close(); // userId 변경 시 이전 연결 먼저 닫힘
  };
}, [userId]);

// userId가 1 → 2로 바뀌면:
// 1. cleanup 실행 (userId=1인 ws.close())
// 2. effect 실행 (userId=2인 새 연결 열기)
```

## useLayoutEffect와 실행 타이밍 비교

`useEffect`와 `useLayoutEffect`의 차이는 실행 타이밍이다.

`useLayoutEffect`는 DOM 변경 직후, **화면에 페인트되기 전에** 동기적으로 실행된다. `useEffect`는 화면 페인트가 완료된 **후에** 비동기적으로 실행된다.

![Effect 실행 타이밍 비교](/assets/posts/react-component-lifecycle-effects.svg)

```jsx
function MeasuredComponent() {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    // 페인트 전에 DOM 크기 측정
    // 깜빡임 없이 정확한 크기 얻기 가능
    setHeight(ref.current.offsetHeight);
  });

  useEffect(() => {
    // 페인트 후 비동기 실행
    // 무거운 작업, 데이터 페칭 등
    fetchData();
  });

  return <div ref={ref} style={{ minHeight: height }}>...</div>;
}
```

대부분의 경우 `useEffect`로 충분하다. `useLayoutEffect`는 DOM 크기·위치를 측정하거나 측정값에 따라 DOM을 즉시 조정해야 할 때 사용한다. `useLayoutEffect`는 동기적으로 실행되므로 무거운 작업을 넣으면 페인트가 지연된다.

## 클래스 컴포넌트 생명주기와의 대응

클래스 컴포넌트를 함수형으로 마이그레이션할 때 생명주기 메서드를 다음처럼 대응할 수 있다.

```jsx
// componentDidMount
useEffect(() => { /* 초기화 */ }, []);

// componentDidUpdate (특정 값 변경 시)
useEffect(() => { /* 업데이트 */ }, [value]);

// componentWillUnmount
useEffect(() => {
  return () => { /* 정리 */ };
}, []);

// componentDidMount + componentDidUpdate
useEffect(() => { /* 항상 */ }); // 의존성 배열 없음
```

단, `useEffect`는 DOM 페인트 후 비동기 실행이므로 `componentDidMount`와 완전히 동일하지 않다. 동기적으로 DOM을 조작해야 한다면 `useLayoutEffect`가 `componentDidMount`에 더 가깝다.

## 마운트 여부 확인

가끔 "컴포넌트가 마운트된 후에만 어떤 작업을 하고 싶다"는 요구가 있다. `isMounted` 패턴으로 해결한다.

```jsx
function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <>{children}</>;
}
```

이 패턴은 서버사이드 렌더링 환경에서 브라우저 전용 API를 사용하는 컴포넌트를 감쌀 때 유용하다. 서버에서는 `null`을 렌더링하고, 클라이언트에서 하이드레이션된 후 실제 콘텐츠를 보여준다.

---

**지난 글:** [React 렌더링 모델](/posts/react-render-model/)

**다음 글:** [Virtual DOM — 개념과 작동 원리](/posts/react-virtual-dom/)

<br>
읽어주셔서 감사합니다. 😊
