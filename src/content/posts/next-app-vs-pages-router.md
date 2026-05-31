---
title: "App Router vs Pages Router — 무엇을 선택해야 할까"
description: "Next.js의 두 라우팅 시스템을 비교하고, 어떤 상황에서 무엇을 선택해야 하는지 명확히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "App Router", "Pages Router", "라우팅"]
featured: false
draft: false
---

[지난 글](/posts/next-project-setup/)에서 프로젝트를 생성할 때 "App Router를 사용하겠습니까?" 질문에 Yes를 선택했습니다. 이번 글에서는 **왜** 그 선택을 해야 하는지, 그리고 App Router와 Pages Router가 어떻게 다른지 상세히 비교합니다.

## 두 라우터의 역사

Next.js는 처음부터 `pages/` 디렉토리를 기반으로 한 **Pages Router**로 라우팅을 처리했습니다. 이 방식은 직관적이고 안정적이었지만, React Server Components라는 새로운 패러다임을 수용하기 어려운 구조였습니다.

Next.js 13에서 새로운 `app/` 디렉토리 기반 **App Router**가 실험적으로 도입됐고, 14에서 안정 버전이 됐습니다. 현재 Next.js 팀은 신규 기능을 App Router에만 추가하고 있습니다.

## 핵심 차이점

![App Router vs Pages Router 비교](/assets/posts/next-app-vs-pages-router-comparison.svg)

가장 큰 차이는 **기본 컴포넌트 유형**입니다.

- **Pages Router**: 모든 컴포넌트가 기본적으로 클라이언트에서 실행됩니다. 서버 데이터가 필요하면 `getServerSideProps`나 `getStaticProps` 같은 특수 함수를 페이지 파일에 export해야 합니다.
- **App Router**: 모든 컴포넌트가 기본적으로 **서버에서 실행**됩니다(React Server Components). 클라이언트 기능이 필요할 때만 파일 상단에 `'use client'` 지시어를 추가합니다.

## 데이터 패칭 방식 비교

![데이터 패칭 코드 비교](/assets/posts/next-app-vs-pages-router-code.svg)

App Router에서는 컴포넌트 자체를 `async` 함수로 만들고 그 안에서 직접 `await fetch()`를 호출합니다. 별도의 데이터 패칭 함수나 props 전달이 필요 없습니다.

```tsx
// app/posts/page.tsx — App Router
export default async function PostsPage() {
  const res = await fetch('https://api.example.com/posts');
  const posts = await res.json();

  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

```tsx
// pages/posts/index.tsx — Pages Router
export async function getServerSideProps() {
  const res = await fetch('https://api.example.com/posts');
  const posts = await res.json();
  return { props: { posts } };
}

export default function PostsPage({ posts }) {
  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

App Router 방식이 더 직관적이고 코드가 적습니다. 또한 서버 컴포넌트이므로 패칭 코드가 클라이언트 번들에 포함되지 않아 번들 크기가 줄어듭니다.

## App Router의 추가 이점

### 중첩 레이아웃

Pages Router는 `_app.tsx` 하나로만 전역 레이아웃을 관리했습니다. App Router는 각 라우트 세그먼트마다 `layout.tsx`를 둘 수 있어 **중첩 레이아웃**이 가능합니다.

```
app/
├── layout.tsx        # 전체 공통 레이아웃
├── (marketing)/
│   └── layout.tsx    # 마케팅 페이지 전용 레이아웃
└── dashboard/
    └── layout.tsx    # 대시보드 전용 레이아웃
```

### 서버 액션

Server Actions는 App Router 전용 기능입니다. 폼 제출·데이터 뮤테이션을 별도 API 라우트 없이 처리할 수 있습니다.

### 스트리밍 & Suspense

App Router는 `loading.tsx`와 `<Suspense>`를 활용한 스트리밍 렌더링을 기본 지원합니다. 느린 데이터 패칭이 있어도 빠른 부분부터 먼저 사용자에게 전달됩니다.

## 언제 Pages Router를 선택해야 할까

신규 프로젝트라면 **App Router를 선택**하는 것이 원칙입니다. Pages Router가 여전히 적합한 경우는 다음과 같습니다.

1. **기존 Pages Router 프로젝트 유지보수**: 마이그레이션 비용이 높은 경우 현 구조를 유지합니다.
2. **Next.js에 익숙하지 않은 팀**: Pages Router가 더 단순하게 느껴질 수 있습니다. 하지만 장기적으로 App Router 학습을 권장합니다.
3. **특정 서드파티 라이브러리 미지원**: 일부 라이브러리가 아직 App Router를 완전히 지원하지 않는 경우가 있습니다.

## 병행 사용

하나의 프로젝트에서 `pages/`와 `app/`을 동시에 사용할 수 있습니다. 마이그레이션 과도기에 유용합니다. 단, 같은 URL을 두 라우터가 모두 처리하면 App Router가 우선합니다.

이 시리즈는 전적으로 **App Router** 기준으로 진행합니다. Pages Router 관련 내용은 필요한 경우 비교 형태로만 언급합니다.

---

**지난 글:** [Next.js 프로젝트 시작하기 — 설치부터 첫 실행까지](/posts/next-project-setup/)

**다음 글:** [Next.js 프로젝트 구조 완전 이해](/posts/next-project-structure/)

<br>
읽어주셔서 감사합니다. 😊
