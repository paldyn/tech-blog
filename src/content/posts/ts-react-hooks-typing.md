---
title: "React Hooks 타이핑 — useState부터 useReducer까지"
description: "React Hook을 TypeScript로 안전하게 쓰는 법을 정리합니다. useState의 추론과 제네릭 명시 기준, null·빈 배열 함정, useReducer를 판별 유니온 Action으로 타이핑하기, useCallback·useMemo의 추론, 커스텀 Hook의 반환값을 const 단언으로 튜플 고정하기까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 2
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "React", "Hooks", "useState", "useReducer", "커스텀훅"]
featured: false
draft: false
---

[지난 글](/posts/ts-react-props-children/)에서 컴포넌트 바깥 경계인 props와 children을 타이핑했다. 이번에는 컴포넌트 안쪽, 즉 상태와 로직을 담당하는 Hook들을 다룬다. Hook은 대부분 제네릭 함수라서, 언제 타입을 추론에 맡기고 언제 직접 명시해야 하는지 감을 잡는 게 핵심이다. `useState`·`useReducer`·`useCallback`·`useMemo`와 커스텀 Hook까지 순서대로 본다.

## useState — 초깃값이 곧 타입

`useState`는 초깃값을 보고 상태 타입을 추론한다. `useState(0)`이면 `number`, `useState("")`면 `string`이다. 값이 단순하면 제네릭을 생략하는 게 깔끔하다.

```typescript
const [count, setCount] = useState(0); // number
const [name, setName] = useState(""); // string
```

문제는 추론이 우리가 원하는 것과 어긋나는 경우다. 초깃값으로 `null`만 주면 타입이 `null`로 굳어 버려서 나중에 객체를 넣을 수 없고, 빈 배열 `[]`을 주면 `never[]`로 추론되어 어떤 요소도 못 넣는다. 이럴 때 제네릭을 명시한다.

```typescript
const [user, setUser] = useState<User | null>(null);
const [items, setItems] = useState<Item[]>([]);
```

![useState 추론과 제네릭](/assets/posts/ts-react-hooks-typing-usestate.svg)

규칙은 간단하다. **초깃값만으로 원하는 타입이 나오면 생략, 아니면 제네릭으로 명시.** `null` 가능성이나 빈 컬렉션, 유니온 상태가 거의 모든 명시 케이스다.

`setState`에 함수형 업데이트를 넘길 때도 타입은 자연스럽게 따라온다. `setCount((prev) => prev + 1)`에서 `prev`는 자동으로 `number`다.

## useReducer — Action을 판별 유니온으로

상태 전이가 복잡해지면 `useReducer`가 낫다. 여기서 TypeScript의 진가가 드러나는데, **State와 Action에 타입만 잘 달면 reducer 내부와 dispatch 호출부가 통째로 검증된다.**

핵심은 Action을 [판별 유니온](/posts/ts-discriminated-union/)으로 선언하는 것이다.

```typescript
interface State {
  count: number;
}

type Action =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "set"; payload: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    case "set":
      return { count: action.payload }; // payload는 여기서만 접근 가능
  }
}
```

`action.type`으로 `switch`하면 각 분기 안에서 `action`이 해당 멤버로 좁혀진다. `"set"` 분기에서만 `action.payload`에 접근할 수 있고, `"increment"` 분기에서 `payload`를 쓰려 하면 에러다.

![useReducer와 판별 유니온 Action](/assets/posts/ts-react-hooks-typing-usereducer.svg)

`useReducer(reducer, { count: 0 })`로 호출하면 `dispatch`의 타입도 `Dispatch<Action>`으로 자동 추론된다. `dispatch({ type: "set" })`처럼 `payload`를 빼먹으면 컴파일 에러가 나고, 존재하지 않는 `type`을 쓰면 거부된다. [exhaustiveness 검사](/posts/ts-exhaustiveness-checking/)까지 곁들이면 Action을 추가했을 때 처리하지 않은 분기를 컴파일러가 잡아준다.

## useRef — 두 가지 얼굴

`useRef`는 용도에 따라 타입이 갈린다. 가변 값을 담는 컨테이너로 쓸 때와 DOM 요소를 참조할 때다. 이 구분은 다음 글에서 자세히 다루므로 여기서는 한 줄만 짚는다.

```typescript
const renderCount = useRef(0); // MutableRefObject<number>
const inputRef = useRef<HTMLInputElement>(null); // DOM 참조용
```

DOM 참조용은 초깃값 `null`과 제네릭을 함께 줘서 `current`가 `HTMLInputElement | null`이 되게 한다.

## useCallback과 useMemo — 추론에 맡기되 의존성 주의

`useCallback`은 함수를, `useMemo`는 계산 결과를 메모이즈한다. 둘 다 콜백의 반환 타입을 추론하므로 대개 제네릭을 쓸 일이 없다.

```typescript
const handleClick = useCallback((id: number) => {
  console.log(id);
}, []); // (id: number) => void

const total = useMemo(() => items.reduce((a, b) => a + b.price, 0), [items]); // number
```

콜백 인자에 타입을 달아두면 반환 함수의 시그니처가 그대로 따라온다. 타입 자체는 거의 알아서 잡히고, 오히려 신경 쓸 부분은 의존성 배열 — 이건 타입이 아니라 `eslint-plugin-react-hooks`가 잡는 영역이다.

## 커스텀 Hook — const 단언으로 튜플 고정

여러 Hook을 묶어 커스텀 Hook을 만들 때, 배열을 반환하면 함정이 있다. 그냥 `return [value, setValue]`를 하면 TypeScript는 이를 `(T | Dispatch<...>)[]` 같은 유니온 배열로 넓혀 버려서, 호출부에서 구조 분해할 때 타입이 섞인다.

해결은 [const 단언](/posts/ts-readonly-const-assertions/)으로 튜플임을 못 박는 것이다.

```typescript
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle] as const; // readonly [boolean, () => void]
}

// 사용
const [isOpen, toggleOpen] = useToggle();
// isOpen: boolean, toggleOpen: () => void — 순서대로 정확히 좁혀짐
```

`as const`를 붙이면 반환값이 `readonly [boolean, () => void]` 튜플로 고정되어, 첫 요소는 `boolean`, 둘째는 함수로 정확히 추론된다. 객체를 반환해도 되지만(`{ on, toggle }`), `useState`처럼 위치 기반으로 쓰고 싶으면 `as const` 튜플이 정답이다.

정리하면, Hook 타이핑의 일관된 원칙은 "추론이 맞으면 맡기고, 어긋나면 명시한다"이다. `useState`의 `null`·빈 배열, `useReducer`의 판별 유니온 Action, 커스텀 Hook의 `as const` 튜플 — 이 세 가지만 익히면 대부분의 Hook 타이핑이 매끄러워진다. 다음 글에서는 `useRef`와 `forwardRef`로 DOM 요소와 ref를 안전하게 다루는 법을 깊게 본다.

---

**지난 글:** [React Props와 children 타이핑](/posts/ts-react-props-children/)

**다음 글:** [ref와 forwardRef 타이핑](/posts/ts-react-refs-forwardref/)

<br>
읽어주셔서 감사합니다. 😊
