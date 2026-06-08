---
title: "Context 분리 전략 — 역할별로 나눠 리렌더 최소화"
description: "단일 Context에 모든 상태를 담을 때 발생하는 불필요한 리렌더 문제를 진단하고, 역할별 Context 분리 패턴으로 해결하는 전략을 실전 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["Context분리", "리렌더최적화", "React성능", "useContext", "Context패턴"]
featured: false
draft: false
---

[지난 글](/posts/react-context-performance/)에서 Context 값을 `useMemo`로 안정화하는 기법을 살펴봤다. 그런데 구독하는 상태가 여러 종류로 섞여 있다면, 값 안정화만으로는 한계가 있다. 이번 글에서는 **Context 자체를 역할별로 나누는 분리 전략**을 다룬다.

## 단일 Context의 함정

규모가 작을 때는 한 Context에 모든 앱 상태를 몰아넣는 게 편하다.

```tsx
const AppContext = createContext<AppState | null>(null);

function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [cart, setCart] = useState<CartItem[]>([]);

  const value = { user, setUser, theme, setTheme, cart, setCart };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
```

이 코드의 문제는 `value` 객체가 `user`, `theme`, `cart` 중 **하나라도 바뀌면 새 참조**로 교체된다는 점이다. `useContext(AppContext)`를 쓰는 모든 컴포넌트가 세 가지 상태 중 자신과 무관한 것이 바뀌어도 리렌더된다.

![단일 Context 불필요 리렌더 문제](/assets/posts/react-splitting-contexts-problem.svg)

## 해결책: 역할별 Context 분리

가장 직관적인 해결책은 **도메인(역할)마다 별개의 Context**를 만드는 것이다.

```tsx
// contexts/UserContext.tsx
const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const value = useMemo(() => ({ user, setUser }), [user]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('UserProvider 외부에서 사용 불가');
  return ctx;
}
```

```tsx
// contexts/ThemeContext.tsx
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

```tsx
// index.tsx (Provider 조합)
<UserProvider>
  <ThemeProvider>
    <CartProvider>
      <App />
    </CartProvider>
  </ThemeProvider>
</UserProvider>
```

이제 `cart`가 바뀌어도 `UserContext`와 `ThemeContext` 구독 컴포넌트는 리렌더되지 않는다.

![Context 분리 전략](/assets/posts/react-splitting-contexts-solution.svg)

## Context 분리 기준

분리할 기준은 **"어떤 상태가 함께 바뀌는가"**다.

| 상태 묶음 | Context |
|---|---|
| 로그인 사용자 정보 | `UserContext` |
| UI 테마·다크모드 | `ThemeContext` |
| 장바구니 아이템 | `CartContext` |
| 알림·토스트 | `NotificationContext` |

비슷하게 자주 함께 업데이트되는 상태는 같은 Context에, 서로 독립적으로 변하는 상태는 다른 Context에 넣는 것이 원칙이다.

## 업데이트 함수(setter)도 분리할까?

업데이트 함수까지 분리하면 더 세밀한 최적화가 가능하다.

```tsx
// 상태와 업데이트 함수를 별도 Context로
const UserStateContext = createContext<User | null>(null);
const UserDispatchContext = createContext<React.Dispatch<UserAction> | null>(null);

function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, dispatch] = useReducer(userReducer, null);

  return (
    <UserStateContext.Provider value={user}>
      <UserDispatchContext.Provider value={dispatch}>
        {children}
      </UserDispatchContext.Provider>
    </UserStateContext.Provider>
  );
}
```

`dispatch`는 `useReducer`가 반환하는 **안정된 참조**이므로 `UserDispatchContext`만 구독하는 컴포넌트는 `user`가 바뀌어도 리렌더되지 않는다. 이 패턴은 다음 글에서 더 자세히 다룬다.

## 과분리의 위험

분리가 항상 좋은 것은 아니다. 너무 잘게 나누면:

- Provider 중첩이 깊어져 읽기 어려워진다
- 연관성 있는 상태를 여러 Context에서 따로 관리하면 동기화 버그가 생긴다
- 단순한 앱에서 오버엔지니어링이 된다

**2~3개 이하의 소규모 앱**이라면 단일 Context + `useMemo` 안정화로 충분하다. Context 분리는 "리렌더 병목이 실측됐을 때" 도입하는 것이 실용적이다.

## 실무 체크리스트

```
✓ 하나의 Context에 서로 독립적인 상태가 섞여 있는가?
✓ Profiler로 불필요한 리렌더가 실측됐는가?
✓ 분리 후 Context 이름이 책임을 명확히 드러내는가?
✓ 각 Provider에 커스텀 훅(useUser, useTheme)을 함께 제공하는가?
✓ Provider 외부에서 사용 시 에러를 던지는가?
```

단순 분리만으로도 리렌더 횟수가 눈에 띄게 줄어드는 경우가 많다. 특히 장바구니·알림처럼 업데이트 빈도가 높은 상태를 별도 Context로 분리하면 효과가 크다.

---

**지난 글:** [Context 성능 최적화 — 불필요한 리렌더 막기](/posts/react-context-performance/)

**다음 글:** [Context + useReducer 아키텍처 — 상태와 액션 분리](/posts/react-context-reducer-architecture/)

<br>
읽어주셔서 감사합니다. 😊
