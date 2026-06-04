---
title: "라우트 보호 패턴 — Middleware와 컴포넌트 레벨 방어"
description: "Next.js에서 라우트를 다층으로 보호하는 Defense in Depth 패턴을 설명합니다. Middleware, Server Component, Server Action, 데이터베이스 레벨의 순차적 보호 전략과 역할 기반 접근 제어(RBAC) 구현을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 5
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "인증", "라우트보호", "RBAC", "Defense in Depth", "Middleware", "Server Action"]
featured: false
draft: false
---

[지난 글](/posts/next-authjs/)에서 Auth.js로 소셜 로그인과 세션 관리를 구현했다. 인증 자체를 구현했다면, 다음 과제는 **인가(Authorization)** — 즉 인증된 사용자가 접근할 수 있는 리소스를 제어하는 것이다. Middleware 하나로 모든 보호를 처리하고 싶겠지만, 보안에서는 단일 방어선을 믿는 것이 위험하다.

## Defense in Depth: 다층 보호 전략

군사 전술에서 차용한 개념인 **Defense in Depth**는 여러 겹의 방어선을 두어 하나가 뚫려도 피해를 최소화한다는 원칙이다. Next.js에서는 네 개 레이어에 걸쳐 보호를 구성할 수 있다.

![Defense in Depth — 다층 라우트 보호](/assets/posts/next-protecting-routes-layers.svg)

각 레이어는 역할이 다르다. Middleware는 빠르고 넓게, Server Component는 정확하게, Server Action은 데이터 변경 직전에, DB는 데이터 자체를 보호한다.

## Layer 1: Middleware로 대량 차단

첫 번째 방어선은 Middleware다. 요청이 App Router에 도달하기 전에 실행되므로 가장 빠르다. 단, DB 쿼리 없이 JWT/세션 쿠키만 검증할 수 있다.

```typescript
// middleware.ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const session = req.auth
  const { pathname } = req.nextUrl

  // 인증 여부
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/settings/:path*'],
}
```

## Layer 2: Server Component / Layout에서 역할 검증

Middleware는 JWT가 존재하는지만 확인한다. 역할(role) 검증이나 DB 조회가 필요한 세밀한 제어는 Server Component에서 수행한다.

```typescript
// app/admin/layout.tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Middleware가 이미 걸렀지만 재확인 (Defense in Depth)
  if (!session?.user) {
    redirect('/login')
  }

  // 역할 기반 접근 제어
  if (session.user.role !== 'admin') {
    redirect('/403')
  }

  return <>{children}</>
}
```

Layout에서 검증하면 해당 레이아웃을 공유하는 모든 페이지에 자동으로 적용된다. `/admin/users`, `/admin/settings` 등을 개별적으로 보호할 필요가 없다.

## Layer 3: Server Action 재검증

![역할 기반 접근 제어(RBAC) 코드 패턴](/assets/posts/next-protecting-routes-rbac.svg)

Server Action은 URL 우회나 `fetch`로 직접 호출될 수 있다. Middleware가 페이지 접근을 막아도, 클라이언트 코드에서 직접 Server Action을 호출할 수 있다. **데이터를 변경하는 Server Action은 반드시 내부에서 인증·인가를 재검증해야 한다.**

```typescript
// app/posts/actions.ts
'use server'

import { auth } from '@/auth'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function updatePost(id: string, data: { title: string; content: string }) {
  // 1. 인증 확인
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  // 2. 소유자 확인 (IDOR 방어)
  const post = await db.post.findUnique({ where: { id } })
  if (!post) {
    throw new Error('Post not found')
  }

  if (post.authorId !== session.user.id && session.user.role !== 'admin') {
    throw new Error('Forbidden: you do not own this post')
  }

  // 3. 업데이트
  await db.post.update({
    where: { id },
    data,
  })

  revalidatePath(`/posts/${id}`)
}
```

**IDOR(Insecure Direct Object Reference)** 공격은 다른 사용자의 리소스 ID를 직접 지정해 접근하는 공격이다. 소유자 확인 없이 ID만으로 삭제/수정을 허용하면 취약해진다.

## Layer 4: 데이터베이스 레벨 필터링

DB 쿼리 자체에 사용자 ID 조건을 추가하면 데이터 레벨에서도 보호된다.

```typescript
// 사용자 자신의 데이터만 조회 — DB 레벨 필터
async function getMyPosts(userId: string) {
  return db.post.findMany({
    where: { authorId: userId }, // 사용자 ID로 필터 — 다른 사람 게시물 조회 불가
  })
}
```

PostgreSQL을 쓴다면 Row-Level Security(RLS)를 데이터베이스 정책으로 설정해 애플리케이션 레벨에서 실수로 필터를 빠뜨려도 DB가 차단하게 할 수 있다.

## 공개 레이아웃 안의 보호된 컴포넌트

페이지 전체를 막는 것이 아니라, 특정 UI 요소만 보호해야 할 때는 컴포넌트 레벨에서 조건부 렌더링을 사용한다.

```typescript
// 공개 페이지의 Admin 전용 버튼
import { auth } from '@/auth'

export default async function PostPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const isAdmin = session?.user?.role === 'admin'

  return (
    <article>
      {/* 공개 콘텐츠 */}
      {isAdmin && <AdminActions postId={params.id} />}
    </article>
  )
}
```

UI에서 버튼을 숨기는 것만으로는 보안이 되지 않는다. Server Action에서도 권한을 검증해야 한다. UI는 사용자 경험, 서버는 보안을 담당한다는 원칙을 지켜야 한다.

## 403 / Unauthorized 페이지

Next.js 13+에서는 `app/` 안에 `not-found.tsx`와 `error.tsx`를 만들 수 있다. 403(Forbidden) 페이지는 별도 라우트로 만든다.

```typescript
// app/403/page.tsx
export default function ForbiddenPage() {
  return (
    <div>
      <h1>접근 권한이 없습니다</h1>
      <p>이 페이지에 접근할 수 있는 권한이 없습니다.</p>
    </div>
  )
}
```

## 정리: 레이어별 역할

| 레이어 | 위치 | 주 역할 | DB 사용 |
|---|---|---|---|
| Middleware | Edge | 인증 여부 / 대규모 차단 | ❌ |
| Layout / Page | Node.js | 역할 검증 / 리다이렉트 | ✅ |
| Server Action | Node.js | 데이터 변경 전 재검증 | ✅ |
| Database | DB | Row-level 필터 | — |

실제 서비스에서는 최소 Middleware + Server Component 두 레이어를 쌓고, 민감한 데이터를 다루는 Server Action에는 반드시 내부 검증을 추가하는 것을 권장한다.

---

**지난 글:** [Auth.js(NextAuth) — 소셜 로그인과 세션 관리](/posts/next-authjs/)

**다음 글:** [Metadata API — SEO를 위한 메타데이터 설정](/posts/next-metadata-api/)

<br>
읽어주셔서 감사합니다. 😊
