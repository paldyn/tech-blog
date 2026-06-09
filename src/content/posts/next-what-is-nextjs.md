---
title: "Next.js란 무엇인가 — React를 넘어선 풀스택 프레임워크"
description: "Next.js가 React와 어떻게 다른지, App Router, SSR/SSG/ISR/CSR 렌더링 방식, 핵심 기능을 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 1
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "React", "SSR", "SSG", "AppRouter", "풀스택", "프레임워크"]
featured: false
draft: false
---

웹 프론트엔드를 공부하다 보면 어느 순간 "Next.js를 써야 한다"는 말을 자주 듣게 된다. React를 이미 아는 상태에서 Next.js를 처음 접하면 "이게 뭐가 다른 거지?" 하는 의문이 자연스럽게 떠오른다. 이 시리즈에서는 Next.js 14/15의 App Router를 기준으로, 개념부터 실전 배포까지 단계별로 완전 정복한다.

## Next.js란

Next.js는 Vercel이 개발하고 오픈소스로 운영하는 **React 기반 풀스택 웹 프레임워크**다. React가 UI를 만드는 라이브러리라면, Next.js는 그 위에 올라타서 라우팅·렌더링·데이터 페칭·이미지 최적화·배포까지 처리해 주는 프레임워크다.

![Next.js 아키텍처 레이어](/assets/posts/next-what-is-nextjs-overview.svg)

React만으로 SPA를 만들면 다음과 같은 문제가 생긴다. **SEO 취약**: 빈 HTML 껍데기에 JavaScript가 실행되어야 콘텐츠가 나타나므로 검색 엔진 크롤러가 내용을 제대로 읽지 못한다. **라우터 설정 직접 구성**: React Router나 TanStack Router를 별도로 설정해야 한다. **서버 사이드 기능 없음**: API 엔드포인트를 Express 같은 별도 서버로 분리해야 한다. Next.js는 이 모든 것을 약속된 파일 구조 하나로 해결한다.

## React와 Next.js의 관계

Next.js는 React를 **대체**하지 않는다. React의 컴포넌트 모델, JSX, Hooks, 상태 관리 방식을 그대로 사용하면서 **프레임워크 레이어**를 추가한다. Next.js 13+의 App Router에서 컴포넌트는 기본적으로 **Server Component**다. 서버에서만 실행되므로 `async/await`로 DB를 직접 쿼리하거나 비공개 API를 호출할 수 있다.

```tsx
// app/page.tsx — 기본이 Server Component
export default async function Page() {
  const users = await fetchUsers() // 서버에서 직접 DB 조회 가능
  return (
    <ul>
      {users.map(u => <li key={u.id}>{u.name}</li>)}
    </ul>
  )
}
```

`'use client'`를 파일 맨 위에 선언하면 브라우저에서 실행되는 클라이언트 컴포넌트가 된다. useState, useEffect 같은 브라우저 훅은 클라이언트 컴포넌트에서만 사용할 수 있다.

## 핵심 기능 요약

**파일 기반 라우팅**: `app/blog/[slug]/page.tsx` 파일을 만들면 `/blog/my-post` URL이 자동으로 생긴다. 라우터 설정 코드가 필요 없다.

**다양한 렌더링 방식**: 페이지마다 다른 렌더링 전략을 선택할 수 있다.

![Next.js 렌더링 방식 비교](/assets/posts/next-what-is-nextjs-rendering.svg)

- **SSR(Server-Side Rendering)**: 요청마다 서버에서 HTML을 생성해 반환한다. 로그인 후 개인화된 대시보드처럼 항상 최신 데이터가 필요한 페이지에 적합하다.
- **SSG(Static Site Generation)**: 빌드 시 미리 HTML을 생성한다. 블로그, 마케팅 페이지처럼 자주 바뀌지 않는 콘텐츠에 최적이다.
- **ISR(Incremental Static Regeneration)**: SSG의 속도와 SSR의 최신성을 결합한다. 설정한 시간마다 백그라운드에서 정적 페이지를 재생성한다.
- **CSR(Client-Side Rendering)**: `'use client'` + `useEffect`로 브라우저에서 데이터를 가져온다. 인터랙티브한 대시보드 위젯에 사용한다.

**이미지 최적화**: `next/image`의 `<Image>` 컴포넌트는 WebP/AVIF 변환, 지연 로딩, 레이아웃 시프트 방지를 자동으로 처리한다.

**폰트 최적화**: `next/font`를 사용하면 Google Fonts나 로컬 폰트를 레이아웃 시프트 없이 로드한다.

**API Route Handlers**: `app/api/users/route.ts` 파일 하나로 GET/POST/PUT/DELETE 엔드포인트를 만들 수 있다.

**Server Actions**: 폼 제출이나 데이터 변경을 서버 함수로 직접 처리한다. 별도 API 엔드포인트 없이 서버 로직을 실행할 수 있다.

**미들웨어**: 요청이 라우트에 도달하기 전에 인증, 리다이렉트, A/B 테스트 등을 처리한다.

## 언제 Next.js를 선택해야 할까

SEO가 중요한 콘텐츠 사이트(블로그, 마케팅, 커머스), 서버 사이드 렌더링이 필요한 동적 데이터, 풀스택 앱을 단일 코드베이스로 관리하고 싶을 때, Vercel에 쉽게 배포하고 싶을 때 Next.js를 적극 고려하자. 반대로 내부 관리자 도구처럼 SEO가 전혀 필요 없고 SPA로 충분하다면 Vite + React만으로도 충분할 수 있다.

## Next.js 버전 흐름

- **Next.js 1~8**: SSR과 파일 기반 라우팅(`pages/`) 도입
- **Next.js 9~12**: API Routes, Image 컴포넌트, Middleware 추가
- **Next.js 13**: App Router(`app/`) 실험적 도입, React Server Components 지원
- **Next.js 14**: App Router 안정화, Server Actions 정식 지원
- **Next.js 15**: Turbopack 기본 번들러, React 19 지원, 캐싱 정책 개선

이 시리즈는 Next.js 14/15 기준의 App Router를 중심으로 다룬다.

---

**다음 글:** [Next.js 프로젝트 시작하기 — create-next-app 완전 가이드](/posts/next-project-setup/)

<br>
읽어주셔서 감사합니다. 😊
