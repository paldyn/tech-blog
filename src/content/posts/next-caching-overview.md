---
title: "Next.js 캐싱 전체 구조 한눈에 보기"
description: "Next.js App Router의 4계층 캐싱 아키텍처를 한눈에 이해합니다. Request Memoization, Data Cache, Full Route Cache, Router Cache의 역할·스코프·무효화 방법을 비교하고 실전에서 어떻게 제어하는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 4
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "캐싱", "Data Cache", "Router Cache", "Full Route Cache", "Request Memoization"]
featured: false
draft: false
---

[지난 글](/posts/next-fetch-caching/)에서 `fetch` API의 캐시 옵션을 살펴봤습니다. 이번에는 한 발짝 물러서서 **Next.js 캐싱 시스템 전체 구조**를 조감도 형태로 이해합니다. App Router에는 서로 다른 역할을 하는 4개의 캐시 계층이 있고, 이 계층들이 어떻게 상호작용하는지 파악해야 성능 문제를 정확히 디버깅할 수 있습니다.

## 4계층 캐싱 개요

![Next.js 4계층 캐싱 아키텍처](/assets/posts/next-caching-overview-layers.svg)

Next.js는 성능을 극대화하기 위해 여러 지점에서 캐싱합니다. 계층별로 위치, 스코프, 수명이 다릅니다.

| 계층 | 위치 | 스코프 | 수명 |
|------|------|--------|------|
| Request Memoization | 서버 메모리 | 단일 렌더 패스 | 렌더 완료 즉시 해제 |
| Data Cache | 서버 파일시스템 | 앱 전체 | 영속 (명시적 무효화까지) |
| Full Route Cache | 서버 파일시스템 | 정적 라우트 | 새 배포까지 |
| Router Cache | 클라이언트 메모리 | 브라우저 세션 | 30분 또는 탭 닫기 |

## 1. Request Memoization

React가 `fetch`를 확장해 제공하는 인메모리 캐시입니다. 단일 렌더 트리 안에서 동일한 URL과 옵션으로 여러 번 `fetch`를 호출해도 실제 네트워크 요청은 한 번만 발생합니다.

```tsx
// 어느 서버 컴포넌트에서든 같은 URL 호출 → 1회 요청
const user = await fetch('/api/me'); // 실제 요청
const user2 = await fetch('/api/me'); // 캐시 반환
```

렌더링이 끝나면 즉시 해제됩니다. 다음 HTTP 요청에서는 새 캐시가 시작됩니다.

## 2. Data Cache

`fetch`의 `cache`/`next` 옵션으로 제어하는 서버 사이드 영속 캐시입니다. 서버 재시작 후에도 유지되며, 여러 사용자 요청이 같은 캐시 항목을 공유합니다.

```tsx
// Data Cache에 저장 (영속)
const posts = await fetch('/api/posts', { next: { revalidate: 60 } });

// Data Cache 무효화
import { revalidateTag } from 'next/cache';
revalidateTag('posts'); // 'posts' 태그 항목 모두 무효화
```

Vercel에서는 파일시스템이 아닌 분산 캐시(KV 스토어)를 사용해 더 효율적으로 관리됩니다.

## 3. Full Route Cache

빌드 시점에 정적 라우트를 HTML과 RSC Payload로 사전 렌더링해 저장합니다. 서버에서 매 요청마다 렌더링하지 않아도 되므로 응답 속도가 빠릅니다.

```tsx
// 이 라우트는 동적 함수 없이 force-cache 사용 → Full Route Cache에 저장
export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetch(`/api/posts/${params.slug}`);
  return <Article post={await post.json()} />;
}
```

`cookies()`, `headers()`, `searchParams` 사용 또는 `no-store` fetch가 있으면 이 라우트는 Full Route Cache에 저장되지 않고 동적 렌더링됩니다.

## 4. Router Cache

클라이언트 브라우저 메모리에 저장되는 RSC Payload 캐시입니다. `<Link>` 컴포넌트로 호버(prefetch)한 페이지와 방문한 페이지의 RSC Payload를 저장합니다. 뒤로 가기나 같은 라우트 재방문 시 서버에 요청하지 않고 즉시 렌더링합니다.

```tsx
// router.refresh()로 Router Cache 무효화
'use client';
import { useRouter } from 'next/navigation';

function RefreshButton() {
  const router = useRouter();
  return <button onClick={() => router.refresh()}>새로고침</button>;
}
```

## 무효화 계층 연쇄

![캐시 무효화 방법 정리](/assets/posts/next-caching-overview-invalidation.svg)

Server Action에서 `revalidateTag`를 호출하면 Data Cache와 Full Route Cache가 함께 무효화됩니다. 다음 요청 시 서버에서 새로 렌더링한 결과가 Router Cache를 업데이트합니다.

```tsx
// Server Action — 글 등록 후 관련 캐시 모두 갱신
'use server';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createPost(formData: FormData) {
  await saveToDatabase(formData);
  revalidateTag('posts'); // Data Cache + Full Route Cache 무효화
  redirect('/posts');      // Router Cache도 이 경로 갱신
}
```

## 캐싱 디버깅 팁

캐싱 동작이 예상과 다를 때 확인해야 할 사항입니다.

- **`no-store` 대신 `force-cache`가 동작 중**: 동적 함수를 사용 중인지 확인하세요. `cookies()` 하나만 써도 해당 라우트가 동적이 됩니다.
- **revalidate 후에도 이전 데이터 표시**: Router Cache가 아직 유효한 상태일 수 있습니다. `router.refresh()`로 강제 갱신하거나 Server Action 성공 후 자동 무효화를 활용하세요.
- **개발 서버에서는 캐싱이 거의 비활성화**: `next dev`는 캐시를 적극적으로 쓰지 않습니다. `next build && next start`로 프로덕션 동작을 테스트하세요.

---

**지난 글:** [fetch 캐시 옵션 완전 정복](/posts/next-fetch-caching/)

**다음 글:** [Data Cache 심층 분석](/posts/next-data-cache/)

<br>
읽어주셔서 감사합니다. 😊
