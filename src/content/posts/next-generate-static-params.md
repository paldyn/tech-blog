---
title: "generateStaticParams — 동적 라우트 정적 생성"
description: "Next.js의 generateStaticParams로 [slug] 같은 동적 라우트를 빌드 시점에 정적으로 사전 생성하는 방법을 배웁니다. 단순 사용법부터 중첩 동적 세그먼트, dynamicParams 제어, ISR과의 조합까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 9
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "generateStaticParams", "동적 라우트", "정적 생성", "ISR", "dynamicParams"]
featured: false
draft: false
---

[지난 글](/posts/next-static-vs-dynamic/)에서 정적 렌더링과 동적 렌더링의 차이를 살펴봤습니다. 이번에는 동적 라우트(`[slug]`, `[id]`)를 **빌드 시점에 정적으로 생성**하는 방법을 다룹니다. `generateStaticParams`는 Pages Router의 `getStaticPaths`를 대체하는 App Router 방식입니다.

## 왜 필요한가

`app/posts/[slug]/page.tsx` 같은 동적 라우트는 기본적으로 요청이 올 때 서버에서 렌더링됩니다. 하지만 블로그처럼 글 목록이 이미 알려져 있다면 빌드 시점에 모든 경로를 정적으로 생성해두는 것이 훨씬 빠릅니다. `generateStaticParams`는 이 경로 목록을 빌드 시점에 알려주는 함수입니다.

![generateStaticParams 빌드 프로세스](/assets/posts/next-generate-static-params-flow.svg)

## 기본 사용법

```tsx
// app/posts/[slug]/page.tsx

// 1. 빌드 시점에 경로 목록 반환
export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then((r) =>
    r.json()
  );
  return posts.map((post: { slug: string }) => ({
    slug: post.slug,
  }));
}

// 2. 정적으로 생성된 각 경로의 페이지 렌더링
export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetch(`https://api.example.com/posts/${slug}`).then(
    (r) => r.json()
  );
  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  );
}
```

빌드 시점에 `generateStaticParams`가 실행되고, 반환된 슬러그마다 `PostPage`가 렌더링되어 정적 HTML 파일이 생성됩니다.

## 중첩 동적 세그먼트와 코드 패턴

![generateStaticParams 패턴](/assets/posts/next-generate-static-params-code.svg)

여러 동적 세그먼트가 있을 때는 모든 조합을 반환합니다.

```tsx
// app/[category]/[slug]/page.tsx

export async function generateStaticParams() {
  const posts = await fetchAllPosts();
  return posts.map((post) => ({
    category: post.category, // 'nextjs', 'react', ...
    slug: post.slug,          // 'what-is-nextjs', ...
  }));
}
```

빌드 결과: `/nextjs/what-is-nextjs`, `/react/hooks-intro`, ... 등의 정적 파일이 생성됩니다.

## dynamicParams — 목록에 없는 경로 처리

빌드 이후 새 글이 추가됐을 때 어떻게 할지 `dynamicParams`로 제어합니다.

```tsx
// 기본값 true — 요청 시 동적으로 렌더링 후 캐시 (런타임 ISR)
export const dynamicParams = true;

// false — 목록에 없는 경로는 404 반환
export const dynamicParams = false;
```

`dynamicParams = true`(기본)는 새 글을 추가해도 재배포 없이 첫 방문 시 정적 파일이 생성되고 이후 CDN에 캐시됩니다. 이것이 **점진적 정적 생성**입니다.

## ISR과 조합

`generateStaticParams`와 `revalidate`를 함께 쓰면 사전 생성 + 주기적 갱신이 됩니다.

```tsx
// app/posts/[slug]/page.tsx
export const revalidate = 3600; // 1시간마다 재검증

export async function generateStaticParams() {
  const posts = await fetchPosts();
  return posts.map(({ slug }) => ({ slug }));
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const post = await fetch(`/api/posts/${slug}`, {
    next: { revalidate: 3600, tags: [`post-${slug}`] },
  }).then((r) => r.json());

  return <Article post={post} />;
}
```

글 내용이 CMS에서 바뀌면 `revalidateTag(`post-${slug}`)`를 호출해 즉시 갱신할 수도 있습니다.

## generateMetadata와 함께 사용

SEO를 위해 `generateMetadata`도 함께 정의합니다.

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug); // React.cache로 중복 요청 제거
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      images: [post.coverImage],
    },
  };
}
```

`generateStaticParams`와 `generateMetadata` 모두 빌드 시점에 실행되며, 같은 `fetch` URL을 사용하면 Request Memoization으로 중복 요청이 제거됩니다.

---

**지난 글:** [정적 vs 동적 렌더링 심화](/posts/next-static-vs-dynamic/)

**다음 글:** [Streaming과 Suspense — 점진적 렌더링](/posts/next-streaming/)

<br>
읽어주셔서 감사합니다. 😊
