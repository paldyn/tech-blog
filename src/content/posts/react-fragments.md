---
title: "Fragment — 불필요한 래퍼 없이 여러 요소 반환하기"
description: "React Fragment의 필요성, 단축 문법과 전체 문법 차이, div 지옥 문제, 그리고 table/dl 같은 시맨틱 HTML 구조를 올바르게 유지하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["Fragment", "React.Fragment", "div지옥", "시맨틱HTML", "JSX", "React기초"]
featured: false
draft: false
---

[지난 글](/posts/react-jsx-deep/)에서 JSX의 심화 표현식과 패턴을 살펴봤다. 이번 글에서는 React 컴포넌트 작성 시 항상 만나는 제약 — "단일 루트 요소" — 을 깔끔하게 해결해주는 **Fragment**를 다룬다.

## 문제: 모든 컴포넌트는 단일 루트를 반환해야 한다

JSX는 컴파일 후 단일 함수 호출이 된다. 따라서 여러 요소를 반환하려면 반드시 하나의 부모로 감싸야 한다.

```jsx
// ❌ 오류: 루트 요소가 2개
function Greeting() {
  return (
    <h1>안녕하세요</h1>
    <p>React를 배워봅시다</p>
  );
}

// 일반적인 해결책: div로 감싸기
function Greeting() {
  return (
    <div>
      <h1>안녕하세요</h1>
      <p>React를 배워봅시다</p>
    </div>
  );
}
```

div로 감싸는 방식은 작동하지만 두 가지 문제가 있다.

1. **CSS 레이아웃 파괴** — flexbox나 grid 컨텍스트에서 불필요한 div가 낀다
2. **시맨틱 HTML 위반** — `<table>` 안에 `<tr>`, `<dl>` 안에 `<dt>/<dd>` 등 특정 부모-자식 관계가 강제되는 HTML에서 중간에 div가 끼면 유효하지 않은 구조가 된다

## Fragment로 해결

![Fragment가 필요한 이유](/assets/posts/react-fragments-why.svg)

Fragment는 DOM에 아무 요소도 추가하지 않으면서 여러 자식을 그룹화하는 React 전용 컴포넌트다.

```jsx
import { Fragment } from 'react';

function Greeting() {
  return (
    <Fragment>
      <h1>안녕하세요</h1>
      <p>React를 배워봅시다</p>
    </Fragment>
  );
}
```

## 단축 문법 `<>...</>`

대부분의 경우 `<>...</>` 단축 문법을 쓴다. 더 간결하고 `import`도 필요 없다.

```jsx
function Greeting() {
  return (
    <>
      <h1>안녕하세요</h1>
      <p>React를 배워봅시다</p>
    </>
  );
}
```

## 단축 문법의 한계: key prop

단축 문법 `<>`는 props를 받을 수 없다. `key` prop이 필요한 리스트 렌더링에서는 전체 문법을 써야 한다.

![Fragment 사용 패턴](/assets/posts/react-fragments-patterns.svg)

```jsx
import { Fragment } from 'react';

function GlossaryList({ terms }) {
  return (
    <dl>
      {terms.map(term => (
        <Fragment key={term.id}>   {/* key 지정 가능 */}
          <dt>{term.word}</dt>
          <dd>{term.definition}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
```

단축 문법 `<>`에 `key`를 붙이면 문법 오류다.

```jsx
// ❌ 오류: <> 에는 props 사용 불가
{terms.map(term => (
  <key={term.id}>   {/* 불가 */}
    <dt>{term.word}</dt>
  </>
))}
```

## 테이블 컴포넌트 예시

Fragment의 실용 가치가 가장 잘 드러나는 사례다.

```jsx
function TableRows({ data }) {
  return (
    <>
      {data.map(row => (
        <tr key={row.id}>
          <td>{row.name}</td>
          <td>{row.age}</td>
          <td>{row.city}</td>
        </tr>
      ))}
    </>
  );
}

function UserTable({ users }) {
  return (
    <table>
      <thead>
        <tr>
          <th>이름</th>
          <th>나이</th>
          <th>도시</th>
        </tr>
      </thead>
      <tbody>
        <TableRows data={users} />
      </tbody>
    </table>
  );
}
```

`TableRows`가 `<>`를 반환하기 때문에 `<tbody>` 안에 직접 `<tr>` 들이 들어간다. div 래퍼를 썼다면 유효하지 않은 HTML 구조가 됐을 것이다.

---

**지난 글:** [JSX 심화 — 표현식, 조건 렌더링, Spread, Children](/posts/react-jsx-deep/)

**다음 글:** [컴포넌트 기초 — React 앱의 기본 구성 단위](/posts/react-components/)

<br>
읽어주셔서 감사합니다. 😊
