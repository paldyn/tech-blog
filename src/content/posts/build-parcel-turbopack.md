---
title: "Parcel · Turbopack — 무설정·Rust 차세대 번들러"
description: "Parcel 2의 무설정 철학과 멀티스레드 아키텍처, Turbopack의 증분 계산 엔진과 Next.js 통합, 두 도구의 포지셔닝과 선택 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Parcel", "Turbopack", "번들러", "Rust", "무설정", "Next.js", "빌드도구"]
featured: false
draft: false
---

[지난 글](/posts/build-vite/)에서 Vite의 이중 아키텍처와 플러그인 시스템을 살펴봤습니다. 빌드 도구 생태계는 여기서 멈추지 않습니다. **Parcel 2**는 "설정 파일 없이 바로 쓰는 번들러"라는 철학으로, **Turbopack**은 "webpack 후계자"를 자처하며 각기 다른 방향에서 개발자 경험을 개선합니다.

## Parcel 2 — 무설정 번들러

Parcel의 핵심 가치는 단 하나입니다. **설정 파일 없이 바로 작동한다**. `webpack.config.js`, `vite.config.ts`, `rollup.config.js` 없이 엔트리 파일만 지정하면 TypeScript, JSX, CSS Modules, 이미지, WASM이 모두 자동으로 처리됩니다.

### 즉시 시작

```bash
# 설치
npm install --save-dev parcel

# HTML 파일을 엔트리로 직접 실행
npx parcel src/index.html

# 빌드
npx parcel build src/index.html
```

```json
// package.json — 이것이 전부
{
  "source": "src/index.html",
  "scripts": {
    "dev":   "parcel",
    "build": "parcel build"
  }
}
```

```html
<!-- src/index.html — TypeScript 직접 참조 가능 -->
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <script type="module" src="./app.tsx"></script>
  </body>
</html>
```

Parcel이 `app.tsx`를 만나면 자동으로 TypeScript와 JSX 변환기를 설치하고 실행합니다.

### 아키텍처

![Parcel vs Turbopack 포지셔닝 비교](/assets/posts/build-parcel-turbopack-compare.svg)

Parcel 2는 내부적으로 **SWC(Rust)**를 사용해 변환하며, 워커 스레드에서 파일 병렬 처리합니다.

```bash
# 변환 결과 캐시 (.parcel-cache/)
# 두 번째 빌드부터 극적으로 빨라짐
npx parcel build --no-cache  # 캐시 무시

# 특정 포맷으로 라이브러리 빌드
npx parcel build src/index.ts \
  --dist-dir dist \
  --target main
```

### 라이브러리 빌드

```json
{
  "name": "my-lib",
  "source": "src/index.ts",
  "main":   "dist/index.cjs",
  "module": "dist/index.esm.js",
  "types":  "dist/index.d.ts",
  "targets": {
    "main":   { "outputFormat": "commonjs" },
    "module": { "outputFormat": "esmodule" }
  },
  "scripts": {
    "build": "parcel build"
  }
}
```

Parcel은 `targets`에 정의된 모든 포맷을 **동시에 병렬 빌드**합니다.

### Parcel 플러그인

설정 없이 대부분 처리되지만, `.parcelrc`로 커스텀 가능합니다.

```json
// .parcelrc
{
  "extends": "@parcel/config-default",
  "transformers": {
    "*.svg": ["@parcel/transformer-svg-react"]
  },
  "optimizers": {
    "*.{png,jpg,webp}": ["@parcel/optimizer-sharp"]
  }
}
```

## Turbopack — webpack 후계자

Turbopack은 Vercel이 만든 Rust 기반 번들러입니다. **Next.js 15**부터 개발 서버의 기본 번들러로 채택됐습니다.

### 증분 계산 엔진 (Turbo Engine)

Turbopack의 핵심은 **함수 단위 캐싱**입니다. 파일이 변경되면 해당 파일에 의존하는 함수만 재실행합니다. webpack의 모듈 단위 캐싱보다 훨씬 세밀합니다.

```text
webpack HMR: 변경 모듈 → 연결된 모듈 청크 재빌드
Turbopack:   변경 함수 → 해당 함수만 재계산 → 결과 캐시
```

### Next.js에서 사용

![Parcel · Turbopack 사용법](/assets/posts/build-parcel-turbopack-usage.svg)

```bash
# Next.js 15 — Turbopack이 기본값
npx create-next-app@latest

# 개발 서버 (Turbopack 자동 사용)
npm run dev

# 명시적 활성화 (Next.js 14 이하)
next dev --turbo
```

```ts
// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  experimental: {
    turbo: {
      // webpack loader를 Turbopack에서 사용
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
};

export default config;
```

### Turbopack의 현재 상태

2026년 현재 Turbopack은 개발 서버에서 안정화됐지만, **프로덕션 빌드**는 여전히 webpack을 사용합니다. `next build`는 webpack으로 실행됩니다.

```bash
# 프로덕션 Turbopack 빌드 (실험적)
TURBOPACK=1 next build
```

벤치마크에 따르면 Next.js 대형 프로젝트에서:
- 콜드 서버 시작: webpack 대비 최대 76% 단축
- 코드 변경 후 HMR: webpack 대비 최대 95% 단축

## 세 번들러 비교

| | webpack | Vite | Parcel | Turbopack |
|---|---|---|---|---|
| 설정 | 복잡 | 중간 | 없음 | Next.js 내 |
| 개발 속도 | 보통 | 빠름 | 빠름 | 매우 빠름 |
| 생태계 | 광대 | 성장 중 | 작음 | 제한적 |
| 커스텀 | 완전 | 높음 | 낮음 | 낮음 |
| 사용 대상 | 앱·엔터프라이즈 | 앱·라이브러리 | 프로토타입 | Next.js |

## 선택 가이드

```text
소규모 프로토타입, 설정 없이 빠르게 → Parcel
Vue/React SPA, 팀 규모 중소형 → Vite
대형 엔터프라이즈, MFA → webpack
Next.js 앱 → Turbopack (개발) + webpack (빌드)
npm 라이브러리 → Rollup 또는 Vite 라이브러리 모드
```

---

**지난 글:** [Vite — 차세대 프론트엔드 빌드 도구](/posts/build-vite/)

**다음 글:** [소스맵 완전 정복 — 디버깅의 숨은 열쇠](/posts/build-source-map/)

<br>
읽어주셔서 감사합니다. 😊
