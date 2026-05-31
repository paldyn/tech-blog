---
title: "Next.js 프로젝트 시작하기 — 설치부터 첫 실행까지"
description: "create-next-app으로 프로젝트를 만들고, 디렉토리 구조와 개발 서버를 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "create-next-app", "설치", "개발환경"]
featured: false
draft: false
---

[지난 글](/posts/next-what-is-nextjs/)에서 Next.js가 어떤 문제를 해결하는 프레임워크인지 살펴봤습니다. 이번에는 실제로 프로젝트를 만들어 개발 서버를 띄우는 과정을 단계별로 따라가 봅니다.

## 사전 요구사항

Next.js 15는 **Node.js 18.17 이상**을 요구합니다. 설치 전 버전을 확인하세요.

```bash
node -v   # v18.17.0 이상
npm -v    # 9.x 이상 권장
```

패키지 매니저는 npm·yarn·pnpm 중 편한 것을 사용할 수 있습니다. 이 시리즈는 **npm** 기준으로 진행하되, pnpm 명령도 병기합니다.

## create-next-app으로 프로젝트 생성

![create-next-app 설치 흐름](/assets/posts/next-project-setup-install.svg)

```bash
npx create-next-app@latest my-app
```

실행하면 다음과 같은 대화형 질문이 나타납니다.

```
Would you like to use TypeScript?          Yes
Would you like to use ESLint?              Yes
Would you like to use Tailwind CSS?        Yes (선택)
Would you like to use `src/` directory?   Yes
Would you like to use App Router?          Yes ← 반드시 Yes
Would you like to use Turbopack?           Yes
Would you like to customize the import alias? No
```

**App Router**를 `Yes`로 선택해야 이 시리즈에서 다루는 모든 예제가 동작합니다. `src/` 디렉토리 사용도 권장합니다 — 소스 코드와 설정 파일이 분리되어 프로젝트 루트가 깔끔해집니다.

## 프로젝트 구조 미리 보기

생성 직후 폴더 구조는 다음과 같습니다.

```
my-app/
├── src/
│   └── app/
│       ├── layout.tsx    # 루트 레이아웃
│       ├── page.tsx      # 홈 페이지 (/)
│       └── globals.css
├── public/               # 정적 파일
├── next.config.ts        # Next.js 설정
├── tsconfig.json
└── package.json
```

`app/` 안의 `page.tsx`가 `/` 경로를 담당하고, `layout.tsx`는 모든 페이지에 공통으로 감싸지는 루트 레이아웃입니다. 자세한 구조는 다음 글들에서 단계별로 다룹니다.

## 개발 서버 실행

```bash
cd my-app
npm run dev
```

터미널에 다음이 출력되면 성공입니다.

```
▲ Next.js 15.x.x (turbopack)
- Local:   http://localhost:3000
- Network: http://192.168.x.x:3000
✓ Starting...
✓ Ready in 832ms
```

브라우저에서 `http://localhost:3000`을 열면 Next.js 기본 환영 페이지가 나타납니다. **Turbopack**이 기본으로 활성화돼 있어 HMR(Hot Module Replacement) 속도가 Webpack 대비 훨씬 빠릅니다.

## 주요 npm 스크립트

![package.json 주요 스크립트](/assets/posts/next-project-setup-scripts.svg)

```json
{
  "scripts": {
    "dev":   "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint":  "next lint"
  }
}
```

`npm run build` → `npm run start` 순서로 실행하면 프로덕션 모드를 로컬에서 테스트할 수 있습니다. 빌드 결과물은 `.next/` 폴더에 생성됩니다.

## next.config.ts 살펴보기

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 여기에 설정 추가
};

export default nextConfig;
```

`next.config.ts`는 TypeScript로 작성할 수 있습니다(Next.js 15부터 기본). 이미지 도메인 허용, 리다이렉트 설정, 실험적 기능 활성화 등 프레임워크 동작을 제어하는 핵심 파일입니다.

## pnpm 사용자를 위한 참고

pnpm을 선호한다면 생성 명령을 다음으로 대체합니다.

```bash
pnpm create next-app@latest my-app
cd my-app
pnpm dev
```

모든 npm 명령을 `pnpm`으로 바꿔도 동작합니다.

---

**지난 글:** [Next.js란 무엇인가 — React 위의 풀스택 프레임워크](/posts/next-what-is-nextjs/)

**다음 글:** [App Router vs Pages Router — 무엇을 선택해야 할까](/posts/next-app-vs-pages-router/)

<br>
읽어주셔서 감사합니다. 😊
