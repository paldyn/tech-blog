---
title: "cleanup 함수 — Effect를 되돌리는 반환값"
description: "useEffect의 cleanup 함수가 실행되는 세 가지 시점(의존성 변경 직전, 언마운트), 이벤트 리스너·타이머·구독의 cleanup 패턴, Strict Mode에서 두 번 실행되는 이유, 그리고 cleanup 없이 발생하는 메모리 누수를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React", "useEffect", "cleanup", "메모리누수", "StrictMode", "이벤트리스너", "구독"]
featured: false
draft: false
---

[지난 글](/posts/react-effect-dependencies/)에서 의존성 배열이 Object.is()로 비교되는 원리와 흔한 함정들을 살펴봤다. 이번에는 `useEffect`가 반환하는 cleanup 함수에 집중한다. cleanup은 단순한 "뒷정리"가 아니라, Effect가 맺은 외부 시스템과의 연결을 정확히 해제하는 책임을 진다. 이것을 빠뜨리면 메모리 누수, 중복 구독, 오래된 클로저 같은 버그가 조용히 쌓인다.

## cleanup이 실행되는 세 가지 시점

cleanup 함수는 세 시점에 실행된다.

1. **언마운트 시** — 컴포넌트가 DOM에서 제거될 때
2. **의존성 변경 직전** — 다음 Effect가 실행되기 바로 전
3. **Strict Mode 개발 환경** — 마운트 직후 cleanup → Effect 재실행 (의도적)

두 번째가 핵심이다. 의존성이 바뀌면 React는 이전 Effect를 정리한 다음 새 Effect를 실행한다. 즉, Cleanup → Effect 순서가 React에 의해 보장된다.

![cleanup 함수 실행 시점](/assets/posts/react-effect-cleanup-lifecycle.svg)

```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createChatConnection(roomId);
    connection.connect();

    // cleanup: 이전 roomId의 연결 해제
    return () => connection.disconnect();
  }, [roomId]);
}
```

`roomId`가 `'general'`에서 `'random'`으로 바뀌면:
1. `'general'` 연결 cleanup → `disconnect()` 호출
2. `'random'` 연결 setup → `connect()` 호출

## 자주 쓰는 cleanup 패턴

세 가지 패턴이 가장 흔하다. 공통점은 **등록/설정과 해제/정리가 항상 짝을 이룬다**는 것이다.

![자주 쓰는 cleanup 패턴](/assets/posts/react-effect-cleanup-patterns.svg)

### 이벤트 리스너

```jsx
useEffect(() => {
  const el = ref.current;
  el.addEventListener('click', handleClick);

  return () => {
    el.removeEventListener('click', handleClick);
  };
}, [handleClick]);
```

`addEventListener`와 `removeEventListener`는 반드시 **같은 함수 참조**를 써야 한다. `handleClick`이 매 렌더마다 새 함수로 만들어진다면 `useCallback`으로 참조를 고정하거나, 의존성 배열에 포함시켜야 한다.

### 타이머와 인터벌

```jsx
useEffect(() => {
  const timerId = setTimeout(() => {
    setVisible(false);
  }, 3000);

  return () => clearTimeout(timerId);
}, []);

// 인터벌
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, [tick]);
```

타이머 ID를 반드시 변수에 저장해 cleanup에서 참조해야 한다.

### 구독 (Subscription)

```jsx
useEffect(() => {
  const unsubscribe = store.subscribe(onStoreChange);

  // 해지 함수를 그대로 반환
  return unsubscribe;
}, []);
```

구독 패턴에서 cleanup 함수를 반환할 때 두 가지 방법이 있다.

```jsx
// 방법 1: 함수 직접 반환
return unsubscribe;

// 방법 2: 래퍼 함수로 반환
return () => unsubscribe();
```

방법 1이 간결하지만, `unsubscribe`가 인수를 받는 함수라면 래퍼로 감싸야 한다. React는 cleanup 함수를 인수 없이 호출하기 때문이다.

## Strict Mode에서 두 번 실행되는 이유

개발 환경의 Strict Mode에서는 마운트 시 Effect를 **의도적으로 두 번** 실행한다.

```
마운트 → Effect ① → Cleanup ① → Effect ②
```

이는 버그를 찾기 위한 것이다. cleanup이 올바르게 구현됐다면 Effect가 두 번 실행되어도 앱 동작이 같아야 한다. cleanup 없이 WebSocket을 두 번 연결하면 두 개의 연결이 열린 채 남는다 — Strict Mode는 이런 문제를 개발 중에 즉시 드러낸다.

```jsx
// 잘못된 코드 — cleanup 없음
useEffect(() => {
  const ws = new WebSocket('wss://example.com');
  ws.onmessage = handleMessage;
  // cleanup 없음 → Strict Mode에서 두 번 연결됨
}, []);

// 올바른 코드
useEffect(() => {
  const ws = new WebSocket('wss://example.com');
  ws.onmessage = handleMessage;

  return () => ws.close(); // cleanup 있음 → 첫 번째 연결 닫힌 후 두 번째 연결
}, []);
```

## cleanup 없이 발생하는 문제들

cleanup을 빠뜨렸을 때 실제로 어떤 일이 생기는지 살펴보자.

### 중복 이벤트 리스너

```jsx
// 문제: dependency가 바뀔 때마다 리스너가 추가만 됨
useEffect(() => {
  document.addEventListener('keydown', handleKey);
  // cleanup 없음
}, [handleKey]);

// roomId가 5번 바뀌면 5개의 리스너가 등록됨
// 키 한 번 누를 때 handleKey가 5번 호출됨
```

### 오래된 상태를 참조하는 타이머

```jsx
useEffect(() => {
  const id = setInterval(() => {
    // cleanup 없이 count가 바뀌면
    // 오래된 count를 참조하는 인터벌이 계속 실행됨
    console.log(count);
  }, 1000);
  // clearInterval 없음
}, [count]);
```

### 언마운트된 컴포넌트 state 업데이트

```jsx
useEffect(() => {
  fetchUser(userId).then(user => {
    setUser(user); // 컴포넌트가 언마운트됐다면 경고 발생
  });
}, [userId]);
```

이 문제의 해결책은 다음 글에서 다룰 cleanup + ignore 패턴과 AbortController다.

## cleanup 함수 작성 원칙

Effect 안에서 **어떤 외부 시스템과 연결했다면, 반드시 그 연결을 끊는 cleanup을 작성한다**.

```jsx
// 기억하기 쉬운 규칙
useEffect(() => {
  // 연결 setup
  const resource = createResource();

  return () => {
    // 연결 teardown (setup과 대칭)
    resource.destroy();
  };
}, [deps]);
```

cleanup이 필요한지 모르겠다면, Effect를 두 번 실행해도 결과가 동일한지 확인하자. 동일하지 않다면 cleanup이 필요하다.

---

**지난 글:** [의존성 배열 — Object.is 비교와 흔한 함정들](/posts/react-effect-dependencies/)

**다음 글:** [useRef — DOM 참조와 렌더 사이 값 유지](/posts/react-useref/)

<br>
읽어주셔서 감사합니다. 😊
