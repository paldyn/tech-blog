---
title: "Next.js App Router 완전 가이드"
description: "Next.js 13+ App Router의 파일 시스템 라우팅, Server/Client Components, Server Actions, 데이터 페칭 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Next.js", "AppRouter", "ServerComponents", "ServerActions", "React", "파일시스템라우팅"]
featured: false
draft: false
---

[지난 글](/posts/fw-rendering-strategies/)에서 CSR, SSR, SSG, ISR, Streaming SSR을 이론적으로 정리했습니다. 이번 글에서는 이 전략들을 실제로 구현하는 **Next.js App Router**를 깊이 살펴봅니다. Next.js 13에서 도입되어 15에서 안정화된 App Router는 React Server Components를 전면적으로 채택한 첫 번째 프로덕션 레디 프레임워크입니다.

---

## App Router vs Pages Router

App Router(`app/` 디렉터리)는 기존 Pages Router(`pages/` 디렉터리)와 공존할 수 있습니다. 두 방식의 핵심 차이는 다음과 같습니다.

| 구분 | Pages Router | App Router |
|------|-------------|------------|
| 기본 컴포넌트 | Client Component | Server Component |
| 데이터 페칭 | `getServerSideProps`, `getStaticProps` | `async/await` + `fetch` |
| 레이아웃 | `_app.tsx` (전역 하나) | 중첩 레이아웃 (세그먼트별) |
| Streaming | 미지원 | Suspense + 자동 스트리밍 |
| 메타데이터 | `<Head>` 컴포넌트 | `metadata` export |

새 프로젝트라면 App Router를 사용하는 것이 좋습니다. 기존 Pages Router 프로젝트도 `app/` 디렉터리를 추가해 점진적으로 마이그레이션할 수 있습니다.

---

## 파일 시스템 라우팅

![Next.js App Router — 파일 시스템 라우팅](/assets/posts/fw-nextjs-app-router-structure.svg)

### 특수 파일 컨벤션

App Router는 파일 이름으로 역할을 결정합니다.

**`layout.tsx`** — 세그먼트와 자식 페이지를 감싸는 레이아웃입니다. 내비게이션 시 리렌더링되지 않고 상태를 유지합니다.

```typescript
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { template: '%s | My Site', default: 'My Site' },
  description: '기술 블로그',
}

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

**`page.tsx`** — 라우트의 실제 UI입니다. `layout`의 `children` 자리에 렌더링됩니다.

**`loading.tsx`** — 해당 세그먼트의 `page.tsx`를 자동으로 `<Suspense>`로 감싸는 fallback UI입니다.

```typescript
// app/blog/loading.tsx
export default function Loading() {
  return (
    <div className="skeleton">
      <div className="skeleton-title" />
      <div className="skeleton-body" />
    </div>
  )
}
```

**`error.tsx`** — 해당 세그먼트에서 발생한 런타임 에러를 잡는 Error Boundary입니다. `'use client'`가 필수입니다.

```typescript
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

**`not-found.tsx`** — `notFound()` 함수 호출 시 표시되는 404 UI입니다.

### 라우트 그룹

폴더 이름을 `(괄호)`로 감싸면 **URL에 포함되지 않는 그룹**을 만들 수 있습니다. 레이아웃을 공유하는 페이지들을 논리적으로 묶을 때 유용합니다.

```
app/
├── (marketing)/
│   ├── layout.tsx      ← 마케팅 공통 레이아웃
│   ├── page.tsx        → /
│   └── about/page.tsx  → /about
└── (shop)/
    ├── layout.tsx      ← 쇼핑몰 공통 레이아웃
    ├── products/page.tsx → /products
    └── cart/page.tsx   → /cart
```

### 동적 세그먼트

`[slug]`처럼 대괄호로 감싸면 동적 경로를 만들 수 있습니다.

```typescript
// app/blog/[slug]/page.tsx
export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    notFound() // not-found.tsx를 렌더링
  }

  return <article>{post.content}</article>
}
```

`[[...slug]]`처럼 이중 대괄호를 쓰면 선택적 catch-all 라우트가 됩니다. `/docs`, `/docs/api`, `/docs/api/reference` 모두 같은 페이지로 처리할 수 있습니다.

