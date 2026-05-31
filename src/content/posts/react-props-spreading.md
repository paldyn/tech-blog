---
title: "Props 스프레딩과 전달 패턴"
description: "JSX에서 {...props} 스프레딩 문법의 작동 원리, rest props 패턴으로 래퍼 컴포넌트를 만드는 방법, 스프레딩 순서에 따른 기본값·재정의 제어를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["React", "props", "스프레딩", "rest props", "래퍼 컴포넌트"]
featured: false
draft: false
---

[지난 글](/posts/react-children/)에서 `children` prop으로 컴포넌트를 조합하는 방법을 살펴봤습니다. 이번에는 `{...props}` 스프레딩 문법이 언제 유용하고 언제 안티패턴이 되는지, 그리고 **rest props** 패턴으로 재사용 가능한 래퍼 컴포넌트를 어떻게 만드는지 알아봅니다.

---

## Props 스프레딩 기본

JSX에서 `{...someObject}` 는 객체의 모든 키를 개별 prop으로 펼칩니다.

```jsx
const buttonProps = {
  type: 'button',
  disabled: true,
  onClick: handleClick,
};

// 아래 두 줄은 동일
<button {...buttonProps} />
<button type="button" disabled={true} onClick={handleClick} />
```

스프레딩은 JavaScript의 객체 전개 문법(`{...obj}`)을 JSX 속성에 적용한 것입니다.

---

## Rest Props 패턴

가장 흔한 사용 사례는 **특정 prop만 꺼내고, 나머지를 하위 요소로 전달**하는 것입니다.

```jsx
// label, error는 이 컴포넌트가 사용하고
// 나머지(type, placeholder, onChange, ...)는 input으로 전달
function FormInput({ label, error, ...inputProps }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <input {...inputProps} />
      {error && <span className="error">{error}</span>}
    </div>
  );
}

// 사용
<FormInput
  label="이메일"
  error={errors.email}
  type="email"
  value={email}
  onChange={e => setEmail(e.target.value)}
  autoComplete="email"
/>
```

`FormInput`은 `input`이 받는 모든 속성(type, value, onChange, autoComplete 등)을 명시적으로 선언하지 않아도 자동으로 통과시킵니다.

![Props 스프레딩 개념](/assets/posts/react-props-spreading-concept.svg)

---

## 스프레딩 순서: 기본값과 재정의

나중에 오는 prop이 앞의 동일한 이름의 prop을 덮어씁니다. 이를 이용해 기본값과 재정의를 제어할 수 있습니다.

```jsx
// 호출자가 type을 전달하면 기본값 'text'를 덮어씀
function TextInput({ ...props }) {
  return <input type="text" {...props} />;
  //           ^기본값   ^재정의 허용
}

// 항상 type='text'를 강제 (호출자가 바꿀 수 없음)
function LockedInput({ ...props }) {
  return <input {...props} type="text" />;
  //           ^먼저      ^항상 고정
}
```

![Props 스프레딩 순서](/assets/posts/react-props-spreading-override.svg)

---

## 안티패턴: 무분별한 전체 전달

HTML 요소에 React가 모르는 prop을 전달하면 콘솔에 경고가 발생하고, 일부는 실제 DOM 속성으로 들어가 부작용을 일으킵니다.

```jsx
// ❌ 위험 — props에 isAdmin, userId 같은 커스텀 prop이 있으면 DOM 경고
function Card(props) {
  return <div {...props} />;
}

// ✓ 필요한 HTML 속성만 전달
function Card({ isAdmin, userId, children, className, ...htmlProps }) {
  return <div className={`card ${className}`} {...htmlProps}>{children}</div>;
}
```

`data-*` 속성은 표준 HTML 커스텀 데이터 속성이므로 DOM에 전달해도 경고가 없습니다.

---

## TypeScript와 스프레딩

TypeScript를 사용할 때는 `React.ComponentProps`나 `React.HTMLAttributes`를 활용해 타입 안전하게 rest props를 처리합니다.

```tsx
// button 요소의 모든 prop을 상속
interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: 'primary' | 'secondary';
}

function Button({ variant = 'primary', ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      {...rest}
    />
  );
}
```

이렇게 하면 `onClick`, `disabled`, `aria-label` 등 button의 모든 속성이 자동으로 타입 체크됩니다.

---

## 정리: 언제 스프레딩을 쓸까

| 상황 | 권장 여부 |
|---|---|
| HTML 요소를 감싸는 래퍼 컴포넌트 | ✓ 적극 권장 |
| 특정 prop을 꺼내고 나머지 전달 | ✓ 권장 (rest props) |
| 컴포넌트 간 prop 전달 중계 | ▲ 명시적 전달이 더 명확 |
| 컴포넌트 자체 로직 prop까지 함께 전달 | ✗ 분리해서 전달 |

---

**지난 글:** [children prop으로 컴포넌트 조합하기](/posts/react-children/)

**다음 글:** [조건부 렌더링](/posts/react-conditional-rendering/)

<br>
읽어주셔서 감사합니다. 😊
