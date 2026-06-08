---
title: "Context + useReducer 아키텍처 — 상태와 액션 분리"
description: "Context와 useReducer를 결합해 상태(StateContext)와 액션(DispatchContext)을 별도로 제공하는 패턴을 구현하고, 불필요한 리렌더를 근본적으로 방지하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["useReducer", "Context아키텍처", "상태관리", "DispatchContext", "React패턴"]
featured: false
draft: false
---

[지난 글](/posts/react-splitting-contexts/)에서 Context를 역할별로 분리하는 전략을 살펴봤다. 여기서 한 단계 더 나아가면 **같은 Context 안에서도 상태(state)와 업데이트 함수(dispatch)를 별도 Context로 분리**하는 아키텍처가 있다. `useReducer`와 결합하면 이 패턴이 자연스럽게 완성된다.

## 왜 dispatch를 따로 분리하는가?

`useReducer`가 반환하는 `dispatch`는 컴포넌트 생애 동안 **항상 동일한 참조**를 유지한다. `useState`의 setter 함수와 마찬가지다. 즉, state가 바뀌어도 dispatch 함수 자체는 바뀌지 않는다.

이 특성을 활용하면:
- **상태를 읽기만 하는 컴포넌트** → StateContext 구독 → state 변경 시 리렌더
- **액션만 보내는 컴포넌트** → DispatchContext 구독 → state가 바뀌어도 **리렌더 없음**

![Context + Reducer 아키텍처](/assets/posts/react-context-reducer-architecture-pattern.svg)

## 패턴 구현

### 1. Context와 Reducer 정의

```tsx
// store/cart.tsx
import { createContext, useReducer, useContext, useCallback } from 'react';

type CartItem = { id: number; name: string; qty: number };
type State = { items: CartItem[]; loading: boolean };
type Action =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean };

function cartReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.payload) };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

const initialState: State = { items: [], loading: false };
```

### 2. StateContext와 DispatchContext 분리

```tsx
const CartStateContext = createContext<State | null>(null);
const CartDispatchContext = createContext<React.Dispatch<Action> | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  return (
    <CartStateContext.Provider value={state}>
      <CartDispatchContext.Provider value={dispatch}>
        {children}
      </CartDispatchContext.Provider>
    </CartStateContext.Provider>
  );
}
```

### 3. 커스텀 훅으로 안전하게 노출

```tsx
export function useCartState() {
  const ctx = useContext(CartStateContext);
  if (!ctx) throw new Error('CartProvider 밖에서 useCartState 사용 불가');
  return ctx;
}

export function useCartDispatch() {
  const ctx = useContext(CartDispatchContext);
  if (!ctx) throw new Error('CartProvider 밖에서 useCartDispatch 사용 불가');
  return ctx;
}

// 편의 훅: 도메인 액션을 추상화
export function useCartActions() {
  const dispatch = useCartDispatch();

  const addItem = useCallback(
    (item: CartItem) => dispatch({ type: 'ADD_ITEM', payload: item }),
    [dispatch],
  );

  const removeItem = useCallback(
    (id: number) => dispatch({ type: 'REMOVE_ITEM', payload: id }),
    [dispatch],
  );

  return { addItem, removeItem };
}
```

![Context + Reducer 코드 구조](/assets/posts/react-context-reducer-architecture-code.svg)

## 소비 컴포넌트 예시

```tsx
// CartBadge: 상태만 읽음 → items 바뀔 때만 리렌더
function CartBadge() {
  const { items } = useCartState();
  return <span>{items.length}</span>;
}

// AddButton: 액션만 보냄 → state가 바뀌어도 리렌더 안 됨
function AddButton({ item }: { item: CartItem }) {
  const { addItem } = useCartActions();
  return <button onClick={() => addItem(item)}>담기</button>;
}
```

`AddButton`은 `useCartDispatch`(또는 `useCartActions`)만 구독하므로 장바구니 목록이 아무리 바뀌어도 리렌더되지 않는다. React DevTools Profiler로 확인하면 `AddButton`은 항상 회색(스킵)으로 표시된다.

## reducer 함수 설계 팁

```tsx
// 불변 업데이트를 명확하게
case 'UPDATE_QTY': {
  const { id, qty } = action.payload;
  return {
    ...state,
    items: state.items.map((item) =>
      item.id === id ? { ...item, qty } : item
    ),
  };
}

// 여러 상태를 한번에 변경
case 'CHECKOUT_SUCCESS':
  return { ...state, items: [], loading: false };
```

reducer는 순수 함수여야 한다. 비동기 작업(`fetch` 등)은 reducer 밖 이벤트 핸들러에서 수행한 뒤 결과를 `dispatch`로 보낸다.

## 언제 이 패턴을 쓸까?

| 상황 | 권장 |
|---|---|
| 상태가 2~3개, 단방향 변경 | `useState` + 단일 Context |
| 복잡한 상태 로직, 여러 액션 타입 | `useReducer` 단독 |
| 전역 공유 + 액션 전용 컴포넌트 최적화 | Context + useReducer 분리 패턴 |
| 매우 복잡한 대규모 앱 | Redux Toolkit, Zustand 등 |

Context + useReducer 패턴은 외부 라이브러리 없이 전역 상태를 깔끔하게 관리하는 표준 접근법이다. 다음 글에서는 컴포넌트 수준의 최적화 도구인 `React.memo`를 살펴본다.

---

**지난 글:** [Context 분리 전략 — 역할별로 나눠 리렌더 최소화](/posts/react-splitting-contexts/)

**다음 글:** [React.memo — 컴포넌트 메모이제이션 완전 정복](/posts/react-react-memo/)

<br>
읽어주셔서 감사합니다. 😊
