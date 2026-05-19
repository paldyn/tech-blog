---
title: "렌더링 전략 완전 정복 — CSR·SSR·SSG·ISR·Streaming"
description: "CSR, SSR, SSG, ISR, Streaming SSR 각 렌더링 전략의 동작 원리와 장단점, 선택 기준을 코드와 다이어그램으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "렌더링전략", "CSR", "SSR", "SSG", "ISR", "StreamingSSR", "Next.js", "React"]
featured: false
draft: false
---

[지난 글](/posts/fw-qwik-core/)에서 Qwik의 Resumability를 살펴봤습니다. Qwik이 O(1) 로딩을 달성하는 방식을 보면서 자연스럽게 이런 질문이 떠오릅니다. "그래서 우리 서비스는 어떤 렌더링 전략을 써야 하는가?" 이번 글에서는 **CSR, SSR, SSG, ISR, Streaming SSR** 다섯 가지 전략을 동작 원리부터 선택 기준까지 체계적으로 정리합니다.

---

## 렌더링 전략 한눈에 보기

![렌더링 전략 비교](/assets/posts/fw-rendering-strategies-compare.svg)

렌더링 전략의 핵심 질문은 두 가지입니다. **"HTML을 어디서 만드는가"** 그리고 **"언제 만드는가"**. 이 두 축에 따라 네 가지 기본 전략이 나뉩니다.

---

## 1. CSR — Client-Side Rendering

### 동작 원리

서버는 사실상 빈 HTML 껍데기와 JavaScript 번들만 전송합니다. 브라우저가 JS를 다운로드·파싱·실행한 뒤 DOM을 직접 생성합니다. React의 `createRoot().render()`가 바로 이 순간입니다.

```html
<!-- 서버가 내려주는 HTML -->
<!doctype html>
<html>
  <head><title>My App</title></head>
  <body>
    <div id="root"></div>
    <!-- 이 시점에 화면은 비어 있습니다 -->
    <script src="/static/js/main.js"></script>
  </body>
</html>
```

JS가 로드되고 나서야 `<div id="root">` 안에 실제 UI가 채워집니다.

### 장점

- 서버 부하가 낮습니다. 정적 파일만 서빙하면 됩니다.
- 페이지 전환이 빠릅니다. 이미 로드된 JS가 라우팅을 처리합니다.
- 사용자 인터랙션이 풍부한 앱에 적합합니다.

### 단점

- **초기 LCP(Largest Contentful Paint)가 느립니다**. 빈 화면을 보여주다가 JS 실행 후 콘텐츠가 나타납니다.
- **SEO가 불리합니다**. Googlebot이 JS를 실행하지 않으면 빈 페이지를 인덱싱합니다.
- 번들 크기가 커질수록 TTI(Time to Interactive)가 늘어납니다.

### 적합한 상황

어드민 대시보드, 로그인 후에만 접근 가능한 SaaS 앱처럼 **SEO가 불필요하고 실시간 인터랙션이 중요한 서비스**에 적합합니다.

---

## 2. SSR — Server-Side Rendering

### 동작 원리

클라이언트 요청이 들어올 때마다 서버가 데이터를 fetching하고 HTML을 완성해 응답합니다. 브라우저는 완전한 HTML을 받아 즉시 렌더링하고, 이후 JS가 로드되면 **Hydration**을 통해 이벤트 핸들러를 연결합니다.

```typescript
// Next.js App Router — SSR (동적 함수 사용 시 자동)
import { cookies, headers } from 'next/headers'

export default async function Page() {
  // cookies()나 headers() 호출은 이 페이지를 동적 렌더링으로 만듭니다
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value ?? 'dark'

  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store', // 매 요청마다 새로 fetch
  }).then(r => r.json())

  return <main data-theme={theme}>{data.title}</main>
}
```

### 장점

- **SEO 우수**: 완성된 HTML이 크롤러에게 전달됩니다.
- **항상 최신 데이터**: 요청 시점의 데이터를 반영합니다.
- **TTFB 이후 빠른 FCP**: HTML 수신 즉시 화면이 그려집니다.

### 단점

- 요청마다 서버 연산이 필요해 서버 부하가 높습니다.
- Hydration 비용이 있어 완전한 인터랙션까지 지연이 생깁니다.
- 캐싱이 복잡합니다.

### 적합한 상황