---

## Server Components vs Client Components

![Server Components vs Client Components](/assets/posts/fw-nextjs-app-router-components.svg)

### Server Component (기본값)

App Router에서 모든 컴포넌트는 기본적으로 **Server Component**입니다. 서버에서만 실행되고, 결과 HTML이 클라이언트로 전달됩니다. JS 번들에 포함되지 않습니다.

핵심 장점은 세 가지입니다.

첫째, **데이터 레이어 직접 접근**입니다. ORM, 파일시스템, 내부 API를 컴포넌트 안에서 바로 호출합니다.

```typescript
// 컴포넌트 안에서 DB 직접 접근
import { db } from '@/lib/db'

export default async function UserList() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return (
    <ul>
      {users.map(u => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  )
}
```

둘째, **시크릿 안전 보호**입니다. `process.env.SECRET_KEY` 같은 값이 클라이언트 번들로 노출되지 않습니다.

셋째, **제로 번들 크기**입니다. 무거운 파싱 라이브러리(marked, highlight.js 등)를 서버에서만 실행하면 클라이언트 번들이 늘어나지 않습니다.

### Client Component

`'use client'` 지시어를 파일 맨 위에 선언하면 해당 컴포넌트와 그 자식들은 **Client Component** 경계 안에 들어갑니다.

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSearch(q: string) {
    setQuery(q)
    const res = await fetch(`/api/search?q=${q}`)
    const data = await res.json()
    setResults(data.results)
  }

  return (
    <div>
      <input
        ref={inputRef}
        value={query}
        onChange={e => handleSearch(e.target.value)}
        placeholder="검색..."
      />
      <ul>
        {results.map(r => <li key={r}>{r}</li>)}
      </ul>
    </div>
  )
}
```

### 컴포넌트 경계 규칙

**SC는 CC를 children으로 받을 수 있습니다**. SC가 CC를 import해 렌더링하면 CC가 클라이언트 번들에 포함됩니다.

**CC는 SC를 직접 import할 수 없습니다**. CC는 클라이언트 번들에 포함되어야 하는데, SC는 서버 전용이므로 모순이 생깁니다. 대신 SC를 `children` prop으로 CC에 전달하는 패턴을 씁니다.

```typescript
// 올바른 패턴: SC를 children으로 전달
// app/page.tsx (SC)
import { ClientShell } from './ClientShell' // CC
import { ServerData } from './ServerData'   // SC

export default function Page() {
  return (
    <ClientShell>
      {/* ServerData는 SC — children으로 전달됨 */}
      <ServerData />
    </ClientShell>
  )
}

// ClientShell.tsx (CC)
'use client'
export function ClientShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(!open)}>토글</button>
      {open && children}
    </div>
  )
}
```

---

## 데이터 페칭

### fetch + 캐시 옵션

Next.js는 `fetch`를 확장해 캐싱을 세밀하게 제어합니다.

```typescript
// SSG: 빌드 시 한 번 fetch (기본값)
const data = await fetch('https://api.example.com/static')

// SSR: 매 요청마다 fetch
const data = await fetch('https://api.example.com/dynamic', {
  cache: 'no-store',
})

// ISR: 60초마다 재검증
const data = await fetch('https://api.example.com/posts', {
  next: { revalidate: 60 },
})

