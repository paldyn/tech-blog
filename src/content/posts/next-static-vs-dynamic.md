---
title: "정적 vs 동적 렌더링 심화"
description: "Next.js에서 정적 렌더링과 동적 렌더링이 어떻게 다른지 요청 흐름, 성능, 실전 트리거 관점에서 깊이 파헤칩니다. 동적 렌더링으로 전환하는 모든 요인과 이를 의도적으로 제어하는 방법을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 8
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "정적 렌더링", "동적 렌더링", "dynamic", "force-static", "cookies", "headers"]
featured: false
draft: false
---

[지난 글](/posts/next-rendering-strategies/)에서 렌더링 전략의 큰 그림을 살펴봤습니다. 이번에는 **정적 렌더링과 동적 렌더링**의 차이를 더 깊게 파고듭니다. 언제 어떻게 전환되는지, 왜 동적 함수 하나가 전체 라우트를 동적으로 만드는지, 그리고 그것을 피하는 패턴을 배웁니다.

## 두 렌더링의 요청 흐름 차이

![정적 렌더링 vs 동적 렌더링 요청 흐름](/assets/posts/next-static-vs-dynamic-comparison.svg)

정적 렌더링은 사용자 요청이 오기 전, 빌드 시점에 이미 HTML이 완성되어 있습니다. 사용자 요청은 CDN 엣지 노드에서 캐시된 파일을 즉시 반환합니다. 서버 렌더링이 없으므로 TTFB가 수십 밀리초에 불과합니다.

동적 렌더링은 사용자 요청이 들어올 때마다 서버가 렌더링을 수행합니다. DB 쿼리, API 호출, 쿠키 기반 개인화가 여기서 이루어집니다. TTFB는 렌더링 시간만큼 늘어납니다.

## 동적 렌더링으로 전환하는 트리거

![동적 렌더링으로 전환하는 요인](/assets/posts/next-static-vs-dynamic-triggers.svg)

동적 함수는 Next.js가 "이 라우트는 요청 시간 정보에 의존한다"고 판단하게 만듭니다. 하나라도 있으면 해당 라우트 전체가 동적 렌더링으로 전환됩니다.

```tsx
// 모두 동적 렌더링을 유발합니다
import { cookies, headers } from 'next/headers';

// 1. cookies() — 요청별 쿠키
const auth = (await cookies()).get('session');

// 2. headers() — 요청별 헤더
const ua = (await headers()).get('user-agent');

// 3. searchParams — URL 쿼리 스트링
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) {
  const { q } = await searchParams; // 동적
}

// 4. cache: 'no-store'
const data = await fetch(url, { cache: 'no-store' });
```

## 동적 함수를 격리하는 패턴

로그인한 사용자 이름만 헤더에서 읽고 나머지 콘텐츠는 정적으로 유지하고 싶을 때, 컴포넌트를 분리하면 됩니다.

```tsx
// app/page.tsx — 이 파일은 정적으로 유지
import { Suspense } from 'react';
import UserGreeting from './UserGreeting'; // 동적 부분
import StaticContent from './StaticContent'; // 정적 부분

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<p>로딩 중...</p>}>
        <UserGreeting /> {/* 동적: 쿠키 사용 */}
      </Suspense>
      <StaticContent /> {/* 정적: CDN에서 서빙 */}
    </>
  );
}
```

`<Suspense>`로 감싸면 동적 컴포넌트(`UserGreeting`)가 렌더링되는 동안 나머지 정적 콘텐츠는 즉시 전송됩니다.

## dynamic 내보내기로 강제 제어

모든 라우트의 동작을 명시적으로 고정할 수 있습니다.

```tsx
// 동적 함수가 있어도 정적 처리 (쿠키 값은 undefined)
export const dynamic = 'force-static';

// 모든 fetch를 no-store로 처리
export const dynamic = 'force-dynamic';

// 동적 요인 발견 시 빌드 에러 (규칙 강제)
export const dynamic = 'error';
```

`force-static`을 사용하면 `cookies()`나 `headers()` 값이 빈 값을 반환합니다. 정적 페이지에서 개인화 로직을 실수로 사용했을 때 에러 없이 빌드되지만 의도치 않은 동작이 생길 수 있으므로 주의가 필요합니다.

## 빌드 출력에서 확인하기

`next build` 실행 후 터미널에 각 라우트의 렌더링 전략이 표시됩니다.

```bash
Route (app)                              Size     First Load JS
┌ ○ /                                    5.3 kB         87 kB
├ ○ /about                               1.2 kB         83 kB
├ λ /dashboard                           3.8 kB         86 kB
├ ○ /blog/[slug]                         2.1 kB         84 kB
└ ƒ /api/webhook                         142 B          82 kB

○  (Static)   정적 HTML 생성
λ  (Dynamic)  서버 렌더링
ƒ  (Function) Route Handler
```

`○` 표시는 정적, `λ`는 동적입니다. 예상과 다른 라우트가 있다면 동적 트리거가 숨어 있을 수 있습니다.

## 실전 가이드라인

같은 페이지에서 정적 콘텐츠와 동적 콘텐츠를 혼용해야 할 때의 권장 패턴입니다.

```tsx
// 1. 정적 데이터 — 서버 컴포넌트 최상위
const post = await fetch(url, { next: { revalidate: 3600 } });

// 2. 동적 데이터 — Suspense로 격리
<Suspense fallback={<LikeButtonSkeleton />}>
  <LikeButton postId={post.id} /> {/* 내부에서 cookies() 사용 */}
</Suspense>
```

이 패턴으로 대부분의 콘텐츠는 CDN에서 빠르게 서빙하면서, 사용자별 동적 정보는 스트리밍으로 제공할 수 있습니다.

---

**지난 글:** [렌더링 전략 — 정적·동적·스트리밍](/posts/next-rendering-strategies/)

**다음 글:** [generateStaticParams — 동적 라우트 정적 생성](/posts/next-generate-static-params/)

<br>
읽어주셔서 감사합니다. 😊