뉴스 사이트, 이커머스 상품 상세 페이지처럼 **항상 최신 데이터가 필요하고 SEO가 중요한 서비스**에 적합합니다.

---

## 3. SSG — Static Site Generation

### 동작 원리

빌드 타임(`next build`)에 모든 HTML을 미리 생성합니다. 생성된 파일은 CDN에 업로드되어 전 세계 엣지에서 서빙됩니다. 요청이 들어오면 CDN이 캐시된 HTML을 즉시 반환합니다.

```typescript
// Next.js App Router — SSG
// fetch에 캐시 옵션이 없거나 force-cache이면 빌드 시 정적 생성
export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await fetch(
    `https://cms.example.com/posts/${slug}`
  ).then(r => r.json())

  return <article>{post.content}</article>
}

// 빌드 시 생성할 경로 목록
export async function generateStaticParams() {
  const posts = await fetch('https://cms.example.com/posts').then(r =>
    r.json()
  )
  return posts.map((p: { slug: string }) => ({ slug: p.slug }))
}
```

### 장점

- **최고의 성능**: CDN 엣지에서 서빙되므로 TTFB가 수십 ms 수준입니다.
- **보안**: 서버 사이드 코드가 없으니 공격 표면이 줄어듭니다.
- **비용 효율**: 서버 컴퓨팅 비용이 거의 없습니다.

### 단점

- 콘텐츠가 변경되면 **재빌드 후 재배포**가 필요합니다.
- 동적 데이터(사용자별 맞춤 콘텐츠)를 다루기 어렵습니다.
- 페이지 수가 수십만 개면 빌드 시간이 길어집니다.

### 적합한 상황

기술 블로그, 마케팅 랜딩 페이지, 문서 사이트처럼 **콘텐츠 변경이 드문 정적 사이트**에 적합합니다.

---

## 4. ISR — Incremental Static Regeneration

### 동작 원리

SSG와 SSR의 중간입니다. 페이지를 정적으로 생성하되, `revalidate` 값(초 단위)을 설정해 주기적으로 백그라운드에서 재생성합니다. 첫 요청 이후 TTL 동안은 캐시된 페이지를 서빙하고, TTL이 만료된 시점에 다음 요청이 들어오면 기존 캐시를 먼저 반환하면서 백그라운드에서 새 페이지를 생성합니다(stale-while-revalidate 패턴).

```typescript
// Next.js App Router — ISR
export const revalidate = 60 // 60초마다 재생성

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await fetch(`https://api.example.com/products/${id}`).then(
    r => r.json()
  )

  return (
    <section>
      <h1>{product.name}</h1>
      <p>재고: {product.stock}</p>
    </section>
  )
}
```

On-Demand Revalidation으로 특정 데이터가 변경될 때 즉시 재생성할 수도 있습니다.

```typescript
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { path } = await req.json()
  revalidatePath(path) // 특정 경로 즉시 무효화
  return Response.json({ revalidated: true })
}
```

### 장점

- CDN 캐시 덕분에 **정적 페이지에 준하는 속도**를 냅니다.
- `revalidate`로 데이터 신선도를 조절합니다.
- On-Demand Revalidation으로 CMS 연동이 쉽습니다.

### 단점

- TTL 만료 직후 첫 요청에서는 **stale(이전 버전) 데이터**를 받을 수 있습니다.
- 설정이 SSG보다 복잡합니다.

### 적합한 상황

이커머스 제품 목록, 뉴스 아카이브, 공식 문서처럼 **대규모 페이지에서 데이터 신선도와 성능을 동시에 잡아야 하는 경우**에 적합합니다.

---

## 5. Streaming SSR — React 18 Suspense

![Streaming SSR — React 18 Suspense](/assets/posts/fw-rendering-strategies-streaming.svg)

### 동작 원리

React 18의 `renderToPipeableStream`(Node.js) 또는 `renderToReadableStream`(엣지 런타임)은 HTML을 청크 단위로 스트리밍합니다. `<Suspense>` 경계가 이 스트리밍의 단위입니다.

1. 서버가 빠른 부분(Header, Nav 등 **HTML shell**)을 즉시 전송합니다.
2. 느린 컴포넌트 자리에는 `fallback`(스피너 등)을 먼저 포함시킵니다.
3. 서버에서 느린 컴포넌트의 데이터 fetch가 완료되면 해당 HTML 청크를 `<script>` 태그와 함께 스트리밍합니다.
4. 브라우저는 청크를 받는 즉시 스피너를 실제 콘텐츠로 교체합니다.

```typescript
// app/page.tsx
import { Suspense } from 'react'
import ProductList from './ProductList'
import ReviewSection from './ReviewSection'
import Spinner from '@/components/Spinner'

