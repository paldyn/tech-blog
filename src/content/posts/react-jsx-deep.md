---
title: "JSX 심화 — 표현식, 조건, 반복, 특수 케이스"
description: "JSX에서 렌더링 가능한 값의 종류, && 연산자의 함정, 동적 컴포넌트 타입, 속성 스프레드 등 JSX의 고급 패턴을 상세히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["JSX", "JSX심화", "조건부렌더링", "리스트렌더링", "React표현식"]
featured: false
draft: false
---

[지난 글](/posts/react-jsx/)에서 JSX의 기본 개념과 5가지 핵심 규칙을 배웠다. 이번 글에서는 실전에서 자주 마주치는 JSX의 고급 패턴과, 알지 못하면 버그가 되는 함정들을 집중적으로 다룬다.

## JSX에서 렌더링 가능한 값

JSX의 `{}` 안에 모든 표현식을 넣을 수 있지만, React가 렌더링할 수 있는 값의 **종류**에는 제약이 있다.

![JSX에서 렌더링 가능한 값의 종류](/assets/posts/react-jsx-deep-types.svg)

```jsx
function Demo() {
  const obj = { name: "홍길동" };
  const arr = [<li key="a">A</li>, <li key="b">B</li>];

  return (
    <ul>
      {"문자열"}      {/* ✅ 문자열 */}
      {42}            {/* ✅ 숫자 */}
      {null}          {/* ✅ 아무것도 렌더링 안 됨 */}
      {false}         {/* ✅ 아무것도 렌더링 안 됨 */}
      {arr}           {/* ✅ 배열 → 항목 순서대로 */}
      {/* {obj} */}   {/* ❌ 객체 직접 렌더링 불가 */}
      {obj.name}      {/* ✅ 객체 프로퍼티(문자열)는 가능 */}
    </ul>
  );
}
```

## && 연산자의 함정

`&&` 연산자로 조건부 렌더링할 때 **숫자 0에 주의**해야 한다. 0은 falsy지만 숫자이므로 React가 화면에 `0`을 출력한다.

```jsx
function MessageBadge({ count }) {
  // ❌ count가 0이면 화면에 "0"이 그대로 출력된다
  return <div>{count && <span>{count}개의 메시지</span>}</div>;
}

// ✅ 해결책 1: 명시적 비교
return <div>{count > 0 && <span>{count}개의 메시지</span>}</div>;

// ✅ 해결책 2: Boolean으로 변환
return <div>{!!count && <span>{count}개의 메시지</span>}</div>;

// ✅ 해결책 3: 삼항 연산자
return <div>{count ? <span>{count}개의 메시지</span> : null}</div>;
```

## 속성 스프레드

`{...props}` 문법으로 객체의 모든 프로퍼티를 속성으로 한꺼번에 전달할 수 있다.

```jsx
// 여러 속성을 객체로 묶어 전달
function Button({ variant, size, ...rest }) {
  const className = `btn btn-${variant} btn-${size}`;
  return <button className={className} {...rest} />;
}

// 사용 측
<Button
  variant="primary"
  size="large"
  onClick={handleClick}
  disabled={isLoading}
  aria-label="저장하기"
/>
```

`...rest`로 나머지 props를 모아 하위 요소에 전달하는 패턴은 컴포넌트 래핑 시 자주 쓰인다.

## 동적 컴포넌트 타입

변수에 따라 렌더링할 태그나 컴포넌트를 동적으로 결정할 수 있다. 단, **변수명은 반드시 대문자로 시작**해야 한다.

```jsx
// ❌ 소문자 — HTML 태그로 해석됨
const tag = isHeading ? 'h1' : 'p';
return <tag>{children}</tag>; // <tag> HTML 태그 → 잘못된 렌더링

// ✅ 대문자 변수 — React 컴포넌트 또는 태그 문자열로 해석
const Tag = isHeading ? 'h1' : 'p';
return <Tag>{children}</Tag>; // h1 또는 p 태그로 렌더링

// ✅ 컴포넌트도 동적으로
const Icon = iconMap[name]; // { arrow: ArrowIcon, close: CloseIcon }
return <Icon size={24} />;
```

JSX에서 소문자 태그는 HTML 네이티브 요소로, 대문자로 시작하는 것은 React 컴포넌트로 해석한다는 규칙 때문이다.

## JSX 심화 패턴 모음

![JSX 심화 패턴](/assets/posts/react-jsx-deep-expressions.svg)

### 복잡한 JSX를 변수로 분리

중첩이 깊어지면 JSX를 변수나 함수로 분리해 가독성을 높인다.

```jsx
function UserProfile({ user, isAdmin }) {
  // 복잡한 조건부 로직을 변수로 분리
  const adminBadge = isAdmin && (
    <span className="badge badge-admin">관리자</span>
  );

  const statusIcon = user.isOnline
    ? <span className="dot dot-green" />
    : <span className="dot dot-gray" />;

  return (
    <div className="profile">
      {statusIcon}
      <strong>{user.name}</strong>
      {adminBadge}
    </div>
  );
}
```

### 즉시 실행 함수 표현식(IIFE)

`{}` 안에 IIFE를 넣어 복잡한 로직을 인라인으로 처리할 수 있다. 단, 과용하면 가독성이 떨어지므로 컴포넌트 분리를 먼저 고려한다.

```jsx
function StatusMessage({ status }) {
  return (
    <div>
      {(() => {
        switch (status) {
          case 'loading': return <Spinner />;
          case 'error':   return <ErrorMessage />;
          case 'success': return <SuccessIcon />;
          default:        return null;
        }
      })()}
    </div>
  );
}
```

### JSX를 props로 전달

JSX는 표현식이므로 props로도 전달할 수 있다. 이는 합성(composition) 패턴의 기초다.

```jsx
function Card({ header, body, footer }) {
  return (
    <div className="card">
      <div className="card-header">{header}</div>
      <div className="card-body">{body}</div>
      <div className="card-footer">{footer}</div>
    </div>
  );
}

// 사용 측 — JSX를 prop으로 전달
<Card
  header={<h2>제목</h2>}
  body={<p>본문 내용</p>}
  footer={<button>확인</button>}
/>
```

## 주요 속성 차이 정리

실무에서 자주 혼동하는 JSX vs HTML 속성 차이다.

```jsx
// HTML  →  JSX 대응표
// class      →  className
// for        →  htmlFor
// tabindex   →  tabIndex
// readonly   →  readOnly
// maxlength  →  maxLength
// colspan    →  colSpan (테이블)
// autocomplete → autoComplete
// crossorigin  → crossOrigin

// 예시
<form>
  <label htmlFor="name">이름</label>
  <input
    id="name"
    className="input"
    maxLength={50}
    autoComplete="name"
    readOnly={false}
  />
</form>
```

## 정리

JSX 심화의 핵심은 네 가지다. 첫째, `{}` 안에 들어갈 수 있는 값의 타입을 정확히 이해한다(객체 직접 렌더링 불가). 둘째, `&&` 연산자 사용 시 숫자 0 함정을 주의한다. 셋째, 동적 컴포넌트 타입 변수는 대문자로 시작해야 한다. 넷째, 복잡한 JSX는 변수나 함수로 분리해 가독성을 높인다. 다음 글에서는 불필요한 DOM 노드를 만들지 않는 **React Fragment**를 알아본다.

---

**지난 글:** [JSX란? — HTML처럼 생긴 자바스크립트 문법](/posts/react-jsx/)

**다음 글:** [React Fragment — 불필요한 DOM 노드 없애기](/posts/react-fragments/)

<br>
읽어주셔서 감사합니다. 😊
