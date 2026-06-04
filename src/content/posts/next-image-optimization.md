---
title: "이미지 최적화 — next/image 완전 가이드"
description: "Next.js의 next/image 컴포넌트로 이미지를 자동 최적화하는 방법을 설명합니다. WebP/AVIF 변환, 반응형 srcset, LCP 최적화, fill 레이아웃, 원격 이미지 설정까지 실전 패턴을 모두 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 10
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "이미지최적화", "next/image", "WebP", "AVIF", "LCP", "Core Web Vitals"]
featured: false
draft: false
---

[지난 글](/posts/next-sitemap-robots/)에서 sitemap과 robots.txt로 검색 엔진 크롤링을 제어하는 방법을 살펴봤다. SEO의 다른 핵심 축은 **Core Web Vitals**, 그중에서도 가장 큰 비중을 차지하는 LCP(Largest Contentful Paint)다. 대부분의 경우 LCP 요소는 이미지다. Next.js의 `next/image` 컴포넌트는 이미지 최적화를 자동화해 성능을 크게 향상시킨다.

## next/image가 하는 일

일반 `<img>` 태그는 원본 파일 그대로 브라우저에 전달한다. `next/image`는 요청 시 서버에서 이미지를 처리한다.

![next/image 최적화 파이프라인](/assets/posts/next-image-optimization-overview.svg)

- **포맷 변환**: 브라우저가 AVIF/WebP를 지원하면 자동 변환. 지원하지 않으면 원본 포맷.
- **리사이징**: 화면 크기와 `sizes` prop에 따라 최적 크기로 리사이징.
- **Lazy Loading**: 기본값으로 뷰포트 밖 이미지는 로드하지 않음.
- **CLS 방지**: `width`/`height` prop으로 이미지 공간을 미리 예약.
- **캐싱**: 최적화된 이미지는 `_next/image/` 경로에 캐시됨.

## 기본 사용법

```tsx
import Image from 'next/image'

// 로컬 이미지 — 빌드 타임에 크기 자동 감지 (import 방식)
import heroImage from '@/public/hero.jpg'

export default function HeroSection() {
  return (
    <Image
      src={heroImage}
      alt="히어로 이미지"
      priority // LCP 이미지에 필수 — preload 생성됨
      quality={85} // 기본값 75, 최대 100
    />
  )
}
```

로컬 이미지를 `import`로 가져오면 빌드 타임에 크기가 자동으로 감지된다. `width`/`height`를 별도로 지정할 필요가 없다.

## 원격 이미지

URL을 직접 `src`에 넣으려면 먼저 `next.config.js`에서 허용 도메인을 설정해야 한다.

![fill 레이아웃 · 원격 이미지 설정](/assets/posts/next-image-optimization-patterns.svg)

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.paldyn.com',
        port: '',
        pathname: '/uploads/**',
      },
      // GitHub 아바타 허용
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
}

export default nextConfig
```

```tsx
<Image
  src="https://images.paldyn.com/uploads/thumbnail.jpg"
  alt="썸네일"
  width={800}
  height={600}
/>
```

원격 이미지는 크기를 알 수 없으므로 `width`/`height`를 명시해야 한다.

## sizes prop — 반응형 이미지 최적화

`sizes`는 이미지가 화면에서 차지하는 크기를 브라우저에 알려주는 힌트다. 이 값에 따라 srcset 중 어떤 이미지를 다운로드할지 결정된다.

```tsx
// 전체 너비 이미지
<Image
  src="/hero.jpg"
  alt="히어로"
  fill
  sizes="100vw"
/>

// 2단 레이아웃 (md 이하에서는 전체 너비)
<Image
  src="/card.jpg"
  alt="카드"
  width={600}
  height={400}
  sizes="(max-width: 768px) 100vw, 50vw"
/>

// 3단 그리드
<Image
  src="/item.jpg"
  alt="아이템"
  width={400}
  height={300}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>
