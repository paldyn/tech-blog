---
title: "generateMetadata — 동적 메타데이터 심화"
description: "Next.js의 generateMetadata 함수로 DB 데이터를 기반으로 메타데이터를 동적 생성하는 방법을 설명합니다. parent 파라미터로 상위 메타데이터 상속, fetch dedup 최적화, notFound 처리, 정적 생성과의 조합까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 7
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "generateMetadata", "SEO", "OpenGraph", "동적라우트", "메타데이터"]
featured: false
draft: false
---

[지난 글](/posts/next-metadata-api/)에서 `metadata` 객체로 정적 메타데이터를 설정하고, `generateMetadata` 함수로 동적 데이터를 다루는 방법의 기초를 살펴봤다. 이번에는 `generateMetadata`를 더 깊이 파고든다. 상위 메타데이터 상속, fetch 중복 제거, `generateStaticParams`와의 조합, 그리고 404 처리까지 실전에서 자주 마주치는 패턴을 다룬다.

## generateMetadata 기본 시그니처

```typescript
import type { Metadata, ResolvingMetadata } from 'next'

type Props = {
  params: { slug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  // ...
}
```

두 번째 파라미터 `parent`는 상위 레이아웃의 메타데이터를 `ResolvingMetadata` 타입으로 제공한다. `await parent`로 실제 값을 가져올 수 있다.

![generateMetadata 실행 시점과 캐싱](/assets/posts/next-generate-metadata-flow.svg)

## fetch 중복 제거 (Dedup)

`generateMetadata`에서 `fetch`로 데이터를 가져오면, 동일 페이지의 Server Component에서 동일한 URL로 fetch할 때 **자동으로 중복 제거**된다. React의 `cache()` 기반 deduplication 덕분에 실제 네트워크 요청은 한 번만 일어난다.

```typescript
// app/posts/[slug]/page.tsx
async function getPost(slug: string) {
  const res = await fetch(`${process.env.API_URL}/posts/${slug}`)
  if (!res.ok) return null
  return res.json()
}

// generateMetadata와 Page 컴포넌트가 같은 함수를 호출해도 fetch는 1회
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug)
  if (!post) return { title: '포스트 없음' }
  return { title: post.title, description: post.summary }
}

export default async function PostPage({ params }: Props) {
  const post = await getPost(params.slug) // 캐시에서 반환 — 실제 fetch 없음
  if (!post) notFound()
  return <article>...</article>
}
```

단, dedup은 동일한 요청 생명주기(같은 렌더링 패스) 안에서만 작동한다. `fetch` 대신 ORM을 직접 사용한다면 `React.cache()`로 동일한 효과를 낼 수 있다.

```typescript
import { cache } from 'react'
import { db } from '@/lib/db'

const getPost = cache(async (slug: string) => {
  return db.post.findUnique({ where: { slug } })
})
```

## parent — 상위 메타데이터 상속

![메타데이터 상속·병합 규칙](/assets/posts/next-generate-metadata-merge.svg)

상위 레이아웃의 이미지나 키워드를 하위 페이지의 메타데이터에 병합할 때 `parent`를 사용한다.

```typescript
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const post = await getPost(params.slug)

  // 상위 OG 이미지를 가져와 하위 이미지와 병합
  const parentImages = (await parent).openGraph?.images ?? []
  const postOgImage = `/api/og?slug=${params.slug}`

  return {
    title: post?.title ?? 'Not Found',
    openGraph: {
      images: [postOgImage, ...parentImages],
    },
  }
}
```

`parent`를 `await`하기 전에는 렌더링이 블로킹되지 않는다. 실제로 필요한 값만 꺼내 쓰는 것이 권장 패턴이다.

## notFound와 연동

포스트가 없을 때 `notFound()`를 호출하면 Next.js가 자동으로 `not-found.tsx`를 렌더링한다. `generateMetadata`에서도 이를 일관되게 처리해야 한다.

```typescript
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug)

  if (!post) {
    // 별도 메타데이터를 반환할 수 있음 — not-found.tsx가 렌더링됨
    return { title: '페이지를 찾을 수 없습니다' }
    // 또는 그냥 notFound()를 호출해도 됨
  }

  return {
    title: post.title,
    description: post.summary,
  }
}
```

## generateStaticParams와 조합

정적 생성 페이지에서 `generateMetadata`를 함께 쓰면 빌드 타임에 모든 정적 경로의 메타데이터가 생성된다.

```typescript
// app/posts/[slug]/page.tsx

// 1. 정적 생성할 슬러그 목록 제공
export async function generateStaticParams() {
  const posts = await db.post.findMany({
    select: { slug: true },
    where: { published: true },
  })
  return posts.map((p) => ({ slug: p.slug }))
}

// 2. 슬러그별 메타데이터 생성 (빌드 타임)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug)
  if (!post) return { title: 'Not Found' }

  return {
    title: post.title,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      images: [`/api/og/${post.slug}`],
      type: 'article',
      publishedTime: post.publishedAt.toISOString(),
    },
    alternates: {
      canonical: `/posts/${post.slug}`,
    },
  }
}
```

빌드 타임에 수백 개의 페이지 메타데이터가 생성되므로, DB 쿼리 최적화에 주의해야 한다. `select`로 필요한 컬럼만 가져오는 것이 중요하다.

## 동적 라우트에서 타입 처리

Next.js 15에서 `params`가 비동기 객체로 변경됐다. 타입 정의 시 주의가 필요하다.

```typescript
// Next.js 15 방식 — params가 Promise
type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post?.title ?? 'Not Found' }
}
```

Next.js 14 이하에서는 `params`가 일반 객체였다. 버전에 따라 타입이 다르므로 `package.json`의 Next.js 버전을 확인하고 맞는 방식을 써야 한다.

## 메타데이터 병합 규칙

상위(layout)와 하위(page) 메타데이터는 **얕은 병합(shallow merge)**된다. 최상위 필드(`title`, `description`)는 하위가 상위를 덮어쓴다. 그러나 중첩 객체(`openGraph`, `twitter`)는 하위가 해당 객체 전체를 교체한다.

```typescript
// 루트 레이아웃
export const metadata = {
  openGraph: {
    siteName: 'PALDYN',
    locale: 'ko_KR',
    type: 'website',
  },
}

// 포스트 페이지 — openGraph 전체 교체됨
export async function generateMetadata(): Promise<Metadata> {
  return {
    openGraph: {
      title: '포스트 제목', // siteName, locale은 상실됨!
    },
  }
}
```

`siteName`을 유지하려면 포스트 페이지에서도 명시해야 한다. 또는 `parent`로 상위 값을 읽어 스프레드하는 방법을 쓴다.

---

**지난 글:** [Metadata API — SEO를 위한 메타데이터 설정](/posts/next-metadata-api/)

**다음 글:** [동적 OG 이미지 — ImageResponse로 SNS 카드 생성](/posts/next-dynamic-og-images/)

<br>
읽어주셔서 감사합니다. 😊
