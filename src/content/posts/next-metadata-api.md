---
title: "Metadata API — SEO를 위한 메타데이터 설정"
description: "Next.js App Router의 Metadata API를 사용해 title, description, Open Graph, Twitter Card, robots 등 SEO 관련 메타데이터를 정적·동적으로 설정하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 6
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "Metadata", "SEO", "OpenGraph", "title template", "head 태그"]
featured: false
draft: false
---

[지난 글](/posts/next-protecting-routes/)에서 다층 보호 패턴으로 라우트를 안전하게 방어하는 방법을 살펴봤다. 이번에는 반대로 검색 엔진과 SNS에 콘텐츠를 잘 노출하기 위한 **Metadata API**를 다룬다. App Router 이전에는 `<Head>` 컴포넌트를 직접 사용했지만, v13부터는 파일에서 객체를 export하는 방식으로 크게 단순해졌다.

## 왜 Metadata API인가

Next.js App Router는 서버에서 HTML을 완전히 렌더링하므로 SEO에 유리하다. Metadata API를 사용하면 각 페이지의 `<title>`, `<meta>`, `<link>` 태그를 서버에서 직접 생성한다. 크롤러가 JavaScript를 실행하지 않아도 메타데이터를 읽을 수 있다는 뜻이다.

![Next.js Metadata API 개요](/assets/posts/next-metadata-api-overview.svg)

## 정적 메타데이터

빌드 타임에 결정되는 고정 메타데이터는 `metadata` 객체를 export한다.

```typescript
// app/about/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '소개 | PALDYN',
  description: 'PALDYN 팀을 소개합니다.',
  keywords: ['기술 블로그', 'Next.js', 'TypeScript'],
  authors: [{ name: 'PALDYN Team', url: 'https://paldyn.com' }],
  openGraph: {
    title: '소개 | PALDYN',
    description: 'PALDYN 팀을 소개합니다.',
    url: 'https://paldyn.com/about',
    siteName: 'PALDYN',
    images: [{ url: 'https://paldyn.com/og/about.png', width: 1200, height: 630 }],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '소개 | PALDYN',
    description: 'PALDYN 팀을 소개합니다.',
    images: ['https://paldyn.com/og/about.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://paldyn.com/about',
  },
}
```

## title template으로 계층적 제목 만들기

사이트 전체에 일관된 제목 형식을 적용하려면 루트 레이아웃에서 `template`을 설정한다.

![title template — 계층적 제목 조합](/assets/posts/next-metadata-api-template.svg)

```typescript
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | PALDYN',  // 하위 title이 %s 위치에 삽입됨
    default: 'PALDYN',         // 하위에서 title 미지정 시 표시
  },
  description: '개발자를 위한 기술 블로그',
}
```

이후 각 페이지에서 짧은 제목만 지정하면 된다.

```typescript
// app/posts/page.tsx
export const metadata: Metadata = {
  title: '포스트 목록',
  // 결과 → '포스트 목록 | PALDYN'
}
```

특정 페이지에서 template을 무시하고 완전히 다른 제목을 써야 할 때는 `absolute`를 사용한다.

```typescript
export const metadata: Metadata = {
  title: {
    absolute: '특별한 랜딩 페이지', // template 완전 무시
  },
}
```

## metadataBase 설정

Open Graph 이미지 URL처럼 절대 URL이 필요한 필드에서, 기본 도메인을 루트 레이아웃에 한 번만 지정할 수 있다.

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://paldyn.com'),
  openGraph: {
    images: '/og-image.png', // → https://paldyn.com/og-image.png 로 자동 해석
  },
}
```

`metadataBase`를 설정하지 않으면 개발 환경에서는 경고가 뜨고, 상대 경로로 지정한 이미지 URL이 크롤러에 제대로 전달되지 않을 수 있다.

## 동적 메타데이터 — generateMetadata

블로그 포스트처럼 URL 파라미터로 달라지는 메타데이터는 `generateMetadata` 함수를 export한다.

```typescript
// app/posts/[slug]/page.tsx
import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'

type Props = {
  params: { slug: string }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const post = await getPost(params.slug)

  if (!post) {
    return { title: '포스트를 찾을 수 없습니다' }
  }

  // 부모 메타데이터 접근 (필요 시)
  const previousImages = (await parent).openGraph?.images ?? []

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: ['PALDYN Team'],
      images: [
        {
          url: `/og/${post.slug}`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
        ...previousImages,
      ],
    },
    alternates: {
      canonical: `/posts/${post.slug}`,
    },
  }
}
```

`generateMetadata`의 fetch 요청은 동일 페이지의 Server Component에서 실행되는 동일한 요청과 **자동으로 중복 제거(dedup)**된다. 포스트 데이터를 두 번 가져올 걱정이 없다.

## robots 메타데이터

```typescript
export const metadata: Metadata = {
  robots: {
    index: true,     // 색인 허용
    follow: true,    // 링크 추적 허용
    nocache: false,  // 캐시 허용
    googleBot: {
      index: true,
      follow: false,
      noimageindex: true, // 이미지 색인 비허용
    },
  },
}
```

특정 페이지(관리자 페이지, 로그인 페이지 등)는 검색 엔진에 노출하지 않는 것이 좋다.

```typescript
// app/admin/layout.tsx — 관리자 페이지 전체 크롤링 차단
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
```

## canonical 링크

페이지가 여러 URL에서 접근 가능할 때(예: 쿼리 파라미터 조합), 검색 엔진에 기준 URL을 알려준다.

```typescript
export const metadata: Metadata = {
  alternates: {
    canonical: 'https://paldyn.com/posts/next-metadata-api',
    languages: {
      'ko-KR': 'https://paldyn.com/ko/posts/next-metadata-api',
      'en-US': 'https://paldyn.com/en/posts/next-metadata-api',
    },
  },
}
```

---

**지난 글:** [라우트 보호 패턴 — Middleware와 컴포넌트 레벨 방어](/posts/next-protecting-routes/)

**다음 글:** [generateMetadata — 동적 메타데이터 심화](/posts/next-generate-metadata/)

<br>
읽어주셔서 감사합니다. 😊
