---
title: "조건부 렌더링 — 상황에 따라 다른 UI 보여주기"
description: "React 조건부 렌더링의 4가지 패턴(if/early return, 삼항 연산자, &&, 객체 맵), 숫자 0 함정, 중첩 삼항 회피, null 반환 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["조건부렌더링", "삼항연산자", "단락평가", "earlyreturn", "React패턴", "JSX"]
featured: false
draft: false
---

[지난 글](/posts/react-props-spreading/)에서 props spreading 패턴을 다뤘다. 이번 글에서는 React에서 가장 자주 쓰는 기법 중 하나인 **조건부 렌더링**을 모든 패턴과 함정과 함께 완전히 정리한다.

## 조건부 렌더링이란

특정 조건에 따라 다른 UI를 렌더링하는 것이다. React에서는 일반 JavaScript 조건문과 표현식을 활용한다.

```jsx
// 가장 단순한 예: 로그인 상태에 따라 다른 버튼
function AuthButton({ isLoggedIn }) {
  if (isLoggedIn) {
    return <button>로그아웃</button>;
  }
  return <button>로그인</button>;
}
```

## 4가지 패턴 비교

![조건부 렌더링 패턴 비교](/assets/posts/react-conditional-rendering-patterns.svg)

### 패턴 1: if / early return

컴포넌트 함수 안에서 일반 `if`를 쓴다. 조건을 만족하지 못하면 일찍 반환(early return)하는 방식이 가장 읽기 쉽다.

```jsx
function UserProfile({ user, isLoading }) {
  if (isLoading) return <Spinner />;
  if (!user) return <p>사용자를 찾을 수 없습니다.</p>;

  return (
    <div className="profile">
      <Avatar src={user.avatar} />
      <h2>{user.name}</h2>
    </div>
  );
}
```

**적합한 경우**: 조건이 3개 이상이거나, 조건별 렌더링 로직이 복잡할 때.

### 패턴 2: 삼항 연산자 (Ternary)

JSX 안에서 A 또는 B 중 하나를 선택할 때 쓴다.

```jsx
function StatusBadge({ isOnline }) {
  return (
    <span className={isOnline ? 'badge-green' : 'badge-gray'}>
      {isOnline ? '온라인' : '오프라인'}
    </span>
  );
}
```

**적합한 경우**: 두 가지 선택지가 명확할 때.

### 패턴 3: && 단락 평가

조건이 참일 때만 렌더링하고, 거짓이면 아무것도 보여주지 않을 때 쓴다.

```jsx
function Notification({ message, hasError }) {
  return (
    <div>
      <p>{message}</p>
      {hasError && <ErrorBanner />}
    </div>
  );
}
```

**적합한 경우**: "있으면 보여줘" 패턴.

### 패턴 4: 객체 맵

상태가 3가지 이상일 때 `switch`보다 객체 맵이 간결하다.

```jsx
function FetchStatus({ status, data }) {
  const content = {
    idle: <p>데이터를 불러오려면 검색하세요</p>,
    loading: <Spinner />,
    error: <ErrorMessage />,
    success: <DataTable data={data} />,
  };

  return <div className="container">{content[status]}</div>;
}
```

## 함정과 해결책

![조건부 렌더링 함정과 해결책](/assets/posts/react-conditional-rendering-pitfalls.svg)

### 함정 1: 숫자 0 렌더링

`&&` 연산자의 왼쪽이 falsy면 React는 `false`, `null`, `undefined`를 렌더링하지 않는다. 그런데 `0`은 falsy지만 **숫자이므로 렌더링된다.**

```jsx
const items = [];

// ❌ items.length가 0이면 화면에 "0"이 출력
{items.length && <ItemList items={items} />}

// ✅ 명시적 boolean 비교
{items.length > 0 && <ItemList items={items} />}
// 또는
{!!items.length && <ItemList items={items} />}
```

### 함정 2: 중첩 삼항 연산자

```jsx
// ❌ 읽기 어렵다
{status === 'loading'
  ? <Spinner />
  : status === 'error'
    ? <Error />
    : <DataView />}

// ✅ 별도 함수로 분리
function renderContent(status, data) {
  if (status === 'loading') return <Spinner />;
  if (status === 'error') return <Error />;
  return <DataView data={data} />;
}

// JSX에서 호출
{renderContent(status, data)}
```

## null 반환으로 숨기기

컴포넌트가 `null`을 반환하면 아무것도 렌더링되지 않는다. State와 Effect는 유지된다.

```jsx
function Tooltip({ visible, text, children }) {
  return (
    <div className="tooltip-wrapper">
      {children}
      {visible && (
        <div className="tooltip-bubble">{text}</div>
      )}
    </div>
  );
}

// 또는 컴포넌트 자체가 null을 반환
function DebugPanel({ isDev }) {
  if (!isDev) return null;  // 개발 환경 아니면 숨김

  return <div className="debug">...</div>;
}
```

---

**지난 글:** [Props Spreading — 유용하지만 주의가 필요한 패턴](/posts/react-props-spreading/)

**다음 글:** [리스트 렌더링 — 배열을 UI로 변환하기](/posts/react-list-rendering/)

<br>
읽어주셔서 감사합니다. 😊
