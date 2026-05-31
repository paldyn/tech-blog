---
title: "Next.js 프로젝트 구조 완전 이해"
description: "src/app/ 중심의 Next.js 프로젝트 디렉토리 구조와 파일 배치 전략을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "프로젝트 구조", "디렉토리", "App Router"]
featured: false
draft: false
---

[지난 글](/posts/next-app-vs-pages-router/)에서 App Router를 선택해야 하는 이유를 확인했습니다. 이번에는 실제 프로젝트 디렉토리 구조를 파헤쳐, 어떤 폴더와 파일이 어떤 역할을 하는지 알아봅니다.

## 최상위 구조

![Next.js 프로젝트 디렉토리 구조](/assets/posts/next-project-structure-tree.svg)

최상위에는 크게 **소스 코드**(`src/`), **정적 파일**(`public/`), **설정 파일들**이 놓입니다.

### src/ 디렉토리

`src/` 디렉토리를 사용하면 설정 파일(`next.config.ts`, `tsconfig.json` 등)과 소스 코드가 분리돼 프로젝트 루트가 깔끔해집니다. create-next-app 설치 시 `src/` 사용 여부를 물어보는데, 특별한 이유가 없다면 **Yes**를 권장합니다.

```
src/
├── app/          # App Router 라우트 + 특수 파일
├── components/   # 재사용 UI 컴포넌트
├── lib/          # 유틸리티, DB 연결, 서드파티 초기화
└── types/        # TypeScript 타입 정의
```

### app/ 디렉토리

`app/`이 App Router의 핵심입니다. 이 안의 **폴더 구조가 곧 URL 경로**가 됩니다. 단, 라우트로 처리되려면 반드시 `page.tsx`(또는 `.js`, `.jsx`, `.mdx`)가 존재해야 합니다.

```
app/
├── layout.tsx        → 모든 페이지에 공통 적용되는 루트 레이아웃
├── page.tsx          → / 경로
├── globals.css       → 전역 스타일
├── blog/
│   ├── layout.tsx    → /blog/* 에만 적용되는 중첩 레이아웃
│   ├── page.tsx      → /blog 경로
│   └── [slug]/
│       └── page.tsx  → /blog/:slug 경로
└── api/
    └── hello/
        └── route.ts  → /api/hello API 엔드포인트
```

### public/ 디렉토리

`public/` 폴더의 파일은 빌드 결과물에 그대로 포함되며, **파일 이름이 곧 URL**이 됩니다.

```
public/images/logo.png → /images/logo.png 으로 직접 접근
```

`next/image`를 사용하면 `public/` 이미지를 최적화해서 서빙합니다.

## 설정 파일들

| 파일 | 역할 |
|------|------|
| `next.config.ts` | Next.js 프레임워크 설정 |
| `tsconfig.json` | TypeScript 컴파일 설정 |
| `tailwind.config.ts` | Tailwind CSS 설정 |
| `.env.local` | 로컬 환경 변수 (git 제외) |
| `eslint.config.mjs` | ESLint 규칙 설정 |

`.env.local`은 민감한 API 키·DB 접속 정보를 담는 파일입니다. 절대 git에 커밋하면 안 됩니다. `.gitignore`에 이미 포함돼 있지만 한 번 더 확인하는 습관을 들이세요.

## 파일 콜로케이션 전략

![파일 콜로케이션 전략](/assets/posts/next-project-structure-colocation.svg)

App Router의 중요한 특성 중 하나는 `app/` 폴더 안에 **어떤 파일을 놓아도 URL로 노출되지 않는다**는 점입니다. `page.tsx`, `layout.tsx` 같은 **특수 파일만** URL에 매핑됩니다.

이를 활용해 라우트 전용 컴포넌트를 해당 라우트 폴더 안에 같이 배치(**콜로케이션**)할 수 있습니다.

```tsx
// app/blog/PostCard.tsx — URL로 접근 불가. blog 전용 컴포넌트
export function PostCard({ title, excerpt }: PostCardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>{excerpt}</p>
    </div>
  );
}
```

```tsx
// app/blog/page.tsx — /blog URL에 매핑됨
import { PostCard } from './PostCard';

export default function BlogPage() {
  return <div>{/* PostCard 사용 */}</div>;
}
```

## 권장 components/ 구조

공유 컴포넌트는 `src/components/`에 두되, 내부를 역할별로 나누면 관리하기 편합니다.

```
components/
├── ui/           # 버튼, 인풋 등 원자 단위 UI
│   ├── Button.tsx
│   └── Input.tsx
├── layout/       # 헤더, 푸터, 사이드바
│   └── Header.tsx
└── features/     # 비즈니스 로직 포함 복합 컴포넌트
    └── AuthForm.tsx
```

이 구조는 Atomic Design 원칙과 유사합니다. 프로젝트 규모에 맞게 조정하면 됩니다.

## lib/ 디렉토리 활용

```
lib/
├── db.ts         # Prisma / 데이터베이스 클라이언트
├── auth.ts       # NextAuth 설정
├── utils.ts      # 범용 유틸리티 함수
└── validations.ts # Zod 스키마
```

서버 전용 코드(DB 연결 등)를 `lib/`에 배치하면, 클라이언트 컴포넌트에서 실수로 import하더라도 Next.js가 경고를 통해 잡아줍니다.

---

**지난 글:** [App Router vs Pages Router — 무엇을 선택해야 할까](/posts/next-app-vs-pages-router/)

**다음 글:** [app/ 디렉토리의 특수 파일들 — layout, page, loading, error](/posts/next-special-files/)

<br>
읽어주셔서 감사합니다. 😊
