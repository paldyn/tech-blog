---
title: "Route Handlers — API 엔드포인트 만들기"
description: "Next.js App Router의 Route Handlers로 REST API를 구현하는 방법을 설명합니다. HTTP 메서드 핸들러, 동적 라우트 파라미터, 쿼리 파라미터, JSON 바디 처리, CORS 설정, 웹훅 구현까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 9
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "RouteHandlers", "RESTAPI", "CORS", "웹훅", "AppRouter"]
featured: false
draft: false
---

[지난 글](/posts/next-server-action-security/)에서 Server Action 보안을 살펴봤습니다. Server Action은 Next.js 앱 내부 UI와 연동되는 뮤테이션에 최적화됐지만, 외부 서비스가 호출하는 API나 웹훅을 만들 때는 **Route Handlers**를 사용합니다. Route Handlers는 App Router에서 `route.ts` 파일로 구현하는 HTTP 엔드포인트입니다.

## Route Handler 기본

`app/api` 디렉토리 아래에 `route.ts` 파일을 만들면 자동으로 API 엔드포인트가 생성됩니다.

```
app/
  api/
    posts/
      route.ts        → GET /api/posts, POST /api/posts
    posts/[id]/
      route.ts        → GET /api/posts/:id, PATCH /api/posts/:id
    webhooks/
      route.ts        → POST /api/webhooks
```

각 HTTP 메서드를 이름으로 named export합니다.

```ts
// app/api/posts/route.ts
import { db } from '@/lib/db'

export async function GET() {
  const posts = await db.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return Response.json(posts)
}

export async function POST(req: Request) {
  const body = await req.json()
  const post = await db.post.create({ data: body })
  return Response.json(post, { status: 201 })
}
```

![Route Handler 파일 구조와 HTTP 메서드](/assets/posts/next-route-handlers-structure.svg)

## 동적 라우트 파라미터

Next.js 15에서는 `params`가 Promise로 변경됐습니다. `await`로 언팩해야 합니다.

```ts
// app/api/posts/[id]/route.ts
type Context = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Context) {
  const { id } = await params
  const post = await db.post.findUnique({ where: { id } })

  if (!post) {
    return new Response('Not Found', { status: 404 })
  }

  return Response.json(post)
}

export async function PATCH(req: Request, { params }: Context) {
  const { id } = await params
  const body = await req.json()
  const updated = await db.post.update({ where: { id }, data: body })
  return Response.json(updated)
}

export async function DELETE(_req: Request, { params }: Context) {
  const { id } = await params
  await db.post.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
```

## 쿼리 파라미터 처리

URL에서 쿼리 파라미터를 읽으려면 `URL` 객체를 사용합니다.

```ts
// app/api/posts/search/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const page = Number(searchParams.get('page') ?? '1')
  const limit = Math.min(Number(searchParams.get('limit') ?? '10'), 100)

  const posts = await db.post.findMany({
    where: { title: { contains: q } },
    skip: (page - 1) * limit,
    take: limit,
  })

  return Response.json({ posts, page, limit })
}
```

## 웹훅 처리 — 시그니처 검증

외부 서비스(Stripe, GitHub 등)의 웹훅은 서명을 반드시 검증해야 합니다.

```ts
// app/api/webhooks/stripe/route.ts
import Stripe from 'stripe'
import { headers } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const body = await req.text()  // raw body 필요
  const headerStore = await headers()
  const signature = headerStore.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    await handlePaymentSuccess(event.data.object)
  }

  return new Response('OK', { status: 200 })
}
```

![Route Handler 고급 패턴](/assets/posts/next-route-handlers-patterns.svg)

## CORS 설정

외부 도메인에서 API를 호출할 수 있도록 CORS 헤더를 추가합니다. OPTIONS 메서드도 함께 구현해야 preflight 요청이 처리됩니다.

```ts
// app/api/public/route.ts
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  const data = await getPublicData()
  return Response.json(data, { headers: CORS_HEADERS })
}
```

## Route Handlers의 캐싱

기본적으로 Route Handlers의 `GET` 요청은 캐싱되지 않습니다. `next.revalidate` 옵션으로 캐싱을 활성화할 수 있습니다.

```ts
export const revalidate = 60  // 60초마다 재검증

export async function GET() {
  const posts = await db.post.findMany()
  return Response.json(posts)
}
```

## Route Handler vs Server Action 선택 기준

| 상황 | 선택 |
|---|---|
| 외부 앱이 호출하는 REST API | Route Handler |
| 웹훅 수신 | Route Handler |
| 파일 스트리밍/다운로드 | Route Handler |
| CORS 필요 | Route Handler |
| Next.js 앱 내부 폼/버튼 뮤테이션 | Server Action |
| 인증 후 리다이렉트 | Server Action |

---

**지난 글:** [Server Action 보안 — 인증과 인가](/posts/next-server-action-security/)

**다음 글:** [cookies와 headers — 요청 정보 읽기](/posts/next-cookies-headers/)

<br>
읽어주셔서 감사합니다. 😊
