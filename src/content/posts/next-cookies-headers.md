---
title: "cookies와 headers — 요청 정보 읽기"
description: "Next.js의 cookies()와 headers() 함수로 서버 컴포넌트, Server Action, Route Handler에서 요청 정보를 읽고 쓰는 방법을 설명합니다. Next.js 15의 비동기 API 변경, 쿠키 옵션, 헤더 처리 패턴을 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 10
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "cookies", "headers", "ServerComponent", "ServerAction", "인증"]
featured: false
draft: false
---

[지난 글](/posts/next-route-handlers/)에서 Route Handler로 API 엔드포인트를 만드는 방법을 살펴봤습니다. 서버에서 실행되는 코드는 현재 요청의 쿠키와 헤더에 접근해야 할 때가 많습니다. 세션 토큰 확인, 사용자 언어 감지, IP 추출 등이 대표적인 예입니다. Next.js는 `next/headers` 모듈의 `cookies()`와 `headers()` 함수로 이를 처리합니다.

## Next.js 15의 비동기 API

Next.js 15부터 `cookies()`와 `headers()`는 비동기 함수로 변경됐습니다. 반드시 `await`를 사용해야 합니다.

```ts
// Next.js 14 이하 (동기)
const cookieStore = cookies()
const headerStore = headers()

// Next.js 15 이상 (비동기)
const cookieStore = await cookies()
const headerStore = await headers()
```

이 변경은 React의 Async Server Component 모델과 일치하는 방향입니다. 기존 코드를 마이그레이션할 때 `@next/codemod` 도구가 자동으로 변환해줍니다.

## cookies() — 쿠키 읽기와 쓰기

### 읽기 (서버 컴포넌트, Server Action, Route Handler)

```ts
import { cookies } from 'next/headers'

export default async function Dashboard() {
  const cookieStore = await cookies()

  // 단일 쿠키 읽기
  const session = cookieStore.get('session')?.value
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'ko'

  // 존재 여부 확인
  const hasSession = cookieStore.has('session')

  // 모든 쿠키 읽기
  const allCookies = cookieStore.getAll()

  return <main>{/* session 기반 렌더링 */}</main>
}
```

### 쓰기 (Server Action, Route Handler에서만)

서버 컴포넌트는 렌더링 중에 응답을 수정할 수 없으므로 쿠키 쓰기가 불가합니다. Server Action이나 Route Handler에서 쓸 수 있습니다.

```ts
// app/actions/auth.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const user = await validateCredentials(email, password)
  if (!user) return { error: '이메일 또는 비밀번호가 올바르지 않습니다' }

  const token = await createSessionToken(user.id)
  const cookieStore = await cookies()

  cookieStore.set({
    name: 'session',
    value: token,
    httpOnly: true,         // JS에서 접근 불가 (XSS 방어)
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',     // CSRF 방어
    path: '/',
    maxAge: 60 * 60 * 24 * 7,  // 7일
  })

  redirect('/dashboard')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  redirect('/login')
}
```

![cookies()와 headers() 사용 가능 위치](/assets/posts/next-cookies-headers-api.svg)

## headers() — 요청 헤더 읽기

`headers()`는 현재 요청의 HTTP 헤더를 읽습니다. 쓰기는 불가합니다(응답 헤더는 `Response` 객체나 `next.config.ts`의 `headers` 설정으로 추가).

```ts
import { headers } from 'next/headers'

export default async function Page() {
  const headerStore = await headers()

  // User-Agent로 디바이스 감지
  const userAgent = headerStore.get('user-agent') ?? ''
  const isMobile = /mobile/i.test(userAgent)

  // 언어 감지
  const acceptLanguage = headerStore.get('accept-language') ?? 'ko'

  // IP 주소 (리버스 프록시 환경)
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0].trim()
    ?? headerStore.get('x-real-ip')
    ?? 'unknown'

  return <main className={isMobile ? 'mobile' : 'desktop'}>{/* ... */}</main>
}
```

![쿠키 읽기/쓰기 및 헤더 처리 코드](/assets/posts/next-cookies-headers-code.svg)

## Route Handler에서 쿠키와 헤더 처리

Route Handler에서는 `next/headers`의 함수를 사용하거나 `Request` 객체를 직접 활용할 수 있습니다.

```ts
// app/api/me/route.ts
import { cookies, headers } from 'next/headers'

export async function GET(req: Request) {
  // 방법 1: next/headers 사용
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  // 방법 2: Request 객체 직접 사용
  const authHeader = req.headers.get('authorization')
  const bearer = authHeader?.replace('Bearer ', '')

  const user = await getUserFromToken(token ?? bearer)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // 응답에 쿠키 설정
  const response = Response.json(user)
  response.headers.set('Set-Cookie', `refresh=...; HttpOnly; Path=/`)
  return response
}
```

## cookies()와 headers()가 동적 렌더링을 유발하는 이유

`cookies()`나 `headers()`를 호출하는 순간, 해당 라우트는 **요청 시점 정보에 의존**하므로 정적 렌더링이 불가능해집니다. Next.js는 자동으로 동적 렌더링으로 전환합니다. 불필요하게 최상위 레이아웃에서 이 함수를 호출하면 앱 전체가 동적 렌더링이 될 수 있으므로, 필요한 컴포넌트에서만 호출해야 합니다.

## 쿠키 보안 옵션 정리

| 옵션 | 설명 | 권장 설정 |
|---|---|---|
| `httpOnly` | JS에서 접근 불가 | `true` (세션 토큰) |
| `secure` | HTTPS에서만 전송 | 프로덕션에서 `true` |
| `sameSite` | CSRF 방어 수준 | `'strict'` 또는 `'lax'` |
| `maxAge` | 만료 시간 (초) | 세션 길이에 맞게 |
| `path` | 유효 경로 | `'/'` (전체) |

---

**지난 글:** [Route Handlers — API 엔드포인트 만들기](/posts/next-route-handlers/)

<br>
읽어주셔서 감사합니다. 😊
