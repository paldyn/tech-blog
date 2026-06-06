---
title: "useSyncExternalStore로 외부 상태 구독하기"
description: "React 18의 useSyncExternalStore 훅으로 Redux, Zustand 같은 외부 저장소나 브라우저 API를 안전하게 구독하는 방법, subscribe/getSnapshot 설계 원칙을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["React", "useSyncExternalStore", "외부상태", "React18", "상태관리", "Redux", "Zustand"]
featured: false
draft: false
---

[지난 글](/posts/react-useid/)에서 SSR 안전한 ID 생성을 위한 `useId`를 살펴봤다. 이번에는 React 외부의 상태(Redux, Zustand, 브라우저 API)를 React 컴포넌트에서 구독할 때 발생하는 tearing 문제와 이를 해결하는 `useSyncExternalStore`를 다룬다.

## 외부 상태 구독의 문제

React 18 이전에는 외부 저장소를 구독할 때 `useEffect`와 `useState`를 조합했다.

```jsx
// ❌ 옛날 방식 — tearing 문제 있음
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return width;
}
```

React 18의 Concurrent Mode에서는 렌더링이 중단되고 재개될 수 있다. 이 과정에서 외부 상태가 변경되면 같은 렌더 사이클 안에서 다른 컴포넌트가 서로 다른 값을 읽는 **tearing**(화면 찢김) 현상이 생길 수 있다. `useSyncExternalStore`는 이 문제를 원천 차단한다.

## useSyncExternalStore 기본 구조

```jsx
const snapshot = useSyncExternalStore(
  subscribe,        // (callback) => unsubscribe 함수
  getSnapshot,      // () => 현재 상태 (동기적, 동일 상태면 동일 레퍼런스)
  getServerSnapshot // 선택: SSR에서 사용할 초기값
);
```

![useSyncExternalStore 동작 원리](/assets/posts/react-usesyncexternalstore-concept.svg)

`subscribe`가 `callback`을 등록하고 저장소 변경 시 호출하면 React가 리렌더를 예약한다. `getSnapshot`이 반환하는 값이 이전과 다르면 컴포넌트가 리렌더된다.

## 네트워크 상태 구독

```jsx
// subscribe, getSnapshot은 컴포넌트 외부에 정의 (렌더마다 재생성 방지)
function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // SSR: 서버에서는 온라인으로 가정
}

function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function StatusIndicator() {
  const isOnline = useOnlineStatus();
  return (
    <span style={{ color: isOnline ? '#55c555' : '#e05555' }}>
      {isOnline ? '온라인' : '오프라인'}
    </span>
  );
}
```

![useSyncExternalStore 예시](/assets/posts/react-usesyncexternalstore-example.svg)

## 미니 전역 스토어 만들기

`useSyncExternalStore`를 이용해 라이브러리 없이 간단한 전역 상태 관리를 구현할 수 있다.

```jsx
function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getSnapshot() {
      return state;
    },
    setState(updater) {
      state = typeof updater === 'function' ? updater(state) : updater;
      listeners.forEach(cb => cb()); // 모든 구독자에게 알림
    },
  };
}

// 전역 상태 생성 (모듈 레벨)
const counterStore = createStore({ count: 0 });

// 훅
function useCounter() {
  const { count } = useSyncExternalStore(
    counterStore.subscribe,
    counterStore.getSnapshot
  );
  return {
    count,
    increment: () => counterStore.setState(s => ({ count: s.count + 1 })),
    decrement: () => counterStore.setState(s => ({ count: s.count - 1 })),
  };
}

// 두 컴포넌트가 같은 전역 상태 공유
function CounterA() {
  const { count, increment } = useCounter();
  return <button onClick={increment}>A: {count}</button>;
}

function CounterB() {
  const { count, decrement } = useCounter();
  return <button onClick={decrement}>B: {count}</button>;
}
```

이것이 사실상 Zustand의 핵심 동작 방식이다.

## getSnapshot 설계 주의사항

```jsx
// ❌ 매번 새 객체 반환 → 무한 리렌더
function getSnapshot() {
  return { ...store.state }; // 항상 새 레퍼런스
}

// ✅ 상태가 바뀌지 않으면 동일 레퍼런스 반환
let cachedSnapshot = store.state;
function getSnapshot() {
  if (store.state !== cachedSnapshot) {
    cachedSnapshot = store.state;
  }
  return cachedSnapshot;
}
```

React는 `getSnapshot` 반환값을 `Object.is`로 비교한다. 같은 상태인데도 매번 새 객체를 만들면 무한 리렌더가 발생한다.

## subscribe 안정성 요구사항

```jsx
// ❌ 잘못된 예: 렌더마다 새 함수 생성
function MyComponent() {
  return useSyncExternalStore(
    (cb) => {  // 렌더마다 새 함수 → React 경고
      store.subscribe(cb);
      return () => store.unsubscribe(cb);
    },
    store.getSnapshot
  );
}

// ✅ 컴포넌트 외부에서 정의
const subscribe = (cb) => {
  store.subscribe(cb);
  return () => store.unsubscribe(cb);
};

function MyComponent() {
  return useSyncExternalStore(subscribe, store.getSnapshot);
}
```

`subscribe` 함수가 렌더마다 바뀌면 React는 매 렌더마다 구독 해지 후 재구독을 반복한다. 모듈 레벨이나 컴포넌트 외부에 정의하면 항상 동일 레퍼런스가 유지된다.

---

**지난 글:** [useId — 고유 ID 생성 훅](/posts/react-useid/)

**다음 글:** [Context 성능 최적화 — 불필요한 리렌더 막기](/posts/react-context-performance/)

<br>
읽어주셔서 감사합니다. 😊
