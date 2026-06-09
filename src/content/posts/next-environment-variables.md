---
title: "환경 변수 완전 정복 — 서버·클라이언트 범위 이해하기"
description: "Next.js 환경 변수의 NEXT_PUBLIC_ 접두사, .env 파일 우선순위, 서버 전용 vs 클라이언트 노출 범위, TypeScript 타입 안전성까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 9
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "환경변수", "NEXT_PUBLIC", ".env", "서버시크릿", "보안", "TypeScript"]
featured: false
draft: false
---

[지난 글](/posts/next-userouter-navigation/)에서 클라이언트 컴포넌트에서 프로그래매틱 네비게이션을 구현하는 방법을 배웠다. 이번에는 데이터베이스 URL, API 키, 외부 서비스 엔드포인트 같은 설정값을 코드에 하드코딩하지 않고 안전하게 관리하는 **환경 변수** 시스템을 완전히 파악한다.

## 환경 변수란

환경 변수(Environment Variable)는 코드 외부에서 주입되는 설정값이다. DB 접속 정보나 API 키를 코드에 직접 쓰면 GitHub에 노출되는 순간 보안 사고가 발생할 수 있다. 환경 변수는 이 문제를 해결한다.

```bash
# 위험 — DB 비밀번호가 코드에 노출됨
const db = new Database("postgresql://user:mysecretpassword@localhost/mydb")

# 안전 — 환경 변수로 분리
const db = new Database(process.env.DATABASE_URL)
```

## 환경 변수 노출 범위 — 가장 중요한 개념

Next.js 환경 변수의 핵심 규칙은 단순하다.

**`NEXT_PUBLIC_` 접두사가 있으면** → 클라이언트(브라우저) 번들에 포함됨. 누구나 볼 수 있음.

**`NEXT_PUBLIC_` 접두사가 없으면** → 서버에서만 접근 가능. 브라우저에는 전달되지 않음.

![환경 변수 노출 범위](/assets/posts/next-environment-variables-scope.svg)

```bash
# .env.local 예시

# 서버 전용 (DB, API 시크릿)
DATABASE_URL="postgresql://user:pass@host/db"
JWT_SECRET="my-super-secret-key"
STRIPE_SECRET_KEY="sk_live_..."

# 클라이언트에 노출됨 (공개해도 되는 것만)
NEXT_PUBLIC_API_URL="https://api.example.com"
NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"
NEXT_PUBLIC_SITE_URL="https://example.com"
```

실수로 `NEXT_PUBLIC_DATABASE_URL`처럼 DB 비밀번호를 클라이언트에 노출하면 심각한 보안 문제가 된다. 이 규칙을 반드시 지키자.

## .env 파일 종류와 우선순위

![.env 파일 우선순위](/assets/posts/next-environment-variables-files.svg)

Next.js는 여러 `.env` 파일을 지원하며, 더 구체적인(우선순위가 높은) 파일이 덜 구체적인 파일을 덮어쓴다.

```
.env.local          # 개인 설정 (최우선, git 제외 필수)
.env.production     # 프로덕션 환경 (NODE_ENV=production)
.env.development    # 개발 환경 (NODE_ENV=development)
.env                # 모든 환경 기본값
```

```bash
# .env (공통 기본값 — git에 커밋 가능, 비밀값 금지)
NEXT_PUBLIC_SITE_NAME="My App"
LOG_LEVEL="info"

# .env.local (개인/로컬 설정 — git 제외)
DATABASE_URL="postgresql://localhost/myapp_dev"
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

`.env.local`은 팀원마다 다른 로컬 DB URL이나 개인 API 키를 저장한다. `.gitignore`에 이미 포함되어 있으니 실수로 커밋될 걱정은 없다.

## 컴포넌트에서 사용하기

```tsx
// Server Component — 서버 전용 변수 접근 가능
export default async function DatabaseStatus() {
  // process.env.DATABASE_URL 접근 가능 (서버에서만 실행)
  const isConnected = await checkDbConnection(process.env.DATABASE_URL!)
  return <span>DB: {isConnected ? '연결됨' : '오류'}</span>
}
```

```tsx
// Client Component — NEXT_PUBLIC_ 변수만 접근 가능
'use client'

export default function ApiStatus() {
  // NEXT_PUBLIC_ 이 있어야 클라이언트에서 접근 가능
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  return <span>API: {apiUrl}</span>
}
```

서버 전용 변수를 클라이언트 컴포넌트에서 사용하면 `undefined`가 된다. 런타임 오류보다는 조용히 실패하므로 주의해야 한다.

## TypeScript 타입 안전성

환경 변수는 기본적으로 `string | undefined` 타입이다. 필수 환경 변수가 없을 때 빌드 시점에 잡으려면 유효성 검사를 추가하는 것이 좋다.

```typescript
// src/lib/env.ts — 환경 변수 유효성 검사
function getEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`환경 변수 ${key}가 설정되지 않았습니다`)
  }
  return value
}

// 서버 시작 시 검증
export const env = {
  databaseUrl: getEnv('DATABASE_URL'),
  jwtSecret: getEnv('JWT_SECRET'),
  // 클라이언트 변수는 NEXT_PUBLIC_ 포함
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
}
```

또는 `zod`를 사용한 더 강력한 유효성 검사도 인기가 높다.

## Vercel 배포 시 환경 변수 설정

로컬의 `.env.local`은 Vercel에 자동으로 배포되지 않는다. Vercel 대시보드의 **Settings → Environment Variables**에서 직접 설정해야 한다. 개발/프리뷰/프로덕션 환경별로 다른 값을 설정할 수 있다.

```bash
# Vercel CLI로 환경 변수 추가
vercel env add DATABASE_URL production
```

---

**지난 글:** [useRouter로 프로그래밍 방식 네비게이션 구현하기](/posts/next-userouter-navigation/)

**다음 글:** [레이아웃 시스템 완전 해설 — 중첩 레이아웃과 상태 보존](/posts/next-layouts/)

<br>
읽어주셔서 감사합니다. 😊
