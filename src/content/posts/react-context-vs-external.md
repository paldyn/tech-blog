---
title: "Context vs 외부 상태 관리 — 언제 무엇을 쓸까?"
description: "Context와 Zustand/Redux 같은 외부 상태 관리 라이브러리의 성능 차이, 렌더링 동작 비교, 선택 기준과 마이그레이션 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["상태관리", "Context", "Zustand", "Redux", "성능최적화"]
featured: false
draft: false
---

[지난 글](/posts/react-state-management-overview/)에서 상태 관리 도구들을 개요로 살펴봤다. 이번 글에서는 가장 많이 비교되는 **React Context와 외부 상태 관리 라이브러리** 간의 핵심 차이를 깊이 분석한다.

## Context의 작동 방식과 한계

Context는 React의 내장 메커니즘으로 prop drilling 없이 상태를 공유한다. 하지만 **성능 특성**을 이해하지 못하면 문제가 생긴다.

Context의 값이 변경되면 해당 Context를 `useContext`로 소비하는 **모든 컴포넌트가 re-render**된다. 변경된 값을 실제로 사용하든 사용하지 않든 관계없다.

```tsx
// 하나의 Context에 여러 값을 넣으면 문제 발생
const AppContext = createContext({
  user: null,
  theme: 'light',
  notifications: [],
  cartItems: [],
});

// user 정보만 쓰는 컴포넌트도
// cartItems가 변경되면 re-render됨
function UserAvatar() {
  const { user } = useContext(AppContext); // cartItems 변경에도 re-render!
  return <img src={user?.avatar} />;
}
```

![Context vs 외부 상태 관리 비교](/assets/posts/react-context-vs-external-comparison.svg)

## Context의 성능 문제를 해결하는 방법

Context만으로 최적화하려면 **Context를 분리**해야 한다.

```tsx
// Context 분리: 각 값마다 별도 Context
const UserContext = createContext<User | null>(null);
const ThemeContext = createContext<'light' | 'dark'>('light');
const CartContext = createContext<CartItem[]>([]);

// 이제 UserAvatar는 user Context만 구독
function UserAvatar() {
  const user = useContext(UserContext); // theme, cart 변경 무관
  return <img src={user?.avatar} />;
}
```

하지만 공유할 상태가 많아질수록 Context 파일이 늘어나고 Provider 중첩이 깊어진다.

## 외부 라이브러리의 핵심 차이: 구독(Subscription)

Zustand, Redux 같은 외부 라이브러리는 **구독 기반**으로 동작한다. 컴포넌트는 스토어의 특정 슬라이스만 구독하고, 그 부분이 변경될 때만 re-render된다.

```tsx
// Zustand: selector로 필요한 값만 구독
const count = useStore(state => state.count);
// count 이외의 상태가 변경돼도 re-render 없음

// Redux: useSelector로 구독
const count = useSelector(state => state.counter.count);
// 다른 slice 변경 시 re-render 없음
```

![Context vs Zustand 렌더링 차이](/assets/posts/react-context-vs-external-perf.svg)

## 실제 성능이 문제가 되는 시점

Context의 성능 문제는 다음 조건에서 현실화된다.

1. **빈번한 업데이트**: 마우스 위치, 애니메이션, 실시간 데이터처럼 초당 수십 번 업데이트되는 경우
2. **많은 소비자**: Context를 구독하는 컴포넌트가 수십 개 이상인 경우
3. **무거운 컴포넌트**: re-render 비용이 비싼 컴포넌트가 Context를 소비하는 경우

반대로 Context가 충분한 경우는 다음과 같다.

- 업데이트가 드문 경우 (로그인 상태, 테마)
- 소비자가 적은 경우
- `React.memo`로 최적화된 컴포넌트들인 경우

## 마이그레이션 전략: Context에서 Zustand로

Context로 시작했다가 성능 문제가 생기면 Zustand로 마이그레이션하기 쉽다.

```tsx
// Before: Context 기반
const CartContext = createContext<CartState | null>(null);

function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const addItem = (item: CartItem) => setItems(prev => [...prev, item]);
  return (
    <CartContext.Provider value={{ items, addItem }}>
      {children}
    </CartContext.Provider>
  );
}

// After: Zustand 기반
import { create } from 'zustand';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
}

const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (item) => set(state => ({ items: [...state.items, item] })),
  removeItem: (id) => set(state => ({
    items: state.items.filter(i => i.id !== id)
  })),
}));

// 사용 측: useContext → useCartStore로만 변경
const { items, addItem } = useCartStore();
```

Context는 Provider로 컴포넌트 트리를 감싸야 했지만 Zustand는 `Provider` 없이도 어디서든 사용 가능하다.

## 언제 어떤 도구를 쓸까?

구체적인 시나리오별 선택 기준이다.

```tsx
// 시나리오 1: 인증 상태 → Context
// 업데이트 빈도 낮음, 앱 전체에서 필요, 외부 의존성 피하고 싶음
const AuthContext = createContext<AuthState | null>(null);

// 시나리오 2: 장바구니 → Zustand
// 여러 페이지에서 빈번히 업데이트, 구독 최적화 필요
const useCartStore = create<CartStore>(...);

// 시나리오 3: 대규모 전자상거래 앱 → Redux Toolkit
// 복잡한 미들웨어, 시간 여행 디버깅, 팀 표준화 필요
const store = configureStore({ reducer: { cart: cartSlice.reducer } });
```

**정리하면**: 새 프로젝트에서 전역 상태가 필요하다면 **Zustand로 시작**하는 것을 권장한다. Context보다 성능이 좋고, Redux보다 학습 곡선이 낮다. 대규모 팀이나 이미 Redux를 쓰는 프로젝트라면 Redux Toolkit이 좋은 선택이다.

다음 글에서는 Redux Toolkit을 구체적으로 살펴본다.

---

**지난 글:** [React 상태 관리 전략 개요 — 내장 훅부터 외부 라이브러리까지](/posts/react-state-management-overview/)

**다음 글:** [Redux Toolkit 완전 가이드 — createSlice와 configureStore](/posts/react-redux-toolkit/)

<br>
읽어주셔서 감사합니다. 😊
