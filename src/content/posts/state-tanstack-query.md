---
title: "TanStack Query — 서버 상태 관리의 표준"
description: "TanStack Query(구 React Query)의 서버 상태 개념, useQuery·useMutation·캐시 무효화·낙관적 업데이트·무한 스크롤까지 — 비동기 데이터 페칭의 모든 것을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "TanStack Query", "React Query", "서버상태", "useQuery", "useMutation", "캐시", "낙관적업데이트", "무한스크롤"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "state-rxjs-intro"
  title: "RxJS 입문 — Observable과 반응형 프로그래밍"
next:
  slug: "state-swr"
  title: "SWR — stale-while-revalidate 서버 상태 관리"
---

[지난 글](/posts/state-rxjs-intro/)에서 RxJS로 이벤트 스트림을 다루는 반응형 프로그래밍을 살펴봤습니다. 이번에는 방향을 틀어 **서버에서 가져오는 데이터**를 어떻게 관리할지 살펴봅니다. TanStack Query(구 React Query)는 "서버 상태 관리"라는 개념을 대중화시킨 라이브러리로, 오늘날 React 생태계에서 데이터 페칭의 사실상 표준이 되었습니다.

---

## 서버 상태 vs 클라이언트 상태

Redux, Zustand, MobX 같은 라이브러리는 **클라이언트 상태**(UI 상태, 폼 값, 탭 선택 등)를 다루는 데 최적화되어 있습니다. 그런데 실제 앱의 상태 대부분은 서버에서 가져오는 데이터입니다. 이 **서버 상태**는 클라이언트 상태와 본질적으로 다릅니다.

| 특성 | 클라이언트 상태 | 서버 상태 |
|---|---|---|
| 소유권 | 내 앱이 소유 | 서버가 소유 |
| 신선도 | 항상 최신 | 언제든 outdated 가능 |
| 비동기 | 동기적 | 비동기 (fetch/await) |
| 공유 | 내 세션만 | 다른 사용자도 변경 가능 |

서버 상태를 Redux로 관리하면 `isLoading`, `isError`, `data`, `error` 필드를 슬라이스마다 수동으로 선언하고, `createAsyncThunk`로 비동기 흐름을 연결해야 합니다. 동일 API를 여러 컴포넌트에서 호출하면 중복 요청이 발생하고, 캐시 무효화 로직은 별도로 구현해야 합니다.

TanStack Query는 이 모든 문제를 처음부터 서버 상태를 위해 설계된 API로 해결합니다.

---

## 설치와 QueryClientProvider 설정

```bash
npm install @tanstack/react-query
# 선택: DevTools
npm install @tanstack/react-query-devtools
```

앱 최상단에 `QueryClientProvider`를 설정합니다.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,       // 1분: 이 시간 동안은 fresh로 간주
      gcTime: 1000 * 60 * 5,      // 5분: 캐시 보관 시간 (v5에서 cacheTime → gcTime)
      retry: 3,                    // 실패 시 최대 3회 재시도
      refetchOnWindowFocus: true,  // 탭 포커스 시 재검증
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MyApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

`QueryClient`는 전체 캐시를 관리하는 중앙 객체입니다. `defaultOptions`로 앱 전역 기본값을 설정하고, 개별 쿼리에서 재정의할 수 있습니다.

---

## useQuery: 데이터 가져오기

![TanStack Query 쿼리 수명 주기](/assets/posts/state-tanstack-query-lifecycle.svg)

`useQuery`는 서버 데이터를 가져오는 핵심 Hook입니다. 두 가지 필수 옵션이 있습니다.

- **`queryKey`**: 이 쿼리를 식별하는 배열. 같은 key를 가진 쿼리는 캐시를 공유합니다.
- **`queryFn`**: 실제 데이터를 가져오는 비동기 함수.

