---
title: "useContext — Prop Drilling 없이 전역 상태 공유"
description: "createContext와 Provider로 컨텍스트를 만들고, useContext로 어디서든 값을 구독하는 방법, 기본값 동작 원리, Provider 중첩, 컨텍스트 커스텀 훅 패턴, 그리고 성능 주의사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["React", "useContext", "createContext", "Provider", "PropDrilling", "전역상태", "컨텍스트"]
featured: false
draft: false
---

[지난 글](/posts/react-callback-refs/)에서 callback ref로 DOM 연결 시점을 감지하는 방법을 살펴봤다. 이번에는 prop drilling을 해결하는 `useContext`를 다룬다. 여러 계층을 거쳐 props를 전달해야 할 때, Context는 중간 컴포넌트들이 props를 알 필요 없이 데이터를 공유할 수 있게 해준다.

## createContext와 Provider

Context는 세 단계로 구성된다.

**1단계: createContext로 컨텍스트 생성**

```jsx
// ThemeContext.js
import { createContext } from 'react';

export const ThemeContext = createContext('light'); // 기본값
```

인수로 넘기는 기본값은 Provider 없이 사용할 때만 쓰인다. 실제로 Provider를 감싸는 경우에는 이 기본값이 무시된다.

**2단계: Provider로 값 공급**

```jsx
function App() {
  const [theme, setTheme] = useState('dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Layout />
    </ThemeContext.Provider>
  );
}
```

**3단계: useContext로 구독**

```jsx
function ThemeButton() {
  const { theme, setTheme } = useContext(ThemeContext);

  return (
    <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
      현재 테마: {theme}
    </button>
  );
}
```

![Context Provider에서 Consumer까지 흐름](/assets/posts/react-usecontext-tree.svg)

중간에 `Layout`이 있어도 `ThemeContext`를 전혀 몰라도 된다. Consumer(`ThemeButton`)가 Provider에서 값을 직접 가져온다.

![useContext 3단계 패턴 코드](/assets/posts/react-usecontext-code.svg)

## 기본값의 역할

`createContext(defaultValue)`의 기본값은 Provider가 없는 환경에서만 사용된다.

```jsx
// Provider 없이 useContext 사용 시
function StandaloneButton() {
  const { theme } = useContext(ThemeContext);
  // theme === 'light' (createContext의 기본값)
}
```

이것은 컴포넌트를 Provider 없이 단독으로 테스트할 때나, 라이브러리 컴포넌트에서 기본값을 제공할 때 유용하다.

## Provider 중첩 — 오버라이드

같은 Context의 Provider를 중첩하면, 안쪽 Provider의 값이 그 하위 트리에서 우선한다.

```jsx
<ThemeContext.Provider value={{ theme: 'dark' }}>
  <Header /> {/* theme = 'dark' */}
  <ThemeContext.Provider value={{ theme: 'light' }}>
    <Sidebar /> {/* theme = 'light' — 안쪽 Provider가 오버라이드 */}
  </ThemeContext.Provider>
  <Footer /> {/* theme = 'dark' */}
</ThemeContext.Provider>
```

중첩을 활용하면 서브트리마다 다른 값을 줄 수 있다.

## 컨텍스트 커스텀 훅 패턴

Context를 직접 노출하지 않고 커스텀 훅으로 감싸는 것이 좋은 관례다.

```jsx
// ThemeContext.js
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme은 ThemeProvider 안에서 사용해야 합니다');
  }
  return ctx;
}
```

```jsx
// 사용
function ThemeButton() {
  const { theme, setTheme } = useTheme(); // ThemeContext 직접 노출 안 함
}
```

이 패턴의 장점:
- Provider 없이 사용하면 즉시 명확한 에러 메시지 출력
- Context 내부 구조 변경 시 외부 코드를 수정할 필요 없음
- 자동완성과 타입 추론이 더 잘 동작

## Context와 성능

`useContext`를 사용하는 컴포넌트는 Provider의 `value`가 변경될 때마다 리렌더된다. value로 넘기는 객체를 매 렌더마다 새로 만들면 불필요한 리렌더가 발생한다.

```jsx
// 문제: 매 렌더마다 새 객체 생성
function App() {
  const [theme, setTheme] = useState('dark');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/* App이 리렌더될 때마다 새 객체 → 모든 Consumer 리렌더 */}
    </ThemeContext.Provider>
  );
}

// 해결: useMemo로 객체 고정
function App() {
  const [theme, setTheme] = useState('dark');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return (
    <ThemeContext.Provider value={value}>
      {/* theme이 실제로 바뀔 때만 Consumer 리렌더 */}
    </ThemeContext.Provider>
  );
}
```

또는 자주 변경되는 상태와 거의 변경되지 않는 함수를 별도 Context로 분리하는 방법도 있다. 이 주제는 이후 컨텍스트 성능 최적화 글에서 자세히 다룬다.

---

**지난 글:** [Callback Refs — DOM 연결 시점을 감지하는 ref](/posts/react-callback-refs/)

**다음 글:** [useReducer — 복잡한 상태 로직 관리](/posts/react-usereducer/)

<br>
읽어주셔서 감사합니다. 😊
