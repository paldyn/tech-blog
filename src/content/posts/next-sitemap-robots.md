---
title: "sitemap.xml과 robots.txt — 검색 엔진 크롤링 제어"
description: "Next.js App Router에서 sitemap.ts와 robots.ts 파일로 sitemap.xml과 robots.txt를 동적으로 생성하는 방법을 설명합니다. ISR 적용, 다국어 사이트맵, 대용량 분할 사이트맵까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 9
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "sitemap", "robots.txt", "SEO", "크롤링", "ISR", "MetadataRoute"]
featured: false
draft: false
---

[지난 글](/posts/next-dynamic-og-images/)에서 ImageResponse로 SNS 공유 카드 이미지를 동적으로 생성했다. 이번에는 검색 엔진이 사이트를 효율적으로 크롤링하도록 돕는 **sitemap.xml**과 **robots.txt**를 Next.js App Router 방식으로 만드는 방법을 다룬다.

## 왜 코드로 생성하는가

블로그처럼 콘텐츠가 지속적으로 추가되는 사이트에서 sitemap을 수동으로 관리하는 건 불가능하다. Next.js는 `app/sitemap.ts`와 `app/robots.ts` 파일을 통해 서버에서 동적으로 생성하고, `/sitemap.xml`과 `/robots.txt` 경로로 자동 노출한다. DB 조회 결과를 그대로 사이트맵으로 변환할 수 있다.

![sitemap.xml · robots.txt 생성 방식](/assets/posts/next-sitemap-robots-overview.svg)

## sitemap.ts 기본 구조

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await db.post.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `https://paldyn.com/posts/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    {
      url: 'https://paldyn.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://paldyn.com/posts',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...postEntries,
  ]
}
```

반환된 배열이 자동으로 XML 형식으로 직렬화된다. `changeFrequency`의 타입은 리터럴 유니온이므로 `as const`를 붙이거나 타입을 명시해야 TypeScript 에러가 없다.

## ISR로 사이트맵 자동 갱신

사이트맵을 매 요청마다 DB 조회로 생성하면 부하가 크다. `revalidate`를 설정해 ISR로 캐싱한다.

![대용량 사이트: 분할 sitemap + ISR](/assets/posts/next-sitemap-robots-multi.svg)

```typescript
// app/sitemap.ts
export const revalidate = 86400 // 24시간마다 재생성

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ...
}
```

또는 특정 포스트가 발행됐을 때 즉시 갱신하고 싶다면 Server Action에서 `revalidatePath('/sitemap.xml')`을 호출한다.

## robots.ts

```typescript
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/login', '/signup'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/admin'],
      },
    ],
    sitemap: 'https://paldyn.com/sitemap.xml',
    host: 'https://paldyn.com',
  }
}
```

`robots.ts`는 동적 데이터가 필요 없으므로 동기 함수로 작성해도 된다. 생성되는 `robots.txt` 예시:

```text
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /login
Disallow: /signup

User-agent: Googlebot
Allow: /
Disallow: /admin

Sitemap: https://paldyn.com/sitemap.xml
Host: https://paldyn.com
```

## 다국어 사이트맵 (alternates)

다국어 사이트라면 각 URL에 `alternates.languages`를 추가한다.

```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts()

  return posts.map((post) => ({
    url: `https://paldyn.com/ko/posts/${post.slug}`,
    lastModified: post.updatedAt,
    alternates: {
      languages: {
        'ko': `https://paldyn.com/ko/posts/${post.slug}`,
        'en': `https://paldyn.com/en/posts/${post.slug}`,
      },
    },
  }))
}
```

이를 통해 검색 엔진이 각 언어별 페이지를 올바른 로케일 사용자에게 노출한다.

## 대용량 분할 sitemap

Google은 sitemap 하나에 최대 50,000 URL을 허용한다. 더 많으면 sitemap index + 분할 파일 구조가 필요하다.

```typescript
// app/sitemap/[id]/route.ts
import { NextRequest } from 'next/server'

const PAGE_SIZE = 1000

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const page = parseInt(params.id)
  const posts = await db.post.findMany({
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { slug: true, updatedAt: true },
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${posts.map((p) => `  <url>
    <loc>https://paldyn.com/posts/${p.slug}</loc>
    <lastmod>${p.updatedAt.toISOString()}</lastmod>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
```

```typescript
// app/sitemap.ts — sitemap index
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const count = await db.post.count()
  const pages = Math.ceil(count / 1000)

  return Array.from({ length: pages }, (_, i) => ({
    url: `https://paldyn.com/sitemap/${i}`,
    lastModified: new Date(),
  }))
}
```

## 환경별 URL 관리

개발/스테이징/운영 환경에서 URL이 달라지므로 환경 변수로 BASE URL을 관리한다.

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://paldyn.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1 },
  ]
}
```

`NEXT_PUBLIC_BASE_URL`은 `.env.production`에 운영 도메인, `.env.development`에 `http://localhost:3000`을 지정해두면 환경별로 자동 분기된다.

---

**지난 글:** [동적 OG 이미지 — ImageResponse로 SNS 카드 생성](/posts/next-dynamic-og-images/)

**다음 글:** [이미지 최적화 — next/image 완전 가이드](/posts/next-image-optimization/)

<br>
읽어주셔서 감사합니다. 😊
