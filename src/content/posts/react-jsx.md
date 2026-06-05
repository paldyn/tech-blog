---
title: "JSX란? — HTML처럼 생긴 자바스크립트 문법"
description: "JSX의 정체, Babel이 JSX를 어떻게 변환하는지, JSX의 5가지 핵심 규칙과 표현식 삽입 방법을 예제 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["JSX", "React", "Babel", "JSX변환", "리액트문법"]
featured: false
draft: false
---

[지난 글](/posts/react-what-is-react/)에서 React의 핵심 개념과 등장 배경을 살펴봤다. React 코드를 처음 보면 자바스크립트 안에 HTML이 섞여 있는 것 같아 낯설게 느껴진다. 이게 바로 **JSX**다. JSX는 자바스크립트의 확장 문법으로, React 컴포넌트의 UI를 직관적으로 작성할 수 있게 해준다.

## JSX는 자바스크립트 확장 문법

JSX(JavaScript XML)는 자바스크립트 코드 안에 HTML과 비슷한 마크업을 작성할 수 있게 해주는 **문법 설탕(syntax sugar)**이다. 브라우저는 JSX를 직접 이해하지 못한다. Babel 같은 트랜스파일러가 JSX를 일반 자바스크립트 함수 호출로 변환한다.

```jsx
// 개발자가 작성하는 JSX
const element = <h1 className="title">React 시작하기</h1>;

// Babel이 변환한 결과 (React 17+ 새 JSX 변환)
const element = _jsx("h1", { className: "title", children: "React 시작하기" });
```

`_jsx()` 함수는 **React Element**라는 JS 객체를 반환한다. React는 이 객체들로 Virtual DOM 트리를 구성한다.

![JSX에서 JavaScript로의 변환 과정](/assets/posts/react-jsx-transform.svg)

## JSX는 표현식이다

JSX는 자바스크립트 **표현식**이다. 변수에 담을 수 있고, 함수에서 반환할 수 있으며, 조건이나 반복 구문에도 사용할 수 있다.

```jsx
// 변수에 담기
const header = <h1>Hello</h1>;

// 조건에 따라 다른 JSX 반환
function Status({ isLoading }) {
  if (isLoading) {
    return <span>로딩 중...</span>;
  }
  return <span>완료!</span>;
}
```

## {} 중괄호: JS 표현식 삽입

JSX 안에서 `{}` 중괄호를 쓰면 어떤 자바스크립트 표현식도 삽입할 수 있다.

```jsx
const user = { name: "홍길동", score: 95 };
const getGrade = (score) => score >= 90 ? "A" : "B";

function StudentCard() {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>점수: {user.score}점</p>
      <p>등급: {getGrade(user.score)}</p>
      <p>합격: {user.score >= 60 ? "합격" : "불합격"}</p>
    </div>
  );
}
```

단, `{}` 안에는 **표현식**만 들어갈 수 있다. `if`, `for` 같은 **문(statement)**은 직접 넣을 수 없다.

```jsx
// ❌ 안 됨 — if는 문(statement)이라 JSX 안에 불가

// ✅ 삼항 연산자(표현식)로 대체
return <div>{isOn ? "ON" : "OFF"}</div>;

// ✅ 논리 AND로 조건부 렌더링
return <div>{hasError && <p>오류가 발생했습니다</p>}</div>;
```

## JSX 핵심 규칙 5가지

![JSX 핵심 규칙 5가지](/assets/posts/react-jsx-rules.svg)

### ① 단일 루트 요소

하나의 컴포넌트에서 여러 요소를 반환할 때 반드시 하나의 부모 태그로 감싸야 한다.

```jsx
// ❌ 에러 — 루트가 두 개
function Bad() {
  return (
    <h1>제목</h1>
    <p>본문</p>
  );
}

// ✅ Fragment로 감싸기 (실제 DOM에 노드 추가 없음)
function Good() {
  return (
    <>
      <h1>제목</h1>
      <p>본문</p>
    </>
  );
}
```

### ② 모든 태그는 반드시 닫는다

HTML에서 `<br>`, `<img>`, `<input>` 태그를 닫지 않아도 되지만, JSX에서는 모든 태그를 닫아야 한다.

```jsx
// ❌ HTML 방식
// <br>  <img src="photo.jpg">  <input type="text">

// ✅ JSX 방식 (자기닫힘 슬래시 필수)
<br />
<img src="photo.jpg" alt="" />
<input type="text" />
```

### ③ 속성명은 camelCase

HTML 속성명은 JSX에서 camelCase로 바꿔야 한다. `class`는 자바스크립트 예약어라 `className`으로, `for`는 `htmlFor`로 쓴다.

```jsx
// class → className, for → htmlFor, tabindex → tabIndex
<label htmlFor="email" className="form-label">이메일</label>
<input id="email" type="email" readOnly tabIndex={0} />
```

### ④ 인라인 스타일은 객체로

HTML에서 문자열로 쓰던 `style`을 JSX에서는 자바스크립트 객체로 전달한다.

```jsx
// ✅ 객체 방식 (JSX) — 중괄호 두 겹: 표현식 { + 객체 리터럴 {
<p style={{ fontSize: '16px', backgroundColor: '#fff' }}>
  스타일 예시
</p>
```

### ⑤ 주석은 {/* */} 형식

```jsx
function Annotated() {
  return (
    <div>
      {/* 이것은 JSX 주석 */}
      <p>내용</p>
    </div>
  );
}
```

## JSX 없이도 React를 쓸 수 있다

JSX 없이 작성하면 코드가 훨씬 복잡해진다.

```jsx
// JSX 버전 (직관적)
const el = (
  <div className="card">
    <h2>{title}</h2>
    <p>{body}</p>
  </div>
);

// JSX 없는 버전 (동등한 코드)
const el = React.createElement(
  'div',
  { className: 'card' },
  React.createElement('h2', null, title),
  React.createElement('p', null, body)
);
```

## 정리

JSX는 자바스크립트 안에서 UI 구조를 선언적으로 표현할 수 있게 해주는 문법 설탕이다. Babel이 JSX를 `_jsx()` 호출로 변환하고, 이 호출이 React Element 객체를 만든다. 핵심 규칙은 단일 루트, 모든 태그 닫기, camelCase 속성명, 인라인 스타일 객체, `{}` 표현식 삽입이다. 다음 글에서는 JSX의 더 복잡한 패턴과 고급 사용법을 다룬다.

---

**지난 글:** [React란 무엇인가? — 핵심 개념과 등장 배경](/posts/react-what-is-react/)

**다음 글:** [JSX 심화 — 표현식, 조건, 반복, 특수 케이스](/posts/react-jsx-deep/)

<br>
읽어주셔서 감사합니다. 😊
