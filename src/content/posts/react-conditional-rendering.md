---
title: "조건부 렌더링"
description: "if/else, 삼항 연산자, && 단락 평가 등 React에서 조건에 따라 다른 UI를 렌더링하는 다양한 패턴과 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["React", "조건부렌더링", "JSX", "삼항연산자", "단락평가"]
featured: false
draft: false
---

[지난 글](/posts/react-props/)에서 props로 데이터를 전달하는 방법을 배웠습니다. 이번에는 상황에 따라 다른 UI를 보여주는 **조건부 렌더링** 패턴들을 살펴봅니다. React에서는 별도의 템플릿 문법 없이 JavaScript 표현식만으로 조건부 렌더링을 처리합니다.

---

## 패턴 1 — if/else (JSX 외부)

가장 명확한 방법은 `return` 이전에 일반 `if/else`로 분기하는 것입니다.

```jsx
function Notification({ type, message }) {
  if (type === 'error') {
    return (
      <div className="alert alert-error">
        <strong>오류:</strong> {message}
      </div>
    );
  }

  if (type === 'success') {
    return (
      <div className="alert alert-success">
        ✓ {message}
      </div>
    );
  }

  return <div className="alert">{message}</div>;
}
```

케이스가 셋 이상이거나 조건 로직이 복잡할 때 이 패턴이 가장 읽기 쉽습니다.

---

## 패턴 2 — 삼항 연산자

JSX 안에서 `조건 ? 참 : 거짓` 형태로 인라인 분기합니다.

```jsx
function StatusBadge({ isOnline }) {
  return (
    <span className={`badge ${isOnline ? 'badge-green' : 'badge-gray'}`}>
      {isOnline ? '온라인' : '오프라인'}
    </span>
  );
}
```

A와 B 중 하나를 선택할 때 간결합니다. 단, 삼항을 **중첩**하면 가독성이 급격히 떨어지므로 2단 이상은 피합니다.

```jsx
// ❌ 중첩 삼항 — 읽기 어려움
{loading ? <Spinner /> : error ? <ErrorMsg /> : <Content />}

// ✅ if/else로 분리하거나 변수로 추출
let content;
if (loading) content = <Spinner />;
else if (error) content = <ErrorMsg />;
else content = <Content />;
return <div>{content}</div>;
```

![조건부 렌더링 패턴](/assets/posts/react-conditional-rendering-patterns.svg)

---

## 패턴 3 — && 단락 평가

조건이 참일 때만 렌더링하고, 거짓이면 아무것도 보이지 않아야 할 때 씁니다.

```jsx
function Inbox({ messages }) {
  return (
    <div>
      <h1>받은 편지함</h1>
      {messages.length > 0 && (
        <p className="badge">{messages.length}개의 새 메시지</p>
      )}
    </div>
  );
}
```

### ⚠ 숫자 0의 함정

`&&` 왼쪽에 숫자를 그대로 두면 0일 때 화면에 `0`이 출력됩니다. JavaScript에서 `0`은 falsy이지만, React는 숫자 `0`을 텍스트 노드로 렌더링합니다.

```jsx
// ❌ count가 0이면 "0"이 화면에 나타남
{count && <Badge>{count}</Badge>}

// ✅ Boolean으로 명시적 변환
{count > 0 && <Badge>{count}</Badge>}
// 또는
{!!count && <Badge>{count}</Badge>}
```

---

## 패턴 4 — null 반환

컴포넌트 자체를 아무것도 렌더링하지 않으려면 `null`을 반환합니다.

```jsx
function Tooltip({ text, visible }) {
  if (!visible) return null;
  return <div className="tooltip">{text}</div>;
}
```

`null`을 반환해도 컴포넌트는 여전히 마운트된 상태입니다. 완전히 제거하려면 부모에서 컴포넌트 자체를 렌더링하지 않아야 합니다.

---

## 변수에 JSX 저장

복잡한 조건 분기 결과를 변수에 저장하면 JSX를 깔끔하게 유지할 수 있습니다.

```jsx
function Dashboard({ user, loading, error }) {
  let content;

  if (loading) {
    content = <LoadingSpinner />;
  } else if (error) {
    content = <ErrorBoundaryMessage error={error} />;
  } else if (!user) {
    content = <LoginPrompt />;
  } else {
    content = <UserDashboard user={user} />;
  }

  return (
    <main className="dashboard">
      <Header />
      {content}
      <Footer />
    </main>
  );
}
```

---

## 패턴 선택 가이드

![조건부 렌더링 패턴 선택 가이드](/assets/posts/react-conditional-rendering-comparison.svg)

- **케이스가 여러 개**: `if/else` 또는 JSX 변수
- **A 또는 B**: 삼항 연산자
- **보여주거나 숨기거나**: `&&` (숫자 조건은 Boolean 변환)
- **중첩 삼항**: 피하고 변수/컴포넌트로 분리

---

**지난 글:** [props로 데이터 전달하기](/posts/react-props/)

**다음 글:** [리스트 렌더링](/posts/react-list-rendering/)

<br>
읽어주셔서 감사합니다. 😊
