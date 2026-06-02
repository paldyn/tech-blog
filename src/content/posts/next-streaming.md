---
title: "Streaming과 Suspense — 점진적 렌더링"
description: "Next.js App Router의 스트리밍 렌더링과 React Suspense를 활용해 느린 컴포넌트가 빠른 컴포넌트를 블로킹하지 않도록 하는 방법을 배웁니다. loading.tsx, Suspense 경계 배치 전략, 그리고 스켈레톤 UI 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 10
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "Streaming", "Suspense", "loading.tsx", "스켈레톤 UI", "점진적 렌더링"]
featured: false
draft: false
---

[지난 글](/posts/next-generate-static-params/)에서 동적 라우트를 빌드 시점에 정적으로 생성하는 방법을 살펴봤습니다. 이번에는 동적 렌더링이 필요한 상황에서도 **빠른 초기 로드**를 유지하는 기법인 **Streaming**을 다룹니다. 서버 컴포넌트와 `<Suspense>`를 조합하면 느린 쿼리가 빠른 콘텐츠를 블로킹하지 않습니다.

## 전통적 렌더링의 문제

![전통적 렌더링 vs 스트리밍](/assets/posts/next-streaming-comparison.svg)

동적 렌더링에서 서버는 모든 데이터가 준비될 때까지 기다린 후 HTML을 전송합니다. 페이지에 느린 DB 쿼리(1,200ms)가 있으면 사용자는 그동안 빈 화면을 보게 됩니다.

Streaming은 이 문제를 해결합니다. 서버는 즉시 준비된 정적 셸(레이아웃, 헤더)을 먼저 전송하고, 느린 부분은 준비되는 대로 청크로 스트리밍합니다. 사용자는 50ms 만에 레이아웃을 보고, 1,200ms에는 모든 콘텐츠가 채워집니다.

## Suspense로 스트리밍 활성화

`<Suspense>`로 컴포넌트를 감싸기만 하면 됩니다. Next.js가 자동으로 스트리밍을 처리합니다.

```tsx
import { Suspense } from 'react';
import ProductInfo from './ProductInfo';
import Reviews from './Reviews';
import Recommendations from './Recommendations';

export default function ProductPage() {
  return (
    <div>
      {/* 정적 — 즉시 렌더링 */}
      <ProductInfo />

      {/* 동적 — 준비되면 스트리밍 */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews /> {/* 느린 DB 쿼리 */}
      </Suspense>

      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations /> {/* 사용자 맞춤 추천 */}
      </Suspense>
    </div>
  );
}
```

`Reviews`와 `Recommendations`는 각각 독립적으로 스트리밍됩니다. `Reviews`가 먼저 완료되면 `Recommendations`를 기다리지 않고 즉시 교체됩니다.

![Suspense 경계 배치와 스트리밍 순서](/assets/posts/next-streaming-suspense.svg)

## loading.tsx — 자동 Suspense

라우트 세그먼트 폴더에 `loading.tsx` 파일을 만들면 Next.js가 자동으로 `<Suspense>`로 감쌉니다.

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-700 rounded mb-4" />
      <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-4 bg-gray-700 rounded w-1/2" />
    </div>
  );
}

// app/dashboard/page.tsx — 자동으로 Suspense로 감싸짐
export default async function DashboardPage() {
  const data = await fetchDashboardData(); // 느린 쿼리
  return <Dashboard data={data} />;
}
```

`loading.tsx`는 페이지 전체에 적용됩니다. 더 세밀한 제어가 필요하면 컴포넌트 수준에서 직접 `<Suspense>`를 사용합니다.

## error.tsx — 스트리밍 에러 처리

스트리밍 중 에러가 발생하면 `error.tsx`가 해당 Suspense 경계를 교체합니다.

```tsx
// app/dashboard/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>데이터를 불러오지 못했습니다.</h2>
      <button onClick={reset}>다시 시도</button>
    </div>
  );
}
```

`error.tsx`는 클라이언트 컴포넌트여야 합니다. `reset`을 호출하면 에러 경계를 다시 렌더링 시도합니다.

## 중첩 Suspense — 세밀한 UX 제어

각 Suspense 경계는 독립적으로 관리됩니다. 중첩 배치로 더 섬세한 UX를 만들 수 있습니다.

```tsx
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}> {/* 전체 페이지 */}
      <MainContent>
        <Suspense fallback={<TableSkeleton />}> {/* 테이블만 */}
          <DataTable />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}> {/* 차트만 */}
          <Analytics />
        </Suspense>
      </MainContent>
    </Suspense>
  );
}
```

외부 Suspense의 fallback은 내부가 준비되기 전까지 보이고, 내부 컴포넌트들은 각각 준비 순서대로 교체됩니다.

## use() 훅으로 클라이언트 스트리밍

서버에서 시작한 프로미스를 클라이언트 컴포넌트에서 `use()`로 소비할 수도 있습니다.

```tsx
// 서버 컴포넌트
export default function Page() {
  const dataPromise = fetchData(); // await 없이 프로미스 그대로 전달
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientComponent dataPromise={dataPromise} />
    </Suspense>
  );
}

// 클라이언트 컴포넌트
'use client';
import { use } from 'react';

export default function ClientComponent({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise); // Suspense와 연동
  return <div>{data.title}</div>;
}
```

`use()`는 프로미스가 완료될 때까지 컴포넌트를 일시 중단하고 가장 가까운 Suspense 경계의 fallback을 보여줍니다.

---

**지난 글:** [generateStaticParams — 동적 라우트 정적 생성](/posts/next-generate-static-params/)

<br>
읽어주셔서 감사합니다. 😊
