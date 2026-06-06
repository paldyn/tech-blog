---
title: "Pages에서 App Router로 마이그레이션하기"
description: "Next.js Pages Router 프로젝트를 App Router로 점진적으로 마이그레이션하는 5단계 전략과, getServerSideProps/getStaticProps 변환 패턴, _app.tsx → layout.tsx 이전 방법을 실전 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 64
type: "knowledge"
category: "Next.js"
tags: ["nextjs", "마이그레이션", "AppRouter", "PagesRouter", "점진적이전", "getServerSideProps", "layout"]
featured: false
draft: false
---

[지난 글](/posts/next-production-isr/)에서 프로덕션 ISR 패턴을 살펴봤다. 이번 글은 시리즈의 마지막으로, **기존 Pages Router 프로젝트를 App Router로 옮기는 마이그레이션 전략**을 다룬다. Next.js는 pages/와 app/ 디렉토리를 동시에 지원하기 때문에 한 번에 전환하지 않아도 된다. 라우트 단위로 천천히 옮길 수 있다.

## 왜 마이그레이션하는가

App Router는 React Server Components를 기반으로 하며, 레이아웃 중첩, 스트리밍, Server Actions 등 최신 기능이 모두 여기에만 추가되고 있다. Pages Router는 유지보수 모드로 접어들었다.

## Pages vs App 대응 관계

![Pages Router vs App Router 대응 관계](/assets/posts/next-migrating-pages-to-app-compare.svg)

핵심 변화는 두 가지다. 첫째, 데이터 페칭이 `getServerSideProps` / `getStaticProps` 같은 특수 함수에서 **컴포넌트 내 async/await**으로 이동한다. 둘째, 라우터 훅의 임포트 경로가 `next/router`에서 `next/navigation`으로 바뀐다.

## 5단계 점진적 마이그레이션

![점진적 마이그레이션 단계](/assets/posts/next-migrating-pages-to-app-steps.svg)

### 1단계: app/ 활성화

Next.js 13.4 이상에서는 `app/` 폴더를 만들고 `app/layout.tsx`를 추가하면 App Router가 즉시 활성화된다.

```tsx
// app/layout.tsx (최소 구성)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
```

`pages/` 폴더는 그대로 유지된다. 두 라우터가 동시에 동작한다.

### 2단계: `_app.tsx` / `_document.tsx` → `layout.tsx` 이전

```tsx
// 이전: pages/_app.tsx
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <Component {...pageProps} />
    </SessionProvider>
  )
}
```

```tsx
// 이후: app/layout.tsx
import { SessionProvider } from 'next-auth/react'
import '../styles/globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

`SessionProvider` 같은 클라이언트 Context Provider는 `'use client'`가 붙은 별도 컴포넌트로 분리해야 한다.

```tsx
// app/providers.tsx
'use client'
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

### 3단계: 데이터 페칭 패턴 변환

```tsx
// 이전: pages/posts/[slug].tsx (getServerSideProps)
export async function getServerSideProps({ params }) {
  const post = await fetchPost(params.slug)
  return { props: { post } }
}

export default function PostPage({ post }) {
  return <article>{post.content}</article>
}
```

```tsx
// 이후: app/posts/[slug]/page.tsx (Server Component)
async function fetchPost(slug: string) {
  const res = await fetch(`https://api.example.com/posts/${slug}`, {
    cache: 'no-store',  // SSR 동작과 동일
  })
  return res.json()
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug)
  return <article>{post.content}</article>
}
```

`getStaticProps + revalidate`는 `fetch`의 `next.revalidate`로 대응한다.

```tsx
// 이전
export async function getStaticProps() {
  const posts = await fetchPosts()
  return { props: { posts }, revalidate: 3600 }
}

// 이후 (Server Component)
async function fetchPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 },
  })
  return res.json()
}
```

### 4단계: 라우터 훅 변환

```tsx
// 이전: next/router
import { useRouter } from 'next/router'
const router = useRouter()
router.push('/dashboard')
console.log(router.query.id)   // URL 파라미터

// 이후: next/navigation
import { useRouter, useParams, useSearchParams, usePathname } from 'next/navigation'
const router = useRouter()
router.push('/dashboard')

const params = useParams()       // { id: '123' }
const searchParams = useSearchParams()  // URLSearchParams
const pathname = usePathname()   // '/posts/hello'
```

`useRouter`의 역할이 분리되었다. `push/replace` 등 네비게이션 조작은 여전히 `useRouter`지만, URL 파라미터 조회는 각각 별도 훅으로 분리됐다.

### 5단계: pages/ 정리

모든 라우트가 app/으로 이전되었으면 `pages/` 폴더를 삭제한다. `pages/api/` 폴더의 Route Handlers는 `app/api/`로 이전한다.

```tsx
// 이전: pages/api/hello.ts
export default function handler(req, res) {
  res.json({ message: 'hello' })
}

// 이후: app/api/hello/route.ts
export async function GET() {
  return Response.json({ message: 'hello' })
}
```

## 자주 겪는 문제

| 문제 | 원인 | 해결 |
|------|------|------|
| `useRouter` 동작 안 함 | `next/router` 임포트 | `next/navigation`으로 변경 |
| Context가 undefined | Server Component에서 useContext | 해당 컴포넌트에 `'use client'` 추가 |
| `document is not defined` | 서버에서 window/document 접근 | `'use client'` 추가 또는 dynamic import |
| 레이아웃이 두 번 렌더 | pages/_app + app/layout 공존 | _app.tsx에서 중복 Provider 제거 |

---

**지난 글:** [프로덕션 ISR — 점진적 정적 재생성 실전 패턴](/posts/next-production-isr/)

<br>
읽어주셔서 감사합니다. 😊
