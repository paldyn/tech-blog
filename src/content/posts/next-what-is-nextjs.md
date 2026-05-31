---
title: "Next.js란 무엇인가 — React 위의 풀스택 프레임워크"
description: "Next.js가 해결하는 문제, 핵심 기능, 그리고 React와의 관계를 명확하게 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 1
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "React", "SSR", "SSG", "풀스택"]
featured: false
draft: false
---

웹 개발을 하다 보면 React만으로는 채워지지 않는 빈자리가 생깁니다. SEO를 위한 서버 렌더링, 이미지 최적화, 파일 기반 라우팅, API 서버 통합… 이 모든 것을 직접 구성하려면 Webpack 설정부터 시작해 수십 가지 라이브러리를 조합해야 합니다. Next.js는 바로 그 빈자리를 채워주는 **React 기반 풀스택 프레임워크**입니다.

## Next.js가 해결하는 문제

순수 React(CRA, Vite 등)는 **클라이언트 사이드 렌더링(CSR)** 방식으로 동작합니다. 브라우저가 빈 HTML을 받아 JavaScript를 실행한 뒤 화면을 그립니다. 이 구조는 빠른 개발 경험을 주지만 두 가지 약점이 있습니다.

1. **SEO 불리**: 검색 크롤러가 빈 HTML을 색인하면 콘텐츠가 누락될 수 있습니다.
2. **초기 로딩 지연**: 모든 JS가 다운로드·파싱·실행돼야 첫 화면이 나타납니다(FCP 지연).

Next.js는 서버에서 HTML을 미리 생성해 보내는 **서버 사이드 렌더링(SSR)** 과 빌드 타임에 정적 파일을 만드는 **정적 사이트 생성(SSG)** 을 React에 덧붙임으로써 이 두 문제를 해결합니다.

![Next.js 아키텍처 개요](/assets/posts/next-what-is-nextjs-overview.svg)

## React와 Next.js의 관계

Next.js는 React를 *대체*하지 않습니다. React가 **UI 레이어**라면 Next.js는 그 위에 올라서는 **애플리케이션 레이어**입니다. React의 컴포넌트 모델·훅·상태 관리는 그대로 사용하면서, Next.js가 라우팅·렌더링 전략·빌드 최적화를 담당합니다.

```
React (컴포넌트·훅)
  └─ Next.js (라우팅·렌더링·최적화)
        └─ Node.js / Edge Runtime (실행 환경)
```

이 구조 덕분에 React 개발자라면 기존 지식을 그대로 활용하면서 프레임워크가 제공하는 최적화를 누릴 수 있습니다.

## 핵심 기능 한눈에 보기

![Next.js 핵심 기능](/assets/posts/next-what-is-nextjs-features.svg)

### 1. 파일 기반 라우팅

`app/` 디렉토리의 폴더·파일 구조가 곧 URL입니다. `app/blog/[slug]/page.tsx` 파일 하나를 만들면 `/blog/:slug` 라우트가 자동 생성됩니다. 라우터 설정 파일을 별도로 관리할 필요가 없습니다.

### 2. 하이브리드 렌더링

페이지마다 렌더링 전략을 다르게 설정할 수 있습니다. 메인 페이지는 SSG, 대시보드는 SSR, 댓글 영역은 CSR — 이 혼합이 한 프로젝트 안에서 가능합니다.

### 3. 내장 최적화

`next/image`는 자동 WebP 변환·지연 로딩·CLS(누적 레이아웃 이동) 방지를 처리하고, `next/font`는 구글 폰트를 FOUC(스타일 없는 텍스트 번쩍임) 없이 로드합니다.

### 4. Server Actions

서버에서만 실행되는 비동기 함수를 컴포넌트에서 직접 호출할 수 있습니다. 폼 제출, DB 쓰기, 이메일 발송 등의 서버 로직을 별도 API 엔드포인트 없이 처리합니다.

### 5. App Router vs Pages Router

Next.js 13부터 도입된 **App Router**(`app/`)는 React Server Components를 기반으로 하는 새 아키텍처입니다. 기존 **Pages Router**(`pages/`)도 여전히 지원되지만, 신규 프로젝트는 App Router를 권장합니다. 이 시리즈는 App Router를 중심으로 진행합니다.

## 언제 Next.js를 선택해야 할까

| 상황 | 추천 |
|------|------|
| SEO가 중요한 마케팅·블로그 사이트 | ✅ Next.js (SSG/SSR) |
| 대시보드·관리자 페이지 (SEO 불필요) | CRA/Vite도 충분, Next.js도 가능 |
| 풀스택 앱 (DB·인증·API 포함) | ✅ Next.js (Server Actions, Route Handlers) |
| React Native 모바일 앱 | ❌ Next.js는 웹 전용 |

## 버전 이야기

이 시리즈는 **Next.js 15** 기준으로 작성됩니다. Next.js 15는 React 19를 기본 지원하며 `fetch` 캐싱 동작이 14에서 바뀌었습니다(기본값이 `no-store`). 주요 변경 사항은 각 글에서 언급하겠습니다.

```bash
# 버전 확인
npx next --version

# 최신 버전으로 업그레이드
npm install next@latest react@latest react-dom@latest
```

Next.js가 어떤 문제를 풀기 위해 태어났는지, 그리고 어떤 무기를 갖고 있는지 파악했습니다. 다음 글에서는 프로젝트를 직접 설치하고 실행해 봅니다.

---

**다음 글:** [Next.js 프로젝트 시작하기 — 설치부터 첫 실행까지](/posts/next-project-setup/)

<br>
읽어주셔서 감사합니다. 😊
