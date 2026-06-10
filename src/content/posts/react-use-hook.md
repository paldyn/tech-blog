---
title: "use() 훅 — Promise와 Context를 조건문 안에서 읽기"
description: "React 19에서 추가된 use() 훅의 Promise 읽기, Context 읽기 방식과 기존 useEffect/useContext와의 차이, Suspense와 함께 사용하는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React19", "use훅", "Suspense", "Promise", "Context"]
featured: false
draft: false
---

[지난 글](/posts/react-transition-vs-deferred/)에서 `useTransition`과 `useDeferredValue`를 비교했다. React 19는 그보다 한층 더 나아간 새로운 훅을 도입했다. 그것이 바로 `use()`다. 기존 훅과 달리 `use()`는 조건문이나 반복문 안에서도 호출할 수 있어 훅 규칙의 제약을 일부 완화해 준다.

## use()란 무엇인가?

`use()`는 두 가지를 읽을 수 있는 훅이다.

1. **Promise** — Suspense와 통합해 비동기 값을 동기처럼 읽는다
2. **Context** — `useContext()`처럼 컨텍스트 값을 읽는다

가장 큰 차이는 **훅 규칙의 예외**를 인정받는다는 점이다. `useContext`나 `useState` 같은 기존 훅은 반드시 컴포넌트 최상위에서만 호출해야 하지만, `use()`는 조건문이나 반복문 안에서도 호출할 수 있다.

![use() 훅 개념과 before/after 비교](/assets/posts/react-use-hook-concept.svg)

## Promise 읽기 — 기존 방식과 비교

기존에는 비동기 데이터를 가져오려면 `useState` + `useEffect` 조합이 필요했다. 로딩 상태, 에러 상태, 데이터 상태를 각각 관리해야 해서 보일러플레이트가 많았다.

```tsx
// 기존: useEffect 패턴
function UserProfile({ id }: { id: number }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchUser(id)
      .then(u => { setUser(u); setLoading(false); })
      .catch(e => { setError(e); setLoading(false); });
  }, [id]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <h1>{user?.name}</h1>;
}
```

`use()`를 쓰면 컴포넌트가 훨씬 단순해진다.

```tsx
// React 19: use() + Suspense 패턴
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // 동기처럼 읽힌다
  return <h1>{user.name}</h1>;
}

// 부모 컴포넌트
function Page() {
  const userPromise = fetchUser(1); // 주의: 렌더마다 새로 생성되면 안 됨
  return (
    <Suspense fallback={<Spinner />}>
      <ErrorBoundary fallback={<ErrorMessage />}>
        <UserProfile userPromise={userPromise} />
      </ErrorBoundary>
    </Suspense>
  );
}
```

로딩 상태는 Suspense가, 에러는 ErrorBoundary가 처리하므로 컴포넌트는 **성공 케이스만 다루면** 된다.

## use()의 내부 동작

`use()`가 Promise를 받으면 세 가지 동작을 한다.

- **Pending**: Promise를 throw → Suspense가 잡아 fallback을 렌더
- **Resolved**: 값을 반환 → 컴포넌트 렌더링 재개
- **Rejected**: 에러를 throw → ErrorBoundary가 잡아 처리

![use() + Suspense 데이터 흐름](/assets/posts/react-use-hook-suspense.svg)

## Promise를 컴포넌트 밖에서 생성해야 하는 이유

`use()`를 사용할 때 가장 흔한 실수는 컴포넌트 함수 안에서 Promise를 생성하는 것이다.

```tsx
// 위험: 렌더링마다 새 Promise 생성
function UserCard({ id }: { id: number }) {
  const user = use(fetchUser(id)); // 매 렌더마다 fetchUser 호출!
  return <span>{user.name}</span>;
}

// 올바름: 부모에서 Promise를 한 번만 생성해 전달
function Page() {
  const [userPromise] = useState(() => fetchUser(1)); // 한 번만 생성
  return (
    <Suspense fallback={<Spinner />}>
      <UserCard promise={userPromise} />
    </Suspense>
  );
}
```

컴포넌트가 re-render될 때마다 새 Promise가 만들어지면 무한 루프에 빠진다. Promise는 `useState`의 초기값으로 만들거나, 컴포넌트 외부에서 캐싱된 형태로 전달받아야 한다.

## Context 읽기 — 조건문 안에서 가능

`useContext`는 최상위에서만 호출해야 하지만 `use(Context)`는 조건문 안에서도 쓸 수 있다.

```tsx
const ThemeContext = createContext<'light' | 'dark'>('light');

function Notification({ show }: { show: boolean }) {
  if (!show) return null;

  // useContext(ThemeContext)는 여기서 호출 불가 (훅 규칙 위반)
  // use()는 가능!
  const theme = use(ThemeContext);

  return <div className={`notification ${theme}`}>새 메시지가 있습니다</div>;
}
```

이 패턴은 조건에 따라 Context가 필요 없는 경우 불필요한 구독을 피할 수 있어 성능상 이점도 있다.

## 언제 use()를 쓰고 언제 useContext를 쓸까?

`use()`가 `useContext`를 완전히 대체하지는 않는다. 차이를 정리하면 다음과 같다.

| 상황 | 권장 |
|------|------|
| 컴포넌트 최상위에서 항상 Context 읽기 | `useContext` (명시적) |
| 조건문 안에서 Context 읽기 | `use()` |
| Promise/비동기 값 읽기 | `use()` 전용 |

## Server Components와의 관계

React Server Components에서는 `use()`를 사용하는 대신 `async/await`를 직접 쓸 수 있다. `use()`는 주로 **Client Components**에서 서버에서 만들어 전달된 Promise를 읽을 때 사용한다.

```tsx
// Server Component: async/await 직접 사용
async function ServerPage() {
  const user = await fetchUser(1); // 서버에서 직접 await
  return <ClientCard user={user} />;
}

// Client Component: use()로 Promise 읽기
'use client';
function ClientCard({ promise }: { promise: Promise<User> }) {
  const user = use(promise);
  return <span>{user.name}</span>;
}
```

`use()`는 React 19가 가져온 가장 주목할 만한 API 변화 중 하나다. 비동기 데이터 처리를 훨씬 선언적으로 만들어 주고, 훅 규칙의 유연성도 높여준다. 다음 글에서는 React 19의 Actions 개념을 살펴본다.

---

**지난 글:** [useTransition vs useDeferredValue 비교](/posts/react-transition-vs-deferred/)

**다음 글:** [React 19 Actions — 폼과 비동기 처리의 새로운 방식](/posts/react-actions/)

<br>
읽어주셔서 감사합니다. 😊
