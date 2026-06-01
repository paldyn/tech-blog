---
title: "동적 라우트 — [slug]로 무한한 URL 처리하기"
description: "Next.js App Router의 동적 라우트 세그먼트를 완전히 이해합니다. [param] 문법, params 비동기 접근, 중첩 동적 세그먼트, generateStaticParams를 이용한 정적 생성까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "동적 라우트", "params", "generateStaticParams", "App Router"]
featured: false
draft: false
---

[지난 글](/posts/next-component-composition/)에서 서버·클라이언트 컴포넌트를 올바르게 합성하는 방법을 배웠습니다. 이번에는 URL의 일부를 변수처럼 처리하는 **동적 라우트**를 살펴봅니다. 블로그 포스트, 상품 상세, 사용자 프로필처럼 수백·수천 개의 URL을 하나의 파일로 처리할 때 필수입니다.

## [param] 문법

대괄호로 폴더 이름을 감싸면 동적 세그먼트가 됩니다. `[slug]`는 `/blog/hello-world`에서 `hello-world` 부분을 캡처합니다.

![동적 라우트 params 흐름](/assets/posts/next-dynamic-routes-params.svg)

```
app/
└── blog/
    ├── page.tsx          → /blog
    └── [slug]/
        └── page.tsx      → /blog/[모든값]
```

## params는 비동기입니다 (Next.js 15+)

Next.js 15부터 `params`가 **Promise**로 변경됐습니다. `await`로 unwrap해야 합니다.

```tsx
// app/blog/[slug]/page.tsx
type Props = {
  params: Promise<{ slug: string }>;
};

export default async function BlogPost({ params }: Props) {
  const { slug } = await params; // ✅ await 필수
  const post = await getPost(slug);

  if (!post) notFound(); // 404 처리

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  );
}
```

## 중첩 동적 세그먼트

![동적 라우트 파일 구조와 URL 매핑](/assets/posts/next-dynamic-routes-structure.svg)

여러 단계의 동적 세그먼트를 중첩할 수 있습니다. `params`에 모든 세그먼트가 포함됩니다.

```tsx
// app/shop/[category]/[id]/page.tsx
type Props = {
  params: Promise<{ category: string; id: string }>;
};

export default async function ProductPage({ params }: Props) {
  const { category, id } = await params;
  // category = 'electronics', id = '42'
  const product = await getProduct(category, id);
  return <ProductDetail product={product} />;
}
```

`params`의 값은 항상 `string`입니다. 숫자 ID가 필요하면 `Number(id)` 또는 `parseInt(id, 10)`으로 변환하세요.

## generateStaticParams — 빌드 타임 사전 생성

동적 라우트 페이지를 빌드 시 미리 생성하려면 `generateStaticParams`를 export합니다.

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getAllPosts();

  return posts.map((post) => ({
    slug: post.slug, // { slug: 'hello-world' }, { slug: 'nextjs-tips' }, ...
  }));
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  return <article>{post.content}</article>;
}
```

`generateStaticParams`가 반환하지 않은 slug로 접근하면 기본적으로 동적 렌더링이 됩니다. `dynamicParams = false`를 설정하면 404를 반환합니다.

```tsx
// 목록에 없는 slug → 404
export const dynamicParams = false;
```

## searchParams — 쿼리 파라미터 접근

URL의 쿼리 파라미터(`?page=2&sort=asc`)는 `searchParams`로 접근합니다. 이것도 Next.js 15에서 Promise가 됐습니다.

```tsx
// /blog?page=2&sort=asc
type Props = {
  searchParams: Promise<{ page?: string; sort?: string }>;
};

export default async function BlogListPage({ searchParams }: Props) {
  const { page = '1', sort = 'desc' } = await searchParams;
  const posts = await getPosts({ page: Number(page), sort });
  return <PostList posts={posts} />;
}
```

`params`는 폴더 구조에서 오고, `searchParams`는 URL 쿼리 문자열에서 옵니다. 두 가지 모두 Page 컴포넌트에서만 접근할 수 있습니다(Layout에서는 불가).

---

**지난 글:** [서버·클라이언트 컴포넌트 합성 패턴](/posts/next-component-composition/)

**다음 글:** [Catch-all 라우트 — 가변 경로 세그먼트 처리](/posts/next-catch-all-routes/)

<br>
읽어주셔서 감사합니다. 😊
