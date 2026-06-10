---
title: "ref를 Props로 전달하기 — forwardRef 없이 ref 넘기기"
description: "React 19에서 ref를 일반 props처럼 전달하는 방법, forwardRef 마이그레이션 전략, ref callback cleanup, useImperativeHandle과의 조합 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["React19", "ref", "forwardRef", "useImperativeHandle", "마이그레이션"]
featured: false
draft: false
---

[지난 글](/posts/react-useformstatus/)에서 `useFormStatus`로 폼 상태를 자식 컴포넌트에서 읽는 방법을 살펴봤다. React 19는 `ref` 처리 방식도 크게 단순화했다. `forwardRef` 래퍼 없이 `ref`를 일반 props처럼 받을 수 있게 됐다.

## 왜 forwardRef가 필요했나?

React 18 이하에서는 컴포넌트에 `ref`를 전달하면 `ref`가 props에 포함되지 않았다. `ref`는 특별하게 처리돼 `props.ref`로 접근할 수 없었다. 자식 컴포넌트에서 부모가 전달한 `ref`를 DOM 요소에 연결하려면 `forwardRef` 래퍼가 필수였다.

```tsx
// React 18: forwardRef 필수
const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />;
});
```

이 패턴의 문제는 다음과 같다.

- 보일러플레이트가 많다
- `displayName`을 별도로 설정해야 한다
- TypeScript 타입이 복잡해진다
- 고차 컴포넌트와 함께 쓸 때 래퍼가 중첩된다

## React 19: ref를 props로

React 19에서 `ref`는 더 이상 특별한 처리를 받지 않는다. `ref`를 일반 props처럼 받을 수 있다.

```tsx
// React 19: 일반 함수 컴포넌트로 충분
function Input({
  ref,
  ...props
}: React.ComponentProps<'input'> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}

// 사용
const inputRef = useRef<HTMLInputElement>(null);
<Input ref={inputRef} placeholder="이름을 입력하세요" />;
```

`forwardRef` 래퍼가 전혀 필요 없다.

![React 19 ref as prop — before/after 비교](/assets/posts/react-ref-as-prop-concept.svg)

## TypeScript에서의 ref prop 타입

TypeScript를 사용할 때 `ref` prop 타입을 명시하는 방법이 몇 가지 있다.

```tsx
// 방법 1: React.Ref<T> 사용
function MyInput({ ref, ...props }: {
  ref?: React.Ref<HTMLInputElement>;
  placeholder?: string;
}) {
  return <input ref={ref} {...props} />;
}

// 방법 2: React.ComponentPropsWithRef 활용
type MyInputProps = React.ComponentPropsWithRef<'input'>;

function MyInput({ ref, ...props }: MyInputProps) {
  return <input ref={ref} {...props} />;
}

// 방법 3: 구조적으로 명확하게
interface ButtonProps {
  label: string;
  ref?: React.Ref<HTMLButtonElement>;
}

function IconButton({ label, ref }: ButtonProps) {
  return <button ref={ref}>{label}</button>;
}
```

## useImperativeHandle과 함께 사용

커스텀 메서드를 외부에 노출하려면 `useImperativeHandle`을 여전히 사용한다. React 19에서는 `forwardRef` 없이 `ref` prop으로 직접 전달받으면 된다.

```tsx
type DialogHandle = {
  open: () => void;
  close: () => void;
};

function Dialog({
  ref,
  title,
  children,
}: {
  ref?: React.Ref<DialogHandle>;
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }));

  if (!isOpen) return null;
  return (
    <dialog open>
      <h2>{title}</h2>
      {children}
      <button onClick={() => setIsOpen(false)}>닫기</button>
    </dialog>
  );
}

// 사용
const dialogRef = useRef<DialogHandle>(null);

function App() {
  return (
    <>
      <button onClick={() => dialogRef.current?.open()}>다이얼로그 열기</button>
      <Dialog ref={dialogRef} title="확인">
        정말 삭제하시겠습니까?
      </Dialog>
    </>
  );
}
```

![ref prop + useImperativeHandle 패턴](/assets/posts/react-ref-as-prop-patterns.svg)

## ref callback cleanup — React 19 신기능

React 19에서 ref callback 함수에서 정리(cleanup) 함수를 반환할 수 있게 됐다.

```tsx
function ResizablePanel() {
  return (
    <div
      ref={(element) => {
        if (!element) return;

        // 요소가 마운트될 때 실행
        const observer = new ResizeObserver(entries => {
          console.log('크기 변경:', entries[0].contentRect);
        });
        observer.observe(element);

        // 반환 함수: 요소가 언마운트될 때 실행 (cleanup)
        return () => {
          observer.disconnect();
        };
      }}
    >
      크기 조절 가능한 패널
    </div>
  );
}
```

이전에는 언마운트 처리를 위해 `node === null` 체크가 필요했지만, 이제는 cleanup 함수 반환 방식이 더 명확하다.

## forwardRef 마이그레이션

기존 코드베이스의 `forwardRef`를 React 19 방식으로 마이그레이션하는 공식 codemod가 있다.

```bash
# 자동 마이그레이션
npx react-codemod@latest forwardRef
```

수동으로 변환할 때는 다음 패턴을 따른다.

```tsx
// Before
const Component = forwardRef<ElementType, Props>((props, ref) => {
  return <element ref={ref} {...props} />;
});

// After
function Component({ ref, ...props }: Props & { ref?: React.Ref<ElementType> }) {
  return <element ref={ref} {...props} />;
}
```

React 19에서 `forwardRef`는 deprecated 예정이지만 아직 동작한다. 새로 작성하는 코드에서는 ref를 일반 props로 받는 방식을 사용하자. 다음 글에서는 React의 상태 관리 전략 전반을 살펴보는 개요편을 다룬다.

---

**지난 글:** [useFormStatus — 폼 상태를 자식 컴포넌트에서 읽기](/posts/react-useformstatus/)

**다음 글:** [React 상태 관리 전략 개요 — 내장 훅부터 외부 라이브러리까지](/posts/react-state-management-overview/)

<br>
읽어주셔서 감사합니다. 😊