```tsx
import { useQuery } from '@tanstack/react-query'

function PostDetail({ postId }: { postId: number }) {
  const {
    data,          // 성공 시 데이터
    isLoading,     // 캐시도 없고 처음 로딩 중
    isFetching,    // 백그라운드 재검증 포함 모든 fetching 상태
    isError,       // 에러 발생
    error,         // 에러 객체
    refetch,       // 수동 재조회
  } = useQuery({
    queryKey: ['posts', postId],   // postId가 바뀌면 새 쿼리로 인식
    queryFn: () => fetch(`/api/posts/${postId}`).then(r => r.json()),
    staleTime: 1000 * 60,          // 1분 동안 fresh
    enabled: !!postId,             // postId가 falsy면 쿼리 실행 안 함
  })

  if (isLoading) return <Spinner />
  if (isError) return <ErrorMsg error={error} />

  return <article>{data.title}</article>
}
```

`isLoading`과 `isFetching`의 차이를 이해하는 것이 중요합니다. `isLoading`은 캐시가 전혀 없고 처음 데이터를 가져오는 상태입니다. `isFetching`은 백그라운드 재검증 중일 때도 `true`가 됩니다. 이미 데이터를 보여주면서 조용히 새로 가져오는 경우 스피너를 보여줄 필요가 없으므로 `isFetching`으로 분리해서 처리합니다.

### 쿼리 상태 머신

TanStack Query의 쿼리는 다음과 같은 상태를 순환합니다.

- **loading** → 처음 데이터를 가져오는 중
- **success** → 데이터 수신 완료, 캐시 저장
- **error** → fetch 실패 (자동 retry 포함)
- **stale** → `staleTime` 경과 후 데이터가 오래됨 (fresh → stale)
- **paused** → 오프라인이거나 observer가 없을 때

---

## queryKey 설계 전략

`queryKey`는 캐시 키이자 자동 재조회 트리거입니다. 배열 내 값이 바뀌면 TanStack Query는 새 쿼리로 인식해 자동으로 데이터를 다시 가져옵니다.

```tsx
// 단순 목록
useQuery({ queryKey: ['posts'], queryFn: fetchPosts })

// 파라미터 포함
useQuery({ queryKey: ['posts', postId], queryFn: () => fetchPost(postId) })

// 필터/정렬 포함
useQuery({
  queryKey: ['posts', { page, sort, filter }],
  queryFn: () => fetchPosts({ page, sort, filter }),
})

// 사용자별 데이터
useQuery({
  queryKey: ['user', userId, 'posts'],
  queryFn: () => fetchUserPosts(userId),
})
```

`queryKey`를 일관성 있게 설계하면 `invalidateQueries`로 관련 쿼리를 일괄 무효화할 수 있어 캐시 관리가 훨씬 쉬워집니다.

---

## useMutation: 데이터 변경

![TanStack Query 캐시 무효화 전략](/assets/posts/state-tanstack-query-cache.svg)

데이터를 생성·수정·삭제할 때는 `useMutation`을 사용합니다.

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

