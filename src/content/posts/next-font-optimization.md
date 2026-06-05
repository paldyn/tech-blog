---
title: "폰트 최적화 — next/font로 CLS 제로 달성하기"
description: "Next.js의 next/font 모듈을 사용해 Google Fonts와 로컬 폰트를 빌드 타임에 자체 호스팅하는 방법을 설명합니다. FOUT, CLS, 렌더 차단 문제를 근본적으로 해결하는 실전 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 51
type: "knowledge"
category: "Next.js"
tags: ["nextjs", "폰트최적화", "next/font", "CLS", "웹성능", "자체호스팅"]
featured: false
draft: false
---

[지난 글](/posts/next-image-optimization/)에서 이미지 최적화를 살펴봤다. 이번 글에서는 **폰트 최적화**를 다룬다. 웹 폰트는 잘못 다루면 레이아웃 이동(CLS)과 렌더 차단을 유발하는 주요 원인이 되지만, Next.js의 `next/font` 모듈은 이를 빌드 타임에 완전히 해결해준다.

## 기존 폰트 로드 방식의 문제

Google Fonts를 `@import`나 `<link>` 태그로 불러오면 세 가지 문제가 발생한다.

1. **외부 네트워크 요청**: 브라우저가 fonts.googleapis.com에 연결해야 한다.
2. **FOUT(Flash of Unstyled Text)**: 폰트 로드 전까지 폴백 폰트가 렌더링된다.
3. **렌더 차단**: 폰트 CSS 파일이 HTML 파싱을 막는다.

`next/font`는 이 세 문제를 빌드 타임에 모두 해결한다.

![next/font 최적화 구조](/assets/posts/next-font-optimization-overview.svg)

## next/font/google 기본 사용법

```tsx
// app/layout.tsx
import { Inter, Noto_Sans_KR } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',        // FOUT 최소화
  variable: '--font-inter', // CSS 변수로 노출
})

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-noto',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${notoSansKR.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

`className`을 `<body>`에, `variable`을 `<html>`에 붙이는 패턴이 일반적이다. CSS 변수 방식을 사용하면 Tailwind나 CSS Modules에서 `var(--font-inter)`로 폰트를 참조할 수 있다.

## next/font/local — 로컬 폰트 사용

외부 CDN에 의존하지 않고 프로젝트 내 폰트 파일을 직접 사용하는 경우다.

```tsx
// app/fonts.ts
import localFont from 'next/font/local'

export const pretendard = localFont({
  src: [
    {
      path: '../../public/fonts/Pretendard-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Pretendard-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-pretendard',
  display: 'swap',
})
```

```tsx
// app/layout.tsx
import { pretendard } from './fonts'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body style={{ fontFamily: 'var(--font-pretendard)' }}>
        {children}
      </body>
    </html>
  )
}
```

![next/font 사용 패턴](/assets/posts/next-font-optimization-usage.svg)

## Tailwind CSS와 연동

`tailwind.config.ts`에서 CSS 변수를 폰트 패밀리로 등록하면 `font-sans` 유틸리티 클래스로 폰트를 적용할 수 있다.

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-pretendard)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-inter)', 'monospace'],
      },
    },
  },
}

export default config
```

이후 `className="font-sans"` 한 줄로 적용된다.

## 주요 옵션 정리

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `subsets` | 문자 서브셋 (`latin`, `latin-ext` 등) | 필수 |
| `weight` | 폰트 굵기 (`'400'`, `['400','700']`) | 기본 사용 불가 |
| `display` | `swap` \| `block` \| `fallback` \| `optional` | `'swap'` |
| `variable` | CSS 변수명 | 없음 |
| `preload` | 미리 로드 여부 | `true` |

`display: 'swap'`은 폰트 로드 전에 폴백 폰트를 먼저 보여주고, 로드 완료 후 교체한다. `display: 'optional'`은 네트워크가 느릴 때 폰트 교체 자체를 포기해 CLS를 완전히 없앤다.

## size-adjust와 ascent-override

`next/font`는 내부적으로 `size-adjust`, `ascent-override`, `descent-override` CSS 속성을 자동 계산해 폴백 폰트와 실제 폰트 간 크기 차이를 최소화한다. 덕분에 폰트가 교체되더라도 레이아웃 이동(CLS)이 0에 가까워진다.

```css
/* next/font가 자동 생성하는 @font-face (예시) */
@font-face {
  font-family: '__Inter_Fallback_abcdef';
  font-style: normal;
  font-weight: 400;
  src: local('Arial');
  ascent-override: 90.49%;
  descent-override: 22.56%;
  line-gap-override: 0%;
  size-adjust: 107.06%;
}
```

개발자가 직접 계산할 필요 없이 자동으로 처리된다.

## preload와 성능 최적화

`preload: true`(기본값)이면 Next.js가 `<head>`에 `<link rel="preload">` 태그를 자동 삽입한다.

```html
<!-- Next.js가 자동 삽입 -->
<link
  rel="preload"
  href="/_next/static/media/inter.woff2"
  as="font"
  type="font/woff2"
  crossorigin="anonymous"
/>
```

폰트를 HTML 파싱과 병렬로 다운로드하므로 렌더링 지연이 없다.

## 주의사항

```tsx
// ❌ 컴포넌트 내부에서 호출하면 안 됨
function MyComponent() {
  const font = Inter({ subsets: ['latin'] }) // 매 렌더마다 호출됨
  return <div className={font.className} />
}

// ✅ 모듈 최상단에서 한 번만 선언
const inter = Inter({ subsets: ['latin'] })

function MyComponent() {
  return <div className={inter.className} />
}
```

`next/font` 함수는 모듈 최상단에서 한 번만 호출해야 한다. 컴포넌트 내부에서 호출하면 렌더마다 새로운 CSS 클래스가 생성돼 성능 문제가 발생한다.

---

**지난 글:** [이미지 최적화 — next/image 완전 가이드](/posts/next-image-optimization/)

**다음 글:** [스크립트 최적화 — next/script로 서드파티 스크립트 제어하기](/posts/next-script-optimization/)

<br>
읽어주셔서 감사합니다. 😊
