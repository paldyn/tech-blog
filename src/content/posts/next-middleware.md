---
title: "Middleware — 요청 가로채기와 전처리"
description: "Next.js Middleware의 개념과 동작 원리, NextResponse를 활용한 리다이렉트·리라이트·헤더 추가 패턴을 코드 예제와 함께 설명합니다. Edge Runtime 제약과 올바른 활용 범위를 짚어봅니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 1
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "Middleware", "Edge Runtime", "NextResponse", "인증", "리다이렉트"]
featured: false
draft: false
---

[지난 글](/posts/next-cookies-headers/)에서 서버 컴포넌트와 Server Action에서 쿠키·헤더를 읽고 쓰는 방법을 살펴봤다. 이번에는 그보다 한 단계 앞선 시점, 즉 요청이 라우터에 도달하기 _전에_ 실행되는 **Middleware**를 다룬다. Middleware는 모든 요청을 가장 먼저 만나는 관문으로, 인증·인가부터 A/B 테스트, 국제화까지 폭넓게 활용된다.

## Middleware란 무엇인가

Middleware는 Next.js 서버가 요청을 처리하는 파이프라인 가장 앞단에 위치한 함수다. 브라우저로부터 요청이 들어오면 App Router나 Pages Router가 실행되기 전에 `middleware.ts`(또는 `middleware.js`)가 먼저 호출된다. 여기서 요청을 검사하고 결과에 따라 세 가지 중 하나를 선택한다.

- **통과 (`NextResponse.next()`)**: 요청을 그대로 App Router로 넘긴다.
- **리다이렉트 (`NextResponse.redirect()`)**: 다른 URL로 응답한다. 브라우저 주소창이 바뀐다.
- **리라이트 (`NextResponse.rewrite()`)**: 다른 URL로 내부 포워딩한다. 브라우저 주소창은 유지된다.

![Middleware 처리 흐름](/assets/posts/next-middleware-flow.svg)

## 파일 위치와 기본 구조

`middleware.ts`는 반드시 **프로젝트 루트** 또는 `src/` 디렉터리 바로 아래에 위치해야 한다. `app/` 폴더 안에 두면 동작하지 않는다.

```
my-app/
├── src/
│   ├── app/
│   └── middleware.ts  ← 여기 (src/ 쓸 경우)
└── middleware.ts       ← 또는 여기 (src/ 없을 경우)
```

기본 내보내기는 `middleware`라는 이름의 함수여야 하며, `NextRequest`를 인수로 받아 `NextResponse` 또는 `Response`를 반환한다.

![middleware.ts 기본 패턴](/assets/posts/next-middleware-code.svg)

## NextResponse API

Middleware 안에서 사용할 수 있는 주요 `NextResponse` 메서드를 정리했다.

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // 1. 리다이렉트 — 브라우저 URL 변경
  if (pathname === '/old-page') {
    return NextResponse.redirect(new URL('/new-page', request.url))
  }

  // 2. 리라이트 — 내부 URL 변경, 브라우저 URL 유지
  if (pathname.startsWith('/api/v1')) {
    return NextResponse.rewrite(new URL('/api/v2' + pathname.slice(7), request.url))
  }

  // 3. 요청 헤더 추가 후 통과
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', 'abc123')

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}
```

### 응답 헤더 추가

응답에 보안 헤더를 삽입하는 것도 Middleware의 흔한 활용 중 하나다.

```typescript
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // CSP, X-Frame-Options 등 보안 헤더 추가
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'"
  )

  return response
}
```

## 인증 흐름 구현

가장 흔한 패턴은 보호된 경로에 대한 인증 검사다.

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/admin', '/profile']
const PUBLIC_PATHS = ['/login', '/signup', '/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth-token')?.value

  // 이미 인증된 상태에서 로그인 페이지 접근 시 대시보드로
  if (PUBLIC_PATHS.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 보호 경로 접근 시 토큰 없으면 로그인으로
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))
  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname) // 로그인 후 돌아올 경로
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}
```

## Edge Runtime 제약

Middleware는 **Edge Runtime** 위에서 실행된다. 이 환경은 Node.js 런타임보다 가볍고 빠르지만 사용할 수 있는 API가 제한된다.

| 사용 가능 | 사용 불가 |
|---|---|
| `fetch()` | 파일 시스템 (`fs`) |
| Web Crypto API | `child_process` |
| `Headers`, `Request`, `Response` | `crypto` (Node.js 버전) |
| 쿠키·URL 파싱 | 대부분의 npm 패키지 |
| 환경 변수 (Edge 호환) | DB 직접 연결 (Prisma 등) |

DB 조회가 필요한 복잡한 인증은 Middleware에서 하지 말고, JWT 같은 자체 검증 가능한 토큰을 쿠키에 담아 Edge에서 검증하는 패턴을 권장한다. DB 의존 로직은 Server Component나 Route Handler로 위임하면 된다.

## 실행 시점과 순서

Middleware는 다음 우선순위로 처리된다.

```
요청
 ↓
Headers (next.config.js의 headers 설정)
 ↓
Redirects (next.config.js의 redirects 설정)
 ↓
Middleware (middleware.ts)
 ↓
Rewrites (beforeFiles — next.config.js)
 ↓
파일 시스템 (public/, _next/static/ 등)
 ↓
Rewrites (afterFiles)
 ↓
Dynamic Routes
 ↓
Rewrites (fallback)
```

Middleware는 `next.config.js`의 redirects보다 뒤에, 파일 시스템 처리보다 앞에 실행된다.

## 주의사항

- **`export const config` 없으면 모든 경로에 실행된다.** 정적 파일(`.ico`, `.png` 등)과 `_next/` 경로까지 포함되어 불필요한 오버헤드가 생긴다. matcher 설정은 필수다.
- **에러를 throw하지 말 것.** Middleware에서 uncaught exception이 발생하면 요청 전체가 500 오류로 떨어진다. try-catch로 감싸고 fallback을 `NextResponse.next()`로 두는 것이 안전하다.
- **응답 body를 직접 반환하는 건 드문 케이스.** Middleware는 `Response` 객체를 직접 반환할 수도 있지만, 일반 API 응답은 Route Handler를 쓰는 게 맞다.

---

**지난 글:** [cookies와 headers — 요청 정보 읽기](/posts/next-cookies-headers/)

**다음 글:** [Middleware matcher — 실행 범위 제어](/posts/next-middleware-matcher/)

<br>
읽어주셔서 감사합니다. 😊