function CreatePostForm() {
  const queryClient = useQueryClient()

  const { mutate, isPending, isError } = useMutation({
    mutationFn: (newPost: { title: string; body: string }) =>
      fetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify(newPost),
        headers: { 'Content-Type': 'application/json' },
      }).then(r => r.json()),

    onSuccess: (data) => {
      // 성공 시 posts 목록 캐시 무효화 → 자동 재조회
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      console.log('생성된 포스트:', data)
    },

    onError: (error) => {
      console.error('에러:', error)
    },

    onSettled: () => {
      // 성공/실패 관계없이 항상 실행
    },
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      mutate({ title: '새 글', body: '내용...' })
    }}>
      <button type="submit" disabled={isPending}>
        {isPending ? '저장 중...' : '저장'}
      </button>
    </form>
  )
}
```

`invalidateQueries`는 지정한 key에 해당하는 모든 쿼리를 stale로 표시하고, 현재 화면에서 사용 중인 쿼리는 즉시 재조회를 트리거합니다. `['posts']`를 무효화하면 `['posts', 1]`, `['posts', 2]` 같은 하위 쿼리도 모두 포함됩니다.

---

## 낙관적 업데이트 (Optimistic Updates)

네트워크 응답을 기다리지 않고 UI를 먼저 업데이트하는 패턴입니다. 응답이 실패하면 롤백합니다.

```tsx
const { mutate } = useMutation({
  mutationFn: updatePost,

  onMutate: async (updatedPost) => {
    // 진행 중인 refetch가 낙관적 업데이트를 덮어쓰지 않도록 취소
    await queryClient.cancelQueries({ queryKey: ['posts', updatedPost.id] })

    // 롤백용 이전 값 저장
    const previousPost = queryClient.getQueryData(['posts', updatedPost.id])

    // 캐시를 즉시 업데이트 (낙관적)
    queryClient.setQueryData(['posts', updatedPost.id], updatedPost)

    return { previousPost }  // context로 전달
  },

  onError: (error, updatedPost, context) => {
    // 실패 시 이전 값으로 롤백
    queryClient.setQueryData(
      ['posts', updatedPost.id],
      context?.previousPost
    )
  },

  onSettled: (data, error, updatedPost) => {
    // 성공/실패 모두 재검증으로 서버 상태 동기화
    queryClient.invalidateQueries({ queryKey: ['posts', updatedPost.id] })
  },
})
```

`onMutate` → `onError` / `onSuccess` → `onSettled` 순서로 콜백이 실행됩니다. `onMutate`에서 `context`를 반환하면 이후 콜백에서 참조할 수 있습니다.

---

## Dependent Queries와 Parallel Queries

### 의존적 쿼리

A 쿼리의 결과가 있어야 B 쿼리를 실행할 수 있는 경우 `enabled` 옵션을 활용합니다.

```tsx
function UserPosts({ userId }: { userId: string }) {
  // 1단계: 유저 정보 조회
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })

  // 2단계: 유저 정보가 있을 때만 포스트 조회
  const { data: posts } = useQuery({
    queryKey: ['user', userId, 'posts'],
    queryFn: () => fetchUserPosts(user!.id),
    enabled: !!user,  // user가 있을 때만 실행
  })

  return <PostList posts={posts} />
}
```

### 병렬 쿼리

독립적인 쿼리 여러 개를 동시에 실행하려면 그냥 여러 번 `useQuery`를 호출하면 됩니다.

```tsx
function Dashboard() {
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const postsQuery = useQuery({ queryKey: ['posts'], queryFn: fetchPosts })
  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: fetchStats })

  // 세 요청이 동시에 실행됨
}
```

동적인 수의 병렬 쿼리가 필요하다면 `useQueries`를 사용합니다.

```tsx
const results = useQueries({
  queries: userIds.map(id => ({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
  })),
})
```

---

## 무한 스크롤: useInfiniteQuery

페이지네이션과 무한 스크롤은 `useInfiniteQuery`로 구현합니다.

```tsx
import { useInfiniteQuery } from '@tanstack/react-query'

function InfinitePostList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['posts', 'infinite'],
    queryFn: ({ pageParam }) =>
      fetch(`/api/posts?page=${pageParam}&limit=10`).then(r => r.json()),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      // 다음 페이지가 있으면 페이지 번호 반환, 없으면 undefined
      return lastPage.hasMore ? allPages.length + 1 : undefined
    },
  })

  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.posts.map(post => <PostCard key={post.id} post={post} />)}
        </div>
      ))}

      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? '로딩 중...' : hasNextPage ? '더 보기' : '끝'}
      </button>
    </div>
  )
}
```

`data.pages`는 각 페이지 응답의 배열입니다. `getNextPageParam`이 `undefined`를 반환하면 `hasNextPage`가 `false`가 됩니다.

---

## Prefetching과 서버 사이드 Hydration

사용자가 페이지를 열기 전에 미리 데이터를 캐시에 넣어두는 기법입니다.

```tsx
// 마우스 hover 시 prefetch
function PostLink({ postId }: { postId: number }) {
  const queryClient = useQueryClient()

  return (
    <a
      href={`/posts/${postId}`}
      onMouseEnter={() => {
        queryClient.prefetchQuery({
          queryKey: ['posts', postId],
          queryFn: () => fetchPost(postId),
          staleTime: 1000 * 60,
        })
      }}
    >
      포스트 보기
    </a>
  )
}
```

Next.js 환경에서 서버 사이드 렌더링과 함께 사용할 때는 `HydrationBoundary`와 `dehydrate`를 활용합니다.

```tsx
// app/posts/page.tsx (Next.js App Router)
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'

