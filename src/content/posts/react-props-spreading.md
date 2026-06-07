---
title: "Props Spreading — 편리함과 위험성 사이"
description: "JSX props spreading({...props})의 올바른 사용법, 커스텀 props와 DOM props 분리, className 합치기 패턴, 스프레드를 피해야 할 상황을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["props", "스프레딩", "rest props", "className", "컴포넌트설계", "React"]
featured: false
draft: false
---

[지난 글](/posts/react-props/)에서 Props의 단방향 흐름과 기본 패턴을 배웠다. JSX에서 `{...props}` 스프레드는 여러 props를 한 번에 전달할 때 편리하다. 하지만 무분별하게 쓰면 의도치 않은 DOM 속성 경고나 컴포넌트 인터페이스 불명확함 같은 문제가 생긴다.

## Props Spreading의 기본

```jsx
const buttonProps = {
  type: 'submit',
  disabled: false,
  className: 'btn-primary',
};

// 아래 두 줄은 완전히 동일하다
<button type="submit" disabled={false} className="btn-primary">제출</button>
<button {...buttonProps}>제출</button>
```

객체 스프레드 문법이 JSX 속성에도 그대로 적용된다. 여러 props를 한 번에 전달하거나 부모에서 받은 props를 하위 컴포넌트에 그대로 전달할 때 사용한다.

## 문제 1: 커스텀 props가 DOM에 노출된다

React 컴포넌트가 받는 props 중 `variant`, `isLoading`, `size` 같은 **커스텀 props**는 HTML DOM 요소에 직접 전달하면 안 된다. 브라우저 콘솔에 경고가 뜨고, 일부는 HTML 동작에 영향을 줄 수 있다.

```jsx
// ❌ 위험 — 모든 props를 div에 전달
function Box(props) {
  return <div {...props} />;
}

<Box isActive={true} size="large">내용</Box>
// → <div isactive="true" size="large">내용</div> ← 알 수 없는 DOM 속성 경고
```

![Props Spreading 위험과 올바른 사용](/assets/posts/react-props-spreading-risk.svg)

## 해결책: 커스텀 Props를 먼저 추출하고 나머지만 전달

```jsx
// ✅ 커스텀 props를 구조 분해로 추출, 나머지만 DOM에 전달
function Button({ variant = 'primary', isLoading, children, ...rest }) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={isLoading}
      {...rest}
    >
      {isLoading ? '처리 중...' : children}
    </button>
  );
}
```

`variant`와 `isLoading`은 구조 분해로 추출해 컴포넌트 로직에서 사용하고, `...rest`에는 `type`, `onClick`, `aria-*`, `data-*` 같은 진짜 HTML 속성만 남는다.

## className 합치기

UI 컴포넌트가 기본 className을 갖되, 사용 측이 추가 className을 넣을 수 있게 하려면 두 값을 합쳐야 한다.

```jsx
function Card({ className, children, ...rest }) {
  const combinedClass = ['card', className].filter(Boolean).join(' ');
  return (
    <div className={combinedClass} {...rest}>
      {children}
    </div>
  );
}

<Card className="my-4 shadow-lg">내용</Card>
// → <div class="card my-4 shadow-lg">내용</div>
```

Tailwind CSS를 사용한다면 `clsx` + `tailwind-merge` 조합이 충돌 없는 클래스 병합을 처리해준다.

![스프레드로 className 합치기](/assets/posts/react-props-spreading-forward.svg)

## 문제 2: 인터페이스가 불명확해진다

```jsx
// ❌ 무엇을 받는지 알 수 없음
function MyInput(props) {
  return <input {...props} />;
}

// ✅ 명확한 인터페이스
function MyInput({ label, error, className, ...inputProps }) {
  return (
    <label>
      {label}
      <input className={`input ${error ? 'input-error' : ''} ${className || ''}`} {...inputProps} />
      {error && <span className="error-msg">{error}</span>}
    </label>
  );
}
```

컴포넌트가 받을 수 있는 props를 명시적으로 구조 분해하면 타입 힌트와 자동완성이 동작하고, 코드를 읽는 사람이 컴포넌트 인터페이스를 즉시 파악할 수 있다.

## Props 순서와 오버라이드

스프레드에서 나중에 오는 같은 이름의 prop이 이전 것을 덮어쓴다.

```jsx
// ...rest에 onClick이 있으면 아래 onClick보다 앞에 왔으므로
// 컴포넌트 내부 onClick이 우선된다
<button {...rest} onClick={handleClick}>제출</button>

// 반대로 사용 측이 override하게 하려면
<button onClick={defaultClick} {...rest}>제출</button>
// → rest.onClick이 defaultClick을 덮어씀
```

이 순서를 의도적으로 활용해 기본값(default)과 오버라이드(override) 중 어느 것이 우선순위를 가질지 제어할 수 있다.

## 언제 스프레드를 쓰면 안 될까

- 어떤 props가 전달될지 예측하기 어려운 경우
- 부모 컴포넌트의 많은 내부 state를 그대로 전달하는 prop drilling 해결책으로 쓸 때
- 스프레드된 props 중 어떤 것이 실제로 DOM에 닿는지 파악하기 어려울 때

이런 상황에서는 context나 명시적 props 전달이 더 명확한 해결책이다.

## 정리

- `{...props}` 스프레드는 편리하지만 커스텀 props를 먼저 추출한 후 사용해야 한다
- 커스텀 props를 그대로 DOM 요소에 전달하면 콘솔 경고가 발생한다
- `className`은 기본값과 합치는 패턴이 필요하다
- props 순서로 기본값과 오버라이드 우선순위를 제어할 수 있다
- 인터페이스가 불명확해질 정도로 스프레드에 의존하는 것은 피한다

다음 글에서는 조건에 따라 다른 UI를 보여주는 **조건부 렌더링** 패턴들을 다룬다.

---

**지난 글:** [Props 완전 정복 — 컴포넌트 인터페이스 설계](/posts/react-props/)

**다음 글:** [조건부 렌더링 — 삼항 연산자부터 얼리 리턴까지](/posts/react-conditional-rendering/)

<br>
읽어주셔서 감사합니다. 😊
