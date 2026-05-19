---
title: "SWR — stale-while-revalidate 서버 상태 관리"
description: "Vercel이 만든 SWR 라이브러리의 캐시 우선 전략, useSWR 기본 사용법, 자동 재검증, useSWRMutation, 낙관적 업데이트, 무한 스크롤, TanStack Query와의 차이점까지 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "SWR", "서버상태", "useSWR", "캐시", "revalidation", "낙관적업데이트", "Vercel", "React"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "state-tanstack-query"
  title: "TanStack Query — 서버 상태 관리의 표준"
---

[지난 글](/posts/state-tanstack-query/)에서 TanStack Query로 서버 상태를 체계적으로 관리하는 방법을 살펴봤습니다. 이번에는 같은 문제를 더 단순하고 가벼운 방식으로 접근하는 **SWR**을 소개합니다. Vercel이 2019년 공개한 SWR은 이름부터 전략을 드러내는 라이브러리입니다.

---

## SWR 이름의 의미

SWR은 **stale-while-revalidate**의 약자입니다. HTTP RFC 5861에 정의된 캐시 전략으로, 핵심 아이디어는 간단합니다.

> **"오래된(stale) 캐시를 즉시 반환하고, 백그라운드에서 새 데이터로 검증(revalidate)한다."**

사용자는 빈 화면 대신 이전 데이터를 즉시 볼 수 있고, 백그라운드에서 조용히 최신 데이터로 갱신됩니다. 네트워크 지연이 없는 것처럼 느껴지는 UX가 목표입니다.

Vercel은 Next.js를 만들면서 이 전략을 React Hook으로 구현한 SWR을 함께 개발했습니다. 처음에는 Next.js 전용 도구처럼 보였지만, 현재는 어떤 React 환경에서도 사용할 수 있습니다.

---

## 설치와 기본 구조

```bash
npm install swr
```

SWR의 철학은 **최소 설정**입니다. `QueryClientProvider` 같은 Provider 없이 바로 사용할 수 있습니다.

```tsx
import useSWR from 'swr'

// fetcher: key를 받아 데이터를 반환하는 함수
const fetcher = (url: string) => fetch(url).then(r => r.json())

function Profile() {
  const { data, error, isLoading } = useSWR('/api/user', fetcher)

  if (isLoading) return <p>로딩 중...</p>
  if (error) return <p>에러 발생</p>

  return <p>안녕하세요, {data.name}님!</p>
}
```

`useSWR`의 첫 번째 인자는 **key**입니다. URL 문자열이 가장 일반적이지만, 배열이나 함수도 사용할 수 있습니다. 두 번째 인자는 **fetcher** 함수로, key를 받아 데이터를 반환합니다.

---

## 데이터 흐름: 캐시 우선 전략

![SWR stale-while-revalidate 전략](/assets/posts/state-swr-strategy.svg)

SWR의 데이터 흐름은 다음 단계로 진행됩니다.

**1단계 — 최초 요청**: 캐시에 데이터가 없으면 `isLoading: true` 상태로 fetcher를 호출합니다. 데이터가 오면 캐시에 저장하고 컴포넌트를 업데이트합니다.

**2단계 — 재방문 시**: 캐시에 데이터가 있으면 즉시 반환합니다(`isLoading: false`, 데이터 즉시 표시). 동시에 백그라운드에서 fetcher를 다시 호출해 데이터를 검증합니다. 새 데이터가 다르면 캐시를 갱신하고 컴포넌트를 업데이트합니다.

**3단계 — 자동 재검증**: 탭 포커스, 네트워크 재연결, 인터벌 등 다양한 트리거에서 자동으로 재검증이 실행됩니다.

이 흐름 덕분에 SWR을 사용하는 앱은 데이터가 항상 최신에 가까운 상태를 유지하면서도, 로딩 지연 없이 즉각적인 반응을 제공합니다.

---

## useSWR 옵션 상세

