---
title: "Partial Prerendering — 정적과 동적의 공존"
description: "Next.js 15 실험적 기능인 Partial Prerendering(PPR)을 이해합니다. 하나의 라우트 안에서 정적 셸과 동적 슬롯을 공존시켜 TTFB와 FCP를 동시에 개선하는 원리와 적용 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 1
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "PPR", "PartialPrerendering", "정적렌더링", "동적렌더링", "Suspense"]
featured: false
draft: false
---

[지난 글](/posts/next-streaming/)에서 `<Suspense>`와 스트리밍으로 느린 컴포넌트가 빠른 컴포넌트를 블로킹하지 않도록 하는 방법을 살펴봤습니다. 이번 글에서는 한 단계 더 나아가, **정적 렌더링의 속도**와 **동적 렌더링의 개인화**를 하나의 라우트 안에서 동시에 얻을 수 있는 실험적 기능 **Partial Prerendering(PPR)**을 소개합니다.

## PPR이 해결하는 문제

전통적인 Next.js 렌더링에서는 라우트 단위로 정적 or 동적을 선택해야 했습니다. 쿠키를 읽거나 사용자 맞춤 데이터를 조회하는 순간 해당 라우트 전체가 동적으로 바뀌고, CDN 캐시 이점을 잃게 됩니다.

예를 들어 이커머스 상품 목록 페이지를 생각해 보겠습니다. 헤더, 상품 그리드, 푸터는 모든 사용자에게 동일한 정적 콘텐츠지만, 장바구니 아이콘의 수량과 개인화 추천 배너는 사용자마다 다릅니다. 장바구니 정보 하나 때문에 페이지 전체가 동적 렌더링으로 전환되면 **모든 요청이 서버를 거쳐야 하고 TTFB가 증가**합니다.

PPR은 이 딜레마를 해결합니다. **정적 셸(static shell)**을 미리 생성해 CDN에 배포하고, 동적 콘텐츠는 `<Suspense>` 경계 안에 담아 요청 시점에 스트리밍합니다.

![PPR 개념 — 정적 셸과 동적 슬롯](/assets/posts/next-partial-prerendering-concept.svg)

## PPR의 동작 원리

PPR은 빌드 시점에 두 가지 작업을 수행합니다.

1. **정적 셸 생성**: `<Suspense>` 경계 바깥의 콘텐츠를 렌더링해 HTML로 저장합니다. 이 HTML은 CDN 엣지에 배포됩니다.
2. **동적 슬롯 마커 삽입**: `<Suspense>` 경계 내부는 플레이스홀더(fallback)로 대체하고, 런타임에 해당 슬롯을 채울 스트리밍 청크 정보를 기록합니다.

사용자가 요청을 보내면 CDN은 정적 셸을 즉시 반환합니다. 브라우저가 HTML을 파싱하는 동안 서버는 동적 슬롯을 처리해 스트리밍으로 전송합니다. 사용자는 의미 있는 콘텐츠를 매우 빠르게 보고, 잠시 후 개인화 영역이 채워집니다.

## 활성화 방법

Next.js 15 이상에서 `next.config.ts`에 실험적 플래그를 추가합니다.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: {
    ppr: true,
  },
}

export default config
```

특정 라우트에만 선택적으로 PPR을 적용하려면 `ppr: 'incremental'`로 설정한 뒤, 해당 레이아웃이나 페이지에 `experimental_ppr` 내보내기를 추가합니다.

```ts
// next.config.ts
const config: NextConfig = {
  experimental: { ppr: 'incremental' },
}
```

```tsx
// app/shop/layout.tsx
export const experimental_ppr = true

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <section>{children}</section>
}
```

## 코드로 보는 PPR 패턴

PPR을 실제로 적용할 때 코드 자체는 Streaming과 거의 동일합니다. 핵심은 동적 컴포넌트를 반드시 `<Suspense>`로 감싸는 것입니다.

```tsx
// app/shop/page.tsx
import { Suspense } from 'react'
import { StaticHeader } from '@/components/static-header'
import { ProductGrid } from '@/components/product-grid'
import { CartWidget } from '@/components/cart-widget'
import { RecommendBanner } from '@/components/recommend-banner'
import { CartSkeleton, RecommendSkeleton } from '@/components/skeletons'

export default function ShopPage() {
  return (
    <main>
      {/* 정적 영역: 빌드 시 렌더링 */}
      <StaticHeader />

      {/* 동적 슬롯: 요청 시 스트리밍 */}
      <Suspense fallback={<CartSkeleton />}>
        <CartWidget />
      </Suspense>

      {/* 또 다른 정적 영역 */}
      <ProductGrid />

      {/* 동적 슬롯 2 */}
      <Suspense fallback={<RecommendSkeleton />}>
        <RecommendBanner />
      </Suspense>
    </main>
  )
}
```

`CartWidget`과 `RecommendBanner`는 서버 컴포넌트로 작성되며, `cookies()`, `headers()`, DB 쿼리 등 동적 API를 자유롭게 사용할 수 있습니다.

```tsx
// app/components/cart-widget.tsx (서버 컴포넌트)
import { cookies } from 'next/headers'

async function CartWidget() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session')?.value
  const cart = await fetchCart(sessionId)

  return (
    <div className="cart-icon">
      <span>{cart.itemCount}</span>
    </div>
  )
}
```

![PPR 활성화 코드 패턴](/assets/posts/next-partial-prerendering-code.svg)

## 정적 컴포넌트에서 동적 API를 실수로 쓰면?

`<Suspense>` 밖에 있는 컴포넌트에서 `cookies()`, `headers()`, `searchParams`처럼 요청 시점 정보에 접근하면 **Next.js가 빌드 오류나 런타임 오류를 발생**시킵니다. PPR 환경에서는 정적 셸이 빌드 시 렌더링되므로 요청 정보를 알 수 없기 때문입니다.

동적 API가 필요하면 반드시 해당 컴포넌트를 `<Suspense>` 안으로 이동시켜야 합니다.

## PPR vs Streaming vs ISR 비교

| 기능 | 정적 캐시 | 동적 콘텐츠 | 구분 단위 |
|---|---|---|---|
| ISR | O (전체 페이지) | X | 라우트 |
| Streaming | X | O (컴포넌트) | 컴포넌트 |
| **PPR** | **O (셸만)** | **O (슬롯)** | **컴포넌트** |

PPR은 ISR의 CDN 캐시 이점과 Streaming의 컴포넌트 단위 동적 처리를 결합한 방식입니다.

## 현재 상태와 주의사항

PPR은 Next.js 15 기준으로 **실험적(experimental)** 기능입니다. 프로덕션 적용 전에 공식 문서의 현재 상태를 확인하세요. 실험적 API는 마이너 버전에서 변경될 수 있습니다. Vercel에 배포하면 PPR을 가장 원활하게 활용할 수 있으며, 자체 호스팅 환경에서는 별도 설정이 필요할 수 있습니다.

---

**지난 글:** [Streaming과 Suspense — 점진적 렌더링](/posts/next-streaming/)

**다음 글:** [Edge Runtime vs Node.js Runtime](/posts/next-edge-vs-nodejs-runtime/)

<br>
읽어주셔서 감사합니다. 😊
