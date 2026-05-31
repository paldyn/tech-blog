---
title: "이벤트 처리"
description: "React의 SyntheticEvent 시스템과 이벤트 위임 방식, 핸들러 작성 패턴, preventDefault/stopPropagation 사용법, 그리고 핸들러에 인자를 전달하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["React", "이벤트처리", "SyntheticEvent", "onClick", "onChange"]
featured: false
draft: false
---

[지난 글](/posts/react-keys/)에서 key prop이 리스트 재조정에서 하는 역할을 살펴봤습니다. 이번에는 사용자 상호작용을 처리하는 **이벤트 핸들링** 시스템을 다룹니다. React는 HTML의 이벤트 속성과 비슷하지만 몇 가지 중요한 차이점이 있습니다.

---

## HTML 이벤트 vs React 이벤트

React 이벤트는 HTML 이벤트 속성과 유사하지만 다음 차이가 있습니다.

| 항목 | HTML | React |
|------|------|-------|
| 이름 | 소문자 (`onclick`) | camelCase (`onClick`) |
| 값 | 문자열 (`"fn()"`) | 함수 레퍼런스 (`{fn}`) |
| 기본 동작 방지 | `return false` 가능 | `e.preventDefault()` 필수 |
| 이벤트 객체 | 네이티브 Event | SyntheticEvent |

```jsx
// HTML
<button onclick="handleClick()">클릭</button>

// React
<button onClick={handleClick}>클릭</button>
```

---

## SyntheticEvent

React는 모든 이벤트를 **SyntheticEvent**로 감쌉니다. 이는 브라우저 네이티브 이벤트를 래핑한 크로스 브라우저 이벤트 객체입니다. 네이티브 이벤트와 동일한 인터페이스(`preventDefault`, `stopPropagation`, `target`, `currentTarget` 등)를 제공하므로 대부분 구분 없이 사용할 수 있습니다.

```jsx
function SearchForm() {
  function handleSubmit(e) {
    e.preventDefault();         // 폼 기본 제출 동작 차단
    const query = e.target.querySelector('input').value;
    console.log('검색:', query);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="query" placeholder="검색어 입력" />
      <button type="submit">검색</button>
    </form>
  );
}
```

---

## React 이벤트 시스템 — 이벤트 위임

![React 이벤트 위임 시스템](/assets/posts/react-event-handling-system.svg)

React는 컴포넌트마다 직접 이벤트 리스너를 DOM 노드에 붙이지 않습니다. 대신 **이벤트 위임(Event Delegation)** 방식으로 모든 이벤트를 **React Root 요소 하나에서** 처리합니다.

이벤트가 발생하면 버블링을 통해 React Root까지 올라오고, React가 해당 이벤트의 핸들러를 찾아 실행합니다. 이 방식 덕분에 수천 개의 리스트 항목이 있어도 이벤트 리스너 수는 최소화됩니다.

---

## 이벤트 처리 패턴

![이벤트 처리 패턴](/assets/posts/react-event-handling-patterns.svg)

### 핸들러 정의

핸들러는 보통 컴포넌트 안에서 함수로 정의하고 이벤트 prop에 레퍼런스로 전달합니다.

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleIncrement() {
    setCount(c => c + 1);
  }

  function handleDecrement() {
    setCount(c => c - 1);
  }

  return (
    <div>
      <button onClick={handleDecrement}>-</button>
      <span>{count}</span>
      <button onClick={handleIncrement}>+</button>
    </div>
  );
}
```

### 핸들러에 인자 전달

핸들러에 추가 인자를 전달할 때는 화살표 함수로 래핑합니다.

```jsx
function ProductList({ products }) {
  function handleDelete(id) {
    // id를 사용해 삭제 로직 실행
    console.log('삭제:', id);
  }

  return (
    <ul>
      {products.map(product => (
        <li key={product.id}>
          {product.name}
          <button onClick={() => handleDelete(product.id)}>삭제</button>
        </li>
      ))}
    </ul>
  );
}
```

---

## 자주 쓰는 이벤트 목록

```jsx
// 클릭
<button onClick={handleClick}>클릭</button>

// 입력 값 변경 (onChange는 HTML의 oninput과 유사하게 동작)
<input onChange={(e) => setValue(e.target.value)} />

// 키보드
<input onKeyDown={(e) => {
  if (e.key === 'Enter') handleSubmit();
}} />

// 포커스
<input
  onFocus={() => setFocused(true)}
  onBlur={() => setFocused(false)}
/>

// 마우스 이벤트
<div
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
/>
```

---

## 이벤트 버블링과 전파 제어

React 이벤트도 DOM 이벤트와 같이 **버블링**합니다. 자식 요소에서 발생한 이벤트가 부모로 올라갑니다.

```jsx
function Modal({ onClose }) {
  function handleBackdropClick(e) {
    // 배경 클릭 시에만 닫기 (내부 콘텐츠 클릭은 무시)
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleContentClick(e) {
    e.stopPropagation(); // 부모로 버블링 중단
  }

  return (
    <div className="backdrop" onClick={handleBackdropClick}>
      <div className="modal-content" onClick={handleContentClick}>
        <p>모달 내용</p>
        <button onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
```

---

## onChange와 폼 처리

React에서 `onChange`는 HTML의 `oninput`처럼 동작합니다. 값이 바뀔 때마다 실시간으로 호출됩니다.

```jsx
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    console.log({ email, password });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호"
      />
      <button type="submit">로그인</button>
    </form>
  );
}
```

폼 처리와 제어 컴포넌트 패턴은 이후 글에서 더 자세히 다룹니다.

---

**지난 글:** [key의 역할과 올바른 사용](/posts/react-keys/)

**다음 글:** [상태(state)란 무엇인가](/posts/react-state-concept/)

<br>
읽어주셔서 감사합니다. 😊
