---
title: "프로덕션 ISR — 점진적 정적 재생성 실전 패턴"
description: "Next.js ISR(Incremental Static Regeneration)의 캐시 라이프사이클, revalidate 설정, On-Demand Revalidation 웹훅 구현, 태그 기반 무효화까지 프로덕션 실전 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 63
type: "knowledge"
category: "Next.js"
tags: ["nextjs", "ISR", "revalidate", "캐싱", "정적재생성", "OnDemandRevalidation", "성능"]
featured: false
draft: false
---

[지난 글](/posts/next-self-hosting-docker/)에서 Docker로 Next.js를 셀프 호스팅하는 방법을 다뤘다. 셀프 호스팅 환경에서 성능을 극대화하려면 ISR(Incremental Static Regeneration)을 제대로 이해해야 한다. ISR은 정적 생성의 속도와 동적 렌더링의 신선도를 모두 가져가는 Next.js의 핵심 캐싱 전략이다.

## ISR이란

빌드 시점에 HTML을 생성(SSG)하고, 지정한 시간(`revalidate`)이 지나면 백그라운드에서 자동으로 HTML을 재생성한다. 사용자는 항상 이전에 생성된 HTML을 즉시 받고, 새 HTML은 다음 요청부터 제공된다.

![ISR 캐시 라이프사이클](/assets/posts/next-production-isr-lifecycle.svg)

MISS → HIT → STALE → HIT 흐름에서 핵심은 **STALE 상태**다. 캐시가 만료되어도 사용자는 기다리지 않는다. 오래된 HTML을 즉시 응답하면서 백그라운드에서 재생성이 완료되면 다음 요청부터 새 HTML이 제공된다.

## revalidate 설정

```ts
// app/posts/[slug]/page.tsx
export const revalidate = 3600  // 이 세그먼트 전체: 1시간마다 재검증

async function getPost(slug: string) {
  // fetch 단위로도 설정 가능
  const res = await fetch(`https://api.example.com/posts/${slug}`, {
    next: { revalidate: 3600, tags: ['posts', `post-${slug}`] },
  })
  return res.json()
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)
  return <article>{post.content}</article>
}
```

`tags`를 함께 지정하면 On-Demand Revalidation 시 태그 단위로 정밀하게 무효화할 수 있다.

## generateStaticParams + ISR

빌드 시 일부 경로만 정적 생성하고, 나머지는 첫 요청 시 생성(fallback)하려면 `dynamicParams`를 사용한다.

```ts
export const dynamicParams = true  // 기본값: 미리 생성 안 된 경로도 허용

export async function generateStaticParams() {
  const posts = await fetchTopPosts()  // 인기 글 100개만 빌드 시 생성
  return posts.map((p) => ({ slug: p.slug }))
}
```

`dynamicParams: false`로 설정하면 `generateStaticParams`에 없는 슬러그는 404를 반환한다.

## On-Demand Revalidation

CMS에서 글을 수정하는 즉시 캐시를 무효화하고 싶다면 On-Demand Revalidation을 쓴다.

![On-Demand Revalidation 흐름](/assets/posts/next-production-isr-ondemand.svg)

```ts
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ message: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { path, tag } = body

  if (tag) revalidateTag(tag)           // 태그 기반 무효화
  if (path) revalidatePath(path)        // 경로 기반 무효화

  return Response.json({ revalidated: true, now: Date.now() })
}
```

CMS 웹훅에서 콘텐츠가 수정될 때마다 이 엔드포인트를 호출하면 된다.

```bash
# CMS 웹훅 테스트
curl -X POST \
  "https://example.com/api/revalidate?secret=$REVALIDATE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"tag": "posts"}'
```

## revalidateTag 실전 패턴

태그를 계층적으로 설계하면 무효화 범위를 정밀하게 제어할 수 있다.

```ts
// 데이터 페치 시 태그 부여
const res = await fetch(url, {
  next: {
    tags: [
      'posts',              // 전체 포스트 목록 무효화
      `post-${postId}`,     // 개별 포스트 무효화
      `author-${authorId}`, // 특정 작성자의 모든 글 무효화
    ],
  },
})

// Server Action이나 Route Handler에서 무효화
revalidateTag('posts')           // 포스트 목록 전체 재생성
revalidateTag(`post-${postId}`)  // 특정 글만 재생성
```

## 셀프 호스팅 ISR 주의사항

Vercel에서는 ISR이 글로벌 CDN 캐시와 통합돼 자동으로 동작한다. 셀프 호스팅에서는 몇 가지를 직접 처리해야 한다.

| 항목 | Vercel | 셀프 호스팅 |
|------|--------|------------|
| 캐시 저장소 | 글로벌 KV | 파일 시스템(기본) |
| 다중 인스턴스 | 자동 공유 | 캐시 불일치 발생 |
| On-Demand | 즉시 전파 | 인스턴스별 별도 처리 |

다중 컨테이너(수평 확장) 환경에서는 캐시 어댑터를 Redis나 외부 스토리지로 교체해야 한다. `@neshca/cache-handler` 같은 커뮤니티 패키지가 이를 해결해준다.

```bash
npm install @neshca/cache-handler @neshca/json-replacer-reviver
```

```ts
// cache-handler.js
const { CacheHandler } = require('@neshca/cache-handler')
const { createRedisHandler } = require('@neshca/cache-handler/redis-strings')

CacheHandler.onCreation(async () => ({
  handlers: [await createRedisHandler({ keyPrefix: 'next:' })],
}))

module.exports = CacheHandler
```

```ts
// next.config.ts
const nextConfig = {
  output: 'standalone',
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0,
}
```

---

**지난 글:** [Docker로 셀프 호스팅 — Next.js를 직접 배포하는 방법](/posts/next-self-hosting-docker/)

**다음 글:** [Pages에서 App Router로 마이그레이션하기](/posts/next-migrating-pages-to-app/)

<br>
읽어주셔서 감사합니다. 😊
