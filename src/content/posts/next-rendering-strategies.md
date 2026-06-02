---
title: "렌더링 전략 — 정적·동적·스트리밍"
description: "Next.js App Router의 세 가지 렌더링 전략인 Static, Dynamic, Streaming을 비교합니다. 각 전략이 언제 자동 선택되는지, 성능·캐싱·적합한 사용 사례를 이해하고 의도적으로 제어하는 방법을 배웁니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 7
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "렌더링", "Static", "Dynamic", "Streaming", "ISR", "Suspense"]
featured: false
draft: false
---

[지난 글](/posts/next-revalidation/)에서 ISR과 온디맨드 재검증을 살펴봤습니다. 이번에는 더 근본적인 질문으로 돌아옵니다. **이 페이지는 빌드 때 만들어질까, 아니면 요청이 올 때마다 만들어질까?** Next.js는 이를 자동으로 판단하지만, 그 원리를 이해해야 성능을 의도적으로 제어할 수 있습니다.

## 세 가지 렌더링 전략

![Next.js 렌더링 전략 비교](/assets/posts/next-rendering-strategies-overview.svg)

**Static(정적) 렌더링**은 `next build` 시점에 HTML을 생성해 CDN에 저장합니다. 사용자 요청 시 서버 렌더링 없이 즉시 응답합니다. TTFB(Time To First Byte)가 극도로 낮고 서버 부하도 없습니다.

**Dynamic(동적) 렌더링**은 매 요청마다 서버에서 HTML을 생성합니다. 요청마다 다른 데이터(쿠키, 헤더, 쿼리 파라미터)가 필요할 때 사용합니다.

**Streaming**은 정적 레이아웃을 먼저 보내고 동적 콘텐츠는 준비되는 대로 점진적으로 스트리밍합니다. `<Suspense>` 경계로 구분합니다.

## 렌더링 전략 자동 결정

![렌더링 전략 자동 결정 흐름](/assets/posts/next-rendering-strategies-decision.svg)

Next.js는 라우트를 분석해 자동으로 렌더링 전략을 결정합니다. **동적 함수**가 하나라도 있으면 그 라우트 전체가 동적 렌더링으로 전환됩니다.

동적 함수의 종류:
- `cookies()` — 쿠키 읽기
- `headers()` — 요청 헤더 읽기
- `searchParams` — URL 쿼리 파라미터
- `fetch(url, { cache: 'no-store' })`
- `fetch(url, { next: { revalidate: 0 } })`

```tsx
// 정적 렌더링 — 빌드 시 생성
export default async function StaticPage() {
  const data = await fetch('https://api.example.com/posts');
  return <Posts data={await data.json()} />;
}

// 동적 렌더링 — cookies() 사용으로 자동 전환
export default async function DynamicPage() {
  const cookieStore = await cookies(); // ← 이것 하나로 동적 렌더링
  const token = cookieStore.get('auth-token');
  const data = await fetchUserData(token?.value);
  return <Dashboard data={data} />;
}
```

## 렌더링 전략 수동 제어

`dynamic` 내보내기로 라우트의 전략을 강제할 수 있습니다.

```tsx
// 항상 정적으로 처리 (동적 함수가 있어도)
export const dynamic = 'force-static';

// 항상 동적으로 처리 (모든 fetch를 no-store로)
export const dynamic = 'force-dynamic';

// 기본값 — Next.js가 자동 결정
export const dynamic = 'auto';

// 정적이 아닌 부분이 있으면 에러 발생 (엄격 모드)
export const dynamic = 'error';
```

## Streaming — 두 전략의 조합

동적 콘텐츠가 있어도 페이지 전체를 동적으로 만들 필요는 없습니다. `<Suspense>`로 동적 컴포넌트를 감싸면 레이아웃과 정적 컴포넌트는 즉시 HTML로 전송하고, 동적 부분은 준비되는 대로 스트리밍합니다.

```tsx
import { Suspense } from 'react';

export default function ProductPage() {
  return (
    <div>
      {/* 정적 — 즉시 렌더링 */}
      <ProductDetails />

      {/* 동적 — 준비되면 스트리밍 */}
      <Suspense fallback={<ReviewSkeleton />}>
        <Reviews /> {/* 내부에서 fetch 실행 */}
      </Suspense>

      <Suspense fallback={<RecommendationSkeleton />}>
        <Recommendations /> {/* 사용자 맞춤 */}
      </Suspense>
    </div>
  );
}
```

사용자는 레이아웃과 `ProductDetails`를 즉시 볼 수 있고, 리뷰와 추천 상품은 각각 준비되는 순서대로 화면에 나타납니다.

## 성능 관점에서의 선택

| 시나리오 | 권장 전략 |
|----------|-----------|
| 블로그 글, 문서 | Static |
| 상품 목록 (1시간 갱신) | Static + ISR (`revalidate: 3600`) |
| 대시보드 (로그인 필요) | Dynamic |
| 혼합 페이지 (제품 + 리뷰) | Static + Streaming (Suspense) |
| 실시간 데이터 | Dynamic + Streaming |

핵심 원칙은 **가능한 한 정적으로, 어쩔 수 없을 때만 동적으로**입니다. 동적 부분이 있더라도 `<Suspense>`로 격리하면 나머지 레이아웃은 정적 성능을 유지할 수 있습니다.

---

**지난 글:** [ISR과 온디맨드 재검증 — revalidate 완전 이해](/posts/next-revalidation/)

**다음 글:** [정적 vs 동적 렌더링 심화](/posts/next-static-vs-dynamic/)

<br>
읽어주셔서 감사합니다. 😊
