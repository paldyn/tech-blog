---
title: "JSX 문법 이해하기"
description: "JSX가 JavaScript로 변환되는 과정과 React Element 객체 구조, 그리고 JSX 작성 시 지켜야 할 핵심 규칙을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["React", "JSX", "Babel", "createElement", "문법"]
featured: false
draft: false
---

[지난 글](/posts/react-what-is-react/)에서 React가 선언형 UI 라이브러리임을 확인했습니다. React 코드를 작성할 때 가장 먼저 마주치는 낯선 문법이 바로 **JSX**입니다. HTML처럼 보이지만 사실 JavaScript 파일 안에 있는 이 문법이 어떻게 작동하는지 살펴봅니다.

---

## JSX란

**JSX(JavaScript XML)**는 JavaScript 파일 안에서 HTML과 유사한 마크업을 작성할 수 있게 해주는 문법 확장입니다. 브라우저는 JSX를 직접 이해하지 못하므로, Babel이나 SWC 같은 **트랜스파일러**가 JSX를 순수 JavaScript로 변환합니다.

```jsx
// 개발자가 작성하는 JSX
const element = <h1 className="title">Hello, React!</h1>;
```

위 한 줄은 컴파일 과정을 거쳐 아래와 같이 변환됩니다.

```javascript
// 트랜스파일러가 생성하는 JavaScript (React 17+ 자동 변환)
import { jsx as _jsx } from 'react/jsx-runtime';
const element = _jsx('h1', { className: 'title', children: 'Hello, React!' });
```

---

## JSX → React Element 변환 과정

![JSX 변환 과정](/assets/posts/react-jsx-transform.svg)

변환의 최종 결과물은 **React Element**라는 순수 JavaScript 객체입니다. 이 객체는 `type`(태그 이름 또는 컴포넌트 함수), `props`(속성), `key` 등을 담고 있으며, React가 이를 읽어 실제 DOM을 구성합니다.

```javascript
// React Element 객체의 실제 모습
{
  $$typeof: Symbol(react.element),
  type: 'h1',
  props: { className: 'title', children: 'Hello, React!' },
  key: null,
  ref: null
}
```

React Element는 값싼 **설계도(Blueprint)**입니다. 실제 DOM 노드보다 훨씬 가볍고 빠르게 생성할 수 있어서, React가 상태 변경 시마다 새 Element 트리를 만들어 이전과 비교(diff)할 수 있습니다.

---

## JSX 핵심 규칙

![JSX 핵심 규칙](/assets/posts/react-jsx-rules.svg)

### 1. 반드시 하나의 루트 요소

컴포넌트의 `return` 문은 항상 단일 루트 요소를 반환해야 합니다. 여러 요소를 반환해야 할 때는 `<>...</>` **Fragment**로 감쌉니다.

```jsx
// ❌ 두 개의 루트 — 컴파일 오류
function Bad() {
  return (
    <h1>제목</h1>
    <p>설명</p>
  );
}

// ✅ Fragment로 감싸기
function Good() {
  return (
    <>
      <h1>제목</h1>
      <p>설명</p>
    </>
  );
}
```

### 2. 빈 태그는 자기 닫기(`/`)

`<img>`, `<input>`, `<br>` 같은 HTML 빈 요소는 JSX에서 반드시 `/>`로 닫아야 합니다.

```jsx
<img src="photo.jpg" alt="사진" />
<input type="text" />
<br />
```

### 3. 속성은 camelCase

HTML 속성 이름과 달리 JSX는 JavaScript 객체 키를 따르므로 camelCase를 사용합니다.

```jsx
// class → className, for → htmlFor
<label htmlFor="email" className="label">이메일</label>
<input id="email" type="email" onChange={handleChange} />
```

단, `data-*`와 `aria-*` 속성은 그대로 사용합니다.

### 4. 중괄호 `{}`로 JavaScript 표현식 삽입

JSX 안의 `{}`에는 유효한 JavaScript **표현식(expression)**을 넣을 수 있습니다. 변수, 함수 호출, 삼항 연산자, 템플릿 리터럴 모두 가능합니다. 단, `if`문이나 `for`문 같은 **문(statement)**은 표현식이 아니므로 직접 넣을 수 없습니다.

```jsx
const user = { name: 'Alice', score: 42 };
const isAdmin = true;

function UserCard() {
  return (
    <div className={`card ${isAdmin ? 'admin' : ''}`}>
      <h2>{user.name}</h2>
      <p>점수: {user.score.toFixed(1)}</p>
      {isAdmin && <span className="badge">관리자</span>}
    </div>
  );
}
```

### 5. 속성값의 따옴표와 중괄호

문자열 값은 따옴표로, JavaScript 표현식은 중괄호로 전달합니다. 둘을 동시에 쓰지 않습니다.

```jsx
// 문자열: 따옴표
<div className="container">

// JavaScript 표현식: 중괄호 (따옴표 없음)
<img src={user.avatarUrl} alt={user.name} />

// ❌ 혼합 불가
<div className={"container"}>  {/* 동작하지만 불필요 */}
```

---

## 주석 작성 방법

JSX 안에서 주석은 `{/* */}` 형식을 사용합니다.

```jsx
function App() {
  return (
    <div>
      {/* 이것이 JSX 주석입니다 */}
      <h1>Hello</h1>
    </div>
  );
}
```

---

## 조건부·반복 렌더링 미리보기

`{}`에는 삼항 연산자, 단락 평가(`&&`), 배열 `map()`을 넣어 조건부·반복 렌더링을 처리합니다. 이 주제는 이후 글에서 자세히 다루겠습니다.

```jsx
function Preview({ items, loading }) {
  return (
    <section>
      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <ul>
          {items.map(item => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

---

**지난 글:** [React란 무엇인가](/posts/react-what-is-react/)

**다음 글:** [컴포넌트의 개념](/posts/react-components/)

<br>
읽어주셔서 감사합니다. 😊