```tsx
const { data, error, isLoading, isValidating, mutate } = useSWR(
  key,
  fetcher,
  {
    // 재검증 트리거
    revalidateOnFocus: true,       // 탭 포커스 시 재검증 (기본값: true)
    revalidateOnReconnect: true,   // 네트워크 재연결 시 (기본값: true)
    revalidateOnMount: true,       // 컴포넌트 마운트 시 (기본값: true)
    refreshInterval: 0,            // 폴링 간격 ms (기본값: 0 = 비활성)

    // 캐시 전략
    dedupingInterval: 2000,        // 같은 key 중복 요청 방지 간격 (기본값: 2000ms)
    fallbackData: undefined,       // 캐시 없을 때 초기값

    // 에러 처리
    shouldRetryOnError: true,      // 에러 시 재시도 여부
    errorRetryCount: 3,            // 최대 재시도 횟수
    errorRetryInterval: 5000,      // 재시도 간격 ms

    // 콜백
    onSuccess: (data, key) => { },
    onError: (error, key) => { },
    onLoadingSlow: (key, config) => { },  // 느린 요청 감지
  }
)
```

`isLoading`과 `isValidating`의 차이도 알아두면 좋습니다. `isLoading`은 캐시가 없고 첫 데이터를 가져오는 중입니다. `isValidating`은 캐시 유무와 관계없이 현재 fetcher가 실행 중이면 `true`입니다(백그라운드 재검증 포함).

---

## 자동 재검증 트리거

SWR의 가장 강력한 기능 중 하나는 다양한 상황에서 자동으로 데이터를 최신으로 유지한다는 점입니다.

**포커스 재검증**: 사용자가 다른 탭을 봤다가 돌아오면 자동으로 재검증합니다. SNS 피드나 알림처럼 실시간성이 중요한 데이터에 유용합니다.

```tsx
// 포커스 재검증 비활성화 (정적 데이터에 유용)
const { data } = useSWR('/api/config', fetcher, {
  revalidateOnFocus: false,
})
```

**폴링(Polling)**: `refreshInterval`로 일정 주기마다 데이터를 갱신합니다.

```tsx
// 30초마다 자동 갱신
const { data } = useSWR('/api/price', fetcher, {
  refreshInterval: 30000,
})
```

**재연결 재검증**: 네트워크가 끊겼다가 다시 연결될 때 자동으로 최신 데이터를 가져옵니다. 오프라인 시나리오 처리에 별도 코드가 필요 없습니다.

---

## 에러 처리와 재시도

SWR은 기본적으로 에러 시 지수 백오프(exponential backoff)로 재시도합니다.

```tsx
const { data, error } = useSWR('/api/data', fetcher, {
  onError: (error, key) => {
    // 에러 로깅, 토스트 알림 등
    console.error(`[${key}] 에러:`, error)
  },
  shouldRetryOnError: (error) => {
    // 404는 재시도하지 않음
    if (error.status === 404) return false
    return true
  },
  errorRetryCount: 3,
})

if (error) {
  return (
    <div>
      <p>데이터를 불러올 수 없습니다.</p>
      <button onClick={() => mutate()}>다시 시도</button>
    </div>
  )
}
```

`mutate()` 함수는 수동으로 재검증을 트리거합니다. 인자 없이 호출하면 해당 key의 데이터를 다시 가져옵니다.

---

## useSWRMutation과 낙관적 업데이트

![SWR 고급 패턴](/assets/posts/state-swr-patterns.svg)

데이터 변경(POST, PUT, DELETE)에는 `useSWRMutation`을 사용합니다. SWR 2.0에서 추가된 API입니다.

```tsx
import useSWRMutation from 'swr/mutation'

async function updateUser(url: string, { arg }: { arg: { name: string } }) {
  return fetch(url, {
    method: 'PUT',
    body: JSON.stringify(arg),
    headers: { 'Content-Type': 'application/json' },
  }).then(r => r.json())
}

function EditProfile() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/user',
    updateUser
  )

  const handleSave = async () => {
    try {
      const result = await trigger({ name: '새 이름' })
      console.log('업데이트 성공:', result)
    } catch (e) {
      console.error('업데이트 실패:', e)
    }
  }

  return (
    <button onClick={handleSave} disabled={isMutating}>
      {isMutating ? '저장 중...' : '저장'}
    </button>
  )
}
```

### 낙관적 업데이트

`mutate` 함수의 두 번째 인자로 새 데이터를, 세 번째 인자로 옵션을 전달하면 낙관적 업데이트가 가능합니다.

