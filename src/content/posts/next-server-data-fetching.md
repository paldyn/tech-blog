---
title: "서버 데이터 패칭 — fetch, async 컴포넌트, 중복 제거"
description: "Next.js App Router에서 서버 컴포넌트로 데이터를 패칭하는 모든 방법을 배웁니다. async/await 컴포넌트, fetch API, ORM 직접 호출, 순차vs병렬 패칭, Request Memoization을 통한 중복 요청 제거까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 10
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "데이터 패칭", "서버 컴포넌트", "fetch", "Promise.all", "Memoization"]
featured: false
draft: false
---

[지난 글](/posts/next-parallel-intercepting-routes/)에서 병렬 라우트와 인터셉팅 라우트로 고급 UI 패턴을 구현하는 방법을 배웠습니다. 이번에는 App Router의 핵심 기능 중 하나인 **서버 컴포넌트에서의 데이터 패칭**을 완전히 이해합니다. Pages Router의 `getServerSideProps`, `getStaticProps`를 대체하는 새로운 방식입니다.

## async 서버 컴포넌트

App Router에서는 컴포넌트 자체를 `async` 함수로 만들어 직접 데이터를 패칭합니다.

![서버 컴포넌트 데이터 패칭 흐름](/assets/posts/next-server-data-fetching-flow.svg)

```tsx
// app/posts/page.tsx
export default async function PostsPage() {
  // 서버에서 직접 실행 — 브라우저에 노출되지 않음
  const res = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }, // 1시간 캐시
  });
  const posts = await res.json();

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

`getServerSideProps` 없이 컴포넌트 안에서 바로 데이터를 가져올 수 있습니다.

## ORM·DB 직접 접근

서버 컴포넌트는 Node.js 환경에서 실행되므로 DB 클라이언트를 직접 사용할 수 있습니다.

```tsx
// app/dashboard/page.tsx
import { db } from '@/lib/db'; // Prisma, Drizzle 등

export default async function DashboardPage() {
  // API 레이어 없이 DB에 직접 쿼리
  const users = await db.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true },
  });

  return <UserTable users={users} />;
}
```

API Route를 거치지 않으므로 레이턴시가 줄고 코드도 간결합니다.

## 순차 패칭 vs 병렬 패칭

![순차 패칭 vs 병렬 패칭](/assets/posts/next-server-data-fetching-patterns.svg)

**독립적인 데이터는 항상 병렬로 패칭**하세요. `await`를 여러 번 순서대로 쓰면 각 요청이 완료될 때까지 기다리는 워터폴이 발생합니다.

```tsx
// ❌ 순차 패칭 — 700ms (200 + 200 + 300)
const user = await getUser(id);
const orders = await getOrders(id);
const reviews = await getReviews(id);

// ✅ 병렬 패칭 — 300ms (가장 긴 것 기준)
const [user, orders, reviews] = await Promise.all([
  getUser(id),
  getOrders(id),
  getReviews(id),
]);
```

단, 순차가 필요한 경우도 있습니다. `orders`를 패칭하는 데 `user.organizationId`가 필요하다면 `user` 먼저 가져와야 합니다.

## Request Memoization — 자동 중복 제거

같은 렌더 트리 안에서 동일한 URL과 옵션으로 `fetch`를 여러 번 호출해도 **실제 네트워크 요청은 한 번만** 발생합니다. Next.js가 자동으로 메모이제이션합니다.

```tsx
// app/layout.tsx
async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`); // 1회 요청
  return res.json();
}

export default async function Layout({ children }) {
  const user = await getUser('123'); // fetch 실행
  return <header>{user.name}</header>;
}

// app/page.tsx
export default async function Page() {
  const user = await getUser('123'); // 캐시된 결과 반환 (fetch 안 함)
  return <Profile user={user} />;
}
```

이 덕분에 각 컴포넌트가 독립적으로 필요한 데이터를 선언적으로 패칭해도 성능 문제가 없습니다.

## fetch 캐시 옵션

```tsx
// 기본: 정적 캐시 (빌드 시 패칭, 변경 없음)
fetch(url)

// 항상 최신 데이터 (SSR)
fetch(url, { cache: 'no-store' })

// ISR: n초마다 재검증
fetch(url, { next: { revalidate: 60 } })

// 태그 기반 재검증
fetch(url, { next: { tags: ['posts'] } })
```

태그 기반 재검증은 `revalidateTag('posts')`를 호출하면 해당 태그의 캐시가 무효화됩니다. Server Action과 함께 쓰면 데이터 수정 즉시 관련 페이지를 갱신할 수 있습니다.

## 컴포넌트 트리에서 데이터 배치

데이터 패칭을 필요한 컴포넌트 가까이 배치하세요. Props drilling 없이 각 컴포넌트가 자신이 필요한 데이터를 직접 가져오는 패턴이 가장 유지보수하기 좋습니다.

```tsx
// ✅ 필요한 곳에서 직접 패칭
export default async function ProductPage({ params }) {
  const { id } = await params;

  return (
    <div>
      <ProductInfo id={id} />  {/* 내부에서 패칭 */}
      <Reviews id={id} />      {/* 내부에서 패칭 */}
      <RelatedProducts />      {/* 내부에서 패칭 */}
    </div>
  );
}
```

---

**지난 글:** [병렬 라우트와 인터셉팅 라우트 — 모달과 슬롯](/posts/next-parallel-intercepting-routes/)

<br>
읽어주셔서 감사합니다. 😊
