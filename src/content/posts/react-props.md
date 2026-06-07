---
title: "Props 완전 정복 — 컴포넌트 인터페이스 설계"
description: "Props의 단방향 흐름, 구조 분해 할당, 기본값, 콜백 props, rest props 전달, TypeScript Props 타입 설계까지 React props를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 7
type: "knowledge"
category: "React"
tags: ["props", "단방향데이터흐름", "콜백props", "구조분해", "TypeScript", "컴포넌트설계"]
featured: false
draft: false
---

[지난 글](/posts/react-children/)에서 `children` prop으로 컴포넌트에 내용을 주입하는 방법을 배웠다. Props는 React 컴포넌트 간 통신의 기본 수단이다. 부모가 자식에게 데이터를 내려보내고, 자식은 그 데이터를 읽기만 한다. 이 단순한 원칙이 React의 예측 가능성을 만든다.

## Props의 핵심 원칙: 읽기 전용

Props는 **읽기 전용(immutable)**이다. 자식 컴포넌트가 받은 props를 직접 수정하는 것은 React의 핵심 규칙 위반이다.

```jsx
// ❌ 절대 금지
function BadChild({ user }) {
  user.name = '수정된 이름'; // props 직접 수정
  return <p>{user.name}</p>;
}

// ✅ 올바른 방법: 콜백으로 부모에게 변경 요청
function GoodChild({ user, onNameChange }) {
  return (
    <p>
      {user.name}
      <button onClick={() => onNameChange('새 이름')}>변경</button>
    </p>
  );
}
```

props를 직접 수정하면 React가 변경을 감지하지 못해 화면이 업데이트되지 않고, 데이터 흐름이 추적하기 어려워진다.

## 단방향 데이터 흐름

데이터는 항상 부모에서 자식으로 흐른다. 자식이 부모의 상태를 변경해야 할 때는 부모가 내려보낸 **콜백 함수**를 호출한다.

```jsx
function Parent() {
  const [text, setText] = useState('');

  return (
    <div>
      <Input value={text} onChange={setText} />
      <p>입력값: {text}</p>
    </div>
  );
}

function Input({ value, onChange }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}
```

`Input`은 `onChange`를 호출할 뿐이다. 실제 `text` state는 `Parent`가 소유하고 업데이트한다.

![Props 단방향 데이터 흐름](/assets/posts/react-props-flow.svg)

## Props 구조 분해 할당과 기본값

함수 파라미터에서 바로 구조 분해 할당하는 것이 관례다. 기본값도 같이 설정할 수 있다.

```jsx
// ✅ 구조 분해 + 기본값
function Button({ label, onClick, variant = 'primary', disabled = false }) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

// 사용 — variant, disabled 생략하면 기본값 적용
<Button label="제출" onClick={handleSubmit} />
```

## Rest props 전달

HTML 요소를 감싸는 래퍼 컴포넌트를 만들 때 `...rest`로 나머지 props를 내부 요소에 전달하는 패턴이 유용하다.

```jsx
function TextInput({ label, className, ...rest }) {
  return (
    <label>
      {label}
      <input className={`input ${className || ''}`} {...rest} />
    </label>
  );
}

// placeholder, type, id, onFocus 등 모든 input props 그대로 사용 가능
<TextInput
  label="이메일"
  type="email"
  placeholder="user@example.com"
  autoComplete="email"
/>
```

단, rest props를 무분별하게 DOM 요소에 전달하면 알 수 없는 HTML 속성 경고가 발생할 수 있다. 컴포넌트가 받아야 할 props와 DOM에 전달할 props를 명확히 분리하는 것이 좋다.

![Props 전달 패턴](/assets/posts/react-props-patterns.svg)

## TypeScript로 Props 타입 정의

TypeScript를 쓴다면 Props 인터페이스를 명확히 정의한다.

```tsx
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  children?: React.ReactNode;
}

function Button({ label, onClick, variant = 'primary', disabled = false }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
```

`React.ReactNode`는 JSX Element, 문자열, 숫자, 배열, `null`, `undefined` 등 렌더 가능한 모든 것을 포함한다. `children` 타입으로 가장 범용적으로 쓰인다.

## 조건부 props

불린 HTML 속성에서 `false` 대신 `undefined`를 전달하면 해당 속성이 완전히 제거된다.

```jsx
// disabled={false}는 disabled="false"로 HTML에 남음
// disabled={undefined}는 disabled 속성 자체가 없어짐

<button disabled={isLoading || undefined}>제출</button>
// isLoading이 false이면: <button>제출</button>
// isLoading이 true이면:  <button disabled>제출</button>
```

## 이벤트 핸들러 Props 네이밍 관례

이벤트 핸들러 props는 `on` + 이벤트명(대문자) 패턴을 따른다.

```jsx
// HTML 이벤트: onClick, onChange, onSubmit, onFocus, onBlur
// 커스텀 이벤트: onSelect, onClose, onConfirm, onItemClick
function Modal({ onClose, onConfirm }) { ... }
function Select({ onSelect }) { ... }
```

## 정리

- Props는 부모 → 자식 단방향. 자식은 읽기만 가능하다
- 자식이 부모의 상태를 바꾸려면 콜백 props를 호출한다
- 구조 분해 할당 + 기본값으로 컴포넌트 인터페이스를 명확하게 만든다
- `...rest`로 나머지 props를 내부 DOM 요소에 전달할 수 있다
- TypeScript `interface`로 Props 타입을 정의하면 안전성이 높아진다
- 이벤트 핸들러 props는 `on` + PascalCase 이벤트명으로 이름 짓는다

다음 글에서는 props spreading의 편리함과 위험성, 그리고 올바른 사용법을 다룬다.

---

**지난 글:** [children prop 완전 정복 — 컴포넌트 슬롯 패턴](/posts/react-children/)

**다음 글:** [Props Spreading — 편리함과 위험성 사이](/posts/react-props-spreading/)

<br>
읽어주셔서 감사합니다. 😊
