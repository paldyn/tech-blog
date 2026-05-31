---
title: "파일 기반 라우팅 완전 정복"
description: "Next.js App Router에서 폴더와 파일 이름이 URL로 변환되는 규칙, 동적 세그먼트, 라우트 그룹을 완벽하게 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 6
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "라우팅", "동적 라우트", "App Router"]
featured: false
draft: false
---

[지난 글](/posts/next-special-files/)에서 `app/` 안의 특수 파일 역할을 파악했습니다. 이번에는 그 폴더와 파일이 실제 URL 경로로 어떻게 변환되는지, App Router의 **파일 기반 라우팅** 규칙을 완전히 정리합니다.

## 기본 원리

Next.js에서 `app/` 폴더의 **디렉토리 이름**이 URL 경로 세그먼트가 됩니다. 해당 경로가 실제로 접근 가능하려면 그 폴더 안에 `page.tsx`(또는 `page.js`, `page.jsx`)가 있어야 합니다.

![파일 구조 → URL 매핑](/assets/posts/next-file-based-routing-map.svg)

```
app/page.tsx          →  /
app/about/page.tsx    →  /about
app/blog/page.tsx     →  /blog
app/blog/[slug]/page.tsx  →  /blog/:slug
```

## 세그먼트 유형

![라우트 세그먼트 유형](/assets/posts/next-file-based-routing-segments.svg)

### 정적 세그먼트

폴더 이름 그대로 URL에 반영됩니다.

```
app/products/page.tsx  →  /products
app/docs/intro/page.tsx  →  /docs/intro
```

### 동적 세그먼트 `[folder]`

대괄호로 감싼 폴더 이름은 **동적 파라미터**가 됩니다. `params` prop으로 값을 받을 수 있습니다.

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <h1>{slug}</h1>;
}
```

> Next.js 15부터 `params`가 **Promise**로 변경됐습니다. `await params`로 받아야 합니다.

### 캐치올 세그먼트 `[...folder]`

점 3개를 붙이면 여러 세그먼트를 **배열**로 받습니다.

```tsx
// app/docs/[...slug]/page.tsx
// /docs/a/b/c → params.slug = ['a', 'b', 'c']
export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  return <p>{slug.join('/')}</p>;
}
```

캐치올은 최소 1개 이상의 세그먼트를 요구합니다. `/docs` 자체는 매칭되지 않습니다.

### 선택적 캐치올 `[[...folder]]`

이중 대괄호를 사용하면 **0개도 허용**합니다.

```tsx
// app/[[...slug]]/page.tsx
// / 와 /a/b/c 모두 매칭
```

### 라우트 그룹 `(folder)`

괄호로 감싼 폴더는 **URL에 포함되지 않습니다.** 주로 레이아웃을 분리하거나 관련 라우트를 논리적으로 묶을 때 사용합니다.

```
app/
├── (marketing)/
│   ├── layout.tsx   ← 마케팅 전용 레이아웃
│   ├── page.tsx     → /
│   └── pricing/
│       └── page.tsx → /pricing
└── (app)/
    ├── layout.tsx   ← 앱 전용 레이아웃 (인증 필요)
    └── dashboard/
        └── page.tsx → /dashboard
```

`(marketing)`과 `(app)` 모두 URL에 나타나지 않으면서, 각각 다른 레이아웃을 가질 수 있습니다.

### 비공개 폴더 `_folder`

언더스코어로 시작하는 폴더는 라우팅 시스템에서 완전히 제외됩니다. `_components/`, `_utils/` 같이 라우트가 아닌 헬퍼 파일을 `app/` 내부에 두고 싶을 때 사용합니다.

## 중첩 라우트와 레이아웃

폴더가 중첩될수록 URL도 중첩되고, 각 레벨의 `layout.tsx`가 자동으로 중첩됩니다.

```
app/
├── layout.tsx          ← 전체 공통 레이아웃
└── blog/
    ├── layout.tsx      ← /blog/* 레이아웃 (루트 레이아웃 내부에 중첩)
    ├── page.tsx        → /blog
    └── [slug]/
        └── page.tsx   → /blog/:slug
```

`/blog/hello-world`에 접근하면 렌더 순서는:
1. `app/layout.tsx` (가장 바깥)
2. `app/blog/layout.tsx`
3. `app/blog/[slug]/page.tsx` (가장 안쪽)

## params 타입 자동 추론 팁

TypeScript를 사용한다면 `params` 타입을 제너릭으로 정확히 명시하는 습관을 들이세요.

```tsx
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { q } = await searchParams;
  // ...
}
```

`searchParams`는 URL 쿼리 스트링(`?q=nextjs`)을 받는 prop입니다. 이것도 Next.js 15에서 Promise로 바뀌었습니다.

---

**지난 글:** [app/ 디렉토리의 특수 파일들 — layout, page, loading, error](/posts/next-special-files/)

**다음 글:** [next/link로 페이지 이동하기](/posts/next-link-navigation/)

<br>
읽어주셔서 감사합니다. 😊
