---
title: "Context 성능 최적화 — 불필요한 리렌더 막기"
description: "Context 사용 시 발생하는 불필요한 리렌더 원인과 세 가지 해결책(useMemo value 안정화, Context 분리, 상태·액션 분리)을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 10
type: "knowledge"
category: "React"
tags: ["React", "Context", "성능최적화", "리렌더", "useMemo", "React.memo", "useReducer"]
featured: false
draft: false
---

[지난 글](/posts/react-usesyncexternalstore/)에서 외부 저장소를 안전하게 구독하는 방법을 배웠다. 이번에는 React 내장 Context를 쓸 때 흔히 발생하는 성능 문제와 그 해결법을 다룬다. Context는 편리하지만 잘못 쓰면 관계없는 컴포넌트까지 리렌더된다.

## Context가 리렌더를 유발하는 원리

`Context.Provider`의 `value`가 변경되면 해당 Context를 `useContext`로 구독하는 **모든** 컴포넌트가 리렌더된다. 이는 Context의 작동 방식이며, 레퍼런스 동등성 비교(`Object.is`)로 판단한다.

```jsx
// ❌ 매 렌더마다 새 객체 → 모든 소비자 리렌더
function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('dark');

  return (
    <MyContext.Provider value={{ user, theme, setUser, setTheme }}>
      {children}
    </MyContext.Provider>
  );
}
```

`AppProvider`가 리렌더될 때마다 `value={{ user, theme, setUser, setTheme }}`은 새 객체가 된다. `user`와 `theme`이 바뀌지 않아도 마찬가지다. 이 Provider 아래에서 `useContext(MyContext)`를 쓰는 컴포넌트는 전부 리렌더된다.

![Context 성능 문제](/assets/posts/react-context-performance-problem.svg)

## 해결책 1: value를 useMemo로 안정화

```jsx
function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('dark');

  // user, theme이 바뀔 때만 새 객체 생성
  const value = useMemo(
    () => ({ user, theme, setUser, setTheme }),
    [user, theme]
  );

  return (
    <MyContext.Provider value={value}>
      {children}
    </MyContext.Provider>
  );
}
```

이제 `user`나 `theme`이 바뀔 때만 새 객체가 생성되고, 그때만 소비자가 리렌더된다. 단, 두 값이 하나의 Context에 묶여 있으므로 `user`만 구독하고 싶은 컴포넌트도 `theme`이 바뀌면 리렌더된다.

## 해결책 2: 관심사별 Context 분리

가장 효과적인 방법이다. 변경 주기가 다른 값은 Context를 나눈다.

```jsx
const UserContext = createContext(null);
const ThemeContext = createContext(null);

function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('dark');

  const userValue = useMemo(() => ({ user, setUser }), [user]);
  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        {children}
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}

// 컴포넌트는 필요한 Context만 구독
function UserAvatar() {
  const { user } = useContext(UserContext); // theme 변경 시 리렌더 안 됨
  return <img src={user?.avatar} alt={user?.name} />;
}

function ThemeButton() {
  const { theme, setTheme } = useContext(ThemeContext); // user 변경 시 리렌더 안 됨
  return (
    <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
      {theme}
    </button>
  );
}
```

## 해결책 3: 상태와 액션을 별도 Context로 분리

`useReducer`와 Context를 함께 쓸 때 특히 유효한 패턴이다.

```jsx
const StateContext = createContext(null);
const DispatchContext = createContext(null);

function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // dispatch는 useReducer가 안정적 레퍼런스를 보장 → useMemo 불필요
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}
```

`dispatch`는 `useReducer`가 항상 동일한 레퍼런스를 반환한다. `DispatchContext.Provider`의 `value`는 절대 바뀌지 않으므로, 액션 함수만 필요한 컴포넌트는 상태가 아무리 바뀌어도 리렌더되지 않는다.

```jsx
// 상태는 읽고 싶지 않지만 액션만 필요한 컴포넌트
function AddItemButton() {
  const dispatch = useContext(DispatchContext); // 절대 리렌더 없음
  return (
    <button onClick={() => dispatch({ type: 'ADD_ITEM', payload: 'new' })}>
      추가
    </button>
  );
}
```

## React.memo와 Context 조합

![Context + React.memo 패턴](/assets/posts/react-context-performance-memo.svg)

Context를 직접 소비하지 않는 자식은 `React.memo`로 보호할 수 있다.

```jsx
const ExpensiveWidget = React.memo(function ExpensiveWidget() {
  // useContext를 쓰지 않으므로 Context 변경 시 리렌더 없음
  return <div>비싼 위젯</div>;
});

function Dashboard() {
  const { user } = useContext(UserContext); // UserContext 구독
  return (
    <div>
      <UserGreeting user={user} />
      <ExpensiveWidget /> {/* user 변경 시 리렌더 안 됨 */}
    </div>
  );
}
```

`ExpensiveWidget`이 `useContext`를 직접 호출하지 않으면 `React.memo`로 감쌌을 때 Context 변경과 무관하게 보호된다. 단, Context를 소비하는 컴포넌트는 `React.memo`로 감싸도 Context가 바뀌면 리렌더된다.

## 언제 외부 상태 관리를 고려할까

Context는 "자주 바뀌지 않는 전역 설정"에 적합하다. 빠르게 자주 바뀌는 상태(예: 폼 입력값, 애니메이션 상태)를 Context로 관리하면 어떻게 최적화해도 한계가 있다. 그 경우에는 Zustand, Jotai 같은 외부 상태 관리 라이브러리가 더 적합하다. 이 라이브러리들은 `useSyncExternalStore` 기반으로 필요한 컴포넌트만 정밀하게 구독할 수 있다.

---

**지난 글:** [useSyncExternalStore로 외부 상태 구독하기](/posts/react-usesyncexternalstore/)

**다음 글:** [Context 분리 전략 — 여러 Context를 구조화하는 법](/posts/react-splitting-contexts/)

<br>
읽어주셔서 감사합니다. 😊
