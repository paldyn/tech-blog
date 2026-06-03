---
title: "Server Action 보안 — 인증과 인가"
description: "Server Action을 안전하게 사용하기 위한 보안 원칙을 설명합니다. 미인증 접근 차단, IDOR 방어, CSRF 보호, Rate Limiting까지 실전 보안 패턴을 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 8
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "ServerActions", "보안", "인증", "인가", "IDOR", "CSRF", "RateLimiting"]
featured: false
draft: false
---

[지난 글](/posts/next-server-action-validation/)에서 Zod로 입력값을 검증하는 방법을 살펴봤습니다. 입력 검증은 보안의 일부일 뿐입니다. Server Action은 클라이언트에서 직접 호출되므로, 악의적인 사용자가 브라우저 개발자 도구나 자동화 스크립트로 직접 POST 요청을 보낼 수 있다는 사실을 항상 기억해야 합니다. **Server Action은 공개 API 엔드포인트와 동일하게 취급**해야 합니다.

## 핵심 원칙: 서버를 신뢰의 기준으로

클라이언트에서 전달하는 모든 데이터는 잠재적으로 조작됐다고 가정해야 합니다. 특히 **사용자 ID를 클라이언트에서 받아서는 안 됩니다.** 현재 사용자 정보는 반드시 서버의 세션/쿠키에서 직접 읽어야 합니다.

```ts
// ❌ 잘못된 패턴 — 클라이언트의 userId를 신뢰
export async function deletePost(userId: string, postId: string) {
  await db.post.delete({ where: { id: postId, userId } })  // userId가 조작될 수 있음
}

// ✅ 올바른 패턴 — 서버 세션에서 userId 읽기
export async function deletePost(postId: string) {
  const session = await getSession()
  await db.post.delete({ where: { id: postId, userId: session.userId } })
}
```

![Server Action 보안 위협과 대응](/assets/posts/next-server-action-security-threats.svg)

## 인증 확인 패턴

모든 인증이 필요한 Server Action의 시작 부분에 세션 확인 로직을 배치합니다.

```ts
'use server'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) throw new Error('Unauthorized')

  const user = await verifyToken(token)
  if (!user) throw new Error('Unauthorized')

  return user
}

export async function updateProfile(formData: FormData) {
  const user = await getAuthenticatedUser()  // 미인증 시 자동으로 throw
  // ... 이후 로직
}
```

Auth.js(NextAuth)를 사용한다면 `auth()` 함수로 더 간결하게 처리할 수 있습니다.

```ts
import { auth } from '@/auth'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  // session.user.id는 Auth.js가 서버에서 직접 검증한 값
}
```

## 인가 — 소유권 확인 (IDOR 방어)

**IDOR(Insecure Direct Object Reference)**는 공격자가 다른 사용자의 리소스 ID를 직접 요청해 접근하는 취약점입니다. 반드시 리소스의 소유자를 서버에서 검증해야 합니다.

```ts
export async function updatePost(postId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  // WHERE id=postId AND userId=currentUserId — 타인의 글이면 null 반환
  const post = await db.post.findFirst({
    where: { id: postId, userId: session.user.id },
  })

  if (!post) throw new Error('Forbidden')  // 404처럼 처리해 존재 여부 노출 방지

  const title = formData.get('title') as string
  await db.post.update({ where: { id: postId }, data: { title } })
  revalidatePath(`/posts/${postId}`)
}
```

![안전한 Server Action 패턴](/assets/posts/next-server-action-security-pattern.svg)

## CSRF 보호

Next.js 14.2 이상에서는 Server Action 요청의 `Origin` 헤더를 자동으로 검증합니다. 다른 도메인에서 Server Action을 호출하려 하면 차단됩니다. 추가로 `SameSite=Strict` 쿠키 설정을 권장합니다.

```ts
// lib/auth.ts
import { cookies } from 'next/headers'
import { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies'

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',  // CSRF 방어
    path: '/',
    maxAge: 60 * 60 * 24 * 7,  // 7일
  })
}
```

## Rate Limiting

민감한 액션(회원가입, 로그인, 비밀번호 변경)에는 Rate Limiting을 적용해 자동화 공격을 차단해야 합니다. Upstash Redis의 `@upstash/ratelimit`을 사용하는 예시입니다.

```ts
'use server'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { headers } from 'next/headers'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '10 m'),  // 10분에 5회
})

export async function resetPassword(formData: FormData) {
  const headerStore = await headers()
  const ip = headerStore.get('x-forwarded-for') ?? 'anonymous'
  const { success } = await ratelimit.limit(ip)

  if (!success) {
    return { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }
  }

  // 비밀번호 재설정 로직...
}
```

## 보안 체크리스트

Server Action을 작성할 때 아래 항목을 모두 확인하세요.

| 항목 | 확인 |
|---|---|
| 세션/토큰으로 인증 여부 확인 | 필수 |
| 리소스 소유권 서버에서 검증 | 수정·삭제 액션에 필수 |
| 클라이언트의 userId 파라미터 신뢰 금지 | 필수 |
| Zod 등으로 입력 스키마 검증 | 필수 |
| 민감 액션에 Rate Limiting 적용 | 권장 |
| 오류 메시지에 내부 정보 노출 금지 | 권장 |

---

**지난 글:** [Server Action 입력 검증 — Zod로 안전하게](/posts/next-server-action-validation/)

**다음 글:** [Route Handlers — API 엔드포인트 만들기](/posts/next-route-handlers/)

<br>
읽어주셔서 감사합니다. 😊
