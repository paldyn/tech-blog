---
title: "파일 기반 라우팅 — 폴더가 URL이 되는 마법"
description: "Next.js App Router의 파일 기반 라우팅을 완전 해설합니다. 정적 라우트, 동적 라우트([param]), 중첩 라우트, Link 컴포넌트 기초를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 6
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "파일기반라우팅", "동적라우트", "중첩라우트", "AppRouter", "라우팅"]
featured: false
draft: false
---

[지난 글](/posts/next-special-files/)에서 page.tsx, layout.tsx 등 특수 파일의 역할을 알아봤다. 이번에는 Next.js의 가장 큰 특징 중 하나인 **파일 기반 라우팅**의 동작 원리를 완전히 파고든다.

## 파일 기반 라우팅이란

전통적인 React SPA에서는 React Router 같은 라이브러리를 사용해 라우트를 직접 정의했다.

```tsx
// React Router 방식 — 직접 정의
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/blog" element={<Blog />} />
  <Route path="/blog/:slug" element={<BlogPost />} />
</Routes>
```

Next.js App Router는 이 설정 코드가 없다. `app/` 폴더 아래의 **폴더 구조**가 곧 URL 구조가 된다. 폴더 안에 `page.tsx`를 두면 그 경로가 공개 라우트가 된다.

![파일 기반 라우팅 기본](/assets/posts/next-file-based-routing-basics.svg)

## 정적 라우트

가장 단순한 형태다. 폴더명이 그대로 URL 경로가 된다.

```
app/page.tsx            → /
app/about/page.tsx      → /about
app/contact/page.tsx    → /contact
app/blog/page.tsx       → /blog
app/blog/tips/page.tsx  → /blog/tips
```

각 폴더 안에는 `page.tsx` 외에 해당 세그먼트에만 적용되는 `layout.tsx`, `loading.tsx` 등을 함께 둘 수 있다.

## 동적 라우트 — [param]

블로그 포스트, 상품 상세 페이지처럼 URL에 변하는 값이 있을 때 사용한다. 폴더명을 대괄호로 감싸면 동적 세그먼트가 된다.

```
app/blog/[slug]/page.tsx    → /blog/hello-world, /blog/my-post
app/users/[id]/page.tsx     → /users/123, /users/456
app/shop/[category]/[id]/   → /shop/electronics/42
```

`page.tsx`에서 `params` props를 통해 동적 세그먼트 값을 읽는다.

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPost({
  params,
}: {
  params: { slug: string }
}) {
  const post = await getPostBySlug(params.slug)
  return <article>{post.title}</article>
}
```

## 중첩 라우트와 레이아웃

폴더를 중첩하면 레이아웃도 자동으로 중첩된다. `app/blog/layout.tsx`는 `/blog` 하위의 모든 경로에 적용된다.

![중첩 라우팅 구조](/assets/posts/next-file-based-routing-nested.svg)

```tsx
// app/blog/layout.tsx — /blog, /blog/*, /blog/*/*에 모두 적용
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="blog-wrapper">
      <aside><BlogNav /></aside>
      <main>{children}</main>
    </div>
  )
}
```

## 라우트 그룹 — (folder)

URL에는 포함되지 않지만 **레이아웃을 공유**하거나 파일을 논리적으로 그룹화하고 싶을 때 사용한다. 폴더명을 소괄호로 감싸면 된다.

```
app/
├── (auth)/           # URL에 포함 안 됨
│   ├── layout.tsx    # 인증 화면용 레이아웃
│   ├── login/page.tsx   → /login
│   └── signup/page.tsx  → /signup
└── (main)/           # URL에 포함 안 됨
    ├── layout.tsx    # 메인 레이아웃 (Header + Footer)
    ├── page.tsx         → /
    └── about/page.tsx   → /about
```

로그인/회원가입 페이지에는 `Header`가 없어야 한다면, `(auth)` 그룹에 별도 레이아웃을 두어 깔끔하게 분리할 수 있다.

## 캐치올 라우트 — [...slug]

여러 세그먼트를 한 번에 받아야 할 때 사용한다. `params.slug`는 배열이 된다.

```
app/docs/[...path]/page.tsx → /docs/intro, /docs/a/b, /docs/a/b/c

// params.path = ['intro'] | ['a', 'b'] | ['a', 'b', 'c']
```

`[[...slug]]`처럼 이중 대괄호를 사용하면 세그먼트가 없는 경우(`/docs`)도 매칭된다.

## 라우트 충돌 방지

같은 URL 경로에 두 파일이 충돌하면 빌드 오류가 난다. 동적 라우트와 정적 라우트가 겹치는 경우 정적 라우트가 우선한다.

```
app/blog/page.tsx         → /blog (정적, 우선)
app/blog/[slug]/page.tsx  → /blog/any-post (동적)
```

`/blog` 경로는 동적 `[slug]`가 아닌 정적 `blog/page.tsx`가 처리한다.

---

**지난 글:** [App Router 특수 파일 완전 가이드](/posts/next-special-files/)

**다음 글:** [Link 컴포넌트로 페이지 이동하기](/posts/next-link-navigation/)

<br>
읽어주셔서 감사합니다. 😊
