---
title: "스크립트 최적화 — next/script로 서드파티 스크립트 제어하기"
description: "Next.js의 next/script 컴포넌트로 Google Tag Manager, 채팅 위젯 등 서드파티 스크립트의 로드 타이밍을 제어해 LCP와 TBT를 개선하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 52
type: "knowledge"
category: "Next.js"
tags: ["nextjs", "스크립트최적화", "next/script", "서드파티", "LCP", "TBT"]
featured: false
draft: false
---

[지난 글](/posts/next-font-optimization/)에서 폰트 최적화를 살펴봤다. 이번 글은 **서드파티 스크립트 최적화**다. 분석 도구, 채팅 위젯, 광고 스크립트는 페이지 성능을 가장 많이 갉아먹는 요소 중 하나다. Next.js의 `next/script`는 `strategy` 옵션 하나로 로드 타이밍을 정밀하게 제어해준다.

## 왜 서드파티 스크립트가 문제인가

일반적인 `<script src="...">` 태그는 HTML 파싱을 차단한다. `async`/`defer` 속성을 붙이더라도 여러 스크립트가 경쟁적으로 로드되면 메인 스레드를 오래 점유해 **Total Blocking Time(TBT)**와 **Largest Contentful Paint(LCP)**가 나빠진다.

`next/script`는 네 가지 `strategy` 옵션으로 각 스크립트의 로드 시점을 명시적으로 선언하게 해준다.

![next/script 로드 전략](/assets/posts/next-script-optimization-strategies.svg)

## strategy 옵션 상세

### beforeInteractive

페이지가 인터랙티브해지기 전에 로드한다. 렌더를 차단하므로 반드시 필요한 경우에만 사용한다.

```tsx
// app/layout.tsx — 폴리필처럼 최우선 로드가 필요한 경우
import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Script
          src="/polyfill.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  )
}
```

`beforeInteractive`는 `app/layout.tsx` 내에서만 올바르게 동작한다. 개별 페이지 컴포넌트에 사용하면 의도대로 작동하지 않는다.

### afterInteractive (기본값)

hydration 완료 후 로드된다. GTM, 인증 스크립트처럼 페이지가 준비된 뒤 실행되어도 되는 경우에 적합하다.

```tsx
<Script
  id="gtm"
  src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXXXX"
  strategy="afterInteractive"
  onLoad={() => {
    // 스크립트 로드 완료 후 실행
    window.dataLayer?.push({ event: 'gtm_loaded' })
  }}
/>
```

### lazyOnload

브라우저 idle 시간(모든 리소스 로드 완료 후)에 로드된다. 채팅 위젯, SNS 공유 버튼처럼 즉시 필요하지 않은 스크립트에 사용한다.

```tsx
<Script
  src="https://cdn.example.com/chat-widget.js"
  strategy="lazyOnload"
  onLoad={() => console.log('Chat widget loaded')}
/>
```

### worker (실험적)

Partytown 라이브러리를 통해 Web Worker에서 스크립트를 실행한다. 메인 스레드를 전혀 차단하지 않는다.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    nextScriptWorkers: true,
  },
}

export default nextConfig
```

```tsx
<Script src="https://analytics.example.com/track.js" strategy="worker" />
```

Worker 전략은 아직 실험적이므로 프로덕션 적용 전에 충분히 테스트해야 한다.

## 인라인 스크립트와 콜백

![next/script 사용 예시](/assets/posts/next-script-optimization-code.svg)

외부 URL이 아닌 인라인 자바스크립트를 삽입할 때는 `dangerouslySetInnerHTML`을 사용하며 반드시 `id` 속성이 있어야 한다.

```tsx
<Script
  id="structured-data"
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: '내 블로그',
      url: 'https://example.com',
    }),
  }}
/>
```

### onLoad vs onReady

| 콜백 | 실행 시점 |
|------|----------|
| `onLoad` | 스크립트 첫 로드 완료 후 한 번 |
| `onReady` | 첫 로드 + 이후 클라이언트 페이지 이동 시마다 |
| `onError` | 스크립트 로드 실패 시 |

채팅 위젯처럼 페이지 이동 후에도 재초기화가 필요한 스크립트는 `onReady`를 사용한다.

```tsx
<Script
  src="https://cdn.example.com/widget.js"
  strategy="lazyOnload"
  onReady={() => {
    window.ChatWidget?.init({ theme: 'dark' })
  }}
/>
```

## 레이아웃 vs 페이지 — 어디에 놓을까

```
app/
├── layout.tsx    ← 전역 스크립트 (GTM, 글로벌 분석)
├── page.tsx      ← 해당 페이지만 필요한 스크립트
└── blog/
    └── page.tsx  ← 블로그 페이지 전용 스크립트
```

모든 페이지에서 필요한 스크립트는 루트 `layout.tsx`에, 특정 페이지에서만 필요한 스크립트는 해당 `page.tsx`에 배치한다. Next.js는 같은 `id`를 가진 스크립트를 중복 로드하지 않는다.

## 실전 GTM 설정 예시

```tsx
// app/layout.tsx
import Script from 'next/script'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}

        {GTM_ID && (
          <>
            {/* GTM 스크립트 */}
            <Script
              id="gtm-script"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  (function(w,d,s,l,i){w[l]=w[l]||[];
                  w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
                  var f=d.getElementsByTagName(s)[0],
                  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
                  j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
                  f.parentNode.insertBefore(j,f);
                  })(window,document,'script','dataLayer','${GTM_ID}');
                `,
              }}
            />
          </>
        )}
      </body>
    </html>
  )
}
```

---

**지난 글:** [폰트 최적화 — next/font로 CLS 제로 달성하기](/posts/next-font-optimization/)

**다음 글:** [동적 임포트 — next/dynamic으로 코드 스플리팅하기](/posts/next-dynamic-import/)

<br>
읽어주셔서 감사합니다. 😊
