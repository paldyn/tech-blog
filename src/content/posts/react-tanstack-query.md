---
title: "TanStack Query — 서버 상태 관리의 표준"
description: "TanStack Query(구 React Query)의 핵심 개념을 다룹니다. useQuery와 쿼리 키, staleTime과 gcTime의 차이, fresh-stale-inactive 캐시 라이프사이클, 자동 refetch 트리거, 쿼리 키 팩토리 패턴까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["TanStackQuery", "ReactQuery", "서버상태", "캐싱", "useQuery"]
featured: false
draft: false
---

[지난 글](/posts/react-zustand/)에서 Zustand로 클라이언트 상태를 단순하게 관리했다. 하지만 서버에서 가져온 데이터는 본질이 다르다. 우리가 소유한 상태가 아니라 **원격 데이터의 스냅샷**이고, 언제든 낡을 수 있으며, 여러 화면에서 같은 데이터를 중복 요청하기 쉽다. **TanStack Query**(구 React Query)는 이 문제를 정면으로 해결하는 라이브러리로, Redux 사용 여부와 무관하게 서버 상태 관리의 사실상 표준이 되었다.

## 설치와 기본 설정

```tsx
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,   // 1분 동안 fresh 유지
      retry: 1,               // 실패 시 1회 재시도
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
```

`QueryClient`가 모든 캐시를 보관하는 중앙 저장소다. Provider는 앱 최상단에 한 번만 감싸면 된다.

## useQuery — 쿼리 키와 쿼리 함수

`useQuery`는 두 가지만 요구한다. 캐시를 식별하는 **쿼리 키**와, 데이터를 가져오는 **쿼리 함수**다.

