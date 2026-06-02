---
title: "Data Cache 심층 분석"
description: "Next.js Data Cache의 내부 동작 방식을 깊이 이해합니다. 캐시 저장·조회 흐름, 태그 기반 무효화 메커니즘, unstable_cache를 이용한 비-fetch 함수 캐싱, 그리고 Vercel과 셀프 호스팅 환경의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 5
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "Data Cache", "캐싱", "revalidateTag", "unstable_cache", "ISR"]
featured: false
draft: false
---

[지난 글](/posts/next-caching-overview/)에서 Next.js 4계층 캐싱의 전체 구조를 살펴봤습니다. 이번에는 그 중 서버 사이드의 핵심인 **Data Cache**를 집중적으로 분석합니다. 어떻게 데이터를 저장하고 무효화하는지, `unstable_cache`로 ORM 쿼리도 캐시할 수 있는지 알아봅니다.

## Data Cache 동작 원리

Data Cache는 `fetch` 응답을 서버 파일시스템(또는 Vercel의 분산 KV 스토어)에 영속적으로 저장합니다. 캐시 키는 URL과 `cache`/`next` 옵션의 해시입니다.

![Data Cache 요청 흐름](/assets/posts/next-data-cache-flow.svg)

요청이 들어오면:
1. URL + 옵션 해시로 캐시를 조회합니다.
2. 캐시가 있고 만료되지 않았으면 저장된 응답을 즉시 반환합니다.
3. 캐시가 없거나 만료됐으면 실제 네트워크 요청을 보내고 결과를 캐시에 저장합니다.
4. `revalidate` 기간이 지난 **stale** 항목은 다음 요청에서 stale 데이터를 먼저 반환하고 백그라운드에서 갱신합니다(stale-while-revalidate).

```tsx
// 60초 TTL — 만료 후 첫 요청: stale 반환 + 백그라운드 갱신
const posts = await fetch('https://api.example.com/posts', {
  next: { revalidate: 60 },
});

// 영구 캐시 — 명시적 무효화 전까지 유지
const config = await fetch('https://api.example.com/config');
```

## 캐시가 동작하지 않는 경우

다음 상황에서는 Data Cache가 비활성화됩니다.

```tsx
// 1. cache: 'no-store' 명시
fetch(url, { cache: 'no-store' })

// 2. revalidate: 0
fetch(url, { next: { revalidate: 0 } })

// 3. 동적 함수 사용 (같은 라우트 내 어디서든)
const cookieStore = await cookies(); // 이것만으로 라우트 전체가 동적

// 4. POST 요청
fetch(url, { method: 'POST' }) // 캐시 안 함
```

개발 서버(`next dev`)에서는 Data Cache가 적극적으로 동작하지 않습니다. 프로덕션 빌드(`next build && next start`)로 확인해야 합니다.

## 태그 기반 무효화

![태그 기반 캐시 무효화](/assets/posts/next-data-cache-tags.svg)

`tags` 옵션으로 캐시 항목에 레이블을 붙이면 `revalidateTag`로 관련 항목을 일괄 무효화할 수 있습니다.

```tsx
// 데이터 패칭 시 태그 설정
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { tags: ['posts', 'all-content'] },
  });
  return res.json();
}

async function getPost(id: string) {
  const res = await fetch(`https://api.example.com/posts/${id}`, {
    next: { tags: ['posts', `post-${id}`, 'all-content'] },
  });
  return res.json();
}

// Server Action에서 무효화
'use server';
import { revalidateTag } from 'next/cache';

export async function deletePost(id: string) {
  await db.post.delete({ where: { id } });
  revalidateTag(`post-${id}`); // 특정 글만 무효화
  revalidateTag('posts');       // 목록 캐시도 무효화
}
```

## unstable_cache — 비-fetch 함수 캐싱

`fetch`를 사용하지 않는 ORM 쿼리나 커스텀 함수도 `unstable_cache`로 Data Cache에 저장할 수 있습니다.

```tsx
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';

// DB 쿼리를 캐시 가능한 함수로 래핑
const getCachedPosts = unstable_cache(
  async () => {
    return db.post.findMany({ orderBy: { createdAt: 'desc' } });
  },
  ['posts-query'],     // 캐시 키 (배열)
  {
    tags: ['posts'],   // revalidateTag 연동
    revalidate: 3600,  // 1시간 TTL
  }
);

export default async function PostsPage() {
  const posts = await getCachedPosts();
  return <PostList posts={posts} />;
}
```

`unstable_cache`는 아직 안정화된 API가 아니므로(접두사 `unstable_` 주의) Next.js 버전에 따라 동작이 바뀔 수 있습니다. Next.js 15에서는 `use cache` 지시어가 실험적으로 제공되어 더 선언적으로 사용할 수 있습니다.

## Vercel vs 셀프 호스팅

Vercel에서 배포하면 Data Cache는 분산 KV 스토어를 사용합니다. 여러 서버 인스턴스 간에 캐시를 공유하고, `revalidateTag` 호출이 즉각적으로 모든 인스턴스에 전파됩니다.

셀프 호스팅 환경에서는 기본적으로 파일시스템을 사용하므로, 여러 서버 인스턴스를 운용할 때 캐시가 공유되지 않습니다. 이를 해결하려면 커스텀 캐시 핸들러가 필요합니다.

```tsx
// next.config.ts — 커스텀 캐시 핸들러 (셀프 호스팅)
const nextConfig = {
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // 인메모리 캐시 비활성화
};
```

Redis나 Memcached를 백엔드로 쓰는 커스텀 핸들러를 구현해 분산 환경에서도 캐시를 공유할 수 있습니다.

---

**지난 글:** [Next.js 캐싱 전체 구조 한눈에 보기](/posts/next-caching-overview/)

**다음 글:** [ISR과 온디맨드 재검증 — revalidate 완전 이해](/posts/next-revalidation/)

<br>
읽어주셔서 감사합니다. 😊
