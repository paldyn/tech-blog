---
title: "App Router 특수 파일 완전 가이드"
description: "page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx, template.tsx 등 Next.js App Router 특수 파일의 역할과 사용법을 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 5
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "AppRouter", "특수파일", "layout", "loading", "error", "not-found"]
featured: false
draft: false
---

[지난 글](/posts/next-project-structure/)에서 Next.js 프로젝트의 전체 디렉토리 구조를 살펴봤다. 이번에는 App Router의 핵심인 특수 파일들을 하나씩 완전히 해부한다. 이 파일들만 이해해도 App Router의 절반은 마스터한 것이다.

## 특수 파일 개요

App Router는 약속된 이름의 파일을 `app/` 폴더 안에 두면 자동으로 특정 기능을 제공한다. 파일명을 틀리면 아무 반응도 없으니 정확히 기억해야 한다.

![App Router 특수 파일 목록](/assets/posts/next-special-files-catalog.svg)

## page.tsx — 라우트의 실제 UI

`page.tsx`(또는 `page.js`)가 있어야 해당 폴더가 URL로 접근 가능한 라우트가 된다. 없으면 폴더가 있어도 그 경로로 접근하면 404가 반환된다.

```tsx
// app/blog/page.tsx → /blog 경로
export default function BlogPage() {
  return <h1>블로그 목록</h1>
}

// Server Component이므로 async 가능
export default async function BlogPage() {
  const posts = await getPosts()
  return (
    <main>
      {posts.map(p => <article key={p.id}>{p.title}</article>)}
    </main>
  )
}
```

`page.tsx`는 자동으로 `params`와 `searchParams`를 props로 받을 수 있다. `params`는 동적 라우트의 파라미터, `searchParams`는 URL 쿼리 파라미터다.

## layout.tsx — 중첩 레이아웃

`layout.tsx`는 같은 폴더 및 하위 폴더의 모든 페이지에 적용되는 공통 UI다. 레이아웃은 네비게이션 시 **언마운트되지 않고** 유지된다. 이 덕분에 사이드바 스크롤 위치나 폼 입력값이 페이지 이동 후에도 보존된다.

```tsx
// app/layout.tsx — 루트 레이아웃 (필수)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

루트 레이아웃은 `html`과 `body` 태그를 포함해야 한다. 이 두 태그는 `app/` 어디서도 단 하나의 루트 레이아웃에만 존재해야 한다.

## loading.tsx — 로딩 UI (Suspense 자동 래핑)

`loading.tsx`를 두면 해당 세그먼트가 로딩 중일 때 자동으로 표시된다. 내부적으로 React의 `<Suspense>` 경계로 `page.tsx`를 감싸는 방식으로 동작한다.

```tsx
// app/blog/loading.tsx
export default function Loading() {
  return (
    <div className="skeleton-container">
      {Array(5).fill(0).map((_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  )
}
```

데이터를 가져오는 동안 `loading.tsx`의 UI가 먼저 표시되고, 데이터 로딩이 완료되면 `page.tsx`로 교체된다. 사용자 경험을 크게 개선한다.

## error.tsx — 에러 UI (Error Boundary)

세그먼트에서 에러가 발생하면 `error.tsx`가 표시된다. 중요한 점은 **반드시 `'use client'` 컴포넌트**여야 한다는 것이다. Error Boundary는 React 클라이언트 기능이기 때문이다.

```tsx
// app/blog/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>문제가 발생했습니다</h2>
      <p>{error.message}</p>
      <button onClick={reset}>다시 시도</button>
    </div>
  )
}
```

`reset` 함수를 호출하면 해당 세그먼트만 재렌더링을 시도한다. 전체 페이지를 새로고침하지 않아도 된다.

## not-found.tsx — 404 페이지

라우트에 매핑되는 `page.tsx`가 없거나, 코드에서 `notFound()` 함수를 호출하면 `not-found.tsx`가 표시된다.

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)
  if (!post) notFound() // 이 순간 not-found.tsx로 전환
  return <article>{post.title}</article>
}
```

`app/not-found.tsx`는 전역 404 페이지가 되고, 각 세그먼트 폴더 안의 `not-found.tsx`는 해당 경로에만 적용된다.

## template.tsx — 매번 새로 마운트되는 레이아웃

`layout.tsx`와 기능은 같지만, **네비게이션마다 새 인스턴스를 생성**한다는 점이 다르다. 즉, 페이지 이동 시마다 언마운트 후 다시 마운트된다. 애니메이션 시작, useEffect 재실행, 폼 초기화가 필요한 경우에 사용한다.

```tsx
// app/blog/template.tsx
'use client'

import { useEffect } from 'react'

export default function BlogTemplate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 블로그 섹션 진입 시마다 실행 (layout이면 한 번만 실행됨)
    trackPageView()
  }, [])
  return <div>{children}</div>
}
```

![특수 파일 중첩 구조](/assets/posts/next-special-files-hierarchy.svg)

## 렌더링 우선순위

같은 폴더에 여러 특수 파일이 있을 때 렌더링 순서는 다음과 같다.

1. `layout.tsx` (가장 바깥)
2. `template.tsx`
3. `error.tsx` (에러 발생 시)
4. `loading.tsx` (로딩 중)
5. `not-found.tsx` (404)
6. `page.tsx` (가장 안쪽)

레이아웃이 가장 바깥을 감싸고, 페이지가 가장 안쪽에 위치한다. 이 중첩 구조를 이해하면 컴포넌트 계층이 어떻게 생겼는지 예측할 수 있다.

---

**지난 글:** [Next.js 프로젝트 구조 완전 해설](/posts/next-project-structure/)

**다음 글:** [파일 기반 라우팅 — 폴더가 URL이 되는 마법](/posts/next-file-based-routing/)

<br>
읽어주셔서 감사합니다. 😊
