---
title: "JSX 기초 — HTML처럼 보이지만 JavaScript다"
description: "JSX의 정체, Babel/SWC 변환 과정, React.createElement와의 관계, 그리고 JSX 핵심 문법 규칙을 코드로 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["JSX", "React.createElement", "Babel", "문법규칙", "컴파일", "React기초"]
featured: false
draft: false
---

[지난 글](/posts/react-what-is-react/)에서 React가 무엇인지 살펴봤다. 이번 글에서는 React 코드에서 가장 먼저 눈에 띄는 문법인 **JSX**를 파헤친다. JSX는 언뜻 HTML처럼 보이지만 실제로는 JavaScript 확장 문법이며, 브라우저에 전달되기 전에 일반 JavaScript로 변환된다.

## JSX란 무엇인가

JSX(JavaScript XML)는 JavaScript 코드 안에서 HTML과 유사한 마크업을 작성할 수 있게 해주는 **문법적 확장**이다. 브라우저는 JSX를 직접 이해하지 못한다. Babel이나 SWC 같은 빌드 도구가 JSX를 `React.createElement()` 호출로 변환한다.

```jsx
// 개발자가 작성하는 코드 (JSX)
const element = <h1 className="title">Hello, React!</h1>;

// 빌드 도구가 변환하는 코드
const element = React.createElement(
  'h1',
  { className: 'title' },
  'Hello, React!'
);
```

## JSX 변환 과정

![JSX 변환 과정](/assets/posts/react-jsx-transform.svg)

변환 결과인 `React.createElement()`는 **React Element 객체**를 반환한다. 이 객체는 단순한 JavaScript 객체로, 어떤 DOM 노드를 만들어야 하는지에 대한 설명이다.

```js
// React Element 객체의 실제 형태
{
  $$typeof: Symbol(react.element),
  type: 'h1',
  props: {
    className: 'title',
    children: 'Hello, React!'
  },
  key: null,
  ref: null
}
```

**React 17 이후**에는 `react/jsx-runtime`에서 자동 import되는 `_jsx()` 함수를 사용하도록 변환 방식이 바뀌었다. 덕분에 JSX를 쓰는 모든 파일마다 `import React from 'react'`를 쓸 필요가 없어졌다.

## JSX 핵심 문법 규칙

![JSX 핵심 문법 규칙](/assets/posts/react-jsx-syntax.svg)

### 규칙 1: 단일 루트 요소

컴포넌트는 반드시 하나의 루트 요소를 반환해야 한다. 여러 요소를 반환하려면 Fragment(`<>...</>` 또는 `<React.Fragment>`)나 래퍼 div로 감싼다.

```jsx
// ❌ 오류: 루트가 2개
function Bad() {
  return (
    <h1>제목</h1>
    <p>본문</p>
  );
}

// ✅ Fragment로 감싸기
function Good() {
  return (
    <>
      <h1>제목</h1>
      <p>본문</p>
    </>
  );
}
```

### 규칙 2: HTML 속성은 camelCase

JSX는 JavaScript 객체로 변환되기 때문에 JavaScript 예약어와 충돌하는 HTML 속성명은 바뀐다.

| HTML | JSX |
|------|-----|
| `class` | `className` |
| `for` | `htmlFor` |
| `tabindex` | `tabIndex` |
| `onclick` | `onClick` |

### 규칙 3: 중괄호로 JavaScript 표현식 삽입

중괄호 `{}` 안에는 JavaScript **표현식(expression)**이면 무엇이든 들어갈 수 있다. 단, 문(statement)은 안 된다.

```jsx
const user = { name: 'Alice', score: 95 };

function Profile() {
  return (
    <div>
      <p>{user.name}</p>            {/* 변수 */}
      <p>{user.score * 1.1}</p>     {/* 연산 */}
      <p>{user.score > 90 ? '우수' : '보통'}</p> {/* 삼항 연산자 */}
      <img src={user.avatarUrl} />  {/* 속성 값에도 사용 */}
    </div>
  );
}
```

### 규칙 4: 모든 태그는 닫아야 한다

HTML에서 `<br>`, `<img>` 같은 void 요소는 닫는 태그가 없어도 되지만, JSX에서는 반드시 자기닫힘(`/>`을 사용)해야 한다.

```jsx
// ❌ HTML 방식
<input type="text">
<br>

// ✅ JSX 방식
<input type="text" />
<br />
```

## style 속성은 객체

JSX에서 `style` 속성은 CSS 문자열이 아닌 **JavaScript 객체**로 전달한다. 속성명은 camelCase다.

```jsx
// ❌ 문자열 방식 (JSX에서 작동 안 함)
<div style="color: red; font-size: 16px">

// ✅ 객체 방식
<div style={{ color: 'red', fontSize: '16px' }}>
  스타일 적용
</div>
```

외부 중괄호는 "JavaScript 표현식", 내부 중괄호는 "객체 리터럴"이다.

## 멀티라인 JSX 작성

JSX가 여러 줄에 걸칠 때는 괄호로 감싸면 세미콜론 자동 삽입(ASI) 문제를 방지할 수 있다.

```jsx
function Card() {
  return (          // ← 괄호 시작
    <div className="card">
      <h2>카드 제목</h2>
      <p>카드 내용</p>
    </div>
  );                // ← 괄호 끝
}
```

JSX를 깊이 이해하면 이후에 배울 조건부 렌더링, 리스트 렌더링, 컴포넌트 합성 등 모든 패턴이 훨씬 명확하게 보인다.

---

**지난 글:** [React란 무엇인가 — 핵심 개념과 멘탈 모델](/posts/react-what-is-react/)

**다음 글:** [JSX 심화 — 표현식, 조건, spread, key](/posts/react-jsx-deep/)

<br>
읽어주셔서 감사합니다. 😊
