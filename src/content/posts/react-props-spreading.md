---
title: "Props Spreading — 편리함과 위험성의 균형"
description: "Props 스프레딩 {...props}의 동작 원리, DOM 경고가 발생하는 이유, 안전한 props 분리 패턴, className 병합 패턴을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["Props Spreading", "React", "...props", "컴포넌트패턴", "DOM속성"]
featured: false
draft: false
---

[지난 글](/posts/react-props/)에서 Props의 전달 방식과 타입 검증을 배웠다. `{...props}` 스프레딩은 컴포넌트 래핑 시 매우 편리하지만, 잘못 쓰면 DOM 경고를 일으키거나 예상치 못한 props가 전달되는 버그를 만든다.

## Props Spreading이란

`{...props}` 문법은 객체의 모든 프로퍼티를 JSX 속성으로 펼쳐서 전달한다.

```jsx
// 스프레딩 없이 명시적 전달
<input
  type={props.type}
  value={props.value}
  onChange={props.onChange}
  placeholder={props.placeholder}
  disabled={props.disabled}
/>

// 스프레딩으로 한 번에 전달 (동일한 결과)
<input {...props} />
```

## DOM 경고가 발생하는 이유

React에서 HTML 요소에 알 수 없는 속성을 전달하면 경고가 발생한다.

```jsx
// ❌ 문제: 커스텀 props가 DOM input에 그대로 전달됨
function BadInput(props) {
  return <input {...props} />;
}

// labelText, errorMessage는 HTML input이 모르는 속성
<BadInput
  type="email"
  labelText="이메일"      // DOM input에 전달됨 → 경고
  errorMessage="필수입력" // DOM input에 전달됨 → 경고
/>

// 콘솔: Warning: React does not recognize the `labelText` prop on a DOM element.
```

커스텀 props는 HTML 요소가 아닌 React 컴포넌트 레이어에서 소비해야 한다.

![Props Spreading 문제와 해결](/assets/posts/react-props-spreading-problem.svg)

## 올바른 패턴: 커스텀 props 분리

구조분해 할당으로 커스텀 props를 꺼내고, 나머지(`...rest`)를 HTML 요소에 전달한다.

```jsx
// ✅ 커스텀 props를 분리하고 나머지만 전달
function FormInput({ label, error, helpText, ...rest }) {
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <input {...rest} />           {/* 표준 HTML 속성만 전달 */}
      {helpText && <p className="help">{helpText}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// 사용 측
<FormInput
  label="이메일"
  error={errors.email}
  helpText="유효한 이메일 주소를 입력하세요"
  type="email"
  value={email}
  onChange={handleChange}
  required
/>
```

![안전한 Props 분리 패턴](/assets/posts/react-props-spreading-patterns.svg)

## 안전한 Props 분리 4가지 패턴

### 패턴 ① 커스텀 props 분리 + 나머지 전달

가장 기본적인 패턴이다.

```jsx
function Button({ variant = 'primary', size = 'md', isLoading, ...rest }) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={isLoading || rest.disabled}
      {...rest}           // onClick, type, aria-* 등 전달됨
    >
      {isLoading ? <Spinner /> : rest.children}
    </button>
  );
}
```

### 패턴 ② className 병합

외부에서 추가 className을 전달할 수 있도록 내부와 병합한다.

```jsx
function Card({ variant = 'default', className = '', children, ...rest }) {
  const baseClass = `card card-${variant}`;
  const mergedClass = [baseClass, className].filter(Boolean).join(' ');

  return (
    <div className={mergedClass} {...rest}>
      {children}
    </div>
  );
}

// clsx 라이브러리를 쓰면 더 깔끔
import clsx from 'clsx';

function Card({ variant, className, ...rest }) {
  return (
    <div className={clsx('card', `card-${variant}`, className)} {...rest} />
  );
}
```

### 패턴 ③ 스프레딩 순서가 중요하다

스프레딩 위치에 따라 기본값이 덮어씌워진다.

```jsx
// ❌ rest.type이 type="email"을 덮어쓸 수 있음
function EmailInput({ ...rest }) {
  return <input type="email" {...rest} />;  // rest에 type이 있으면 email 무효화!
}

// ✅ 기본값을 뒤에 두어 보호
function EmailInput({ ...rest }) {
  return <input {...rest} type="email" />;  // 항상 email 타입 유지
}
```

### 패턴 ④ TypeScript + ComponentPropsWithoutRef

TypeScript에서 HTML 요소의 모든 표준 속성을 자동 상속하는 방법이다.

```tsx
type ButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
};

function Button({ variant = 'primary', isLoading, children, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={isLoading}
      {...rest}
    >
      {isLoading ? '로딩 중...' : children}
    </button>
  );
}

// TypeScript가 button의 모든 속성(type, onClick, aria-* 등)을 자동 제안
<Button type="submit" onClick={handleSubmit} aria-label="저장하기" variant="primary">
  저장
</Button>
```

## 스프레딩 사용 기준

```
스프레딩 적합:
  ✅ HTML 요소를 얇게 래핑하는 UI 컴포넌트 (Button, Input, Card 등)
  ✅ 커스텀 props를 분리한 후 ...rest를 전달
  ✅ 테스트 유틸리티에서 모든 이벤트 핸들러를 주입할 때

스프레딩 부적합:
  ❌ 복잡한 비즈니스 컴포넌트에 props 전체를 덮어씌울 때
  ❌ 어떤 props가 전달될지 예측하기 어려울 때
  ❌ 두 컴포넌트 간 "props relay"를 여러 단계 이어 사용할 때 → prop drilling 문제
```

## 정리

Props 스프레딩은 래핑 컴포넌트에서 HTML 속성을 전달할 때 강력하다. 핵심은 **커스텀 props를 먼저 분리**하고 나머지(`...rest`)만 전달하는 것이다. TypeScript의 `ComponentPropsWithoutRef`와 결합하면 타입 안전성까지 확보된다. 다음 글에서는 조건에 따라 UI를 다르게 렌더링하는 **조건부 렌더링** 패턴을 다룬다.

---

**지난 글:** [Props 완전 정복 — 데이터 전달과 기본값, 타입 검증](/posts/react-props/)

**다음 글:** [조건부 렌더링 — 상황에 맞는 UI 표현하기](/posts/react-conditional-rendering/)

<br>
읽어주셔서 감사합니다. 😊
