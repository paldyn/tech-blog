---
title: "JSX란 무엇인가? — HTML이 아닌 JavaScript"
description: "JSX 문법, Babel이 어떻게 변환하는지, 중괄호 표현식 삽입 규칙, className과 camelCase 속성 등 JSX를 처음 배울 때 꼭 알아야 할 모든 것을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["JSX", "Babel", "React", "컴포넌트", "표현식", "프론트엔드"]
featured: false
draft: false
---

[지난 글](/posts/react-what-is-react/)에서 React가 무엇인지, 왜 만들어졌는지 살펴봤다. React 코드를 처음 열면 가장 먼저 눈에 들어오는 것이 이상한 문법이다. JavaScript 안에 HTML처럼 생긴 코드가 섞여 있다. 이것이 바로 **JSX**다. JSX는 문법 설탕(syntactic sugar)이며, 빌드 단계에서 평범한 JavaScript 함수 호출로 변환된다.

## JSX는 HTML이 아니다

겉모습은 HTML과 비슷하지만 JSX는 HTML이 아니다. `class` 대신 `className`을 쓰고, 모든 태그는 반드시 닫아야 하며, 이벤트 핸들러는 camelCase로 쓴다. 브라우저가 직접 해석하는 것도 아니다. **Babel**이 JSX를 일반 JavaScript로 변환한 뒤 브라우저에 전달한다.

```jsx
// JSX
function Button() {
  return <button className="btn">클릭</button>;
}

// Babel이 변환한 결과
function Button() {
  return React.createElement('button', { className: 'btn' }, '클릭');
}
```

React 17 이후에는 `import React from 'react'`를 안 써도 되는 새 JSX 변환 방식이 도입됐다. 내부적으로 `_jsx()`를 호출하지만 개발자 입장에서는 차이가 없다.

![JSX 변환 과정](/assets/posts/react-jsx-syntax.svg)

## JSX 핵심 규칙 4가지

### 1. 최상위 요소는 반드시 하나

반환값이 여러 요소를 직접 나열할 수 없다. `<div>`로 감싸거나, 불필요한 DOM 노드를 추가하기 싫으면 `<>...</>` (Fragment)를 쓴다.

```jsx
// ❌ 에러 — 최상위 요소 2개
function Wrong() {
  return (
    <h1>제목</h1>
    <p>내용</p>
  );
}

// ✅ Fragment로 감싸기
function Right() {
  return (
    <>
      <h1>제목</h1>
      <p>내용</p>
    </>
  );
}
```

### 2. 모든 태그는 닫아야 한다

HTML에서 `<br>`, `<img>`, `<input>`은 닫는 태그를 생략해도 됐다. JSX에서는 자기 닫기 슬래시를 반드시 붙여야 한다.

```jsx
// ❌ HTML 방식 — JSX에서 에러
<img src="photo.jpg">
<input type="text">
<br>

// ✅ JSX 방식
<img src="photo.jpg" />
<input type="text" />
<br />
```

### 3. HTML 속성은 camelCase

JSX는 JavaScript 맥락이기 때문에 속성 이름도 JavaScript 관례를 따른다.

| HTML | JSX |
|---|---|
| `class` | `className` |
| `for` | `htmlFor` |
| `onclick` | `onClick` |
| `tabindex` | `tabIndex` |

`data-*`와 `aria-*`는 예외로 그대로 쓴다.

### 4. style은 객체

HTML에서 `style="color: red"`처럼 문자열로 썼다면, JSX에서는 JavaScript 객체를 전달한다. 속성 이름도 camelCase다.

```jsx
// ❌ 문자열 방식 (JSX에서 에러)
<div style="background-color: blue; font-size: 16px">...</div>

// ✅ 객체 방식
<div style={{ backgroundColor: 'blue', fontSize: '16px' }}>...</div>
```

이중 중괄호 `{{ }}`가 낯설게 보이지만 `{표현식}` 안에 `{객체 리터럴}`이 들어간 것뿐이다.

## 중괄호 `{}` — JavaScript 표현식 삽입

JSX 안에서 `{}` 안에는 JavaScript **표현식**을 자유롭게 쓸 수 있다. 변수, 연산, 함수 호출, 삼항 연산자 모두 가능하다.

```jsx
function Greeting({ user }) {
  const isLoggedIn = user !== null;
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{isLoggedIn ? '로그인 상태' : '비로그인'}</p>
      <img src={user.avatarUrl} alt={user.name} />
    </div>
  );
}
```

단, `if` 문, `for` 루프, `switch` 문처럼 **값을 반환하지 않는 문(statement)**은 중괄호 안에 직접 쓸 수 없다. 조건 처리는 삼항 연산자나 `&&` 단축 평가, 또는 중괄호 밖에서 변수로 계산해 놓는 방식으로 해결한다.

![JSX 표현식 삽입](/assets/posts/react-jsx-expressions.svg)

## 조건부 렌더링과 목록 렌더링 미리보기

조건부 렌더링과 목록 렌더링은 JSX의 자주 쓰이는 패턴으로, 각자 독립된 글로 깊이 다룬다. 여기서는 개념만 훑는다.

```jsx
// 조건부: && 단축 평가
function Notice({ hasNew }) {
  return (
    <div>
      {hasNew && <span>새 알림이 있습니다</span>}
    </div>
  );
}

// 목록: map()으로 렌더
function List({ items }) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

## JSX가 없어도 React를 쓸 수 있다

JSX는 필수가 아니다. `React.createElement`를 직접 호출해도 된다. 하지만 중첩 구조가 깊어질수록 코드가 극도로 복잡해지므로 모든 프로젝트가 JSX를 채택한다. JSX는 표준 JavaScript가 아니지만, Vite·Create React App·Next.js 등 모든 React 빌드 도구가 기본으로 지원한다.

## 정리

- JSX는 HTML과 비슷하지만 JavaScript 확장 문법이다
- Babel이 빌드 단계에 JSX를 `React.createElement()` 호출로 변환한다
- 최상위 요소 하나, 모든 태그 닫기, className, camelCase 이벤트 — 4가지 규칙
- `{}` 안에는 JS 표현식을 자유롭게 넣을 수 있다
- `if`, `for` 같은 문(statement)은 `{}` 안에 직접 쓸 수 없다

다음 글에서는 JSX가 내부적으로 어떻게 동작하는지, `React.createElement`와 JSX Element 객체를 더 깊이 파헤친다.

---

**지난 글:** [React란 무엇인가? — UI를 만드는 JavaScript 라이브러리](/posts/react-what-is-react/)

**다음 글:** [JSX 깊이 보기 — createElement와 JSX Element 객체](/posts/react-jsx-deep/)

<br>
읽어주셔서 감사합니다. 😊
