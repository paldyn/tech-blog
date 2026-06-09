---
title: "Suspense로 비동기 UI 선언적으로 처리하기"
description: "React Suspense의 동작 원리, React.lazy와의 조합, 중첩 Suspense로 병렬 로딩 구현, ErrorBoundary와의 조합 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["React", "Suspense", "비동기", "React.lazy", "코드스플리팅", "선언적UI"]
featured: false
draft: false
---

[지난 글](/posts/react-error-boundaries-deep/)에서 에러 경계 심화 패턴을 살펴봤다. 이번에는 **Suspense** 다. 에러 경계가 에러 상태를 선언적으로 처리하듯, Suspense는 **로딩 상태를 선언적으로 처리**한다.

## Suspense란?

전통적인 방식에서는 컴포넌트가 로딩 상태를 직접 관리했다. `isLoading` state, `useEffect`로 fetch, 로딩이면 Spinner 반환 — 이 패턴이 모든 컴포넌트에서 반복됐다.

Suspense는 이 관심사를 분리한다. **컴포넌트는 "데이터가 있다고 가정"하고 렌더링 로직에만 집중**하고, 로딩 상태 표시는 부모의 Suspense 경계가 담당한다.

![Suspense 개념](/assets/posts/react-suspense-concept.svg)

## 동작 원리

Suspense의 핵심은 **Promise를 throw**하는 것이다. 컴포넌트가 렌더링 도중 Promise를 throw하면:

1. React가 해당 컴포넌트 렌더링을 멈춤
2. 가장 가까운 상위 Suspense 경계가 `fallback`을 표시
3. throw된 Promise가 resolve되면 해당 컴포넌트를 다시 렌더링 시도

이 메커니즘을 직접 구현할 수도 있지만, 실제로는 `React.lazy`나 React Query 같은 라이브러리가 대신 처리해 준다.

## React.lazy로 코드 스플리팅

현재 Suspense가 안정적으로 지원되는 주요 사용처는 `React.lazy`다.

```tsx
import { lazy, Suspense } from 'react';

// 컴포넌트를 동적으로 import
const HeavyChart = lazy(() => import('./HeavyChart'));
const DataTable = lazy(() => import('./DataTable'));

function Dashboard() {
  return (
    <div>
      <Suspense fallback={<div>차트 불러오는 중...</div>}>
        <HeavyChart />
      </Suspense>
      <Suspense fallback={<div>테이블 불러오는 중...</div>}>
        <DataTable />
      </Suspense>
    </div>
  );
}
```

`React.lazy`로 감싼 컴포넌트가 처음 렌더링될 때 해당 청크가 로드된다. 로드 완료 전까지 가장 가까운 Suspense의 `fallback`이 표시된다.

## Suspense 중첩과 배치 전략

![Suspense 중첩과 병렬 로딩](/assets/posts/react-suspense-boundaries.svg)

Suspense를 어디에 배치하느냐가 사용자 경험에 큰 영향을 준다.

### 단일 Suspense (모두 준비될 때까지 대기)

```tsx
<Suspense fallback={<PageSkeleton />}>
  <Profile />   {/* 각자 데이터 로딩 */}
  <Activity />
  <Friends />
</Suspense>
```

세 컴포넌트 중 하나라도 suspend되면 모두 `PageSkeleton`으로 대체된다. 가장 느린 컴포넌트가 전체 로딩 시간을 결정한다.

### 독립 Suspense (각각 독립적으로 표시)

```tsx
<Suspense fallback={<ProfileSkeleton />}>
  <Profile />
</Suspense>
<Suspense fallback={<ActivitySkeleton />}>
  <Activity />
</Suspense>
<Suspense fallback={<FriendsSkeleton />}>
  <Friends />
</Suspense>
```

각 섹션이 준비되는 대로 독립적으로 표시된다. 빠른 컴포넌트가 먼저 보인다.

## ErrorBoundary + Suspense 조합

Suspense는 로딩 상태만 처리한다. 에러 상태는 여전히 ErrorBoundary가 필요하다.

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { lazy, Suspense } from 'react';

const LazyPage = lazy(() => import('./LazyPage'));

function SafeLazyLoad() {
  return (
    <ErrorBoundary
      fallback={<div>페이지를 불러오지 못했습니다</div>}
      onError={(e) => logger.error(e)}
    >
      <Suspense fallback={<div>로딩 중...</div>}>
        <LazyPage />
      </Suspense>
    </ErrorBoundary>
  );
}
```

`ErrorBoundary`는 바깥, `Suspense`는 안쪽에 배치하는 것이 일반적이다. 로드 실패 시 ErrorBoundary가 가로채고, 로딩 중에는 Suspense가 fallback을 보여준다.

## React Query와 Suspense

React Query에서 Suspense 모드를 활성화하면 `isLoading` 체크 없이 데이터를 바로 사용할 수 있다.

```tsx
import { useSuspenseQuery } from '@tanstack/react-query';

function UserProfile({ userId }: { userId: string }) {
  // suspend될 경우 가장 가까운 Suspense가 fallback 표시
  const { data } = useSuspenseQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  // data는 항상 존재 (로딩 중에는 이 줄에 도달하지 않음)
  return <div>{data.name}</div>;
}

// 사용
function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <Suspense fallback={<ProfileSkeleton />}>
        <UserProfile userId="123" />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## React 19의 use 훅

React 19부터는 `use` 훅으로 Promise를 직접 소비할 수 있다.

```tsx
import { use, Suspense } from 'react';

function Message({ messagePromise }: { messagePromise: Promise<string> }) {
  const message = use(messagePromise); // suspend
  return <p>{message}</p>;
}

function App() {
  const messagePromise = fetchMessage(); // 컴포넌트 외부에서 시작

  return (
    <Suspense fallback={<p>불러오는 중...</p>}>
      <Message messagePromise={messagePromise} />
    </Suspense>
  );
}
```

`use`는 조건문 안에서도 호출할 수 있다는 점에서 일반 훅과 다르다.

## Suspense와 서버 사이드 렌더링

Next.js App Router에서 Suspense는 스트리밍 SSR과 연동된다. 서버에서 Suspense 경계를 만나면 해당 부분을 나중에 스트리밍으로 전송하고, 먼저 준비된 HTML을 클라이언트에 전달한다. 사용자는 페이지 일부를 더 빨리 볼 수 있다.

```tsx
// app/dashboard/page.tsx (Next.js App Router)
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <main>
      <h1>대시보드</h1>
      <Suspense fallback={<StatsSkeleton />}>
        {/* 서버에서 데이터 페칭 — 완료 시 스트리밍 */}
        <Stats />
      </Suspense>
    </main>
  );
}
```

---

**지난 글:** [에러 경계 심화: 복구·리셋·에러 추적](/posts/react-error-boundaries-deep/)

**다음 글:** [Suspense와 데이터 페칭](/posts/react-suspense-data-fetching/)

<br>
읽어주셔서 감사합니다. 😊
