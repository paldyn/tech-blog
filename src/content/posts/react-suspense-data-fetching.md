---
title: "Suspense와 데이터 페칭"
description: "Render-as-You-Fetch 패턴으로 워터폴을 방지하는 방법, React Query useSuspenseQuery 활용, 병렬 요청 설계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["React", "Suspense", "데이터페칭", "ReactQuery", "useSuspenseQuery", "워터폴"]
featured: false
draft: false
---

[지난 글](/posts/react-suspense/)에서 Suspense의 기본 개념을 살펴봤다. 이번에는 Suspense를 **데이터 페칭**에 실제로 적용하는 방법을 다룬다. 특히 워터폴(Waterfall) 문제를 해결하는 Render-as-You-Fetch 패턴과 React Query 연동에 집중한다.

## 페칭 패턴의 진화

### 1. Fetch-on-Render (기존 방식)

컴포넌트가 마운트된 후 `useEffect`에서 데이터를 fetching한다.

```tsx
function Profile({ id }: { id: string }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(id).then(setUser);
  }, [id]);

  if (!user) return <Spinner />;
  return <UserCard user={user} />;
}
```

문제: 컴포넌트가 렌더링되어야 fetch가 시작된다. 중첩 컴포넌트에서는 **워터폴**이 발생한다.

```
Parent 렌더
  → Parent fetch 완료
    → Child 렌더 (Parent 완료 후에야 시작)
      → Child fetch 완료
```

### 2. Fetch-then-Render

부모에서 모든 데이터를 fetch한 후 자식에게 전달한다. 코드 복잡도가 높아진다.

### 3. Render-as-You-Fetch (Suspense 방식)

**렌더 전에 fetch를 시작**하고, Suspense가 로딩 상태를 처리한다.

![데이터 페칭 패턴 비교](/assets/posts/react-suspense-data-fetching-patterns.svg)

```tsx
// 모듈 수준 또는 라우트 진입 시 즉시 시작
const userQuery = queryClient.prefetchQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id),
});
```

## React Query useSuspenseQuery

실무에서 Suspense 데이터 페칭은 React Query의 `useSuspenseQuery`로 구현하는 것이 가장 현실적이다.

![React Query + Suspense 통합](/assets/posts/react-suspense-data-fetching-rq.svg)

```tsx
import { useSuspenseQuery } from '@tanstack/react-query';

function UserProfile({ id }: { id: string }) {
  // 로딩 중: Suspense fallback 표시
  // 에러: ErrorBoundary가 처리
  // 성공: data는 반드시 존재
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
  });

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

`isLoading`, `error` 체크가 사라진다. 컴포넌트는 항상 데이터가 있다고 가정하고 렌더링 로직에만 집중한다.

## 병렬 요청으로 워터폴 방지

중첩 컴포넌트에서 각자 `useSuspenseQuery`를 쓰면 워터폴이 발생할 수 있다. 이를 방지하려면 **부모에서 미리 쿼리를 시작**한다.

```tsx
// 방법 1: prefetchQuery로 미리 시작
function ProfilePage({ userId }: { userId: string }) {
  // 쿼리를 미리 kick-off (await 없음)
  queryClient.prefetchQuery({ queryKey: ['posts', userId], queryFn: () => fetchPosts(userId) });

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserProfile userId={userId} />
      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts userId={userId} />
      </Suspense>
    </Suspense>
  );
}
```

```tsx
// 방법 2: useSuspenseQueries로 병렬 요청
import { useSuspenseQueries } from '@tanstack/react-query';

function Dashboard({ userId }: { userId: string }) {
  const [{ data: profile }, { data: posts }, { data: friends }] = useSuspenseQueries({
    queries: [
      { queryKey: ['profile', userId], queryFn: () => fetchProfile(userId) },
      { queryKey: ['posts', userId], queryFn: () => fetchPosts(userId) },
      { queryKey: ['friends', userId], queryFn: () => fetchFriends(userId) },
    ],
  });

  return (
    <div>
      <ProfileCard profile={profile} />
      <PostList posts={posts} />
      <FriendList friends={friends} />
    </div>
  );
}
```

`useSuspenseQueries`는 세 요청을 병렬로 시작하고, 모두 완료되면 컴포넌트를 렌더링한다. 가장 느린 요청이 완료될 때까지 Suspense fallback이 표시된다.

## 독립적으로 표시되게 하려면 Suspense 분리

모두 완료될 때까지 기다리는 것보다, 각 섹션이 독립적으로 표시되게 하려면:

```tsx
function Dashboard({ userId }: { userId: string }) {
  return (
    <div>
      <ErrorBoundary fallback={<SectionError />}>
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfileSection userId={userId} />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={<SectionError />}>
        <Suspense fallback={<PostsSkeleton />}>
          <PostsSection userId={userId} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
```

각 섹션이 독립적으로 데이터를 로드하고 준비되는 대로 표시된다. 하나가 실패해도 다른 섹션은 영향받지 않는다.

## React 19의 use 훅으로 직접 처리

React 19에서는 라이브러리 없이도 `use`로 Suspense를 활용할 수 있다.

```tsx
'use client';
import { use, Suspense } from 'react';

// Promise를 props로 전달 (서버에서 생성)
function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);

  return (
    <ul>
      {comments.map((c) => <li key={c.id}>{c.text}</li>)}
    </ul>
  );
}

// 서버 컴포넌트 (Next.js App Router)
async function Page() {
  const commentsPromise = getComments(); // await 없이 바로 전달

  return (
    <Suspense fallback={<CommentSkeleton />}>
      <Comments commentsPromise={commentsPromise} />
    </Suspense>
  );
}
```

서버에서 Promise를 생성해 클라이언트 컴포넌트에 전달하면, 서버가 데이터를 스트리밍으로 전송할 수 있다.

## Suspense 데이터 페칭 주의사항

```
✓ useSuspenseQuery — 캐시, 재시도, 백그라운드 재검증 자동
✓ ErrorBoundary를 항상 Suspense 바깥에 배치
✓ 독립 섹션은 각각 Suspense로 분리
✗ useEffect 안에서 직접 throw Promise — 지원 안 됨
✗ 이벤트 핸들러 안에서 use() — 훅 규칙 위반
✗ Strict Mode에서 이중 호출 — 캐시 없으면 두 번 fetch됨
```

---

**지난 글:** [Suspense로 비동기 UI 선언적으로 처리하기](/posts/react-suspense/)

**다음 글:** [React.lazy와 코드 스플리팅](/posts/react-lazy-loading/)

<br>
읽어주셔서 감사합니다. 😊