```tsx
import { useSWRConfig } from 'swr'

function LikeButton({ postId }: { postId: number }) {
  const { mutate } = useSWRConfig()
  const { data: post } = useSWR(`/api/posts/${postId}`, fetcher)

  const handleLike = async () => {
    // 1. 낙관적으로 캐시를 즉시 업데이트
    mutate(
      `/api/posts/${postId}`,
      { ...post, likes: post.likes + 1 },
      { revalidate: false }   // 서버 재검증 없이 캐시만 업데이트
    )

    try {
      // 2. 실제 서버 요청
      await fetch(`/api/posts/${postId}/like`, { method: 'POST' })
      // 3. 성공 시 서버 데이터로 검증
      mutate(`/api/posts/${postId}`)
    } catch (e) {
      // 4. 실패 시 롤백 (재검증으로 원래 값 복구)
      mutate(`/api/posts/${postId}`)
    }
  }

  return (
    <button onClick={handleLike}>
      ❤️ {post?.likes}
    </button>
  )
}
```

`useSWRMutation`의 `optimisticData` 옵션으로 더 선언적으로 작성할 수도 있습니다.

```tsx
const { trigger } = useSWRMutation('/api/posts', createPost, {
  optimisticData: (currentData) => [...(currentData ?? []), newPost],
  rollbackOnError: true,     // 에러 시 자동 롤백
  revalidate: false,         // 낙관적 업데이트 후 재검증 스킵
})
```

---

## Global Configuration: SWRConfig

전역 기본값을 설정하려면 `SWRConfig` Provider를 사용합니다.

```tsx
import { SWRConfig } from 'swr'

const globalFetcher = (url: string) =>
  fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
  }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

export default function App() {
  return (
    <SWRConfig
      value={{
        fetcher: globalFetcher,           // 전역 fetcher
        revalidateOnFocus: false,         // 포커스 재검증 비활성화
        dedupingInterval: 5000,
        onError: (error, key) => {
          // 전역 에러 핸들러
          if (error.status === 401) router.push('/login')
        },
      }}
    >
      <MyApp />
    </SWRConfig>
  )
}
```

전역 fetcher를 설정하면 각 `useSWR` 호출에서 fetcher를 생략할 수 있습니다.

```tsx
// fetcher 생략 가능
const { data } = useSWR('/api/user')
```

---

## 조건부 키와 의존적 패칭

key가 `null`이나 `false`이면 SWR이 요청을 실행하지 않습니다. 이를 활용해 조건부 패칭을 구현합니다.

```tsx
// 로그인한 경우에만 유저 데이터 조회
const { data: user } = useSWR(
  isLoggedIn ? '/api/user' : null,
  fetcher
)

// 함수로 조건 표현 (런타임에 평가)
const { data: posts } = useSWR(
  () => user ? `/api/users/${user.id}/posts` : null,
  fetcher
)
```

함수를 key로 사용하면 함수 실행 중 에러가 발생할 때(예: `user`가 `undefined`일 때 `user.id` 접근)도 요청이 스킵됩니다.

---

## 페이지네이션과 무한 스크롤

### 전통적 페이지네이션

```tsx
function PaginatedPosts() {
  const [page, setPage] = useState(1)

  const { data } = useSWR(
    `/api/posts?page=${page}`,
    fetcher,
    { keepPreviousData: true }  // 페이지 전환 시 이전 데이터 유지
  )

  return (
    <div>
      {data?.posts.map(post => <PostCard key={post.id} post={post} />)}
      <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>이전</button>
      <button onClick={() => setPage(p => p + 1)} disabled={!data?.hasMore}>다음</button>
    </div>
  )
}
```

### 무한 스크롤: useSWRInfinite

```tsx
import useSWRInfinite from 'swr/infinite'

function InfinitePostList() {
  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite(
    // 각 페이지의 key를 반환하는 함수
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.hasMore) return null  // 끝
      return `/api/posts?page=${pageIndex + 1}`
    },
    fetcher
  )

  const posts = data ? data.flatMap(page => page.posts) : []
  const isLoadingMore = isValidating && size > 0 && data && !data[size - 1]
  const isEmpty = data?.[0]?.posts.length === 0
  const isReachingEnd = data && !data[data.length - 1]?.hasMore

  return (
    <div>
      {isEmpty ? <p>포스트가 없습니다.</p> : null}
      {posts.map(post => <PostCard key={post.id} post={post} />)}

      <button
        onClick={() => setSize(size + 1)}
        disabled={isLoadingMore || isReachingEnd}
      >
        {isLoadingMore ? '로딩 중...' : isReachingEnd ? '모두 봤습니다' : '더 보기'}
      </button>
    </div>
  )
}
```

