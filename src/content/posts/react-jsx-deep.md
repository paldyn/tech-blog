---
title: "JSX 깊이 보기 — createElement와 JSX Element 객체"
description: "JSX가 빌드 단계에서 어떤 객체로 변환되는지, type 필드의 의미, children prop, $$typeof Symbol XSS 방어까지 React 내부를 깊이 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["JSX", "createElement", "ReactElement", "$$typeof", "children", "React 내부"]
featured: false
draft: false
---

[지난 글](/posts/react-jsx/)에서 JSX의 문법 규칙을 배웠다. 이번에는 JSX가 빌드 과정에서 정확히 어떤 JavaScript로 바뀌고, 그 결과물이 어떤 구조를 가지는지 들여다본다. 내부를 이해하면 에러 메시지가 훨씬 명확하게 읽히고, 컴포넌트 대문자/소문자 규칙처럼 "왜 이래야 하지?" 싶었던 것들이 자연스럽게 이해된다.

## JSX가 변환되는 과정

Vite나 Next.js로 프로젝트를 만들면 Babel(또는 SWC)이 빌드 과정에 JSX를 변환한다. 최신 React(17+)는 "새 JSX 변환"을 사용한다.

```jsx
// 작성한 JSX
const el = <h1 className="title">Hello</h1>;

// 새 JSX 변환 결과 (자동으로 import)
import { jsx as _jsx } from 'react/jsx-runtime';
const el = _jsx('h1', { className: 'title', children: 'Hello' });
```

구형 변환은 `React.createElement('h1', { className: 'title' }, 'Hello')`였고, `import React from 'react'`가 필요했다. 새 변환은 React import 없이 동작한다.

## JSX Element 객체의 실제 구조

`_jsx()` 또는 `React.createElement()`가 반환하는 것은 평범한 JavaScript 객체다.

```javascript
{
  $$typeof: Symbol(react.element),
  type: 'h1',
  key: null,
  ref: null,
  props: {
    className: 'title',
    children: 'Hello'
  }
}
```

이 객체를 **React Element**라고 부른다. 브라우저 DOM이 아니다. 아직 화면에 아무것도 그려지지 않은 "설계도"다. React가 이 설계도를 보고 실제 DOM을 만든다.

![JSX Element 객체 구조](/assets/posts/react-jsx-deep-element.svg)

## type 필드 — 소문자 vs 대문자의 진짜 이유

`type` 필드는 두 가지 값 중 하나다.

**소문자 문자열** — 내장 HTML 태그를 의미한다. React가 직접 `document.createElement('h1')` 같은 DOM 노드를 만든다.

```jsx
<div />   // type: "div"
<span />  // type: "span"
<input /> // type: "input"
```

**함수 참조** — 사용자 정의 컴포넌트를 의미한다. React가 그 함수를 호출해 반환된 Element 트리를 다시 처리한다.

```jsx
<Button />  // type: Button (함수 자체)
<Card />    // type: Card (함수 자체)
```

컴포넌트 이름을 **반드시 대문자로** 시작해야 하는 이유가 여기 있다. `<button>`은 `type: "button"` (문자열), `<Button>`은 `type: Button` (함수 참조)가 된다. 소문자로 작성하면 React가 DOM 태그로 해석해 `Button` 함수를 호출하지 않는다.

```jsx
// ❌ 소문자 — DOM 태그 'button'으로 처리됨
const button = <button />; // type: "button"

// ✅ 대문자 — Button 컴포넌트 함수 참조
const btn = <Button />; // type: Button (함수)
```

## children — 자식 요소는 props 안에 있다

JSX에서 태그 사이에 작성한 내용은 자동으로 `props.children`에 들어간다.

```jsx
<p>Hello</p>
// props.children === "Hello" (문자열)

<p><span>A</span><span>B</span></p>
// props.children === [ReactElement, ReactElement] (배열)
```

컴포넌트에서 `children`을 받아 렌더하는 패턴이 바로 이것을 활용한다.

```jsx
function Card({ children, title }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// 사용
<Card title="제목">
  <p>내용 1</p>
  <p>내용 2</p>
</Card>
```

![children prop과 중첩 구조](/assets/posts/react-jsx-deep-children.svg)

## $$typeof Symbol — XSS 방어 장치

`$$typeof: Symbol(react.element)` 필드는 보안 장치다. Symbol은 JSON으로 직렬화되지 않는다. 만약 서버가 악의적인 JSON을 반환하고 앱이 그것을 그대로 Element로 렌더하려 해도, Symbol이 없으므로 React가 이를 거부한다.

```javascript
// 서버에서 온 JSON 데이터
const malicious = JSON.parse('{"type":"script","props":{"dangerouslySetInnerHTML":...}}');

// React는 $$typeof Symbol이 없으면 렌더를 거부한다
// → dangerouslySetInnerHTML XSS 주입 차단
```

## React Element는 불변이다

`_jsx()`가 반환한 Element 객체는 생성 후 수정할 수 없다. `el.props.className = 'new'` 같은 직접 수정은 React의 렌더링 모델을 깨뜨린다. 상태가 바뀌면 React는 기존 Element를 수정하지 않고, 새 Element 객체를 처음부터 만든다.

```javascript
const el = <h1 className="old">Hello</h1>;
el.props.className = 'new'; // ⚠️ 하면 안 됨

// 올바른 방식: 상태를 바꾸면 React가 새 Element를 생성
const [cls, setCls] = useState('old');
const el2 = <h1 className={cls}>Hello</h1>;
```

## 정리

- JSX는 빌드 과정에서 `_jsx()` 호출로 변환되고, 그 결과는 평범한 JS 객체(React Element)다
- `type`이 문자열이면 DOM 태그, 함수이면 컴포넌트 — 컴포넌트 이름 대문자 규칙의 이유
- 태그 사이 내용은 `props.children`으로 전달된다
- `$$typeof` Symbol은 JSON 주입 XSS를 방어한다
- React Element는 불변이다. 상태가 바뀌면 새 Element를 만든다

다음 글에서는 JSX에서 여러 요소를 묶을 때 쓰는 **Fragment**를 다룬다.

---

**지난 글:** [JSX란 무엇인가? — HTML이 아닌 JavaScript](/posts/react-jsx/)

**다음 글:** [Fragment — 불필요한 DOM 노드 없애기](/posts/react-fragments/)

<br>
읽어주셔서 감사합니다. 😊