export default function Page() {
  return (
    <main>
      {/* 빠른 부분은 즉시 렌더링 */}
      <Header />
      <HeroSection />

      {/* 느린 데이터는 Suspense로 감쌉니다 */}
      <Suspense fallback={<Spinner label="상품 로드 중..." />}>
        <ProductList />
      </Suspense>

      {/* 각 Suspense는 독립적으로 스트리밍됩니다 */}
      <Suspense fallback={<Spinner label="리뷰 로드 중..." />}>
        <ReviewSection />
      </Suspense>
    </main>
  )
}
```

```typescript
// ProductList.tsx — async Server Component
async function ProductList() {
  // 이 await이 해결될 때까지 이 컴포넌트의 HTML 전송을 지연
  const products = await fetch('https://api.example.com/products', {
    cache: 'no-store',
  }).then(r => r.json())

  return (
    <ul>
      {products.map((p: { id: string; name: string }) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

### 핵심 이점

**TTFB(Time to First Byte) 최소화**: 느린 데이터를 기다리지 않고 shell을 즉시 전송합니다. 사용자는 빠르게 페이지 구조를 봅니다.

**Progressive Rendering**: 준비된 조각부터 순서대로 화면에 나타납니다. 사용자 경험이 부드럽습니다.

**Selective Hydration**: React 18은 사용자가 상호작용하는 컴포넌트를 먼저 하이드레이션합니다. 스크롤 아래에 있는 컴포넌트의 하이드레이션은 뒤로 미룹니다.

---

## 전략 선택 가이드

| 상황 | 추천 전략 |
|------|----------|
| 블로그, 마케팅 랜딩 | SSG |
| 문서 사이트, 포트폴리오 | SSG |
| 제품 목록, 뉴스 아카이브 | ISR |
| 뉴스 상세, 실시간 재고 | SSR |
| 어드민, SaaS 대시보드 | CSR (or SSR) |
| 복잡한 페이지 (느린 섹션 혼재) | Streaming SSR |

실제로는 **단일 전략을 고집하지 않는 것**이 좋습니다. Next.js App Router는 라우트 단위로 전략을 달리 적용할 수 있습니다. 마케팅 홈은 SSG, 상품 목록은 ISR, 주문 내역은 SSR, 대시보드는 CSR — 이렇게 혼합 운영이 가능합니다.

```
app/
├── page.tsx          → SSG (정적 홈)
├── shop/
│   └── page.tsx      → ISR (revalidate=60)
├── orders/
│   └── page.tsx      → SSR (cache: no-store)
└── dashboard/
    └── page.tsx      → SSR + Client 컴포넌트
```

---

## 핵심 메트릭 정리

렌더링 전략을 논할 때 자주 등장하는 웹 성능 지표를 정리합니다.

- **TTFB (Time to First Byte)**: 브라우저가 첫 바이트를 받는 데 걸리는 시간. SSG/ISR이 유리합니다.
- **FCP (First Contentful Paint)**: 첫 텍스트나 이미지가 화면에 나타나는 시간. SSR/SSG가 CSR보다 유리합니다.
- **LCP (Largest Contentful Paint)**: 뷰포트 내 가장 큰 콘텐츠 요소가 렌더링되는 시간. Core Web Vitals 중 하나입니다.
- **TTI (Time to Interactive)**: 페이지가 완전히 인터랙티브해지는 시간. Hydration이 무거울수록 늦어집니다.

---

다음 글에서는 이 전략들을 실제로 구현하는 **Next.js App Router**의 파일 시스템 라우팅, Server/Client 컴포넌트, Server Actions를 깊이 살펴봅니다.

---

<nav style="display:flex;justify-content:space-between;margin-top:2rem;padding-top:1rem;border-top:1px solid #333">
  <a href="/posts/fw-qwik-core/">← Qwik 핵심 — 재개 가능성(Resumability)과 O(1) 로딩</a>
  <a href="/posts/fw-nextjs-app-router/">Next.js App Router 완전 가이드 →</a>
</nav>
