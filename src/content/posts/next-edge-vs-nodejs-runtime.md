---
title: "Edge Runtime vs Node.js Runtime — 실행 환경 선택 가이드"
description: "Next.js의 두 가지 서버 실행 환경인 Edge Runtime과 Node.js Runtime의 차이를 비교합니다. 각각의 API 제약, 콜드 스타트, 메모리 한도를 이해하고 라우트·미들웨어별로 올바른 런타임을 선택하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 2
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "EdgeRuntime", "NodejsRuntime", "미들웨어", "런타임", "서버컴포넌트"]
featured: false
draft: false
---

[지난 글](/posts/next-partial-prerendering/)에서 PPR로 정적 셸과 동적 슬롯을 하나의 라우트에서 공존시키는 방법을 살펴봤습니다. Next.js 서버 코드가 실제로 어디서, 어떻게 실행되는지도 이해해야 합니다. 이번 글에서는 **Edge Runtime**과 **Node.js Runtime**의 차이를 정리하고, 상황에 따라 어떤 런타임을 선택해야 하는지 설명합니다.

## 두 런타임이 존재하는 이유

Next.js는 서버 코드를 실행하는 환경을 두 가지로 나눕니다. **Node.js Runtime**은 익숙한 Node.js 환경으로, 파일 시스템, 네이티브 모듈, 대용량 메모리를 자유롭게 사용할 수 있습니다. 반면 **Edge Runtime**은 Cloudflare Workers, Vercel Edge Functions처럼 **전 세계 엣지 노드에 분산 배포**되는 경량 실행 환경입니다.

Edge Runtime은 V8 Isolate 기반으로 동작하며, Web Standard API(`fetch`, `Request`, `Response`, `Web Crypto`)만 지원합니다. Node.js 전용 API(`fs`, `Buffer`, `crypto` 등)는 사용할 수 없지만, 그 대신 **콜드 스타트가 1ms 이하**로 극도로 빠릅니다.

![Edge Runtime vs Node.js Runtime 비교](/assets/posts/next-edge-vs-nodejs-runtime-comparison.svg)

## 기본값과 런타임 선언 방법

Next.js의 기본 런타임은 **Node.js**입니다. 특별히 선언하지 않으면 모든 Route Handler, Server Component, Server Action이 Node.js 환경에서 실행됩니다.

Edge Runtime으로 변경하려면 해당 파일에서 `runtime` 상수를 내보냅니다.

```ts
// app/api/geo/route.ts
export const runtime = 'edge'

export function GET(req: Request) {
  // Vercel에서 req.geo로 지역 정보 접근 가능
  return Response.json({ region: 'edge' })
}
```

반대로 명시적으로 Node.js로 지정할 수도 있습니다.

```ts
export const runtime = 'nodejs'
```

## 미들웨어는 항상 Edge Runtime

`middleware.ts`는 예외입니다. 런타임 선언과 무관하게 **항상 Edge Runtime에서 실행**됩니다. 이는 미들웨어가 모든 요청을 가로채야 하므로, 가능한 한 사용자 가까운 엣지에서 빠르게 처리해야 하기 때문입니다.

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

미들웨어에서 Prisma나 `fs` 같은 Node.js 전용 모듈을 import하면 **빌드 오류**가 발생합니다. 미들웨어 로직은 반드시 Web API만으로 작성해야 합니다.

![런타임 선언 코드 패턴](/assets/posts/next-edge-vs-nodejs-runtime-code.svg)

## Edge Runtime의 제약 사항

Edge Runtime에서 사용할 수 없는 주요 항목들입니다.

```ts
// ❌ Edge Runtime에서 불가
import fs from 'fs'               // Node.js 전용
import { createHash } from 'crypto' // Node.js crypto
import { PrismaClient } from '@prisma/client' // Node.js 바이너리

// ✅ Edge Runtime에서 가능
const hash = await crypto.subtle.digest('SHA-256', data) // Web Crypto API
const res = await fetch('https://api.example.com/data')  // Web fetch
const cookie = req.cookies.get('session')                 // Next.js cookies
```

Prisma를 Edge Runtime에서 사용하려면 `@prisma/client/edge`와 Prisma Accelerate를 함께 사용해야 합니다.

## 언제 Edge Runtime을 선택해야 하나

| 상황 | 권장 런타임 |
|---|---|
| JWT 검증, 쿠키 파싱 | Edge |
| 지역(geo) 기반 리다이렉트 | Edge |
| A/B 테스트 배너 변경 | Edge |
| 경량 API 프록시 | Edge |
| Prisma / Drizzle DB 쿼리 | Node.js |
| 파일 읽기/쓰기 | Node.js |
| 이미지 리사이즈(sharp) | Node.js |
| PDF 생성 | Node.js |

경험칙으로는 **"요청 정보(쿠키·헤더)만 보고 빠르게 결정해야 한다면 Edge, 외부 자원(DB·파일)이 필요하다면 Node.js"** 입니다.

## 런타임 선택이 배포에 미치는 영향

Vercel에서는 Edge Runtime 함수가 자동으로 글로벌 엣지 네트워크에 배포됩니다. 자체 호스팅(Docker, PM2 등) 환경에서는 Edge Runtime과 Node.js Runtime 모두 동일한 서버 프로세스에서 실행되므로 콜드 스타트 차이가 크지 않습니다. Edge Runtime의 이점은 Vercel·Cloudflare처럼 글로벌 분산 배포 플랫폼에서 가장 잘 발휘됩니다.

---

**지난 글:** [Partial Prerendering — 정적과 동적의 공존](/posts/next-partial-prerendering/)

**다음 글:** [Server Actions — 서버에서 실행되는 함수](/posts/next-server-actions/)

<br>
읽어주셔서 감사합니다. 😊
