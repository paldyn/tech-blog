---
title: "useEffect — 부수효과와 외부 시스템 동기화"
description: "useEffect의 목적과 실행 타이밍, 의존성 배열 세 가지 형태, cleanup 함수의 역할, 데이터 페칭 시 경쟁 조건 방지 패턴, 그리고 useEffect를 쓰지 말아야 할 상황까지 종합적으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["React", "useEffect", "부수효과", "SideEffect", "cleanup", "데이터페칭", "동기화"]
featured: false
draft: false
---

[지난 글](/posts/react-rules-of-hooks/)에서 훅의 두 가지 핵심 규칙과 그 이유를 살펴봤다. 이번에는 가장 많이 사용하면서도 잘못 사용되는 훅인 `useEffect`를 다룬다. useEffect의 목적, 정확한 실행 타이밍, cleanup 패턴, 그리고 쓰지 말아야 할 상황을 이해하면 코드가 훨씬 명확해진다.

## useEffect의 목적

`useEffect`는 **컴포넌트를 외부 시스템과 동기화**하기 위한 훅이다. 여기서 "외부 시스템"은 React가 직접 관리하지 않는 모든 것을 말한다.

- 브라우저 API (DOM, 타이머, 이벤트 리스너)
- 네트워크 요청 (데이터 페칭)
- WebSocket, SSE 연결
- 서드파티 위젯/라이브러리

```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    // 외부 시스템(WebSocket)과 동기화
    const connection = createChatConnection(roomId);
    connection.connect();

    return () => connection.disconnect(); // 동기화 해제
  }, [roomId]);
}
```

## 실행 타이밍

`useEffect`는 **브라우저가 화면을 페인트한 후** 비동기적으로 실행된다. DOM이 이미 반영된 상태다.

```
setState → 렌더 → DOM 반영 → 화면 페인트 → useEffect 실행
```

![useEffect 실행 타이밍](/assets/posts/react-useeffect-timing.svg)

컴포넌트가 처음 화면에 표시된 후 useEffect가 실행되므로, 데이터를 가져오는 동안 로딩 UI를 보여주는 것이 자연스럽다.

## 의존성 배열 세 가지 형태

```jsx
// 1. 배열 없음 — 매 렌더마다 실행
useEffect(() => {
  document.title = `${count}회 클릭`;
}); // 위험: 무한 루프 가능

// 2. 빈 배열 — 마운트 시 1회
useEffect(() => {
  initializeTracking();
  return () => destroyTracking();
}, []);

// 3. 의존성 명시 — 변경 시마다
useEffect(() => {
  fetchUser(userId);
}, [userId]); // userId 변경 시 재실행
```

## cleanup 함수

cleanup 함수는 effect를 "되돌리는" 코드다. 두 시점에 실행된다.

1. 언마운트 시
2. 다음 effect 실행 직전 (의존성 변경 시)

![useEffect cleanup 패턴](/assets/posts/react-useeffect-cleanup.svg)

```jsx
// 이벤트 리스너 — 등록/제거 짝 맞추기
useEffect(() => {
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, [handleKey]);

// 인터벌 — 설정/해제 짝 맞추기
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);

// 구독 — 구독/해지 짝 맞추기
useEffect(() => {
  const unsubscribe = store.subscribe(onStoreChange);
  return unsubscribe; // 함수 직접 반환 가능
}, []);
```

## 데이터 페칭과 경쟁 조건

useEffect에서 데이터를 가져올 때 **경쟁 조건(race condition)**이 발생할 수 있다.

```jsx
// 문제가 있는 코드
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(data => {
      setUser(data); // userId가 빠르게 바뀌면 오래된 응답이 나중에 도착할 수 있음
    });
  }, [userId]);
}
```

`userId`가 1 → 2로 빠르게 바뀌면, userId=2 요청이 먼저 완료되고 userId=1 요청이 나중에 완료될 수 있다. 그러면 userId=2를 보고 있는데 userId=1의 데이터가 표시된다.

```jsx
// 올바른 코드 — ignore 플래그 패턴
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let ignore = false;

    fetchUser(userId).then(data => {
      if (!ignore) setUser(data); // cleanup 후엔 무시
    });

    return () => {
      ignore = true; // userId 바뀌면 이전 요청 무시
    };
  }, [userId]);

  return user ? <Profile user={user} /> : <Spinner />;
}
```

또는 AbortController를 사용해 요청 자체를 취소할 수 있다.

```jsx
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/user/${userId}`, { signal: controller.signal })
    .then(res => res.json())
    .then(setUser)
    .catch(err => {
      if (err.name !== 'AbortError') throw err; // 취소는 무시
    });

  return () => controller.abort();
}, [userId]);
```

## useEffect를 쓰지 말아야 할 경우

useEffect를 습관적으로 사용하기 전에, 꼭 필요한지 확인하자.

**props/state로 계산 가능한 값**은 렌더 중에 직접 계산한다.

```jsx
// 잘못된 패턴 — useEffect로 파생 state 만들기
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${firstName} ${lastName}`); // 불필요한 리렌더 추가 발생
}, [firstName, lastName]);

// 올바른 패턴 — 렌더 중 계산
const fullName = `${firstName} ${lastName}`;
```

**사용자 이벤트에 응답**하는 코드는 이벤트 핸들러에 둔다.

```jsx
// 잘못된 패턴
const [submitted, setSubmitted] = useState(false);
useEffect(() => {
  if (submitted) {
    sendForm(data); // 이벤트가 아닌 state 변화로 작동
  }
}, [submitted]);

// 올바른 패턴
function handleSubmit() {
  sendForm(data); // 이벤트 핸들러에서 직접 호출
}
```

---

**지난 글:** [훅의 규칙](/posts/react-rules-of-hooks/)

**다음 글:** [의존성 배열 — Object.is 비교와 함정들](/posts/react-effect-dependencies/)

<br>
읽어주셔서 감사합니다. 😊
