---
title: "크리티컬 CSS와 폰트 — 렌더 블로킹 제거"
description: "CSS와 웹 폰트가 FCP를 블로킹하는 원리, 크리티컬 CSS 인라인 전략, 비동기 CSS 로딩, font-display: swap·preload·unicode-range 서브셋으로 폰트 로딩을 최적화하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "성능", "CSS", "폰트", "렌더블로킹", "FCP", "크리티컬CSS", "font-display", "preload", "최적화"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "perf-image-lazy-load"
  title: "이미지 지연 로딩 — Intersection Observer와 loading 속성"
next:
  slug: "perf-core-web-vitals"
  title: "Core Web Vitals — LCP·INP·CLS 완전 가이드"
---

[지난 글](/posts/perf-image-lazy-load/)에서 이미지를 뷰포트 진입 시에만 로드하는 방법을 살펴봤습니다. 이번에는 **렌더 블로킹**의 주요 원인인 CSS와 웹 폰트를 최적화하는 방법을 다룹니다. FCP(First Contentful Paint)를 빠르게 하려면 초기 렌더에 필요한 리소스를 최소화하고, 나머지는 비동기로 로드해야 합니다.

---

## CSS는 왜 렌더를 블로킹하는가

브라우저는 `<link rel="stylesheet">`를 발견하면 해당 CSS를 완전히 다운로드하고 파싱할 때까지 렌더 트리 생성을 중단합니다. CSSOM이 없으면 렌더 트리를 만들 수 없기 때문입니다.

```html
<!-- ❌ 렌더 블로킹 — style.css가 로드될 때까지 화면 아무것도 안 보임 -->
<head>
  <link rel="stylesheet" href="style.css">
</head>
```

큰 CSS 파일이 느린 네트워크에서 로딩되는 동안 사용자는 빈 화면을 봅니다.

---

## 크리티컬 CSS 전략

**크리티컬 CSS**는 초기 뷰포트(Above the fold)를 렌더링하는 데 필요한 최소한의 CSS를 `<style>` 태그로 인라인화하는 기법입니다.

![렌더 블로킹 vs 최적화된 로딩](/assets/posts/perf-critical-css-fonts-render-blocking.svg)

```html
<head>
  <!-- ✅ 크리티컬 CSS: 인라인으로 렌더 블로킹 없이 즉시 적용 -->
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; }
    header { background: #fff; height: 60px; }
    .hero { max-width: 1200px; margin: 0 auto; }
  </style>

  <!-- 나머지 CSS: media="print"로 블로킹 해제 후 비동기 로드 -->
  <link
    rel="stylesheet"
    href="main.css"
    media="print"
    onload="this.media='all'"
  >
  <!-- JS 비활성화 대비 폴백 -->
  <noscript><link rel="stylesheet" href="main.css"></noscript>
</head>
```

`media="print"` 트릭의 원리: 브라우저는 현재 미디어(화면)에 해당하지 않는 CSS는 렌더를 블로킹하지 않고 낮은 우선순위로 다운로드합니다. `onload`에서 `media='all'`로 변경하면 로드 완료 후 즉시 적용됩니다.

---

## 크리티컬 CSS 자동 추출

수동으로 크리티컬 CSS를 추출하기는 어렵습니다. 자동화 도구를 씁니다.

```bash
# critical 패키지로 자동 추출
npx critical index.html --base ./ --inline --width 1300 --height 900
```

```js
// Vite 플러그인으로 빌드 시 자동화
import { defineConfig } from 'vite';
import critical from 'vite-plugin-critical';

export default defineConfig({
  plugins: [
    critical({
      criticalUrl: 'http://localhost:3000',
      criticalBase: './dist',
      criticalPages: [{ uri: '/', template: 'index' }],
      criticalConfig: { inline: true, width: 1300, height: 900 }
    })
  ]
});
```

---

## 웹 폰트 최적화