```

`sizes`를 설정하지 않으면 Next.js는 100vw로 가정해 불필요하게 큰 이미지를 제공할 수 있다.

## fill 레이아웃

이미지 크기를 CSS로 제어하고 싶을 때는 `fill` prop을 사용한다. 부모 요소에 맞게 이미지가 채워진다.

```tsx
// 히어로 배너 — 전체 높이 꽉 채우기
<div
  style={{ position: 'relative', width: '100%', height: '400px' }}
  className="overflow-hidden"
>
  <Image
    src="/banner.jpg"
    alt="배너"
    fill
    style={{ objectFit: 'cover' }}
    sizes="100vw"
    priority
  />
</div>
```

**fill 사용 시 주의사항**:
- 부모에 `position: relative`(또는 absolute/fixed) 필수
- `width`/`height` prop은 지정하지 않음
- `sizes` prop은 반드시 설정 (없으면 100vw 가정)
- 부모 높이는 직접 지정해야 함 (이미지가 높이를 결정하지 않음)

## priority — LCP 최적화

뷰포트 상단에 있는 가장 큰 이미지(LCP 요소)에는 `priority`를 추가한다. Next.js가 해당 이미지에 `<link rel="preload">`를 생성해 브라우저가 가능한 한 빨리 다운로드한다.

```tsx
// 히어로 이미지, 페이지 상단 배너 등에는 priority 필수
<Image
  src="/hero.jpg"
  alt="히어로"
  width={1200}
  height={630}
  priority // 이 prop 없으면 LCP 점수 하락
/>
```

`priority`가 없는 이미지는 `loading="lazy"`로 처리된다. 스크롤해야 보이는 이미지에는 lazy가 맞지만, 최초 뷰포트에 있는 이미지에는 priority를 써야 한다.

## Placeholder — 이미지 로딩 중 UI

이미지가 로드되기 전 빈 공간이 보이는 것을 방지하는 placeholder 옵션이 있다.

```tsx
import Image from 'next/image'
import heroImage from '@/public/hero.jpg'

// blur placeholder — 로컬 이미지에서 자동 생성
<Image
  src={heroImage}
  alt="히어로"
  placeholder="blur"
  priority
/>

// 원격 이미지는 blurDataURL 직접 지정
<Image
  src="https://example.com/image.jpg"
  alt="이미지"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AA..." // Base64 썸네일
/>
```

`blurDataURL`을 자동 생성하려면 빌드 타임에 `plaiceholder` 같은 라이브러리를 써서 각 이미지의 base64 블러 데이터를 미리 생성해두는 방법을 쓸 수 있다.

## next.config 이미지 설정

```typescript
const nextConfig: NextConfig = {
  images: {
    // 지원할 포맷 우선순위 (앞이 우선)
    formats: ['image/avif', 'image/webp'],

    // 반응형 이미지 크기 목록
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // 캐시 TTL (초)
    minimumCacheTTL: 60 * 60, // 1시간

    // SVG는 최적화 제외 (XSS 위험)
    dangerouslyAllowSVG: false,
  },
}
```

`dangerouslyAllowSVG`는 기본값 `false`다. SVG 최적화를 허용하면 XSS 위험이 있으므로 신뢰할 수 없는 SVG 소스가 있다면 활성화하지 않는다.

## 흔한 실수

```tsx
// ❌ alt 빠뜨리기 — 접근성·SEO 모두 나쁨
<Image src="/img.jpg" width={800} height={600} />

// ❌ fill인데 sizes 없음 — 불필요하게 큰 이미지 제공
<Image src="/img.jpg" fill />

// ❌ LCP 이미지에 priority 없음 — Lighthouse 점수 하락
<Image src="/hero.jpg" width={1200} height={630} alt="히어로" />

// ✅ 올바른 패턴
<Image
  src="/hero.jpg"
  alt="히어로 이미지"
  width={1200}
  height={630}
  priority
  sizes="(max-width: 768px) 100vw, 1200px"
/>
```

---

**지난 글:** [sitemap.xml과 robots.txt — 검색 엔진 크롤링 제어](/posts/next-sitemap-robots/)

**다음 글:** [폰트 최적화 — next/font로 웹폰트 성능 개선](/posts/next-font-optimization/)

<br>
읽어주셔서 감사합니다. 😊
