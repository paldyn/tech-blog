---
title: "Auth.js(NextAuth) — 소셜 로그인과 세션 관리"
description: "Auth.js v5(NextAuth)를 Next.js App Router에 통합하는 방법을 설명합니다. GitHub/Google OAuth 설정, Credentials 프로바이더, callbacks로 JWT 커스터마이징, Middleware 연동까지 실전 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 4
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "Auth.js", "NextAuth", "OAuth", "소셜로그인", "인증", "세션"]
featured: false
draft: false
---

[지난 글](/posts/next-authentication/)에서 jose와 httpOnly 쿠키로 JWT 인증을 직접 구현하는 방법을 살펴봤다. 이번에는 OAuth 소셜 로그인과 세션 관리를 포함해 인증 전반을 처리하는 **Auth.js(구 NextAuth)**를 소개한다. v5에서 App Router를 완전히 지원하게 되면서 설정 방식이 크게 개선됐다.

## Auth.js v5 개요

Auth.js는 Next.js를 포함한 여러 프레임워크를 지원하는 인증 라이브러리다. OAuth 2.0 / OpenID Connect 기반 소셜 로그인(Google, GitHub, Kakao 등 50개 이상)과 이메일/비밀번호 인증을 통합한다. v5(beta)부터 App Router 친화적인 구조로 재설계됐다.

![Auth.js v5 아키텍처](/assets/posts/next-authjs-architecture.svg)

핵심은 `auth.ts` 파일 하나에서 `NextAuth()` 인스턴스를 만들고, 거기서 나온 `auth`, `signIn`, `signOut`, `handlers`를 Middleware, Server Component, Server Action, Route Handler에서 import해 쓰는 구조다.

## 설치

```bash
npm install next-auth@beta
```

환경 변수 설정:

```bash
# .env.local
AUTH_SECRET=최소_32자_랜덤_문자열  # openssl rand -hex 32
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

`AUTH_SECRET`은 세션 JWT를 서명·암호화하는 데 사용된다. 누출되면 모든 세션이 위조 가능해지므로 강력한 랜덤 문자열을 사용해야 한다.

## auth.ts 설정 파일

![auth.ts 설정 파일 예시](/assets/posts/next-authjs-config.svg)

```typescript
// auth.ts (프로젝트 루트 또는 src/ 바로 아래)
import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub,
    Google,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // 최초 로그인 시 user가 존재 — 커스텀 필드를 token에 추가
      if (user) {
        token.role = (user as any).role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      // jwt callback의 token을 session에 반영
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',          // 커스텀 로그인 페이지
    error: '/login',           // 오류 시 리다이렉트 경로
  },
})
```

## Route Handler 연결

Auth.js가 자동으로 처리하는 엔드포인트(`/api/auth/signin`, `/api/auth/callback/*` 등)를 활성화한다.

```typescript
// app/api/auth/[...nextauth]/route.ts
export { GET, POST } from '@/auth'
```

단 한 줄이다. `handlers`에서 가져온 `GET`, `POST`를 그대로 내보내면 Auth.js가 모든 OAuth 콜백을 처리한다.

## Middleware 연동

```typescript
// middleware.ts
export { auth as middleware } from '@/auth'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
```

`auth`를 Middleware로 직접 내보내면 된다. Auth.js가 내부적으로 세션 쿠키를 검증하고, `authorized` callback을 통해 접근 제어를 구현할 수 있다.

보다 세밀한 제어가 필요하면:

```typescript
// middleware.ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isProtected = req.nextUrl.pathname.startsWith('/dashboard')

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next|api/auth).*)'],
}
```

## Server Component에서 세션 읽기

```typescript
import { auth } from '@/auth'

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    // 보통 Middleware가 먼저 막지만 Defense in Depth 차원에서 체크
    redirect('/login')
  }

  return <div>환영합니다, {session.user.name}!</div>
}
```

## Server Action에서 로그인 / 로그아웃

```typescript
// app/login/actions.ts
'use server'

import { signIn, signOut } from '@/auth'
import { AuthError } from 'next-auth'

export async function loginWithGitHub() {
  await signIn('github', { redirectTo: '/dashboard' })
}

export async function loginWithCredentials(formData: FormData) {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
        default:
          return { error: '로그인 중 오류가 발생했습니다.' }
      }
    }
    throw error // redirect()는 내부적으로 error를 throw하므로 re-throw 필요
  }
}

export async function logout() {
  await signOut({ redirectTo: '/login' })
}
```

## TypeScript 타입 확장

`role` 같은 커스텀 필드를 세션 타입에 추가하려면 모듈 선언 확장이 필요하다.

```typescript
// types/next-auth.d.ts
import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession['user']
  }

  interface User {
    role: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
  }
}
```

## Database Adapter 연결

세션을 DB에 저장하려면 adapter를 추가한다. Prisma 예시:

```bash
npm install @auth/prisma-adapter @prisma/client
```

```typescript
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'database' }, // DB 세션 (기본값은 'jwt')
  providers: [...],
})
```

Adapter를 사용하면 `next-auth` 스키마(User, Account, Session, VerificationToken 테이블)가 DB에 필요하다. Prisma 스키마는 Auth.js 공식 문서에서 제공한다.

---

**지난 글:** [인증 구현 — 세션과 토큰 기반 인증](/posts/next-authentication/)

**다음 글:** [라우트 보호 패턴 — Middleware와 컴포넌트 레벨 방어](/posts/next-protecting-routes/)

<br>
읽어주셔서 감사합니다. 😊
