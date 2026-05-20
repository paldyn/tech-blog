---
title: "이미지 지연 로딩 — Intersection Observer와 loading 속성"
description: "Intersection Observer로 뷰포트 진입 시 이미지를 로드하는 방법, 브라우저 네이티브 loading='lazy' 속성, WebP·AVIF 포맷 선택, srcset으로 반응형 이미지를 제공하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "성능", "이미지", "지연로딩", "IntersectionObserver", "WebP", "AVIF", "LCP", "최적화"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "perf-request-idle-callback"
  title: "requestIdleCallback — 유휴 시간 활용"
next:
  slug: "perf-critical-css-fonts"
  title: "크리티컬 CSS와 폰트 — 렌더 블로킹 제거"
---

[지난 글](/posts/perf-request-idle-callback/)에서 메인 스레드 유휴 시간을 활용하는 `requestIdleCallback`을 살펴봤습니다. 이번에는 웹 성능에서 가장 큰 비중을 차지하는 **이미지 최적화** — 특히 지연 로딩과 포맷 선택을 다룹니다. 페이지 전체 바이트의 50~70%를 이미지가 차지하는 경우가 많고, 이를 최적화하면 LCP, TTI 모두 드라마틱하게 개선됩니다.

---

## 문제: 뷰포트 밖 이미지를 모두 즉시 로드

```html
<!-- ❌ 페이지 로드 시 모든 이미지를 즉시 다운로드 -->
<img src="hero.jpg" alt="히어로">
<img src="product-1.jpg" alt="상품 1">
<img src="product-2.jpg" alt="상품 2">
<!-- 스크롤해야 보이는 이미지도 즉시 다운로드 -->
<img src="footer-banner.jpg" alt="배너">
```

페이지 로드 시 모든 `<img>`의 `src`가 설정되어 있으면 브라우저는 즉시 병렬로 다운로드를 시작합니다. 스크롤해야 보이는 이미지도 마찬가지입니다. 초기 로드에 불필요한 네트워크 비용이 발생하고 LCP가 나빠집니다.

---

## 방법 1: loading="lazy" (네이티브)

```html
<!-- ✅ 브라우저 네이티브 지연 로딩 — JS 불필요 -->
<img src="product.jpg" alt="상품" loading="lazy" width="400" height="300">
```

Chrome 77+ 이상에서 지원하며, 뷰포트 근처에 이미지가 접근할 때 브라우저가 자동으로 로드합니다. **`width`와 `height` 명시**가 필수입니다. 그래야 브라우저가 이미지 자리를 미리 확보해 레이아웃 시프트(CLS)를 방지합니다.

**주의**: **히어로 이미지(LCP 후보)에는 절대 `loading="lazy"`를 쓰면 안 됩니다.** 가장 중요한 이미지의 로드가 지연되어 LCP 점수가 크게 낮아집니다.

```html
<!-- LCP 이미지: fetchpriority="high" + lazy 없음 -->
<img src="hero.jpg" alt="히어로" fetchpriority="high" width="1200" height="600">

<!-- 폴드 아래 이미지: lazy -->
<img src="below-fold.jpg" alt="설명" loading="lazy" width="400" height="300">
```

---

## 방법 2: Intersection Observer

`loading="lazy"`를 지원하지 않거나, 더 세밀한 제어가 필요할 때 사용합니다.

![Intersection Observer 지연 로딩](/assets/posts/perf-image-lazy-load-intersection.svg)

```js
const lazyImages = document.querySelectorAll('img[data-src]');

const observer = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    const img = entry.target;
    img.src = img.dataset.src;
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    img.removeAttribute('data-src');
    obs.unobserve(img); // 로드 완료 후 옵저버 해제
  });
}, {
  rootMargin: '200px 0px', // 뷰포트 200px 전에 미리 로드
  threshold: 0
});

lazyImages.forEach(img => observer.observe(img));
```

```html
<!-- data-src에 실제 URL, src에는 placeholder -->
<img
  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'/%3E"
  data-src="product.jpg"
  data-srcset="product-480.jpg 480w, product-800.jpg 800w"
  alt="상품"
  width="400" height="300"
>
```

`rootMargin: '200px'`으로 뷰포트보다 200px 앞에서 미리 로드를 시작하면, 사용자가 스크롤해서 이미지 위치에 도달했을 때 이미 로딩이 완료된 상태가 됩니다.

---

## 이미지 포맷과 크기 최적화

지연 로딩으로 불필요한 다운로드를 막는 것만큼, **이미지 자체의 크기를 줄이는 것**도 중요합니다.

![이미지 최적화 — 포맷·크기·loading](/assets/posts/perf-image-lazy-load-formats.svg)

### WebP·AVIF 사용

```html
<picture>
  <!-- AVIF: 최신 포맷, JPEG 대비 ~50% 절감 -->
  <source type="image/avif" srcset="img.avif">
  <!-- WebP: JPEG 대비 ~30% 절감, 광범위한 지원 -->
  <source type="image/webp" srcset="img.webp">
  <!-- 폴백: 구형 브라우저 -->
  <img src="img.jpg" alt="설명" loading="lazy" width="800" height="600">
</picture>
```

### 반응형 srcset

```html
<img
  src="img-800.jpg"
  srcset="img-480.jpg 480w, img-800.jpg 800w, img-1200.jpg 1200w"
  sizes="(max-width: 600px) 480px, (max-width: 900px) 800px, 1200px"
  alt="설명"
  loading="lazy"
  width="1200" height="800"
>
```

`sizes`는 CSS처럼 미디어 쿼리를 사용해 각 뷰포트 크기에서 이미지가 실제로 차지하는 폭을 브라우저에 힌트로 줍니다. 브라우저는 이를 기반으로 `srcset` 중 최적의 해상도를 선택합니다.

---

## 블러 업 패턴 (LQIP)

```js
// Low Quality Image Placeholder (LQIP)
// 초저해상도 placeholder를 즉시 보여주고, 고해상도로 교체
function loadHighRes(img) {
  const hi = new Image();
  hi.onload = () => {
    img.src = hi.src;
    img.classList.add('loaded'); // CSS로 blur 제거
  };
  hi.src = img.dataset.src;
}

// CSS
// img { filter: blur(20px); transition: filter 0.3s; }
// img.loaded { filter: none; }
```

---

## 정리

| 기법 | 효과 | 주의 |
|---|---|---|
| `loading="lazy"` | JS 없이 지연 로딩 | LCP 이미지엔 금지 |
| `Intersection Observer` | 세밀한 제어, rootMargin 활용 | unobserve 잊지 말 것 |
| WebP/AVIF | 30~50% 파일 크기 절감 | `<picture>` 폴백 필수 |
| `srcset` + `sizes` | 뷰포트에 맞는 해상도 제공 | sizes 정확히 설정 |
| `width`/`height` 명시 | CLS(레이아웃 시프트) 방지 | 필수 |

---

**지난 글:** [requestIdleCallback — 유휴 시간 활용](/posts/perf-request-idle-callback/)

**다음 글:** [크리티컬 CSS와 폰트 — 렌더 블로킹 제거](/posts/perf-critical-css-fonts/)

<br>
읽어주셔서 감사합니다. 😊
