---
title: "app/ 디렉토리의 특수 파일들 — layout, page, loading, error"
description: "Next.js App Router에서 예약된 특수 파일 이름과 각 파일의 역할, 렌더링 계층 구조를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 5
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "App Router", "layout", "page", "loading", "error"]
featured: false
draft: false
---

[지난 글](/posts/next-project-structure/)에서 `app/` 폴더 안에 어떤 파일이 있어야 URL로 매핑되는지 간략히 살펴봤습니다. 이번 글에서는 App Router가 인식하는 **특수 파일 이름**들을 하나씩 상세히 다룹니다.

## 특수 파일 목록

![app/ 디렉토리 특수 파일](/assets/posts/next-special-files-overview.svg)

Next.js는 `app/` 폴더 안에서 특정 이름을 가진 파일을 자동으로 인식합니다. 이름이 정해져 있고, 역할도 정해져 있습니다. 그 외 파일은 URL 라우팅에 관여하지 않습니다.

## page.tsx — 라우트의 핵심

```tsx
// app/about/page.tsx → /about URL
export default function AboutPage() {
  return <h1>회사 소개</h1>;
}
```

`page.tsx`는 특정 URL 경로에 접근했을 때 렌더링되는 컴포넌트를 export합니다. 이 파일이 없으면 해당 폴더는 라우트로 처리되지 않습니다.

## layout.tsx — 공유 래퍼

```tsx
// app/layout.tsx — 루트 레이아웃
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
```

`layout.tsx`는 같은 폴더와 그 하위 모든 라우트를 감쌉니다. 라우트 이동 시에도 **컴포넌트가 언마운트되지 않으므로** 상태(예: 검색창 입력값)가 유지됩니다. 이것이 Pages Router의 `_app.tsx`와 다른 점입니다.

루트 `app/layout.tsx`는 반드시 `<html>`과 `<body>` 태그를 포함해야 합니다.

## loading.tsx — 자동 Suspense 래핑

```tsx
// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return <Skeleton />;
}
```

`loading.tsx`를 만들면 Next.js가 자동으로 `<Suspense>` 경계를 설정합니다. 같은 폴더의 `page.tsx`가 데이터를 패칭하는 동안 `loading.tsx`의 UI가 먼저 보입니다. 별도의 `<Suspense>` 코드 작성 없이도 스트리밍 렌더링이 가능한 이유입니다.

## error.tsx — 에러 경계

```tsx
// app/dashboard/error.tsx
'use client'; // 반드시 클라이언트 컴포넌트

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>오류가 발생했습니다.</h2>
      <p>{error.message}</p>
      <button onClick={reset}>다시 시도</button>
    </div>
  );
}
```

`error.tsx`는 **반드시 `'use client'` 지시어**가 있어야 합니다. `reset` 함수를 통해 에러 상태를 초기화하고 컴포넌트를 다시 렌더링할 수 있기 때문입니다. 서버에서는 이 상호작용이 불가능합니다.

## not-found.tsx — 404 처리

```tsx
// app/not-found.tsx
export default function NotFound() {
  return <h1>페이지를 찾을 수 없습니다.</h1>;
}
```

서버 컴포넌트에서 `notFound()` 함수를 호출하거나, URL이 어떤 라우트와도 매칭되지 않을 때 표시됩니다.

```tsx
import { notFound } from 'next/navigation';

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound(); // not-found.tsx 렌더링
  return <article>{post.content}</article>;
}
```

## layout vs template

![컴포넌트 렌더링 계층 구조](/assets/posts/next-special-files-hierarchy.svg)

`template.tsx`는 `layout.tsx`와 구조가 동일하지만 동작이 다릅니다.

| | layout.tsx | template.tsx |
|---|---|---|
| 라우트 이동 시 | 언마운트 없이 유지 | 새 인스턴스 생성 |
| 상태 보존 | ✅ | ❌ |
| 사용 사례 | 내비게이션, 사이드바 | 입장 애니메이션, 조회수 트래킹 |

## route.ts — API 엔드포인트

```ts
// app/api/users/route.ts
export async function GET(request: Request) {
  const users = await db.user.findMany();
  return Response.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = await db.user.create({ data: body });
  return Response.json(user, { status: 201 });
}
```

`route.ts`는 HTTP 메서드 이름으로 함수를 export합니다. `page.tsx`와 같은 폴더에 공존할 수 없으니 주의하세요.

---

**지난 글:** [Next.js 프로젝트 구조 완전 이해](/posts/next-project-structure/)

**다음 글:** [파일 기반 라우팅 완전 정복](/posts/next-file-based-routing/)

<br>
읽어주셔서 감사합니다. 😊