```tsx
import { useQuery } from '@tanstack/react-query';

interface Post {
  id: number;
  title: string;
}

function PostList() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['posts'],
    queryFn: async (): Promise<Post[]> => {
      const res = await fetch('/api/posts');
      if (!res.ok) throw new Error('목록을 불러오지 못했습니다');
      return res.json();
    },
  });

  if (isPending) return <Spinner />;
  if (isError) return <p>{error.message}</p>;

  return (
    <ul>
      {data.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

쿼리 키는 배열이며, **직렬화 가능한 모든 값**을 포함할 수 있다. 파라미터가 있는 쿼리는 키에 파라미터를 포함시켜야 한다.

```tsx
function PostDetail({ postId }: { postId: number }) {
  const { data } = useQuery({
    // postId가 바뀌면 별개의 캐시 항목으로 취급된다
    queryKey: ['posts', postId],
    queryFn: () => fetchPost(postId),
  });
  // ...
}
```

같은 키로 `useQuery`를 호출하는 컴포넌트가 몇 개든, 실제 네트워크 요청은 하나로 합쳐지고 모두가 같은 캐시를 공유한다.

## 캐시 라이프사이클 — fresh, stale, inactive

TanStack Query를 이해하는 열쇠는 캐시 항목의 상태 전이다.

![쿼리 캐시 라이프사이클](/assets/posts/react-tanstack-query-lifecycle.svg)

- **fresh**: 방금 가져온 신선한 데이터. 이 상태에서는 어떤 일이 있어도 다시 요청하지 않는다
- **stale**: `staleTime`이 지나 낡은 것으로 표시된 상태. 캐시는 계속 보여주되, 트리거가 발생하면 백그라운드에서 다시 가져온다
- **inactive**: 이 쿼리를 구독하는 컴포넌트가 모두 언마운트된 상태. 캐시는 `gcTime`(기본 5분) 동안 보관되다가 삭제된다

여기서 두 시간 옵션의 역할이 명확해진다.

```tsx
useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 5 * 60 * 1000,  // 5분 동안은 fresh — refetch 억제
  gcTime: 30 * 60 * 1000,    // 화면을 떠나도 30분간 캐시 보관
});
```

- **staleTime**은 "언제부터 낡았다고 볼 것인가" — refetch 빈도를 결정
- **gcTime**은 "안 쓰는 캐시를 언제 버릴 것인가" — 메모리 보관 기간을 결정

기본 `staleTime`은 0이다. 즉 가져오자마자 stale로 취급되어 트리거마다 재검증한다. 자주 바뀌지 않는 데이터라면 `staleTime`을 늘리는 것이 첫 번째 튜닝 포인트다.

## 자동 refetch 트리거

stale 쿼리는 다음 네 가지 순간에 자동으로 다시 가져온다.

![자동 refetch 트리거](/assets/posts/react-tanstack-query-triggers.svg)

```tsx
useQuery({
  queryKey: ['notifications'],
  queryFn: fetchNotifications,
  refetchOnWindowFocus: true,   // 창 포커스 복귀 시 (기본 true)
  refetchOnReconnect: true,     // 네트워크 재연결 시 (기본 true)
  refetchOnMount: true,         // 새 구독자 마운트 시 (기본 true)
  refetchInterval: 30_000,      // 30초 폴링 (기본 false)
});
```

"다른 탭에 다녀왔더니 데이터가 알아서 최신이 되어 있다"는 사용자 경험이 `refetchOnWindowFocus` 하나로 공짜로 생긴다. 핵심은 **트리거가 와도 fresh면 요청하지 않는다**는 점이다. refetch 정책은 트리거와 `staleTime`의 조합으로 결정된다.

## 파생 상태 — isPending vs isFetching

```tsx
const { isPending, isFetching } = useQuery({ ... });
```

- **isPending**: 캐시가 전혀 없어서 보여줄 것이 없는 상태. 스켈레톤 UI를 그릴 타이밍
- **isFetching**: 요청이 진행 중인 모든 순간. 백그라운드 재검증 중에도 true

캐시가 있으면 일단 보여주고 뒤에서 갱신하는 **stale-while-revalidate** 패턴이 라이브러리 전체의 기본 동작이다.

## 의존 쿼리와 조건부 실행

앞 쿼리의 결과가 있어야 다음 쿼리를 실행할 수 있을 때는 `enabled` 옵션을 쓴다.

```tsx
function UserProjects({ email }: { email: string }) {
  const { data: user } = useQuery({
    queryKey: ['user', email],
    queryFn: () => fetchUserByEmail(email),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: () => fetchProjects(user!.id),
    enabled: !!user?.id,   // user가 준비되기 전에는 실행하지 않음
  });
  // ...
}
```

## 쿼리 키 팩토리 패턴

프로젝트가 커지면 쿼리 키 문자열이 여기저기 흩어져 오타와 불일치가 생긴다. 키를 한곳에서 생성하는 팩토리를 만들어 두면 안전하다.

```tsx
// queries/keys.ts
export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (filter: string) => [...postKeys.lists(), { filter }] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: number) => [...postKeys.details(), id] as const,
};

// 사용
useQuery({ queryKey: postKeys.detail(42), queryFn: () => fetchPost(42) });

// 무효화할 때 계층 단위로 매칭 가능
queryClient.invalidateQueries({ queryKey: postKeys.lists() });
```

키가 계층 구조이므로 `['posts']`를 무효화하면 하위의 모든 목록·상세 캐시가 함께 무효화된다.

지금까지는 데이터를 **읽는** 쪽만 다뤘다. 생성·수정·삭제와, 서버 응답을 기다리지 않고 UI를 먼저 갱신하는 낙관적 업데이트는 다음 글에서 `useMutation`과 함께 살펴본다.

---

**지난 글:** [Zustand — 가볍고 단순한 상태 관리](/posts/react-zustand/)

**다음 글:** [TanStack Query Mutations — 데이터 변경과 낙관적 업데이트](/posts/react-tanstack-query-mutations/)

<br>
읽어주셔서 감사합니다. 😊
