---
title: "ISR과 온디맨드 재검증 — revalidate 완전 이해"
description: "Next.js의 두 가지 재검증 전략인 시간 기반 ISR(revalidate)과 온디맨드 재검증(revalidateTag, revalidatePath)을 완전히 이해합니다. Stale-While-Revalidate 패턴과 CMS Webhook 연동 방법까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 6
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "ISR", "재검증", "revalidateTag", "revalidatePath", "Stale-While-Revalidate"]
featured: false
draft: false
---

[지난 글](/posts/next-data-cache/)에서 Data Cache의 내부 동작을 살펴봤습니다. 이번에는 캐시된 데이터를 **언제, 어떻게 갱신하는지** — 재검증(revalidation) 전략을 다룹니다. Next.js는 두 가지 방법을 제공합니다: 시간 기반의 **ISR**과 이벤트 기반의 **온디맨드 재검증**입니다.

## 시간 기반 재검증 (ISR)

`next: { revalidate: N }` 옵션으로 캐시의 TTL(Time To Live)을 초 단위로 설정합니다.

![시간 기반 재검증 타임라인](/assets/posts/next-revalidation-timeline.svg)

```tsx
// app/blog/page.tsx
export default async function BlogPage() {
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }, // 1시간
  });
  return <PostList posts={await posts.json()} />;
}

// 또는 파일 레벨 설정 (모든 fetch에 적용)
export const revalidate = 3600;
```

핵심은 **Stale-While-Revalidate** 패턴입니다. TTL이 만료된 직후 첫 번째 요청은 여전히 캐시된(오래된) 데이터를 즉시 반환합니다. 사용자가 기다릴 필요가 없습니다. 동시에 백그라운드에서 새 데이터를 가져오고, 완료되면 그다음 요청부터 최신 데이터를 제공합니다.

이 방식의 장점은 서버 부하가 낮다는 것입니다. N초 내에 아무리 많은 요청이 와도 실제 upstream 요청은 1번뿐입니다.

## 온디맨드 재검증

시간 기반 ISR은 "N초가 지나면 갱신"이지만, 관리자가 글을 수정하는 즉시 캐시를 무효화하고 싶을 때는 **온디맨드 재검증**이 필요합니다.

![온디맨드 재검증 흐름](/assets/posts/next-revalidation-ondemand.svg)

### revalidateTag

```tsx
// 1단계: 패칭 시 태그 설정
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { tags: ['posts'] },
  });
  return res.json();
}

// 2단계: Server Action에서 무효화
'use server';
import { revalidateTag } from 'next/cache';

export async function updatePost(id: string, data: PostData) {
  await db.post.update({ where: { id }, data });
  revalidateTag('posts');       // 목록 캐시 무효화
  revalidateTag(`post-${id}`); // 특정 글 캐시 무효화
}
```

### revalidatePath

특정 URL 경로에 해당하는 캐시를 무효화합니다.

```tsx
import { revalidatePath } from 'next/cache';

export async function deletePost(id: string) {
  await db.post.delete({ where: { id } });
  revalidatePath('/blog');           // 목록 페이지
  revalidatePath(`/blog/${id}`);     // 상세 페이지
  revalidatePath('/blog', 'layout'); // 레이아웃까지 포함
}
```

`revalidatePath`의 두 번째 인수로 `'page'`(기본) 또는 `'layout'`을 지정할 수 있습니다. `'layout'`을 쓰면 해당 경로의 레이아웃 데이터도 함께 무효화됩니다.

## CMS Webhook 연동

Contentful, Sanity 같은 헤드리스 CMS는 콘텐츠가 변경될 때 Webhook을 보냅니다. Route Handler에서 이를 받아 재검증을 트리거합니다.

```tsx
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 });
  }

  const body = await req.json();
  const tag = body.contentType === 'post' ? 'posts' : body.contentType;

  revalidateTag(tag);
  return Response.json({ revalidated: true, tag });
}
```

CMS 대시보드에서 Webhook URL을 `https://your-site.com/api/revalidate?secret=YOUR_SECRET`으로 설정합니다. 콘텐츠 변경 즉시 관련 페이지가 갱신됩니다.

## 두 전략 비교

| 전략 | 방법 | 장점 | 단점 |
|------|------|------|------|
| 시간 기반 (ISR) | `revalidate: N` | 설정 간단, 자동 | 변경 즉시 반영 안 됨 |
| 온디맨드 | `revalidateTag/Path` | 즉각 갱신 | Webhook/Action 구현 필요 |

실전에서는 두 전략을 조합합니다. 기본 TTL로 `revalidate: 3600`을 설정하고, 중요한 변경은 Server Action에서 `revalidateTag`를 호출해 즉시 갱신합니다.

```tsx
// 조합 예시
const posts = await fetch(url, {
  next: {
    revalidate: 3600, // 기본 1시간 TTL
    tags: ['posts'],  // 온디맨드 무효화도 가능
  },
});
```

---

**지난 글:** [Data Cache 심층 분석](/posts/next-data-cache/)

**다음 글:** [렌더링 전략 — 정적·동적·스트리밍](/posts/next-rendering-strategies/)

<br>
읽어주셔서 감사합니다. 😊
