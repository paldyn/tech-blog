---
title: "ref와 forwardRef 타이핑"
description: "React에서 ref를 TypeScript로 안전하게 다루는 법을 정리합니다. useRef의 DOM 참조용과 가변 컨테이너용 타입 차이, null 체크, forwardRef의 두 제네릭 인자 순서, useImperativeHandle로 노출 API 타이핑, React 19에서 ref가 일반 prop이 된 변화까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 3
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "React", "useRef", "forwardRef", "DOM", "ref"]
featured: false
draft: false
---

[지난 글](/posts/ts-react-hooks-typing/)에서 `useState`·`useReducer`를 비롯한 Hook들을 타이핑했고, `useRef`는 "두 가지 얼굴이 있다"고만 짚고 넘어갔다. 이번 글에서 그 둘을 제대로 구분하고, ref를 컴포넌트 경계 너머로 전달하는 `forwardRef`와 `useImperativeHandle`까지 타이핑한다. ref는 React에서 타입이 가장 자주 꼬이는 자리 중 하나라, 한 번 정리해 두면 두고두고 편하다.

## useRef의 두 가지 얼굴

`useRef`는 호출 방식에 따라 의미와 타입이 갈린다. DOM 요소를 참조하느냐, 리렌더와 무관하게 값을 보존하는 컨테이너로 쓰느냐다.

DOM 참조용은 초깃값 `null`과 제네릭을 함께 준다. 그러면 `current`의 타입이 `HTMLInputElement | null`이 되고, JSX의 `ref` 속성에 연결할 수 있다.

```typescript
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  inputRef.current?.focus(); // current는 null일 수 있다
}, []);

return <input ref={inputRef} />;
```

마운트 전이나 언마운트 후에는 `current`가 `null`이므로, 접근할 때 옵셔널 체이닝(`?.`)이나 명시적 `null` 체크가 필수다. 이건 [strict 모드](/posts/ts-strict-mode-flags/)의 `strictNullChecks`가 제대로 일하는 지점이다.

![useRef의 두 가지 얼굴](/assets/posts/ts-react-refs-forwardref-tworefs.svg)

반면 가변 값 컨테이너로 쓸 때는 초깃값을 주면 타입이 추론되고, `current`가 그 타입으로 고정된다. 타이머 ID나 이전 값 저장처럼 "리렌더를 일으키지 않고 값을 들고 있어야 할 때" 쓴다.

```typescript
const timerId = useRef(0); // current: number, 항상 접근 가능

function start() {
  timerId.current = window.setInterval(tick, 1000);
}
```

핵심 구분은 이렇다. **`null`을 초깃값으로 주고 제네릭으로 엘리먼트 타입을 명시하면 DOM 참조용(null 가능), 실제 초깃값을 주면 가변 컨테이너용(null 없음).** 같은 `useRef`지만 타입 시스템이 두 용도를 다르게 본다.

## DOM 요소 타입 고르기

DOM 참조용 제네릭에는 정확한 요소 타입을 넣어야 한다. `<input>`이면 `HTMLInputElement`, `<div>`면 `HTMLDivElement`, `<button>`이면 `HTMLButtonElement`다. TypeScript의 DOM 라이브러리(`lib.dom.d.ts`)에 모든 요소 타입이 정의되어 있어, 잘못된 메서드 호출을 막아준다.

```typescript
const divRef = useRef<HTMLDivElement>(null);
const videoRef = useRef<HTMLVideoElement>(null);

videoRef.current?.play(); // HTMLVideoElement에만 있는 play()
```

요소 타입을 정확히 맞춰야 `play()`, `select()`, `scrollIntoView()` 같은 요소별 메서드가 자동완성에 뜨고 타입 검사를 받는다.

## forwardRef — ref를 자식 DOM까지

부모가 자식 컴포넌트 안쪽의 DOM에 직접 접근하고 싶을 때가 있다. 그런데 ref는 일반 prop처럼 자동으로 전달되지 않는다(적어도 React 18까지는). 이때 `forwardRef`로 컴포넌트를 감싸 ref를 받아 넘긴다.

타이핑의 핵심은 **제네릭 인자 순서**다. 첫 번째가 노출할 엘리먼트 타입, 두 번째가 Props 타입이다. 직관과 반대 순서라 자주 헷갈린다.

```typescript
import { forwardRef } from "react";

interface InputProps {
  label: string;
}

const TextInput = forwardRef<HTMLInputElement, InputProps>(
  ({ label }, ref) => {
    return (
      <label>
        {label}
        <input ref={ref} />
      </label>
    );
  }
);
```

이렇게 하면 부모에서 `useRef<HTMLInputElement>(null)`로 만든 ref를 `<TextInput ref={ref} label="이름" />`처럼 넘길 수 있고, `ref.current`가 자식 안의 `<input>` DOM을 가리킨다.

![forwardRef로 ref 전달](/assets/posts/ts-react-refs-forwardref-flow.svg)

## useImperativeHandle — 노출 API를 직접 타이핑

DOM 요소 전체를 노출하는 대신, 부모에게 보여줄 "명령형 API"만 골라 노출하고 싶을 때 `useImperativeHandle`을 쓴다. 이때 노출할 핸들의 타입을 따로 정의해 `forwardRef`의 첫 제네릭으로 넘긴다.

```typescript
interface DialogHandle {
  open: () => void;
  close: () => void;
}

const Dialog = forwardRef<DialogHandle, { title: string }>((props, ref) => {
  const [visible, setVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => setVisible(true),
    close: () => setVisible(false),
  }), []);

  return visible ? <div role="dialog">{props.title}</div> : null;
});

// 부모
const dialogRef = useRef<DialogHandle>(null);
dialogRef.current?.open(); // open/close만 노출됨
```

`useImperativeHandle`이 반환하는 객체의 모양이 `DialogHandle`과 맞는지 컴파일러가 검사하고, 부모는 `open`·`close`만 볼 수 있다. DOM 디테일을 숨기고 의도한 API만 계약으로 드러내는 깔끔한 방식이다.

## React 19에서의 변화

React 19부터는 함수 컴포넌트가 `ref`를 일반 prop으로 직접 받을 수 있게 되어, 많은 경우 `forwardRef` 없이도 ref 전달이 가능해졌다.

```typescript
// React 19+
function TextInput({ label, ref }: {
  label: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return <input ref={ref} />;
}
```

`forwardRef`가 사라지는 건 아니고 기존 코드도 잘 동작하지만, 새 코드라면 ref를 props 타입에 `React.Ref<T>`로 한 줄 추가하는 쪽이 더 단순하다. 어느 방식이든 타이핑의 본질은 같다 — **노출할 엘리먼트(또는 핸들)의 타입을 정확히 명시하는 것.**

정리하면, ref 타이핑은 "용도에 맞는 타입을 고르는 일"로 압축된다. DOM 참조용은 `null` + 엘리먼트 제네릭, 가변 컨테이너는 초깃값 추론, 자식으로 전달할 땐 `forwardRef`의 순서 주의, 명령형 API는 `useImperativeHandle`로 핸들 타입을 노출. 다음 글에서는 컴포넌트 트리 전체에 값을 내려보내는 Context를 타이핑한다.

---

**지난 글:** [React Hooks 타이핑 — useState부터 useReducer까지](/posts/ts-react-hooks-typing/)

**다음 글:** [React Context 타이핑](/posts/ts-react-context-typing/)

<br>
읽어주셔서 감사합니다. 😊