export default async function PostsPage() {
  const queryClient = new QueryClient()

  // 서버에서 미리 데이터 가져오기
  await queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  })

  return (
    // 서버에서 미리 채운 캐시를 클라이언트로 전달
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PostList />
    </HydrationBoundary>
  )
}
```

클라이언트의 `PostList` 컴포넌트가 `useQuery`를 호출하면 서버에서 미리 가져온 데이터가 즉시 반환되어 로딩 상태 없이 렌더링됩니다.

---

## v4 → v5 주요 변경사항

TanStack Query v5(2023년 말 출시)는 여러 중요한 변경사항을 포함합니다.

| 항목 | v4 | v5 |
|---|---|---|
| 캐시 보관 시간 옵션 | `cacheTime` | `gcTime` (Garbage Collection Time) |
| `useQuery` 콜백 | `onSuccess`, `onError`, `onSettled` | 제거됨 (useMutation에는 유지) |
| 무한 쿼리 초기 페이지 | `getNextPageParam`에서 처리 | `initialPageParam` 필수 |
| `status` 값 | `'loading'` | `'pending'` |
| 객체 인자 | 일부 함수 인자 방식 | 모두 객체 방식으로 통일 |
| TypeScript | 타입 추론 부분적 | 전면 개선 |

v5에서 `useQuery`의 `onSuccess`/`onError` 콜백이 제거된 것이 가장 큰 변화입니다. 대신 `useEffect`나 `useMutation`의 콜백을 활용하거나, 데이터/에러 상태를 직접 감지합니다.

```tsx
// v5에서 onSuccess 대체
const { data } = useQuery({ queryKey: ['posts'], queryFn: fetchPosts })

useEffect(() => {
  if (data) {
    console.log('데이터 수신:', data)
  }
}, [data])
```

---

## 정리

TanStack Query는 서버 상태 관리의 복잡한 문제들을 선언적 API 하나로 해결합니다.

- **자동 캐싱**: `queryKey` 기반으로 캐시를 공유, 중복 요청 방지
- **백그라운드 재검증**: 포커스·재연결·인터벌 시 자동으로 최신 데이터 유지
- **쿼리 상태 머신**: loading/success/error/stale/paused 상태를 자동 관리
- **캐시 무효화**: `invalidateQueries`로 mutation 후 관련 쿼리 자동 재조회
- **낙관적 업데이트**: `onMutate`/`setQueryData`로 즉각적인 UI 반응 구현
- **무한 스크롤**: `useInfiniteQuery`로 페이지네이션 로직 추상화
- **SSR 지원**: `dehydrate`/`HydrationBoundary`로 서버 사이드 데이터 전달

직접 `useEffect`와 `useState`로 데이터 페칭 로직을 관리하고 있다면, TanStack Query 도입이 코드량과 버그를 동시에 줄여줄 것입니다.

다음 글에서는 Vercel이 만든 경량 서버 상태 라이브러리인 **SWR**을 살펴보며 TanStack Query와의 차이점을 비교합니다.

---

**지난 글:** [RxJS 입문 — Observable과 반응형 프로그래밍](/posts/state-rxjs-intro/)

**다음 글:** [SWR — stale-while-revalidate 서버 상태 관리](/posts/state-swr/)
