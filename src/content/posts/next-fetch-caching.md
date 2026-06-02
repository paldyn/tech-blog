---
title: "fetch 캐시 옵션 완전 정복"
description: "Next.js App Router의 fetch API 캐시 옵션을 완전히 이해합니다. force-cache, no-store, revalidate, tags의 차이와 동작 원리, 올바른 선택 방법을 코드 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 3
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "fetch", "캐싱", "force-cache", "no-store", "revalidate", "ISR"]
featured: false
draft: false
---

[지난 글](/posts/next-client-data-fetching/)에서 클라이언트 사이드 데이터 패칭을 다뤘습니다. 이번에는 서버 컴포넌트에서 사용하는 `fetch`의 **캐시 옵션**을 집중적으로 파헤칩니다. Next.js는 웹 표준 `fetch`를 확장해 Data Cache와 연동하는 옵션을 추가했습니다. 이 옵션을 제대로 이해해야 정적·동적·ISR 렌더링을 원하는 대로 조합할 수 있습니다.

## 기본값: force-cache

별도 옵션 없이 `fetch`를 호출하면 `cache: 'force-cache'`가 기본 적용됩니다.

```tsx
// 기본값 — force-cache와 동일
const res = await fetch('https://api.example.com/posts');

// 명시적으로 써도 동일
const res = await fetch('https://api.example.com/posts', {
  cache: 'force-cache',
});
```

`force-cache`는 먼저 Data Cache를 확인합니다. 캐시가 있으면 즉시 반환하고, 없으면 실제 `fetch`를 실행한 뒤 결과를 저장합니다. 서버 재시작이나 명시적 무효화 없이는 만료되지 않습니다. 빌드 시 한 번 패칭하고 CDN에서 서빙하는 **정적 렌더링**에 적합합니다.

## no-store — 항상 최신 데이터

```tsx
const res = await fetch('https://api.example.com/user/me', {
  cache: 'no-store',
});
```

캐시를 완전히 우회합니다. 매 요청마다 실제 네트워크 요청이 발생하고 결과를 저장하지 않습니다. 페이지를 **동적 렌더링**으로 전환하며, 사용자마다 다른 데이터나 실시간성이 필요한 경우에 사용합니다.

![fetch 캐시 옵션 비교](/assets/posts/next-fetch-caching-options.svg)

`cookies()`, `headers()`, `searchParams` 같은 **동적 함수**를 사용하면 자동으로 해당 라우트 전체가 동적 렌더링으로 전환됩니다. 이때는 `no-store`를 명시하지 않아도 동적으로 동작합니다.

## revalidate — 시간 기반 ISR

```tsx
const res = await fetch('https://api.example.com/posts', {
  next: { revalidate: 60 }, // 60초 후 재검증
});
```

데이터를 캐시하되, 지정한 시간(초)이 지나면 백그라운드에서 새 데이터를 가져옵니다. 사용자는 항상 최대 N초 오래된 데이터를 보게 되고, 만료된 직후 첫 요청은 캐시된 데이터를 반환하면서 동시에 백그라운드에서 갱신이 시작됩니다. 이것이 **Incremental Static Regeneration(ISR)** 패턴입니다.

```tsx
// 1시간마다 갱신
const news = await fetch('https://api.example.com/news', {
  next: { revalidate: 3600 },
});

// 절대 만료 안 함 (revalidate: false와 동일)
const config = await fetch('https://api.example.com/config', {
  next: { revalidate: Infinity },
});
```

`revalidate: 0`은 `no-store`와 동일하게 동적 렌더링으로 처리됩니다.

## tags — 온디맨드 재검증

```tsx
// 패칭 시 태그 설정
const posts = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] },
});

const post = await fetch(`https://api.example.com/posts/${id}`, {
  next: { tags: ['posts', `post-${id}`] },
});
```

태그를 사용하면 특정 이벤트가 발생했을 때 관련 캐시만 선택적으로 무효화할 수 있습니다. Server Action이나 Route Handler에서 `revalidateTag`를 호출합니다.

```tsx
// app/actions.ts
'use server';
import { revalidateTag, revalidatePath } from 'next/cache';

export async function createPost(data: FormData) {
  await savePost(data);
  // 'posts' 태그가 붙은 모든 캐시 무효화
  revalidateTag('posts');
  // 또는 경로 단위 무효화
  revalidatePath('/posts');
}
```

`revalidateTag`가 호출되면 해당 태그의 Data Cache 항목이 무효화됩니다. 다음 요청 시 해당 경로들이 백그라운드에서 재생성됩니다.

## 캐시 옵션 선택 가이드

![캐시 옵션 선택 가이드](/assets/posts/next-fetch-caching-decision.svg)

| 옵션 | 동작 | 적합한 경우 |
|------|------|------------|
| `force-cache` | 영구 캐시 | 정적 콘텐츠, 거의 안 바뀌는 데이터 |
| `no-store` | 캐시 없음 | 실시간 데이터, 사용자별 데이터 |
| `revalidate: N` | N초 TTL | 블로그, 뉴스, 상품 목록 |
| `tags` | 이벤트 기반 | CMS 연동, 수동 캐시 무효화 |

## 세그먼트 레벨 기본값

개별 `fetch`마다 옵션을 지정하는 대신, 라우트 세그먼트 전체에 기본값을 설정할 수 있습니다.

```tsx
// app/dashboard/page.tsx
// 이 파일의 모든 fetch에 기본으로 적용
export const revalidate = 60; // 60초 ISR
export const dynamic = 'force-dynamic'; // 모든 fetch를 no-store로
```

개별 `fetch` 옵션이 세그먼트 설정보다 우선합니다. 세그먼트 수준 설정은 기본값을 제공하는 것이고, 특정 `fetch`에서 다른 옵션을 명시하면 그것이 사용됩니다.

---

**지난 글:** [클라이언트 데이터 패칭 — SWR과 TanStack Query](/posts/next-client-data-fetching/)

**다음 글:** [Next.js 캐싱 전체 구조 한눈에 보기](/posts/next-caching-overview/)

<br>
읽어주셔서 감사합니다. 😊
