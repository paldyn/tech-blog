---
title: "클라이언트 데이터 패칭 — SWR과 TanStack Query"
description: "Next.js에서 클라이언트 컴포넌트 안에서 데이터를 패칭하는 방법을 다룹니다. useEffect 직접 구현의 한계를 파악하고, SWR과 TanStack Query로 캐싱·중복 제거·갱신을 자동화하는 패턴을 배웁니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 2
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "클라이언트 패칭", "SWR", "TanStack Query", "useEffect", "React Query"]
featured: false
draft: false
---

[지난 글](/posts/next-request-deduplication/)에서 서버 렌더 패스 안에서 Request Memoization이 중복 요청을 어떻게 제거하는지 살펴봤습니다. 이번에는 반대편인 **클라이언트 사이드 데이터 패칭**을 다룹니다. 사용자 인터랙션 후 즉시 데이터를 갱신해야 하거나, 서버 컴포넌트로 초기 HTML을 내려준 뒤 이후 업데이트만 클라이언트에서 처리할 때 필요한 패턴입니다.

## 언제 클라이언트 패칭을 써야 하나

App Router에서는 가능하면 서버 컴포넌트로 데이터를 패칭하는 것이 좋습니다. 하지만 다음 상황에서는 클라이언트 패칭이 적합합니다.

- 사용자 클릭·스크롤 같은 **인터랙션 이후** 로드되는 데이터
- 탭 포커스 시 자동 갱신이 필요한 **실시간 데이터**
- 로그인 상태에 따라 달라지는 **개인화 콘텐츠**
- 즐겨찾기, 장바구니처럼 빠른 피드백이 중요한 **즉시 업데이트** 기능

## useEffect + useState — 직접 구현의 한계

가장 기본적인 방법은 `useEffect` 안에서 `fetch`를 호출하고 `useState`로 결과를 관리하는 것입니다.

![클라이언트 데이터 패칭 라이프사이클](/assets/posts/next-client-data-fetching-lifecycle.svg)

```tsx
'use client';
import { useEffect, useState } from 'react';

export default function UserCard({ id }: { id: string }) {
  const [data, setData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <Spinner />;
  if (error) return <p>에러 발생</p>;
  return <p>{data?.name}</p>;
}
```

이 패턴의 문제는 보일러플레이트가 많고, 캐싱·중복 제거·재시도·포커스 갱신 같은 기능이 없다는 점입니다. 같은 `id`로 두 곳에서 컴포넌트를 렌더링하면 네트워크 요청이 두 번 발생합니다.

## SWR — Stale While Revalidate

SWR은 Vercel이 만든 경량 데이터 패칭 라이브러리입니다. 핵심 전략은 **stale-while-revalidate**입니다. 캐시된(stale) 데이터를 즉시 화면에 보여주면서 백그라운드에서 새 데이터를 가져옵니다.

```tsx
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function UserCard({ id }: { id: string }) {
  const { data, error, isLoading } = useSWR(`/api/users/${id}`, fetcher);

  if (isLoading) return <Spinner />;
  if (error) return <p>에러 발생</p>;
  return <p>{data.name}</p>;
}
```

같은 키(`/api/users/123`)를 사용하는 컴포넌트가 여러 개라도 요청은 한 번만 발생합니다. 탭을 다시 포커스하면 자동으로 최신 데이터를 가져오고(`revalidateOnFocus`), 네트워크 재연결 시에도 갱신합니다(`revalidateOnReconnect`).

뮤테이션도 간단합니다.

```tsx
import { mutate } from 'swr';

async function updateUser(id: string, name: string) {
  await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  // 캐시 무효화 → 자동 재패칭
  mutate(`/api/users/${id}`);
}
```

## TanStack Query — 강력한 서버 상태 관리

TanStack Query(구 React Query)는 복잡한 서버 상태 시나리오에 더 적합합니다. `useQuery`로 조회, `useMutation`으로 쓰기를 명확히 분리합니다.

```tsx
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function PostList() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: () => fetch('/api/posts').then((r) => r.json()),
    staleTime: 60_000, // 1분간 fresh 취급
  });

  const mutation = useMutation({
    mutationFn: (newPost: Post) =>
      fetch('/api/posts', { method: 'POST', body: JSON.stringify(newPost) }),
    onSuccess: () => {
      // posts 쿼리 무효화 → 재패칭
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  if (isLoading) return <Spinner />;
  return (
    <>
      <ul>{data.map((p: Post) => <li key={p.id}>{p.title}</li>)}</ul>
      <button onClick={() => mutation.mutate({ title: '새 글' })}>
        추가
      </button>
    </>
  );
}
```

옵티미스틱 업데이트, 무한 스크롤(`useInfiniteQuery`), SSR 초기 데이터 하이드레이션 등 고급 기능이 내장되어 있습니다.

![SWR vs TanStack Query 비교](/assets/posts/next-client-data-fetching-swr-vs-query.svg)

## 서버 초기 데이터 + 클라이언트 갱신 하이브리드

Next.js에서 가장 좋은 패턴은 서버 컴포넌트로 초기 HTML을 제공하고, 클라이언트에서는 갱신만 맡기는 것입니다.

```tsx
// app/posts/page.tsx (서버 컴포넌트)
import PostListClient from './PostListClient';

export default async function PostsPage() {
  const initialPosts = await fetchPosts(); // 서버에서 직접 패칭
  return <PostListClient initialData={initialPosts} />;
}

// app/posts/PostListClient.tsx (클라이언트 컴포넌트)
'use client';
import { useQuery } from '@tanstack/react-query';

export default function PostListClient({ initialData }: { initialData: Post[] }) {
  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: () => fetch('/api/posts').then((r) => r.json()),
    initialData, // 서버 데이터로 초기화 — 첫 로딩 플래시 없음
    staleTime: 30_000,
  });
  return <ul>{data.map((p) => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

초기 렌더에서 `initialData`를 사용하므로 로딩 스피너 없이 콘텐츠가 즉시 표시됩니다. `staleTime`이 지나면 백그라운드에서 최신 데이터를 가져옵니다.

---

**지난 글:** [Request Memoization — 동일 요청 자동 중복 제거](/posts/next-request-deduplication/)

**다음 글:** [fetch 캐시 옵션 완전 정복](/posts/next-fetch-caching/)

<br>
읽어주셔서 감사합니다. 😊
