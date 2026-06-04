---
title: "인증 구현 — 세션과 토큰 기반 인증"
description: "Next.js에서 인증을 직접 구현하는 방법을 설명합니다. JWT와 세션 방식의 비교, jose 라이브러리를 사용한 토큰 서명·검증, Server Action 기반 로그인 흐름, httpOnly 쿠키 설정을 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 3
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "인증", "JWT", "세션", "jose", "httpOnly", "Server Action"]
featured: false
draft: false
---

[지난 글](/posts/next-middleware-matcher/)에서 Middleware의 `matcher` 설정으로 실행 경로를 제어하는 방법을 알아봤다. 이번에는 인증 자체를 어떻게 구현하는지 살펴본다. Next.js는 인증 라이브러리를 강제하지 않으므로 직접 구현하거나 Auth.js 같은 라이브러리를 쓸 수 있다. 이번 글에서는 직접 구현 방식을 다루고, 다음 글에서 Auth.js를 소개한다.

## 두 가지 인증 전략

인증 방식은 크게 **JWT(Stateless)**와 **세션(Stateful)** 두 가지로 나뉜다.

![Next.js 인증 전략 비교](/assets/posts/next-authentication-strategies.svg)

Next.js에서는 두 방식의 하이브리드가 자주 사용된다. 세션 정보를 암호화된 JWT에 담아 쿠키에 저장하면 Edge Runtime의 Middleware에서 DB 조회 없이 검증할 수 있다. Auth.js(NextAuth)가 이 방식을 사용한다.

## jose — Edge 호환 JWT 라이브러리

Node.js의 `jsonwebtoken` 패키지는 Edge Runtime에서 동작하지 않는다. Middleware에서 JWT를 검증하려면 Web Crypto API를 사용하는 **jose** 라이브러리가 필요하다.

```bash
npm install jose
```

![직접 구현: JWT 인증 흐름 코드](/assets/posts/next-authentication-flow.svg)

## 로그인 Server Action

```typescript
// app/login/actions.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { signToken } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // 1. 사용자 조회
  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  // 2. 비밀번호 검증
  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  // 3. JWT 발급
  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  // 4. httpOnly 쿠키에 저장
  const cookieStore = await cookies()
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: '/',
  })

  redirect('/dashboard')
}
```

`httpOnly: true`는 JavaScript에서 쿠키에 접근할 수 없도록 막아 XSS 공격으로부터 토큰을 보호한다. `sameSite: 'lax'`는 CSRF 공격을 방어한다.

## Middleware에서 JWT 검증

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    // Edge Runtime에서 jose로 JWT 검증
    await verifyToken(token)
    return NextResponse.next()
  } catch {
    // 토큰 만료·위조 시 로그아웃 처리
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth-token')
    return response
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}
```

## Server Component에서 세션 읽기

페이지 컴포넌트에서 현재 사용자 정보가 필요하다면 `cookies()`로 토큰을 읽어 검증한다.

```typescript
// lib/session.ts
import { cookies } from 'next/headers'
import { verifyToken } from './auth'

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  try {
    const { payload } = await verifyToken(token)
    return payload as { sub: string; email: string; role: string }
  } catch {
    return null
  }
}
```

```typescript
// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div>
      <h1>안녕하세요, {session.email}!</h1>
    </div>
  )
}
```

`getSession()`을 Server Component에서 직접 호출하는 방식은 Middleware 검증과 이중으로 보호하는 **Defense in Depth** 패턴이다.

## 로그아웃

```typescript
// app/logout/actions.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('auth-token')
  redirect('/login')
}
```

Server Action이므로 `<form action={logoutAction}>` 형태로 폼과 연결하면 된다.

## 비밀번호 해싱

절대 비밀번호를 평문으로 저장하지 말 것. `bcryptjs`는 Node.js 환경(Server Action, Route Handler)에서 사용한다.

```typescript
import bcrypt from 'bcryptjs'

// 회원가입 시 해싱
const hash = await bcrypt.hash(password, 12) // salt rounds 10~12 권장

// 로그인 시 검증
const isValid = await bcrypt.compare(plainPassword, storedHash)
```

Edge Runtime(Middleware)에서는 `bcryptjs`를 사용할 수 없다. 비밀번호 검증은 Route Handler나 Server Action에서 수행하고, Middleware에서는 JWT 검증만 담당한다.

## 환경 변수 관리

```bash
# .env.local
JWT_SECRET=최소_32자_이상의_무작위_문자열
```

JWT 시크릿은 최소 32자 이상, 가능하면 64자 이상의 랜덤 문자열을 사용한다. 운영 환경에서는 시크릿 관리 서비스(AWS Secrets Manager, Vault 등)를 활용한다.

---

**지난 글:** [Middleware matcher — 실행 범위 제어](/posts/next-middleware-matcher/)

**다음 글:** [Auth.js(NextAuth) — 소셜 로그인과 세션 관리](/posts/next-authjs/)

<br>
읽어주셔서 감사합니다. 😊
