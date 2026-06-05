---
title: "동적 임포트 — next/dynamic으로 코드 스플리팅하기"
description: "Next.js의 next/dynamic을 사용해 무거운 컴포넌트를 지연 로드하고 초기 번들 크기를 줄이는 방법을 설명합니다. SSR 비활성, named export, loading 폴백 등 실전 패턴을 모두 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 53
type: "knowledge"
category: "Next.js"
tags: ["nextjs", "동적임포트", "코드스플리팅", "next/dynamic", "번들최적화", "지연로드"]
featured: false
draft: false
---

[지난 글](/posts/next-script-optimization/)에서 서드파티 스크립트 최적화를 살펴봤다. 이번 글은 **동적 임포트(Dynamic Import)**다. 차트 라이브러리, 지도 컴포넌트, 리치 텍스트 에디터처럼 무거운 컴포넌트를 처음부터 모두 다운로드하면 초기 로딩이 느려진다. `next/dynamic`은 이러한 컴포넌트를 필요한 시점에만 로드해 번들 크기를 줄인다.

## 코드 스플리팅이란

웹팩(Webpack)이나 터보팩(Turbopack)은 `import()` 문법을 만나면 해당 모듈을 별도의 청크(chunk) 파일로 분리한다. 사용자는 초기 로드 시 핵심 코드만 받고, 나머지는 필요할 때 네트워크로 받아온다.

```js
// 정적 import: 항상 번들에 포함
import HeavyChart from './HeavyChart'

// 동적 import: 별도 청크로 분리 (표준 JS)
const { default: HeavyChart } = await import('./HeavyChart')
```

Next.js의 `dynamic()`은 이 동적 import를 React 컴포넌트에서 쓰기 편하게 래핑한 함수다.

![dynamic import 코드 스플리팅](/assets/posts/next-dynamic-import-flow.svg)

## 기본 사용법

```tsx
// app/dashboard/page.tsx
import dynamic from 'next/dynamic'

const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <div className="h-64 animate-pulse bg-gray-800 rounded" />,
})

export default function DashboardPage() {
  return (
    <main>
      <h1>대시보드</h1>
      <HeavyChart data={chartData} />
    </main>
  )
}
```

`loading` 옵션에 지정한 컴포넌트는 청크 로드가 완료되기 전까지 보여준다. Skeleton UI를 넣는 것이 일반적이다.

## SSR 비활성 — 브라우저 전용 컴포넌트

`window`, `document`, `navigator` 같은 브라우저 API에 의존하는 컴포넌트는 서버에서 렌더링하면 에러가 난다. `ssr: false`로 SSR을 완전히 끈다.

```tsx
import dynamic from 'next/dynamic'

// Leaflet, Three.js 등 브라우저 전용 라이브러리
const LeafletMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-900 rounded flex items-center justify-center">
    <span className="text-gray-400">지도 로딩 중...</span>
  </div>,
})
```

`ssr: false`인 컴포넌트는 서버에서 HTML을 생성할 때 완전히 건너뛰고, 클라이언트에서 hydration 후에만 렌더링된다.

![dynamic() 패턴 비교](/assets/posts/next-dynamic-import-patterns.svg)

## named export 처리

default export가 아닌 named export를 동적으로 불러올 때는 `.then(m => m.ComponentName)` 패턴을 사용한다.

```tsx
// components/ui/index.ts에 여러 컴포넌트가 있는 경우
const RichTextEditor = dynamic(
  () => import('@/components/ui').then(m => m.RichTextEditor),
  { ssr: false }
)

const DataGrid = dynamic(
  () => import('@/components/ui').then(m => m.DataGrid),
  { loading: () => <TableSkeleton /> }
)
```

## 조건부 동적 로드

사용자 인터랙션에 따라 컴포넌트를 보여주는 패턴이다.

```tsx
'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const VideoPlayer = dynamic(() => import('@/components/VideoPlayer'), {
  loading: () => <div className="aspect-video bg-black rounded" />,
  ssr: false,
})

export default function BlogPost() {
  const [showVideo, setShowVideo] = useState(false)

  return (
    <article>
      <p>블로그 본문...</p>
      {showVideo ? (
        <VideoPlayer src="/demo.mp4" />
      ) : (
        <button onClick={() => setShowVideo(true)}>
          동영상 보기
        </button>
      )}
    </article>
  )
}
```

버튼을 클릭하기 전까지 `VideoPlayer` 청크는 다운로드되지 않는다.

## Server Component에서의 주의사항

```tsx
// ❌ Server Component에서 dynamic() 사용 시 SSR 옵션이 무시됨
// Server Component는 항상 서버에서만 실행되므로 의미가 없음

// ✅ Server Component에서 코드 스플리팅이 필요한 경우
// 브라우저 전용 기능이 있는 컴포넌트를 Client Component로 분리 후 dynamic() 적용
```

`next/dynamic`의 `ssr: false`는 **Client Component 내부에서만** 의미가 있다. Server Component 자체는 서버에서만 실행되므로 `ssr: false`가 동작하지 않는다.

## 실전 팁

```tsx
// 모듈 최상단에서 선언 (컴포넌트 내부 금지)
const Chart = dynamic(() => import('./Chart'))

// ❌ 컴포넌트 내에서 매 렌더마다 dynamic() 호출 시 새 청크 ID가 생성됨
function Page() {
  const Chart = dynamic(() => import('./Chart')) // 금지
  return <Chart />
}
```

`dynamic()`은 `next/font`와 마찬가지로 모듈 최상단에서 한 번만 호출해야 한다. 컴포넌트 함수 내에서 호출하면 매 렌더마다 새로운 청크 참조가 생성되어 성능 문제와 hydration 불일치가 발생한다.

번들 분석 도구(`@next/bundle-analyzer`)로 어떤 컴포넌트가 초기 번들을 크게 만드는지 파악한 뒤, 상위 몇 개를 `dynamic()`으로 전환하는 것이 가장 효과적인 접근법이다.

---

**지난 글:** [스크립트 최적화 — next/script로 서드파티 스크립트 제어하기](/posts/next-script-optimization/)

**다음 글:** [번들 분석 — @next/bundle-analyzer로 번들 크기 진단하기](/posts/next-bundle-analysis/)

<br>
읽어주셔서 감사합니다. 😊
