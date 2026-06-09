---
title: "App Router vs Pages Router — 무엇을 선택해야 할까"
description: "Next.js App Router와 Pages Router의 차이점, 마이그레이션 전략, 각 방식의 장단점을 코드 예시와 함께 완전 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 3
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "AppRouter", "PagesRouter", "라우터비교", "마이그레이션", "ServerComponents"]
featured: false
draft: false
---

[지난 글](/posts/next-project-setup/)에서 create-next-app으로 프로젝트를 생성하는 방법을 알아봤다. 설치 중 "App Router를 사용할까요?"라는 질문이 나왔는데, 이번에는 App Router와 Pages Router가 정확히 어떻게 다른지 깊이 파고들어 본다.

## 두 라우터의 등장 배경

Next.js는 2016년 출시 이래 `pages/` 디렉토리 기반의 라우팅을 사용해 왔다. 이를 **Pages Router**라고 부른다. 그러다 2022년 Next.js 13에서 `app/` 디렉토리 기반의 **App Router**가 실험적으로 도입됐고, Next.js 14에서 안정화됐다.

App Router가 나온 핵심 이유는 **React Server Components(RSC)** 지원이다. RSC는 서버에서만 실행되는 컴포넌트로, 클라이언트 번들 크기를 줄이고 서버 리소스를 직접 접근할 수 있게 한다. Pages Router는 RSC를 제대로 지원하지 못하기 때문에 App Router가 탄생했다.

![App Router vs Pages Router 비교표](/assets/posts/next-app-vs-pages-compare.svg)

## 코드로 보는 차이

데이터를 페칭하는 코드를 비교해 보자.

**Pages Router 방식**:

```tsx
// pages/blog/[slug].tsx
import { GetStaticProps } from 'next'

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const post = await fetchPost(params!.slug as string)
  return { props: { post }, revalidate: 3600 }
}

export default function BlogPost({ post }: { post: Post }) {
  return <article>{post.title}</article>
}
```

**App Router 방식**:

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPost(
  { params }: { params: { slug: string } }
) {
  const post = await fetchPost(params.slug) // async/await 직접 사용
  return <article>{post.title}</article>
}
```

App Router에서는 `getStaticProps`나 `getServerSideProps` 같은 특수 함수가 없다. 컴포넌트 자체가 `async` 함수가 되어 데이터를 직접 가져온다. 훨씬 직관적이다.

## 파일 구조 비교

![라우팅 파일 구조 비교](/assets/posts/next-app-vs-pages-routing.svg)

Pages Router에서는 `pages/` 아래의 **파일명**이 URL이 됐다. `pages/blog/[slug].tsx` → `/blog/:slug`. App Router에서는 `app/` 아래의 **폴더명**이 URL 세그먼트가 되고, 폴더 안의 `page.tsx`가 실제 UI를 담당한다.

## 주요 차이점 정리

**Server Components 기본값**: App Router에서 모든 컴포넌트는 기본이 Server Component다. `'use client'` 없이도 서버에서 실행된다. Pages Router에서는 모든 컴포넌트가 클라이언트 컴포넌트였다.

**레이아웃 중첩**: App Router는 `layout.tsx` 파일로 중첩 레이아웃을 자연스럽게 표현한다. Pages Router의 `_app.tsx`는 단일 전역 래퍼만 지원해 복잡한 중첩 레이아웃을 구현하기 어려웠다.

**데이터 페칭**: Pages Router의 `getServerSideProps`, `getStaticProps`, `getStaticPaths`가 App Router에서는 사라졌다. 대신 `fetch()` 옵션(`cache`, `next.revalidate`)으로 캐싱 전략을 컴포넌트 단위로 제어한다.

**특수 파일**: App Router는 `loading.tsx`, `error.tsx`, `not-found.tsx` 등 특수 파일로 로딩/에러 상태를 선언적으로 처리한다.

**Server Actions**: App Router에서만 사용 가능한 기능으로, 폼 제출을 서버 함수로 직접 처리한다.

## Pages Router를 계속 써도 될까

공식 문서는 **신규 프로젝트에 App Router를 권장**한다. 하지만 Pages Router가 deprecated(지원 종료)된 것은 아니다. 기존 Pages Router 프로젝트는 계속 동작하며, Next.js팀은 오랫동안 유지보수할 계획이다.

레거시 프로젝트를 유지보수하는 경우라면 Pages Router를 그대로 써도 무방하다. 단, 새로운 기능(PPR, Server Actions 등)은 App Router에서만 추가되므로 장기적으로는 마이그레이션이 유리하다.

## 두 라우터 공존 (점진적 마이그레이션)

Next.js 13+에서는 `app/`와 `pages/`를 **동시에 사용**할 수 있다. 일부 경로는 App Router, 나머지는 Pages Router로 운영하면서 점진적으로 마이그레이션할 수 있다.

```bash
my-app/
├── app/           # 새 페이지는 App Router로
│   └── dashboard/ page.tsx
└── pages/         # 기존 페이지는 Pages Router 유지
    └── about.tsx
```

같은 경로가 `app/`과 `pages/` 양쪽에 있으면 `app/`이 우선한다.

## 결론

신규 프로젝트라면 **App Router**를 선택하는 것이 옳다. Server Components, 중첩 레이아웃, Server Actions, Streaming, PPR 등 현재와 미래의 모든 Next.js 기능은 App Router 중심으로 발전한다. 이 시리즈도 App Router를 기준으로 진행한다.

---

**지난 글:** [Next.js 프로젝트 시작하기 — create-next-app 완전 가이드](/posts/next-project-setup/)

**다음 글:** [Next.js 프로젝트 구조 완전 해설](/posts/next-project-structure/)

<br>
읽어주셔서 감사합니다. 😊
