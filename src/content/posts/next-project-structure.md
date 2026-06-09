---
title: "Next.js 프로젝트 구조 완전 해설"
description: "Next.js App Router 프로젝트의 디렉토리 구조를 완전 해설합니다. src/ 사용법, app/와 public/ 역할, components/lib/types/ 구성 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 4
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "프로젝트구조", "디렉토리", "AppRouter", "TypeScript", "아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/next-app-vs-pages-router/)에서 App Router와 Pages Router의 차이를 비교했다. 이번에는 App Router 기반 Next.js 프로젝트의 디렉토리 구조를 파고들어, 각 폴더와 파일이 무슨 역할을 하는지 완전히 파악한다.

## 최상위 파일과 폴더

```
my-app/
├── .next/              # 빌드 출력물 (git 제외)
├── node_modules/       # 의존성 (git 제외)
├── public/             # 정적 파일
├── src/                # 소스 코드
├── next.config.ts      # Next.js 설정
├── tsconfig.json       # TypeScript 설정
├── package.json        # 의존성 및 스크립트
├── .env.local          # 환경 변수 (git 제외)
└── .gitignore
```

`.next/` 폴더는 `next build`나 `next dev` 실행 시 자동으로 생성된다. 직접 수정하지 않으며, git에서 제외한다. 빌드 캐시와 서버 번들, 클라이언트 번들이 모두 여기에 들어간다.

## public/ 디렉토리

`public/`에 있는 파일은 웹 루트(`/`)에서 직접 접근된다. `public/logo.png`를 `<img src="/logo.png">`로 참조하는 방식이다. 단, 이미지는 `next/image`의 `<Image>` 컴포넌트를 통해 최적화하는 것이 권장된다.

```
public/
├── favicon.ico
├── robots.txt
├── sitemap.xml
└── images/
    └── og-default.jpg
```

![Next.js 프로젝트 디렉토리 구조](/assets/posts/next-project-structure-dirs.svg)

## src/ 디렉토리 사용 이유

`src/` 없이 `app/`을 프로젝트 루트에 두어도 동작한다. 하지만 `src/`를 사용하면 설정 파일(`next.config.ts`, `tsconfig.json`, `.env*`)과 실제 소스 코드를 명확히 분리할 수 있어 유지보수가 쉬워진다. `create-next-app` 설치 시 "src/ directory?" 질문에 Yes를 선택하면 자동으로 구성된다.

## src/app/ — App Router의 핵심

```
src/app/
├── layout.tsx          # 루트 레이아웃 (필수)
├── page.tsx            # 홈 페이지 (/)
├── globals.css         # 전역 CSS
├── (marketing)/        # 라우트 그룹 (URL에 영향 없음)
│   ├── about/
│   │   └── page.tsx    # /about
│   └── pricing/
│       └── page.tsx    # /pricing
├── blog/
│   ├── page.tsx        # /blog
│   └── [slug]/
│       └── page.tsx    # /blog/:slug
└── api/
    └── users/
        └── route.ts    # GET/POST /api/users
```

`app/` 안의 모든 파일이 라우트가 되는 것은 아니다. `page.tsx`와 `route.ts`만 공개 URL에 매핑된다. `layout.tsx`, `loading.tsx`, `error.tsx` 같은 특수 파일도 마찬가지로 URL에 노출되지 않는다. 일반 컴포넌트 파일(`components/Header.tsx`)을 `app/` 안에 두어도 URL로 접근할 수 없다.

## src/components/ — UI 컴포넌트

재사용 가능한 UI 컴포넌트를 모아두는 폴더다. 구조는 팀마다 다르지만 대표적인 패턴은 다음과 같다.

```
src/components/
├── ui/               # 기본 UI 원소 (Button, Input, Modal)
│   ├── Button.tsx
│   └── Input.tsx
├── layout/           # 레이아웃 관련 (Header, Footer, Sidebar)
│   ├── Header.tsx
│   └── Footer.tsx
└── features/         # 기능별 복합 컴포넌트
    └── blog/
        └── PostCard.tsx
```

## src/lib/ — 유틸리티와 서버 로직

비즈니스 로직, DB 클라이언트, 외부 API 호출 함수 등을 모아둔다.

```typescript
// src/lib/db.ts — Prisma 클라이언트 싱글턴
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const db = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

## src/types/ — TypeScript 타입 정의

전역적으로 공유되는 타입을 모아둔다.

```typescript
// src/types/index.ts
export interface Post {
  id: string
  title: string
  slug: string
  content: string
  publishedAt: Date
}

export interface User {
  id: string
  email: string
  role: 'admin' | 'user'
}
```

## 경로 별칭 설정 (@/*)

`tsconfig.json`에 경로 별칭을 설정하면 `../../../components/Button` 같은 복잡한 상대 경로 대신 `@/components/Button`을 사용할 수 있다.

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

이 설정이 있으면 아무 depth에서도 `import Button from '@/components/ui/Button'`으로 깔끔하게 import할 수 있다.

![요청 처리 흐름](/assets/posts/next-project-structure-flow.svg)

## 프로젝트 규모별 구조 전략

작은 프로젝트는 단순하게 시작하고, 규모가 커지면 기능별로 나누는 전략이 일반적이다. `src/features/` 폴더 아래에 인증(`auth/`), 블로그(`blog/`), 결제(`payment/`) 같이 도메인별로 컴포넌트·훅·타입을 묶어서 관리하면 유지보수가 훨씬 편해진다.

---

**지난 글:** [App Router vs Pages Router — 무엇을 선택해야 할까](/posts/next-app-vs-pages-router/)

**다음 글:** [App Router 특수 파일 완전 가이드](/posts/next-special-files/)

<br>
읽어주셔서 감사합니다. 😊
