---
title: "loading.tsx와 error.tsx — 스트리밍과 에러 경계"
description: "Next.js App Router의 loading.tsx와 error.tsx로 로딩 상태와 에러를 우아하게 처리하는 방법을 배웁니다. Suspense 경계, 스켈레톤 UI, Error Boundary, not-found.tsx, global-error.tsx까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 8
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "loading", "error", "Suspense", "Error Boundary", "스켈레톤"]
featured: false
draft: false
---

[지난 글](/posts/next-route-segment-config/)에서 세그먼트별 렌더링 방식을 설정하는 방법을 배웠습니다. 이번에는 App Router가 제공하는 **로딩 UI와 에러 처리 파일 컨벤션**—`loading.tsx`와 `error.tsx`—을 다룹니다. 이 두 파일은 React의 Suspense와 Error Boundary를 파일 시스템 기반으로 쉽게 사용하게 해줍니다.

## loading.tsx — 자동 Suspense 래핑

폴더에 `loading.tsx`를 추가하면 Next.js가 해당 폴더의 `page.tsx`를 자동으로 `<Suspense>`로 감쌉니다.

![loading.tsx와 error.tsx 계층 구조](/assets/posts/next-loading-error-ui-hierarchy.svg)

페이지가 async 데이터 페칭으로 지연되는 동안 `loading.tsx`의 내용이 즉시 표시됩니다.

```tsx
// app/blog/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-800" />
      <div className="h-4 w-full animate-pulse rounded bg-gray-800" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-gray-800" />
    </div>
  );
}
```

```tsx
// app/blog/page.tsx
export default async function BlogPage() {
  const posts = await getPosts(); // 이 동안 loading.tsx가 표시됨
  return <PostList posts={posts} />;
}
```

## 세분화된 Suspense 경계

![로딩 UI 패턴 — 스켈레톤과 Suspense](/assets/posts/next-loading-error-ui-skeleton.svg)

`loading.tsx`는 페이지 전체를 감쌉니다. 페이지의 **특정 섹션만** 로딩 상태를 보여주려면 컴포넌트 레벨에서 직접 `<Suspense>`를 사용합니다.

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Suspense fallback={<StatCardSkeleton />}>
        <StatCards />  {/* 독립적으로 로딩 */}
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />  {/* 독립적으로 로딩 */}
      </Suspense>
    </div>
  );
}
```

각 섹션이 병렬로 로딩되며, 완료되는 순서대로 스트리밍됩니다.

## error.tsx — Error Boundary

`error.tsx`는 React Error Boundary를 파일 컨벤션으로 구현합니다. 같은 폴더의 `page.tsx`나 자식 컴포넌트에서 발생한 에러를 포착합니다.

```tsx
// app/blog/error.tsx
'use client'; // Error Boundary는 클라이언트 컴포넌트 필수

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div>
      <h2>문제가 발생했습니다</h2>
      <button onClick={reset}>다시 시도</button>
    </div>
  );
}
```

`reset` 함수를 호출하면 해당 라우트 세그먼트를 다시 렌더링합니다. `error.tsx`는 **같은 레벨의 `layout.tsx` 에러는 포착하지 못합니다.** 레이아웃 에러를 처리하려면 상위 폴더의 `error.tsx`를 써야 합니다.

## not-found.tsx — 404 처리

`notFound()` 함수를 호출하거나 URL이 어떤 라우트와도 매칭되지 않을 때 `not-found.tsx`가 렌더링됩니다.

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation';

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) notFound(); // not-found.tsx 렌더링

  return <article>{post.content}</article>;
}
```

```tsx
// app/blog/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h2>포스트를 찾을 수 없습니다</h2>
      <p>삭제되었거나 URL이 잘못됐습니다.</p>
    </div>
  );
}
```

## global-error.tsx — 루트 레이아웃 에러

`app/global-error.tsx`는 루트 레이아웃에서 발생한 에러를 처리합니다. `<html>`과 `<body>`를 포함해야 합니다.

```tsx
// app/global-error.tsx
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h1>심각한 오류 발생</h1>
        <button onClick={reset}>앱 다시 시작</button>
      </body>
    </html>
  );
}
```

---

**지난 글:** [라우트 세그먼트 설정 — dynamic, revalidate, runtime](/posts/next-route-segment-config/)

**다음 글:** [병렬 라우트와 인터셉팅 라우트 — 모달과 슬롯](/posts/next-parallel-intercepting-routes/)

<br>
읽어주셔서 감사합니다. 😊