// 태그 기반 재검증
const data = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] },
})
```

### 요청 메모이제이션

같은 URL로 여러 컴포넌트가 동일한 `fetch`를 호출하면, 하나의 요청 내에서 자동으로 중복 제거(deduplication)됩니다. 컴포넌트 트리 어디서나 필요한 데이터를 fetch해도 네트워크 요청이 하나만 발생합니다.

```typescript
// Header, Footer, Page 모두에서 호출해도 요청은 한 번
async function getCurrentUser() {
  return fetch('/api/me', { cache: 'no-store' }).then(r => r.json())
}
```

### parallel fetch로 워터폴 방지

```typescript
export default async function Dashboard() {
  // 순차 실행 (나쁜 예) — 각 fetch가 완료될 때까지 다음이 시작 안 됨
  // const user = await getUser()
  // const posts = await getPosts()
  // const stats = await getStats()

  // 병렬 실행 (좋은 예) — 모두 동시에 시작
  const [user, posts, stats] = await Promise.all([
    getUser(),
    getPosts(),
    getStats(),
  ])

  return (
    <main>
      <UserCard user={user} />
      <PostList posts={posts} />
      <StatsPanel stats={stats} />
    </main>
  )
}
```

---

## Server Actions

Server Actions는 클라이언트에서 서버 함수를 직접 호출하는 방법입니다. API 라우트 없이 폼 처리나 데이터 변이를 처리할 수 있습니다.

```typescript
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  // 서버에서 직접 DB 접근
  const post = await db.post.create({
    data: { title, content },
  })

  // 특정 경로 캐시 무효화
  revalidatePath('/blog')

  // 생성된 포스트 페이지로 이동
  redirect(`/blog/${post.slug}`)
}
```

폼에서 Server Action 사용:

```typescript
// app/new-post/page.tsx
import { createPost } from '../actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="제목" required />
      <textarea name="content" placeholder="내용" required />
      <button type="submit">게시</button>
    </form>
  )
}
```

클라이언트 컴포넌트에서도 Server Action을 호출할 수 있습니다.

```typescript
'use client'

import { createPost } from '../actions'
import { useTransition } from 'react'

export function PostForm() {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await createPost(formData)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" />
      <button disabled={isPending}>
        {isPending ? '저장 중...' : '저장'}
      </button>
    </form>
  )
}
```

---

## Streaming과 Suspense

App Router는 `loading.tsx`가 없어도 `<Suspense>`를 직접 써서 스트리밍을 제어할 수 있습니다.

```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <div>
      {/* 빠른 섹션 — 즉시 렌더링 */}
      <QuickStats />

      {/* 느린 섹션들 — 각자 독립적으로 스트리밍 */}
      <div className="grid">
        <Suspense fallback={<CardSkeleton />}>
          <RecentOrders />
        </Suspense>

        <Suspense fallback={<ChartSkeleton />}>
          <SalesChart />
        </Suspense>

        <Suspense fallback={<TableSkeleton />}>
          <TopProducts />
        </Suspense>
      </div>
    </div>
  )
}
```

`RecentOrders`, `SalesChart`, `TopProducts` 각각의 데이터 fetch가 완료되는 순서대로 화면에 나타납니다. 가장 빠른 것이 먼저 보이고, 나머지는 차례로 스켈레톤 UI를 교체합니다.

---

## 메타데이터 API

App Router는 `metadata` export로 SEO 메타데이터를 선언적으로 관리합니다.

```typescript
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

// 정적 메타데이터
export const metadata: Metadata = {
  title: '블로그',
}

// 동적 메타데이터 — 라우트 파라미터 기반
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [{ url: post.coverImage }],
    },
  }
}
```

---

## API Routes

App Router의 API 라우트는 `route.ts` 파일로 정의합니다. HTTP 메서드별 핸들러를 named export로 작성합니다.

```typescript
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? '1')

  const posts = await db.post.findMany({
    skip: (page - 1) * 10,
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ posts })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  // 인증 확인
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const post = await db.post.create({ data: body })
  return NextResponse.json(post, { status: 201 })
}
```

---

App Router는 처음에는 낯설게 느껴지지만, Server Components와 Streaming을 익히고 나면 기존 방식보다 훨씬 자연스럽게 성능 좋은 앱을 만들 수 있습니다. 다음 글에서는 Next.js 외에 **Remix, Nuxt, SvelteKit, Astro** 같은 다른 메타 프레임워크들을 비교합니다.

---

<nav style="display:flex;justify-content:space-between;margin-top:2rem;padding-top:1rem;border-top:1px solid #333">
  <a href="/posts/fw-rendering-strategies/">← 렌더링 전략 완전 정복 — CSR·SSR·SSG·ISR·Streaming</a>
  <a href="/posts/fw-meta-frameworks/">메타 프레임워크 완전 가이드 — Remix, Nuxt, SvelteKit, Astro →</a>
</nav>
