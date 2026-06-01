---
title: "라우트 세그먼트 설정 — dynamic, revalidate, runtime"
description: "Next.js Route Segment Config로 각 페이지와 레이아웃의 렌더링 방식, 캐시 정책, 실행 런타임을 세밀하게 제어하는 방법을 배웁니다. dynamic, revalidate, runtime, maxDuration 옵션을 실전 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 7
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "route segment config", "dynamic", "revalidate", "runtime", "ISR"]
featured: false
draft: false
---

[지난 글](/posts/next-route-groups/)에서 라우트 그룹으로 URL에 영향 없이 레이아웃을 분리하는 방법을 배웠습니다. 이번에는 개별 페이지와 레이아웃의 **렌더링 방식, 캐시 정책, 런타임 환경**을 직접 제어하는 Route Segment Config를 다룹니다.

## Route Segment Config란

Page, Layout, Route Handler 파일에서 특정 이름의 변수를 `export`하면 Next.js가 해당 세그먼트의 동작을 설정합니다.

```tsx
// app/dashboard/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 60;
export const runtime = 'edge';

export default function DashboardPage() {
  // ...
}
```

![Route Segment Config 주요 옵션](/assets/posts/next-route-segment-config-options.svg)

## dynamic — 렌더링 방식 제어

가장 많이 쓰는 옵션입니다.

```tsx
// 항상 동적 렌더링 (SSR)
export const dynamic = 'force-dynamic';

// 항상 정적 렌더링 (SSG)
export const dynamic = 'force-static';

// 동적 API 사용 시 에러 발생 (정적 강제)
export const dynamic = 'error';
```

기본값인 `'auto'`는 Next.js가 자동으로 정적/동적을 결정합니다. `cookies()`, `headers()`, `searchParams`를 사용하면 자동으로 동적 렌더링이 됩니다.

## revalidate — ISR 재검증 주기

정적으로 생성된 페이지를 주기적으로 재생성하는 ISR(Incremental Static Regeneration)을 설정합니다.

```tsx
// 60초마다 재검증
export const revalidate = 60;

// 캐시를 무기한 유지 (변경 안 함)
export const revalidate = false;

// 캐시 없음 (force-dynamic과 유사)
export const revalidate = 0;
```

```tsx
// app/blog/page.tsx
export const revalidate = 3600; // 1시간마다 재검증

export default async function BlogList() {
  const posts = await getPosts(); // 1시간 동안 캐시됨
  return <PostList posts={posts} />;
}
```

`fetch`의 `next.revalidate` 옵션과 같은 개념입니다. 세그먼트에서 설정하면 해당 페이지의 모든 fetch에 기본 적용됩니다.

## runtime — 실행 런타임 선택

![Edge vs Node.js 런타임 비교](/assets/posts/next-route-segment-config-runtime.svg)

```tsx
// Edge Runtime: 전 세계 엣지에서 실행, 빠른 응답
export const runtime = 'edge';

// Node.js Runtime: 기본값, 모든 Node API 사용 가능
export const runtime = 'nodejs';
```

Edge Runtime은 미들웨어, 지역별 리다이렉션, 인증 토큰 검증처럼 빠른 응답이 중요하고 Node.js API가 필요 없는 곳에 적합합니다.

## maxDuration — 최대 실행 시간

서버 함수(서버 액션, Route Handler 등)의 최대 실행 시간을 설정합니다. 배포 플랫폼이 지원하는 범위 내에서만 동작합니다.

```tsx
// app/api/report/route.ts
export const maxDuration = 30; // 30초까지 허용

export async function GET() {
  const report = await generateHeavyReport(); // 오래 걸리는 작업
  return Response.json(report);
}
```

Vercel Free 플랜의 기본 제한은 10초이며, `maxDuration`으로 늘릴 수 있습니다(프로 플랜 필요).

## dynamicParams — 미리 생성하지 않은 경로 처리

`generateStaticParams`와 함께 써서, 목록에 없는 파라미터로 접근했을 때의 동작을 제어합니다.

```tsx
// app/blog/[slug]/page.tsx
export const dynamicParams = false; // 없는 slug → 404
// export const dynamicParams = true;  // 없는 slug → 동적 렌더링 (기본값)

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}
```

## 설정 우선순위

동일 세그먼트에서 충돌하는 설정이 있을 때의 우선순위:

```
개별 fetch 옵션 > Segment Config > 전역 설정
```

예를 들어 세그먼트에 `revalidate = 60`이 있어도 특정 `fetch`에서 `{ cache: 'no-store' }`를 지정하면 그 fetch는 캐시되지 않습니다.

---

**지난 글:** [라우트 그룹 — URL 영향 없이 레이아웃 나누기](/posts/next-route-groups/)

**다음 글:** [loading.tsx와 error.tsx — 스트리밍과 에러 경계](/posts/next-loading-error-ui/)

<br>
읽어주셔서 감사합니다. 😊
