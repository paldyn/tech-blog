---
title: "React Fragment — 불필요한 DOM 노드 없애기"
description: "React Fragment가 필요한 이유, <></> 단축 문법과 React.Fragment의 차이, key prop 사용법, 실전에서 Fragment가 필요한 4가지 상황을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["React Fragment", "Fragment", "React", "DOM구조", "JSX"]
featured: false
draft: false
---

[지난 글](/posts/react-jsx-deep/)에서 JSX의 고급 패턴을 살펴봤다. React 컴포넌트는 반드시 단일 루트 요소를 반환해야 한다는 규칙 때문에, 여러 요소를 반환할 때 `<div>`로 감싸는 습관이 생기기 쉽다. 하지만 이 방법은 불필요한 DOM 노드를 만들어 구조를 오염시킨다. **React Fragment**가 이 문제의 해법이다.

## 왜 Fragment가 필요한가

HTML 테이블을 생각해보자. `<tr>` 안에는 `<td>`가 직접 들어가야 한다. 만약 `<td>`를 묶는 컴포넌트가 `<div>`를 반환하면 `<tr> → <div> → <td>` 구조가 되어 HTML이 깨진다.

```jsx
// ❌ div로 감싸면 테이블 구조 파괴
function Row() {
  return (
    <div>          {/* 이 div가 tr 안에 삽입되어 구조 깨짐 */}
      <td>홍길동</td>
      <td>30세</td>
    </div>
  );
}

// 렌더링 결과: <tr><div><td>홍길동</td><td>30세</td></div></tr> ← 무효한 HTML
```

Fragment를 사용하면 DOM에 실제 노드가 추가되지 않아 구조가 유지된다.

![Fragment: 불필요한 DOM 노드 문제 해결](/assets/posts/react-fragments-problem.svg)

## 두 가지 문법

### 단축 문법 `<></>`

가장 간편하다. 단, `key` 속성을 붙일 수 없다.

```jsx
function Row() {
  return (
    <>
      <td>홍길동</td>
      <td>30세</td>
    </>
  );
}
```

### React.Fragment

`key` 속성이 필요할 때 사용한다.

```jsx
import React from 'react';

function GlossaryList({ items }) {
  return (
    <dl>
      {items.map(item => (
        <React.Fragment key={item.id}>
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
```

`key`를 갖는 Fragment는 리스트 렌더링에서 여러 형제 요소를 묶을 때 필수다.

## Fragment가 필요한 4가지 상황

![Fragment가 필요한 4가지 상황](/assets/posts/react-fragments-usage.svg)

### ① 테이블 구조 유지

```jsx
function TableRow({ user }) {
  return (
    <>
      <td>{user.name}</td>
      <td>{user.email}</td>
      <td>{user.role}</td>
    </>
  );
}

function UserTable({ users }) {
  return (
    <table>
      <tbody>
        {users.map(user => (
          <tr key={user.id}>
            <TableRow user={user} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### ② CSS Flexbox/Grid 레이아웃 보호

불필요한 `<div>`가 flex/grid 자식으로 끼어들면 레이아웃이 깨질 수 있다.

```jsx
function FieldGroup({ label, input, hint }) {
  // div를 반환하면 flex 자식이 하나 더 생겨 레이아웃 오작동
  return (
    <>
      {label}
      {input}
      {hint}
    </>
  );
}

// 부모: display flex; flex-direction column;
// Fragment 덕분에 label, input, hint가 직접 flex 자식이 됨
```

### ③ 리스트 렌더링에서 여러 형제 요소

```jsx
function DefinitionList({ terms }) {
  return (
    <dl>
      {terms.map(({ id, word, meaning }) => (
        <React.Fragment key={id}>
          <dt className="term">{word}</dt>
          <dd className="def">{meaning}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
```

### ④ 조건부 블록 전환

```jsx
function AuthSection({ isLoggedIn }) {
  return (
    <>
      {isLoggedIn ? (
        <>
          <UserAvatar />
          <LogoutButton />
        </>
      ) : (
        <>
          <LoginButton />
          <SignupLink />
        </>
      )}
    </>
  );
}
```

## Fragment는 실제 DOM에 아무것도 남기지 않는다

브라우저 DevTools로 확인해보면 Fragment로 감싼 요소들은 추가적인 래퍼 없이 그대로 나타난다.

```jsx
// React
function App() {
  return (
    <>
      <header>헤더</header>
      <main>본문</main>
      <footer>푸터</footer>
    </>
  );
}

// 브라우저 DOM (추가 노드 없음)
// <body>
//   <div id="root">
//     <header>헤더</header>
//     <main>본문</main>
//     <footer>푸터</footer>
//   </div>
// </body>
```

## 정리

Fragment는 React의 "단일 루트 요소" 제약을 DOM 오염 없이 충족시키는 도구다. `<></>` 단축 문법은 key가 필요 없을 때, `<React.Fragment key={id}>`는 리스트처럼 key가 필요할 때 사용한다. 다음 글에서는 React 컴포넌트의 구조와 종류를 자세히 살펴본다.

---

**지난 글:** [JSX 심화 — 표현식, 조건, 반복, 특수 케이스](/posts/react-jsx-deep/)

**다음 글:** [React 컴포넌트 — 함수형과 클래스형, 컴포넌트 설계 원칙](/posts/react-components/)

<br>
읽어주셔서 감사합니다. 😊
