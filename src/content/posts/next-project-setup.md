---
title: "Next.js 프로젝트 시작하기 — create-next-app 완전 가이드"
description: "create-next-app으로 Next.js 프로젝트를 빠르게 생성하고, next.config.ts와 핵심 패키지 설정까지 완전 가이드합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 2
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "create-next-app", "프로젝트설정", "TypeScript", "Turbopack", "next.config"]
featured: false
draft: false
---

[지난 글](/posts/next-what-is-nextjs/)에서 Next.js가 React 위에서 어떤 역할을 하는지, 그리고 SSR/SSG/ISR/CSR 렌더링 방식에 대해 살펴봤다. 이번에는 실제 프로젝트를 시작하는 방법을 단계별로 알아본다.

## create-next-app으로 프로젝트 생성

Next.js 공식 CLI 도구인 `create-next-app`을 사용하면 TypeScript, ESLint, Tailwind CSS, App Router 등 현대 개발 환경을 한 번에 설정할 수 있다.

```bash
# npx 사용 (별도 설치 불필요)
npx create-next-app@latest my-app

# pnpm 사용 (권장 — 설치 속도 빠름)
pnpm create next-app@latest my-app

# yarn 사용
yarn create next-app my-app
```

![create-next-app 옵션과 설정](/assets/posts/next-project-setup-cli.svg)

명령을 실행하면 인터랙티브 질문이 나타난다. 권장 선택지는 다음과 같다.

| 질문 | 권장 선택 | 이유 |
|------|-----------|------|
| TypeScript? | Yes | 타입 안전성으로 런타임 오류 감소 |
| ESLint? | Yes | 코드 품질 자동 검사 |
| Tailwind CSS? | 선택적 | CSS-in-JS 없이 유틸리티 클래스 사용 |
| src/ directory? | Yes | 소스 파일과 설정 파일 분리 |
| App Router? | Yes | 최신 기능 모두 활용 |
| Turbopack? | Yes (Next.js 15+) | Rust 기반 고속 번들러 |
| import alias? | @/* | `@/components/Button` 형태로 import |

## 생성된 프로젝트 구조

```
my-app/
├── next.config.ts        # Next.js 설정
├── tsconfig.json         # TypeScript 설정
├── package.json          # 의존성 목록
├── .eslintrc.json        # ESLint 설정
├── .gitignore
├── public/               # 정적 파일 (favicon, 이미지)
└── src/
    └── app/
        ├── layout.tsx    # 루트 레이아웃
        ├── page.tsx      # 홈 페이지 (/)
        └── globals.css   # 전역 CSS
```

`app/` 디렉토리가 App Router의 진입점이다. `layout.tsx`는 모든 페이지를 감싸는 루트 레이아웃이고, `page.tsx`가 실제로 화면에 보이는 홈 페이지 컴포넌트다.

## package.json 스크립트

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

- `dev`: 개발 서버 시작 (hot reload, 에러 overlay 포함)
- `build`: 프로덕션 빌드 생성 (`.next/` 폴더)
- `start`: 프로덕션 빌드 서버 실행 (build 후 실행)
- `lint`: ESLint 검사

## next.config.ts 핵심 설정

![next.config.ts 주요 옵션](/assets/posts/next-project-setup-config.svg)

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // React Strict Mode — 개발 중 이중 렌더링으로 사이드이펙트 감지
  reactStrictMode: true,

  // 외부 이미지 허용 도메인 설정
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // 실험적 기능 (PPR, 부분 사전 렌더링)
  experimental: {
    ppr: true,
  },
}

export default nextConfig
```

`reactStrictMode: true`는 개발 환경에서 컴포넌트를 두 번 렌더링하여 사이드이펙트를 발견하게 도와준다. 프로덕션에서는 한 번만 렌더링되므로 영향이 없다.

## 개발 서버 실행과 첫 화면

```bash
cd my-app
pnpm dev
```

터미널에 `Local: http://localhost:3000` 메시지가 뜨면 브라우저에서 확인할 수 있다. 파일을 수정하면 저장 즉시 브라우저가 자동으로 갱신된다(Hot Module Replacement).

## 수동 설치 방법

`create-next-app` 없이 직접 설치할 수도 있다.

```bash
mkdir my-app && cd my-app
pnpm init
pnpm add next react react-dom
pnpm add -D typescript @types/node @types/react @types/react-dom
```

그다음 `package.json`에 스크립트를 추가하고 `app/layout.tsx`와 `app/page.tsx`를 직접 작성하면 된다. `create-next-app`이 이 과정을 자동화해 주는 것이므로, 내부 동작을 이해하고 싶을 때 한 번 해볼 만하다.

## Node.js 버전 요구사항

Next.js 14/15는 Node.js **18.17 이상**을 요구한다. `node -v`로 버전을 확인하고, 낮으면 nvm이나 n으로 업그레이드한다.

```bash
node -v        # v18.17.0 이상이어야 함
nvm use 20     # nvm이 있다면 최신 LTS로 전환
```

---

**지난 글:** [Next.js란 무엇인가 — React를 넘어선 풀스택 프레임워크](/posts/next-what-is-nextjs/)

**다음 글:** [App Router vs Pages Router — 무엇을 선택해야 할까](/posts/next-app-vs-pages-router/)

<br>
읽어주셔서 감사합니다. 😊
