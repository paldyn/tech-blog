---
title: "JSX 심화 — 표현식, 조건 렌더링, Spread, Children"
description: "JSX 중괄호 표현식의 한계, 숫자 0 함정, props spread 패턴, children prop, 그리고 동적 렌더링 관용구를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["JSX심화", "표현식", "조건부렌더링", "PropsSpread", "children", "React패턴"]
featured: false
draft: false
---

[지난 글](/posts/react-jsx/)에서 JSX의 기본 문법 규칙을 배웠다. 이번 글에서는 JSX를 실무에서 능숙하게 쓰기 위한 심화 내용을 다룬다. 표현식의 한계, 자주 만나는 함정, props spread, 그리고 children prop이 핵심 주제다.

## 표현식 vs 문(Statement)

JSX 중괄호 `{}` 안에는 **표현식(expression)**만 들어갈 수 있다. 표현식은 값을 반환하는 코드다. 문(statement)은 제어 흐름을 바꾸지만 값을 반환하지 않아서 JSX 안에 쓸 수 없다.

![JSX 표현식 완전 정리](/assets/posts/react-jsx-deep-expressions.svg)

```jsx
// ✅ 표현식 — JSX 안에서 사용 가능
{user.name}
{price * 0.9}
{isAdmin ? <AdminPanel /> : <UserPanel />}
{isLoggedIn && <Profile />}
{items.map(item => <li key={item.id}>{item.name}</li>)}

// ❌ 문 — JSX 안에서 사용 불가
{if (isAdmin) { return <AdminPanel /> }}   // if문
{for (let i = 0; i < 3; i++) { ... }}      // for문
```

## 숫자 0 함정

가장 흔히 만나는 JSX 버그다. `&&` 연산자의 왼쪽 값이 `0`이면 React는 `false`가 아니라 `0` 자체를 렌더링한다.

```jsx
// ⚠ 버그: items.length가 0이면 화면에 "0"이 출력된다
{items.length && <List items={items} />}

// ✅ 해결책 1: 명시적 boolean 변환
{items.length > 0 && <List items={items} />}

// ✅ 해결책 2: 삼항 연산자
{items.length ? <List items={items} /> : null}
```

비슷한 이유로 `NaN`, `undefined`, `null`, `false`는 렌더링되지 않지만 `0`과 `''`(빈 문자열)은 렌더링된다.

## Props Spread와 Children

![JSX Props 전달 패턴](/assets/posts/react-jsx-deep-spread.svg)

### Props Spread

객체를 펼쳐서 props로 전달할 수 있다. 상위 컴포넌트에서 받은 props를 그대로 하위에 전달할 때 자주 쓴다.

```jsx
function Button({ size, variant, ...rest }) {
  // size와 variant는 꺼내 쓰고,
  // 나머지(onClick, disabled 등)는 그대로 전달
  return (
    <button
      className={`btn btn-${size} btn-${variant}`}
      {...rest}
    />
  );
}
```

나중에 배울 props spreading 안티패턴도 있으니 주의가 필요하다. 지금은 패턴 자체를 익히는 것으로 충분하다.

### Children

태그 사이의 내용은 자동으로 `props.children`이 된다.

```jsx
function Card({ title, children }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="card-body">{children}</div>
    </div>
  );
}

// 사용: 태그 사이 내용이 children이 됨
function App() {
  return (
    <Card title="안녕">
      <p>이 텍스트가 children</p>
      <button>버튼도 children</button>
    </Card>
  );
}
```

## 조건부 렌더링 관용구 3가지

```jsx
// 패턴 1: && (단락 평가) — "있으면 보여줘"
{user && <UserAvatar user={user} />}

// 패턴 2: 삼항 연산자 — "A 또는 B"
{isDark ? <DarkTheme /> : <LightTheme />}

// 패턴 3: 즉시 실행 함수 표현식 (IIFE) — 복잡한 조건
{(() => {
  if (status === 'loading') return <Spinner />;
  if (status === 'error') return <ErrorMessage />;
  return <DataView data={data} />;
})()}
```

IIFE는 가독성을 해치기 쉬우므로 복잡한 경우엔 컴포넌트를 분리하는 것이 낫다.

## JSX 없이 React 쓰기

JSX는 필수가 아니다. 이해를 돕기 위해 완전히 JSX 없이 작성한 컴포넌트를 보자.

```js
import { createElement } from 'react';

// JSX 없는 순수 JavaScript React
function Greeting({ name }) {
  return createElement(
    'div',
    { className: 'greeting' },
    createElement('h1', null, `Hello, ${name}!`),
    createElement('p', null, 'Welcome to React')
  );
}
```

JSX가 단순히 이 코드의 문법적 설탕임을 명확히 알 수 있다. 실무에서는 당연히 JSX를 쓰지만, JSX 없는 버전을 이해하면 디버깅과 도구 이해에 도움이 된다.

## JSX 인라인 스타일 심화

```jsx
// 동적 스타일 객체 생성
function StatusBadge({ status }) {
  const style = {
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: status === 'active' ? '#55c555' : '#e05555',
    color: '#fff',
    fontSize: '12px',
  };

  return <span style={style}>{status}</span>;
}
```

스타일이 복잡해지면 CSS 모듈, Tailwind CSS, styled-components 같은 도구를 쓰는 것이 유지보수에 유리하다.

---

**지난 글:** [JSX 기초 — HTML처럼 보이지만 JavaScript다](/posts/react-jsx/)

**다음 글:** [Fragment — 불필요한 래퍼 없이 여러 요소 반환하기](/posts/react-fragments/)

<br>
읽어주셔서 감사합니다. 😊
