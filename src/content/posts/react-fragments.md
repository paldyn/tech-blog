---
title: "React.Fragment 완전 이해"
description: "Fragment가 필요한 이유와 단축 문법(<>), key prop이 필요할 때 명시 문법을 써야 하는 이유, 그리고 Flexbox·테이블 레이아웃에서의 활용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["React", "Fragment", "JSX", "DOM", "레이아웃"]
featured: false
draft: false
---

[지난 글](/posts/react-jsx-deep/)에서 JSX가 단일 루트 요소를 요구한다는 것을 확인했습니다. 여러 요소를 반환해야 할 때 `<div>`로 감싸면 DOM에 불필요한 노드가 생깁니다. **Fragment**는 이 문제를 해결하는 React의 특수 컴포넌트입니다.

---

## Fragment가 필요한 이유

HTML `<table>`의 `<tr>` 안에는 `<td>`나 `<th>`만 직접 위치할 수 있습니다. 그런데 여러 `<td>`를 반환하는 컴포넌트를 만들 때 `<div>`로 감싸면 유효하지 않은 DOM이 됩니다.

```jsx
// ❌ div가 tr과 td 사이에 끼어 DOM이 망가짐
function Columns() {
  return (
    <div>
      <td>이름</td>
      <td>나이</td>
    </div>
  );
}
```

Fragment는 DOM에 어떤 노드도 추가하지 않고 여러 자식을 묶어 줍니다.

```jsx
// ✓ Fragment — DOM에 흔적 없음
function Columns() {
  return (
    <>
      <td>이름</td>
      <td>나이</td>
    </>
  );
}
```

![Fragment가 필요한 이유](/assets/posts/react-fragments-why.svg)

---

## 두 가지 문법

### 단축 문법 `<>…</>`

가장 일반적인 형태입니다. `React.Fragment`와 동일하게 동작하지만, **`key` prop을 받지 못한다**는 제약이 있습니다.

```jsx
function Header() {
  return (
    <>
      <h1>제목</h1>
      <nav>...</nav>
    </>
  );
}
```

### 명시 문법 `<React.Fragment>`

`key`를 전달해야 하는 경우에만 사용합니다.

```jsx
import { Fragment } from 'react';

function List({ items }) {
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

`Fragment`를 named import로 가져오면 `React.Fragment`보다 짧게 쓸 수 있습니다.

---

## key가 있는 Fragment

목록에서 여러 DOM 요소를 하나의 key로 묶어야 할 때 명시 문법이 필수입니다. `dt`/`dd` 쌍이 대표적인 예입니다.

![key가 있는 Fragment 패턴](/assets/posts/react-fragments-keyed.svg)

단축 `<>` 에 `key`를 붙이면 파서 오류가 발생합니다.

```jsx
// ❌ 불가 — 단축 문법은 key 지원 안 함
{items.map(item => (
  <key={item.id}>
    <dt>{item.term}</dt>
    <dd>{item.desc}</dd>
  </>
))}

// ✓ React.Fragment (또는 Fragment named import)
{items.map(item => (
  <Fragment key={item.id}>
    <dt>{item.term}</dt>
    <dd>{item.desc}</dd>
  </Fragment>
))}
```

---

## CSS Flexbox / Grid와 Fragment

Flex 컨테이너 안에 `<div>` 래퍼가 생기면 의도치 않은 레이아웃이 발생합니다.

```jsx
// ❌ Flex 아이템이 div로 한 번 더 감싸져 레이아웃 틀어짐
function Actions() {
  return (
    <div>
      <button>저장</button>
      <button>취소</button>
    </div>
  );
}

// ✓ Fragment로 감싸면 버튼이 직접 flex 아이템이 됨
function Actions() {
  return (
    <>
      <button>저장</button>
      <button>취소</button>
    </>
  );
}
```

---

## Fragment가 필요 없는 경우

- 반환 요소가 이미 **하나**라면 Fragment는 불필요합니다.
- 래퍼 `<div>`가 의미상 필요한 경우(예: CSS 스타일 적용 대상)라면 오히려 `<div>`를 쓰세요.

Fragment는 "DOM에 추가 노드를 만들고 싶지 않을 때"만 사용하는 도구입니다.

---

**지난 글:** [JSX 심화: 컴파일 과정과 표현식 규칙](/posts/react-jsx-deep/)

**다음 글:** [컴포넌트의 개념](/posts/react-components/)

<br>
읽어주셔서 감사합니다. 😊