웹 폰트는 또 다른 렌더 블로킹 원인입니다. 브라우저가 CSSOM을 파싱하다가 `@font-face`를 발견하면 폰트 파일을 다운로드하기 전까지 텍스트를 표시하지 않거나(FOIT) 폴백 폰트로 렌더한 뒤 교체(FOUT)합니다.

![폰트 최적화 — preload·font-display·서브셋](/assets/posts/perf-critical-css-fonts-preload.svg)

### font-display: swap

```css
@font-face {
  font-family: 'Pretendard';
  src: url('/fonts/pretendard-variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap; /* 폴백 폰트로 즉시 렌더, 로드 후 교체 */
}
```

`font-display: swap`은 폰트 다운로드를 기다리지 않고 즉시 시스템 폰트로 텍스트를 렌더합니다. 폰트가 로드되면 교체합니다. FCP를 빠르게 하는 데 가장 효과적인 설정입니다.

### rel="preload" 로 폰트 우선 로드

```html
<link
  rel="preload"
  href="/fonts/pretendard-kr.woff2"
  as="font"
  type="font/woff2"
  crossorigin
>
```

`rel="preload"`는 HTML 파서가 `<head>`를 읽는 즉시 폰트 다운로드를 시작합니다. CSS에서 `@font-face`를 파싱한 뒤에야 폰트를 발견하는 것보다 훨씬 일찍 로드가 시작됩니다. `crossorigin` 속성은 폰트 요청에 CORS 헤더를 포함하므로 반드시 붙여야 합니다(빠뜨리면 두 번 다운로드됨).

### unicode-range 서브셋

```css
/* 라틴 문자만 포함한 서브셋 */
@font-face {
  font-family: 'Pretendard';
  src: url('/fonts/pretendard-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}

/* 한글만 포함한 서브셋 */
@font-face {
  font-family: 'Pretendard';
  src: url('/fonts/pretendard-kr.woff2') format('woff2');
  unicode-range: U+AC00-D7A3, U+3130-318F;
}
```

`unicode-range`를 사용하면 브라우저는 해당 유니코드 범위의 글자가 실제로 페이지에 있을 때만 해당 서브셋을 다운로드합니다. 한국어와 영어를 분리하면 영어만 쓰는 페이지에서는 한글 폰트 파일을 전혀 다운로드하지 않습니다.

---

## self-hosting vs Google Fonts

```html
<!-- Google Fonts: 편리하지만 외부 연결 필요 -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR&display=swap" rel="stylesheet">

<!-- ✅ self-hosting: 외부 DNS 조회 없음, 더 빠른 로드 -->
<!-- Fontsource npm 패키지로 로컬 서빙 -->
```

```bash
npm install @fontsource/pretendard
```

```js
// 앱 진입점에서 필요한 웨이트만 임포트
import '@fontsource/pretendard/400.css';
import '@fontsource/pretendard/700.css';
```

self-hosting은 외부 도메인 DNS 조회와 TCP 연결 비용을 없애고, HTTP/2 멀티플렉싱의 이점을 그대로 받습니다.

---

## 정리

- 크리티컬 CSS를 `<style>` 인라인으로 넣고, 나머지 CSS는 `media="print"` + `onload` 트릭으로 비동기 로드합니다.
- 웹 폰트에 `font-display: swap`을 설정해 FOIT(텍스트 숨김)을 방지합니다.
- 주요 폰트는 `<link rel="preload">`로 조기 요청합니다.
- `unicode-range` 서브셋으로 실제 사용하는 문자 범위만 다운로드합니다.
- 가능하면 폰트를 self-hosting해 외부 연결 비용을 제거합니다.

---

**지난 글:** [이미지 지연 로딩 — Intersection Observer와 loading 속성](/posts/perf-image-lazy-load/)

**다음 글:** [Core Web Vitals — LCP·INP·CLS 완전 가이드](/posts/perf-core-web-vitals/)

<br>
읽어주셔서 감사합니다. 😊
