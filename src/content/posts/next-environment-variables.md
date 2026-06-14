---
title: "환경 변수 완전 정복 — .env 파일부터 NEXT_PUBLIC까지"
description: "Next.js에서 환경 변수를 안전하게 관리하는 방법을 정리합니다. 파일 우선순위, NEXT_PUBLIC_ 접두사, 서버/클라이언트 접근 범위, TypeScript 타입 선언까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 9
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "환경 변수", ".env", "NEXT_PUBLIC", "보안"]
featured: false
draft: false
---

[지난 글](/posts/next-userouter-navigation/)에서 코드로 페이지를 이동하는 방법을 익혔습니다. 이번에는 API 키, 데이터베이스 URL 같은 설정값을 코드에 하드코딩하지 않고 관리하는 **환경 변수** 시스템을 정리합니다.

## .env 파일 종류와 우선순위

![.env 파일 우선순위](/assets/posts/next-environment-variables-files.svg)

Next.js는 여러 `.env` 파일을 지원하며, **더 구체적인 파일이 일반 파일을 덮어씁니다.**

```
우선순위 (높음 → 낮음)
.env.local  >  .env.development (또는 .env.production)  >  .env
```

실제로 많이 쓰는 패턴은 다음과 같습니다.

```
.env              → 기본값 (공통 설정, git 추적 가능)
.env.local        → 로컬 개발 전용 비밀값 (.gitignore 필수)
.env.production   → 프로덕션 기본값 (시크릿 제외)
```

## NEXT_PUBLIC_ 접두사 — 클라이언트 노출 제어

환경 변수가 클라이언트 번들에 포함되는지 여부는 **변수 이름의 접두사**로 결정됩니다.

![서버 전용 vs 클라이언트 노출](/assets/posts/next-environment-variables-access.svg)

```env
# .env.local

# 서버에서만 접근 가능 (클라이언트에서는 undefined)
DATABASE_URL=postgres://user:pass@localhost/mydb
JWT_SECRET=supersecret

# 클라이언트·서버 모두 접근 가능 (빌드 시 번들에 인라인)
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### 규칙 요약

| 접두사 | 서버에서 접근 | 클라이언트에서 접근 | 번들 포함 |
|--------|-------------|-----------------|---------|
| 없음 | ✅ | ❌ | ❌ |
| `NEXT_PUBLIC_` | ✅ | ✅ | ✅ |

**`NEXT_PUBLIC_`에는 절대 비밀값을 넣지 마세요.** 클라이언트 번들에 문자열 그대로 포함되어 누구나 확인할 수 있습니다.

## 사용 방법

```tsx
// 서버 컴포넌트 (서버 전용 변수 접근 가능)
export default async function Page() {
  const db = await connectDb(process.env.DATABASE_URL!);
  return <div>{/* ... */}</div>;
}
```

```tsx
// 클라이언트 컴포넌트 (NEXT_PUBLIC_ 변수만 접근)
'use client';

export function ApiStatus() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  return <p>API: {apiUrl}</p>;
}
```

> `NEXT_PUBLIC_` 변수는 **빌드 타임에 인라인**됩니다. 런타임에 값을 변경해도 반영되지 않습니다. 재빌드가 필요합니다.

## TypeScript 타입 선언

`process.env.*`의 기본 타입은 `string | undefined`입니다. 서버 시작 시 필수 변수를 검증하면 런타임 에러를 예방할 수 있습니다.

```ts
// src/lib/env.ts
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
} as const;
```

또는 [t3-env](https://env.t3.gg/), [zod](https://zod.dev/) 같은 라이브러리로 스키마 기반 검증을 하면 더 안전합니다.

```ts
// src/lib/env.ts (zod 버전)
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NEXT_PUBLIC_API_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

## Vercel 배포 시 환경 변수

`.env.local`은 로컬 전용이라 배포 서버에 자동으로 올라가지 않습니다. Vercel에 배포할 때는 **프로젝트 설정 → Environment Variables** 탭에서 직접 추가해야 합니다.

- `Development`, `Preview`, `Production` 환경별로 다른 값을 설정할 수 있습니다.
- 변경 후 재배포해야 적용됩니다.

## .env.local을 gitignore에 추가하기

create-next-app으로 생성하면 `.gitignore`에 `.env*.local`이 이미 포함돼 있습니다. 수동으로 프로젝트를 구성한 경우 반드시 확인하세요.

```gitignore
# .gitignore
.env*.local
```

---

**지난 글:** [useRouter로 프로그래매틱 내비게이션 하기](/posts/next-userouter-navigation/)

**다음 글:** [Next.js 레이아웃 — 중첩 레이아웃과 루트 레이아웃](/posts/next-layouts/)

<br>
읽어주셔서 감사합니다. 😊
