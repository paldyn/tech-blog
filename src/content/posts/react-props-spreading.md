---
title: "Props Spreading — 유용하지만 주의가 필요한 패턴"
description: "React props spread 연산자의 동작 원리, 무분별한 spread의 위험(DOM 오염, 의도치 않은 오버라이드), rest 패턴으로 안전하게 사용하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["Props Spreading", "rest props", "DOM오염", "컴포넌트패턴", "React기초", "JSX"]
featured: false
draft: false
---

[지난 글](/posts/react-props/)에서 props의 단방향 흐름과 타입을 배웠다. 이번 글에서는 props에서 특히 조심해야 할 **spread 패턴**을 다룬다.

## Props Spreading이란

JSX에서 `{...obj}` 문법으로 객체의 모든 키-값을 props로 한번에 전달하는 패턴이다.

```jsx
const buttonProps = {
  type: 'button',
  disabled: false,
  className: 'btn',
};

// 아래 두 줄은 완전히 동일하다
<button {...buttonProps} />
<button type="button" disabled={false} className="btn" />
```

## 개념 비교

![Props Spreading 개념](/assets/posts/react-props-spreading-concept.svg)

명시적 전달과 spread 전달의 차이는 명확하다. 명시적 전달은 어떤 props가 내려가는지 코드에서 한눈에 보인다. Spread는 코드가 짧지만 전달되는 내용을 추적하기 어렵다.

## 안전하지 않은 Spread 사례

### 1. DOM 오염

HTML 요소가 모르는 props를 받으면 React는 경고를 출력하고, 브라우저 콘솔도 오류를 낸다.

```jsx
// ❌ variant는 HTML div 속성이 아님
function Card({ variant, ...props }) {
  return <div variant={variant} {...props} />;
}

// 경고: Unknown prop `variant` on <div> tag.
```

### 2. 의도치 않은 오버라이드

```jsx
// ❌ 부모가 준 onClick이 내부 onClick을 덮어버린다
function DangerButton({ ...props }) {
  return (
    <button
      {...props}
      onClick={() => {
        // 안전 확인 로직
        if (window.confirm('정말요?')) props.onClick?.();
      }}
    />
  );
}

// spread가 onClick을 오버라이드해서 확인 로직이 사라짐
<DangerButton {...{ onClick: () => deleteAll() }} />
```

## 안전한 패턴: Rest Spreading

![안전한 Props Spreading 패턴](/assets/posts/react-props-spreading-safe.svg)

컴포넌트 전용 props를 먼저 꺼내고, 나머지(`...rest`)만 DOM 요소에 전달한다.

```jsx
function Input({
  label,          // 컴포넌트 전용 (DOM에 전달 X)
  errorMessage,   // 컴포넌트 전용
  className = '',
  ...rest         // type, value, onChange, placeholder, disabled 등
}) {
  return (
    <div className="input-wrapper">
      {label && <label>{label}</label>}
      <input
        className={`input ${errorMessage ? 'input-error' : ''} ${className}`}
        {...rest}   // HTML input 속성만 안전하게 전달
      />
      {errorMessage && <p className="error">{errorMessage}</p>}
    </div>
  );
}

// 사용
<Input
  label="이메일"
  errorMessage="유효한 이메일을 입력하세요"
  type="email"
  value={email}
  onChange={e => setEmail(e.target.value)}
/>
```

## Spread 순서가 중요하다

같은 key가 여러 번 나오면 **뒤에 오는 값이 이긴다.**

```jsx
const defaults = { type: 'text', className: 'input' };

// defaults.type이 'email'로 오버라이드된다
<input {...defaults} type="email" />
// 결과: type="email" className="input"

// 'email'이 defaults.type으로 오버라이드된다
<input type="email" {...defaults} />
// 결과: type="text" className="input"
```

## 언제 Spread를 써도 좋은가

**래퍼(Wrapper) 컴포넌트**에서 네이티브 요소를 감쌀 때, rest 패턴과 함께 쓰면 안전하다.

```jsx
// 버튼 래퍼: HTML button의 모든 속성 그대로 지원
function Button({ children, className = '', ...rest }) {
  return (
    <button
      className={`btn ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
```

반면, **비즈니스 컴포넌트**(특정 도메인 데이터를 렌더링하는 컴포넌트)에서는 명시적 props를 선호한다. 어떤 데이터가 필요한지 타입을 보고 알 수 있어야 유지보수가 쉽다.

---

**지난 글:** [Props — 컴포넌트 간 데이터 전달의 모든 것](/posts/react-props/)

**다음 글:** [조건부 렌더링 — 상황에 따라 다른 UI 보여주기](/posts/react-conditional-rendering/)

<br>
읽어주셔서 감사합니다. 😊
