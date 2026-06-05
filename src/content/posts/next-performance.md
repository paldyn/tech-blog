---
title: "성능 최적화 — Core Web Vitals 개선 전략"
description: "Next.js 프로젝트에서 LCP, CLS, INP 등 Core Web Vitals를 개선하는 전략을 설명합니다. 이미지, 폰트, 번들, 렌더링, 캐싱 등 카테고리별 최적화 체크리스트를 제공합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 55
type: "knowledge"
category: "Next.js"
tags: ["nextjs", "성능최적화", "CoreWebVitals", "LCP", "CLS", "INP"]
featured: false
draft: false
---

[지난 글](/posts/next-bundle-analysis/)에서 번들 크기를 진단하는 방법을 살펴봤다. 이번 글은 **종합 성능 최적화**다. Next.js가 제공하는 최적화 도구들을 이미 개별적으로 살펴봤으니, 이번에는 Core Web Vitals(CWV)를 기준으로 전략을 종합 정리한다.

## Core Web Vitals란

구글이 정의한 **사용자 경험 성능 지표** 세 가지다. SEO 순위에도 직접 영향을 준다.

![Core Web Vitals 개요](/assets/posts/next-performance-cwv.svg)

- **LCP (Largest Contentful Paint)**: 가장 큰 콘텐츠(보통 히어로 이미지나 제목)가 화면에 나타나는 시점. 목표 ≤ 2.5초
- **CLS (Cumulative Layout Shift)**: 페이지 로드 중 레이아웃이 얼마나 예기치 않게 이동하는지. 목표 ≤ 0.1
- **INP (Interaction to Next Paint)**: 클릭·탭·키 입력 후 다음 화면 업데이트까지 걸리는 시간. 목표 ≤ 200ms

## LCP 개선: 가장 큰 콘텐츠를 빠르게

### 히어로 이미지에 priority 설정

```tsx
// ❌ priority 없으면 lazy load → LCP 느려짐
<Image src="/hero.jpg" alt="Hero" width={1200} height={600} />

// ✅ 뷰포트 상단 이미지에는 priority 필수
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority  // preload + 즉시 로드
/>
```

### 렌더링 전략 선택

```ts
// 정적 콘텐츠 → SSG (빌드 타임 HTML)
export const dynamic = 'force-static' // 또는 SSG 기본 동작

// 자주 바뀌는 콘텐츠 → ISR
export const revalidate = 60 // 60초마다 재생성

// 실시간 데이터 → SSR + Streaming
export const dynamic = 'force-dynamic'
```

SSG/ISR을 사용하면 서버가 매 요청마다 렌더링할 필요 없이 CDN에서 HTML을 즉시 제공한다. LCP가 극적으로 개선된다.

## CLS 개선: 레이아웃 이동 방지

### 이미지 크기 명시

```tsx
// ❌ 크기 없으면 로드 후 레이아웃 이동
<img src="/photo.jpg" alt="사진" />

// ✅ 반드시 크기 지정
<Image src="/photo.jpg" alt="사진" width={800} height={450} />

// ✅ fill 사용 시 부모에 position: relative + 고정 높이
<div className="relative h-64">
  <Image src="/photo.jpg" alt="사진" fill className="object-cover" />
</div>
```

### Skeleton으로 공간 예약

```tsx
// 데이터 로딩 중 같은 크기의 Skeleton을 먼저 보여줌
function UserCard() {
  const [user, setUser] = useState<User | null>(null)

  if (!user) {
    return (
      <div className="h-24 w-full animate-pulse rounded-lg bg-gray-800" />
    )
  }

  return <div className="h-24 w-full">{user.name}</div>
}
```

## INP 개선: 인터랙션 응답 속도

### Server Component로 JS 최소화

```tsx
// 서버에서 실행 → 클라이언트 JS 번들에 포함되지 않음
// 상호작용 없는 UI는 Server Component로 작성
async function ProductList() {
  const products = await fetchProducts()
  return (
    <ul>
      {products.map(p => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

### useTransition으로 UI 블로킹 방지

```tsx
'use client'
import { useTransition } from 'react'

function FilterButton() {
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState('all')

  const handleFilter = (newFilter: string) => {
    startTransition(() => {
      setFilter(newFilter) // 우선순위가 낮은 업데이트로 표시
    })
  }

  return (
    <button onClick={() => handleFilter('sale')} disabled={isPending}>
      {isPending ? '로딩 중...' : '세일 상품'}
    </button>
  )
}
```

`startTransition` 내부의 상태 업데이트는 긴급하지 않은 렌더링으로 표시되어, 사용자 입력이 즉시 반응할 수 있도록 메인 스레드를 확보한다.

## 실시간 CWV 모니터링

```ts
// instrumentation.ts (Next.js 15)
export function onRequestError(err: Error) {
  // 오류 모니터링
}

// app/_components/WebVitals.tsx
'use client'
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    // 분석 서비스로 전송
    console.log(metric.name, metric.value)

    // 예: Google Analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      })
    }
  })

  return null
}
```

`useReportWebVitals`는 실제 사용자의 LCP, CLS, INP, TTFB, FCP 값을 수집한다. 분석 서비스로 보내면 어떤 페이지가 실제로 느린지 파악할 수 있다.

## 종합 체크리스트

![Next.js 성능 최적화 체크리스트](/assets/posts/next-performance-checklist.svg)

성능 최적화는 한 번에 모든 것을 다 하는 것이 아니라, **측정 → 가장 큰 문제 발견 → 수정 → 재측정** 사이클을 반복하는 것이다. Lighthouse 점수 90+ 달성이 목표가 아니라 실제 사용자의 경험 지표(LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms)를 만족하는 것이 진짜 목표다.

---

**지난 글:** [번들 분석 — @next/bundle-analyzer로 번들 크기 진단하기](/posts/next-bundle-analysis/)

**다음 글:** [국제화(i18n) — Next.js에서 다국어 지원 구현하기](/posts/next-internationalization/)

<br>
읽어주셔서 감사합니다. 😊
