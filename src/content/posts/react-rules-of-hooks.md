---
title: "훅의 규칙 — 최상위에서만, 함수 컴포넌트에서만"
description: "React 훅의 두 가지 핵심 규칙(최상위에서만 호출, React 함수에서만 호출)과 그 이유를 Fiber의 링크드 리스트 구조로 설명하고, eslint-plugin-react-hooks로 규칙 위반을 자동 감지하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["React", "훅규칙", "RulesOfHooks", "useEffect", "useState", "ESLint", "Fiber"]
featured: false
draft: false
---

[지난 글](/posts/react-hydration/)에서 SSR과 하이드레이션을 살펴봤다. 이번에는 React 훅을 사용할 때 반드시 지켜야 하는 두 가지 규칙을 다룬다. 이 규칙은 임의적인 제약이 아니라 훅의 내부 구현에서 비롯된 필연적 요구사항이다.

## 두 가지 훅 규칙

**규칙 1**: 훅은 함수의 최상위에서만 호출한다. 반복문, 조건문, 중첩 함수 안에서 호출하면 안 된다.

**규칙 2**: 훅은 React 함수 컴포넌트나 커스텀 훅에서만 호출한다. 일반 JavaScript 함수에서 호출하면 안 된다.

```jsx
// 규칙 1 위반 — 조건문 안 훅
function Component({ show }) {
  if (show) {
    useState(0); // 금지!
  }
}

// 규칙 2 위반 — 일반 함수 안 훅
function regularFunction() {
  useState(0); // 금지!
}
```

## 왜 이 규칙이 필요한가?

훅이 어떻게 state를 기억하는지 이해하면 규칙의 이유가 명확해진다.

React는 컴포넌트의 훅 상태를 **Fiber 노드의 링크드 리스트**에 저장한다. 각 훅은 리스트의 한 노드다. React는 훅이 **항상 같은 순서로, 같은 수만큼** 호출된다고 가정하고 순서(인덱스)로 어떤 훅의 state인지 찾는다.

```
컴포넌트 함수 호출 시:
useState(0)  → hooks[0]
useEffect()  → hooks[1]
useRef(null) → hooks[2]

다음 렌더 시 (순서 동일해야 함):
useState(0)  → hooks[0] (state 올바르게 복원)
useEffect()  → hooks[1]
useRef(null) → hooks[2]
```

![훅 규칙과 Fiber 링크드 리스트](/assets/posts/react-rules-of-hooks-rule1.svg)

## 규칙 위반 시 어떤 일이?

조건문 안에 훅이 있으면 조건이 바뀔 때 훅의 수가 달라진다.

```jsx
function Form({ isLoggedIn }) {
  // 렌더 1 (isLoggedIn=true):
  // useState → hooks[0]
  // useEffect → hooks[1]  ← 조건 있음
  // useState → hooks[2]

  // 렌더 2 (isLoggedIn=false):
  // useState → hooks[0]
  // useState → hooks[1]  ← hooks[2]의 값을 잘못 읽음!
  
  const [name, setName] = useState('');
  if (isLoggedIn) {
    useEffect(() => loadUser()); // 이 훅이 사라짐
  }
  const [age, setAge] = useState(0);
  // isLoggedIn이 false로 바뀌면 age state가 hooks[1]을 읽음
  // 하지만 hooks[1]엔 원래 useEffect 데이터 → 예측 불가
}
```

![Fiber 링크드 리스트와 훅 순서](/assets/posts/react-rules-of-hooks-fiber.svg)

## 올바른 패턴: 조건은 훅 안으로

훅 호출 자체는 항상 최상위에 두고, 조건 로직을 훅 안으로 넣는다.

```jsx
// 잘못된 패턴
function Component({ userId }) {
  if (userId) {
    useEffect(() => fetchUser(userId), [userId]);
  }
}

// 올바른 패턴
function Component({ userId }) {
  useEffect(() => {
    if (!userId) return; // 조건을 안으로
    fetchUser(userId);
  }, [userId]);
}
```

```jsx
// 잘못된 패턴
function Component({ isAdmin }) {
  if (isAdmin) {
    const [logs, setLogs] = useState([]);
    // ...
  }
}

// 올바른 패턴 — 컴포넌트로 분리
function AdminSection() {
  const [logs, setLogs] = useState([]);
  return <div>{logs}</div>;
}

function Component({ isAdmin }) {
  return isAdmin ? <AdminSection /> : null;
}
```

## eslint-plugin-react-hooks

이 규칙을 수동으로 지키기 어렵기 때문에 eslint 플러그인이 자동으로 검사한다.

```bash
npm install --save-dev eslint-plugin-react-hooks
```

```json
// .eslintrc
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

Create React App, Vite React 템플릿, Next.js는 이 플러그인을 기본 포함한다. `rules-of-hooks`는 규칙 위반을 에러로 잡고, `exhaustive-deps`는 useEffect 의존성 배열 누락을 경고한다.

## 커스텀 훅 이름 규칙

커스텀 훅은 반드시 `use`로 시작해야 한다. `use`로 시작하지 않으면 eslint가 그 함수 안에서 훅 규칙을 검사하지 않는다.

```jsx
// 올바른 커스텀 훅 — use로 시작
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const handle = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return size;
}

// 잘못된 이름 — eslint가 훅으로 인식 못 함
function getWindowSize() { // use로 시작하지 않음
  const [size, setSize] = useState(...); // 경고 없이 통과
}
```

---

**지난 글:** [하이드레이션 — SSR과 React 연결하기](/posts/react-hydration/)

**다음 글:** [useEffect — 부수효과와 외부 시스템 동기화](/posts/react-useeffect/)

<br>
읽어주셔서 감사합니다. 😊
