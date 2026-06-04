---
title: "forwardRef — 부모가 자식 DOM을 제어하는 방법"
description: "React의 ref 전달 제한과 forwardRef로 이를 해결하는 방법, 커스텀 컴포넌트에 ref prop을 연결하는 패턴, displayName 설정, 그리고 React 19에서 달라진 ref 처리 방식을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["React", "forwardRef", "ref", "DOM", "컴포넌트", "React19"]
featured: false
draft: false
---

[지난 글](/posts/react-useref/)에서 `useRef`로 DOM을 참조하고 렌더 간 값을 유지하는 방법을 살펴봤다. 이번에는 한 단계 더 나아가, **부모 컴포넌트가 자식 컴포넌트 내부의 DOM을 직접 가리킬 수 있도록** ref를 전달하는 `forwardRef`를 다룬다.

## 왜 forwardRef가 필요한가

일반 컴포넌트에 `ref` prop을 넘기면 React가 이를 무시한다. 이것은 의도된 동작이다.

```jsx
function FancyInput(props) {
  return <input className="fancy" {...props} />;
}

// 부모에서
const ref = useRef(null);
<FancyInput ref={ref} />;
// ref.current는 null — ref가 전달되지 않음
```

React는 `ref`를 일반 prop으로 취급하지 않는다. `key`처럼, `ref`는 특수 예약어라서 컴포넌트 함수의 `props` 객체에 포함되지 않는다. 따라서 부모가 자식의 DOM에 직접 접근하려면 명시적인 전달 메커니즘이 필요하다 — 그것이 `forwardRef`다.

![forwardRef ref 전달 흐름](/assets/posts/react-forwardref-flow.svg)

## forwardRef 기본 사용법

```jsx
import { forwardRef } from 'react';

const FancyInput = forwardRef(function FancyInput(props, ref) {
  return (
    <input
      ref={ref}
      className="fancy"
      {...props}
    />
  );
});
```

`forwardRef`는 두 번째 인수로 `ref`를 받는 렌더 함수를 감싸서 새 컴포넌트를 반환한다. 이 `ref`를 내부 DOM 요소의 `ref` prop에 연결하면 부모가 넘긴 ref 객체에 그 DOM이 연결된다.

![forwardRef 기본 패턴 코드](/assets/posts/react-forwardref-code.svg)

부모 컴포넌트에서는 일반 DOM 요소에 ref를 쓰는 것과 동일하게 사용한다.

```jsx
function Form() {
  const inputRef = useRef(null);

  function handleSubmit() {
    inputRef.current.focus();
  }

  return (
    <>
      <FancyInput ref={inputRef} placeholder="이름 입력" />
      <button onClick={handleSubmit}>포커스</button>
    </>
  );
}
```

## ref를 어느 DOM에 연결할지 선택

`forwardRef`에서 받은 `ref`를 **어느 DOM에 연결할지는 자식 컴포넌트가 결정**한다. 루트 요소가 아닌 내부 특정 요소에 연결하는 것도 가능하다.

```jsx
const Modal = forwardRef(function Modal({ children }, ref) {
  return (
    <div className="overlay">
      <div className="modal" ref={ref}> {/* 루트가 아닌 내부 요소에 연결 */}
        {children}
      </div>
    </div>
  );
});
```

ref를 전달하지 않을 수도 있다. 조건에 따라 연결 여부를 결정하거나, 내부 로직에만 사용하고 외부에 노출하지 않을 수 있다.

## displayName 설정

`forwardRef`로 감싼 컴포넌트는 React DevTools에서 "ForwardRef"로 표시된다. 디버깅을 위해 `displayName`을 설정하면 좋다.

```jsx
// 방법 1: 함수에 이름 붙이기 (권장)
const FancyInput = forwardRef(function FancyInput(props, ref) {
  // ...
});

// 방법 2: displayName 직접 설정
const FancyInput = forwardRef((props, ref) => {
  // ...
});
FancyInput.displayName = 'FancyInput';
```

함수에 이름을 붙이는 방법(방법 1)이 더 자연스럽고, DevTools뿐만 아니라 에러 스택 추적에도 이름이 표시된다.

## 언제 forwardRef를 쓰지 않아도 될까

ref가 필요한 모든 상황에 `forwardRef`가 필요한 건 아니다.

```jsx
// ref를 prop 이름으로 명시적으로 전달 — forwardRef 불필요
function FancyInput({ inputRef, ...props }) {
  return <input ref={inputRef} {...props} />;
}

// 사용
const ref = useRef(null);
<FancyInput inputRef={ref} />;
```

`ref`라는 이름 대신 `inputRef` 같은 일반 prop 이름을 쓰면 `forwardRef` 없이 전달할 수 있다. 단, API 일관성과 가독성을 위해 팀 내 컨벤션을 정해두는 것이 좋다.

## React 19에서의 변화

React 19부터는 `forwardRef` 없이도 함수 컴포넌트가 `ref` prop을 직접 받을 수 있다.

```jsx
// React 19+
function FancyInput({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}

// forwardRef 불필요
<FancyInput ref={inputRef} />;
```

기존 `forwardRef` 코드도 계속 동작하지만, 새 코드에서는 이 더 간단한 방식을 쓸 수 있다. React 팀은 점진적으로 `forwardRef`를 deprecated할 예정이다.

## forwardRef와 TypeScript

TypeScript 환경에서는 제네릭으로 타입을 명시한다.

```tsx
const FancyInput = forwardRef<HTMLInputElement, InputProps>(
  function FancyInput({ label, ...props }, ref) {
    return (
      <label>
        {label}
        <input ref={ref} {...props} />
      </label>
    );
  }
);
```

첫 번째 타입 인자는 ref 대상 DOM 타입, 두 번째는 props 타입이다.

---

**지난 글:** [useRef — DOM 참조와 렌더 사이 값 유지](/posts/react-useref/)

**다음 글:** [useImperativeHandle — ref로 메서드 노출하기](/posts/react-useimperativehandle/)

<br>
읽어주셔서 감사합니다. 😊