`useSWRInfinite`는 key 생성 함수를 받습니다. 이전 페이지의 응답(`previousPageData`)을 참조해 다음 페이지 key를 동적으로 만들 수 있어, 커서 기반 페이지네이션도 쉽게 구현합니다.

---

## TanStack Query와의 비교

두 라이브러리는 같은 문제를 해결하지만 철학이 다릅니다.

| 항목 | SWR | TanStack Query |
|---|---|---|
| 번들 크기 | ~4KB | ~13KB |
| 설정 복잡도 | 낮음 (Provider 선택) | 중간 (QueryClient 필수) |
| API 표면 | 작고 단순 | 크고 세밀 |
| 쿼리 상태 | `isLoading`, `isValidating` | `isLoading`, `isFetching`, `status` 등 |
| 뮤테이션 | `useSWRMutation` (SWR 2.0+) | `useMutation` (풍부한 콜백) |
| 낙관적 업데이트 | `mutate` + `revalidate: false` | `onMutate` + `setQueryData` |
| 무한 스크롤 | `useSWRInfinite` | `useInfiniteQuery` |
| DevTools | 공식 없음 (서드파티) | 공식 DevTools 제공 |
| 의존적 쿼리 | null key 패턴 | `enabled` 옵션 |
| 캐시 무효화 | `mutate(key)` | `invalidateQueries` |
| 서버 사이드 | Next.js 친화적 | `dehydrate`/`HydrationBoundary` |
| TypeScript | 좋음 | 매우 좋음 |

---

## 선택 가이드: SWR vs TanStack Query

**SWR을 선택할 때:**

- Next.js 프로젝트에서 Vercel 스택을 사용 중일 때
- 번들 크기가 중요하고 API 요구사항이 단순할 때
- 빠르게 프로토타입을 만들고 복잡한 설정 없이 시작하고 싶을 때
- `revalidateOnFocus`, `refreshInterval` 같은 UX 중심 기능이 주 목적일 때

**TanStack Query를 선택할 때:**

- 복잡한 캐시 무효화 전략이 필요할 때 (여러 쿼리 간 의존성)
- `useMutation`의 `onMutate`/`onError`/`onSettled` 생명주기를 세밀하게 제어해야 할 때
- DevTools로 캐시 상태와 쿼리 흐름을 시각화하고 디버깅해야 할 때
- 팀이 크고 API 계약을 명확히 정의해야 할 때 (`queryKey` 타입 안전성)
- 서버 사이드 Hydration이 중요한 SSR 앱

두 라이브러리 모두 훌륭하고 적극적으로 유지보수됩니다. 소규모·빠른 프로젝트라면 SWR, 대규모·복잡한 데이터 요구사항이라면 TanStack Query를 추천합니다. 그리고 이미 어느 쪽을 쓰고 있다면 굳이 바꿀 필요는 없습니다. 둘 다 서버 상태 관리를 크게 개선해줍니다.

---

## 정리

SWR은 이름 그대로의 철학을 일관되게 구현한 라이브러리입니다.

- **stale-while-revalidate**: 캐시를 즉시 반환하고 백그라운드에서 갱신
- **자동 재검증**: 포커스·재연결·인터벌에서 데이터를 최신으로 유지
- **단순한 API**: `useSWR(key, fetcher, options)` 하나로 대부분 해결
- **유연한 key**: 문자열, 배열, 함수 — 조건부 패칭도 `null` 반환으로 간단히 처리
- **useSWRMutation**: 뮤테이션과 낙관적 업데이트를 선언적으로 처리
- **useSWRInfinite**: 무한 스크롤을 최소한의 코드로 구현

React 앱에서 데이터 페칭을 `useEffect` + `useState`로 직접 관리하고 있다면, SWR 하나만 도입해도 캐싱, 재검증, 에러 처리, 중복 요청 방지가 모두 자동으로 처리됩니다.

---

**지난 글:** [TanStack Query — 서버 상태 관리의 표준](/posts/state-tanstack-query/)

<br>
읽어주셔서 감사합니다. 😊
