---
title: "Fragment — 불필요한 DOM 노드 없애기"
description: "<></> Fragment 문법이 왜 필요한지, key prop이 있을 때 명시적 Fragment를 쓰는 방법, table·dl 같은 구조적 HTML에서의 활용법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["Fragment", "React", "JSX", "DOM", "목록렌더링", "key"]
featured: false
draft: false
---

[지난 글](/posts/react-jsx-deep/)에서 JSX가 내부적으로 어떤 객체로 변환되는지 살펴봤다. React 컴포넌트는 반드시 최상위 요소 하나를 반환해야 한다. 가장 쉬운 해결책은 `<div>`로 감싸는 것이지만, 이 방법이 HTML 구조를 깨거나 불필요한 DOM 노드를 추가하는 경우가 있다. 이때 **Fragment**가 필요하다.

## 왜 wrapper div가 문제가 될까

`<table>` 안에 `<tr>`, `<td>`가 들어가야 하는 구조를 컴포넌트로 분리한다고 가정하자.

```jsx
// ❌ wrapper div를 쓰면 HTML 구조가 깨진다
function TableRow() {
  return (
    <div>               {/* table 안에 div는 유효하지 않은 HTML */}
      <td>이름</td>
      <td>값</td>
    </div>
  );
}

// 실제 렌더된 HTML
// <table><tr><div><td>이름</td><td>값</td></div></tr></table>
// ← 브라우저가 div를 table 밖으로 꺼낼 수 있음
```

CSS `flex` 또는 `grid` 레이아웃에서 직접 자식 요소의 스타일을 계산할 때도, 중간에 불필요한 `<div>`가 끼면 레이아웃이 어긋난다.

## Fragment 기본 사용법

`<>...</>` 단축 문법을 쓰면 JSX 최상위 요소 규칙을 지키면서도 DOM에 아무 노드도 추가하지 않는다.

```jsx
function TableRow() {
  return (
    <>
      <td>이름</td>
      <td>값</td>
    </>
  );
}
```

렌더 결과 HTML에는 `<td>이름</td><td>값</td>` 두 개만 나타난다. Fragment 자체는 DOM에 흔적을 남기지 않는다.

![Fragment가 필요한 이유](/assets/posts/react-fragments-why.svg)

## 두 가지 문법

**단축 문법 `<>...</>`** 은 대부분의 상황에서 사용하는 형태다. 임포트 없이 바로 쓸 수 있다.

**명시적 `<Fragment>...</Fragment>`** 는 `key` prop을 붙여야 할 때 필요하다. `<>` 단축 문법에는 props를 붙일 수 없다.

```jsx
import { Fragment } from 'react';

// key가 필요한 경우 명시적 Fragment 사용
function GlossaryList({ items }) {
  return (
    <dl>
      {items.map(item => (
        <Fragment key={item.id}>
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
```

![Fragment에 key 사용하기](/assets/posts/react-fragments-key.svg)

## 목록 렌더링에서 Fragment + key

`map()`으로 여러 DOM 요소를 묶어 반환할 때 흔히 만나는 패턴이다. `dl > dt + dd` 쌍, `tr > th + td` 쌍처럼 한 논리 단위가 여러 형제 요소로 이뤄질 때, Fragment에 `key`를 달아 React 재조정을 돕는다.

```jsx
// key 없는 단축 문법 (에러는 안 나지만 key 경고가 뜸)
{items.map(item => (
  <>
    <dt>{item.term}</dt>
    <dd>{item.description}</dd>
  </>
))}

// ✅ Fragment에 key 부여
{items.map(item => (
  <Fragment key={item.id}>
    <dt>{item.term}</dt>
    <dd>{item.description}</dd>
  </Fragment>
))}
```

## Fragment는 진짜 컴포넌트다

`React.Fragment`는 실제 React 컴포넌트다. `type` 필드에 `Symbol(react.fragment)`가 들어간 React Element를 만든다. React가 이 Element를 처리할 때 자식들을 그대로 렌더하고 Fragment 자체는 DOM에 남기지 않는다.

## 정리

- 여러 형제 요소를 반환해야 할 때 `<>...</>` Fragment를 사용한다
- Fragment는 DOM에 노드를 남기지 않으므로 `table`, `flex`, `grid` 구조를 깨지 않는다
- `key` prop이 필요할 때는 `<Fragment key={id}>` 명시 문법을 쓴다
- 단축 `<>` 문법은 `key` 외의 props를 받을 수 없다

다음 글에서는 React의 가장 핵심적인 단위인 **컴포넌트**를 깊이 다룬다.

---

**지난 글:** [JSX 깊이 보기 — createElement와 JSX Element 객체](/posts/react-jsx-deep/)

**다음 글:** [컴포넌트 완전 정복 — 함수 컴포넌트와 설계 원칙](/posts/react-components/)

<br>
읽어주셔서 감사합니다. 😊
