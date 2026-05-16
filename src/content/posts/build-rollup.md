---
title: "Rollup — 라이브러리 번들러의 표준"
description: "Rollup이 라이브러리 배포에 최적화된 이유, ESM·CJS·UMD 다중 포맷 출력, Tree Shaking 원리, @rollup/plugin-typescript와 vite-plugin 생태계, package.json exports 필드까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Rollup", "번들러", "라이브러리", "Tree Shaking", "ESM", "CJS", "빌드도구"]
featured: false
draft: false
---

[지난 글](/posts/build-webpack/)에서 webpack의 의존성 그래프와 코드 스플리팅을 살펴봤습니다. webpack이 웹 애플리케이션에 최적화된 반면, **Rollup**은 **라이브러리 배포**에 최적화된 번들러입니다. React, Vue, Svelte, D3 등 거의 모든 주요 라이브러리가 Rollup으로 빌드됩니다. Vite도 내부적으로 Rollup을 사용합니다.

## Rollup이 선택받는 이유

1. **깔끔한 출력물** — webpack처럼 복잡한 런타임 코드 없이, 작성한 코드와 거의 동일한 읽기 좋은 번들 생성
2. **완전한 Tree Shaking** — ES 정적 분석 기반으로 미사용 코드를 정확히 제거
3. **다중 포맷 출력** — 하나의 소스에서 ESM, CJS, UMD, IIFE를 동시에 생성
4. **작은 번들 크기** — 라이브러리 배포 시 peer dependency를 번들에서 제외하기 쉬움

## 설치와 기본 사용

```bash
npm install --save-dev rollup @rollup/plugin-typescript \
  @rollup/plugin-node-resolve @rollup/plugin-commonjs
npx rollup --config
```

## 다중 포맷 출력

![Rollup 출력 포맷 비교](/assets/posts/build-rollup-formats.svg)

하나의 `rollup.config.js`로 여러 포맷을 동시에 빌드하는 것이 Rollup의 핵심 가치입니다.

```js
// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

const pkg = JSON.parse(
  await import('fs').then(fs => fs.promises.readFile('./package.json', 'utf-8'))
);

// 모든 외부 의존성을 번들에서 제외
const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

export default [
  // 1. ESM + CJS 번들
  {
    input: 'src/index.ts',
    external,
    plugins: [resolve(), commonjs(), typescript({ tsconfig: './tsconfig.build.json' })],
    output: [
      { file: pkg.exports['.'].import, format: 'esm', sourcemap: true },
      { file: pkg.exports['.'].require, format: 'cjs', sourcemap: true, exports: 'named' },
    ],
  },
  // 2. UMD (CDN 배포용)
  {
    input: 'src/index.ts',
    plugins: [resolve(), commonjs(), typescript(), terser()],
    output: {
      file: 'dist/index.umd.min.js',
      format: 'umd',
      name: 'MyLibrary',       // 전역 변수 이름
      globals: { react: 'React' },
    },
  },
  // 3. 타입 선언 파일 (.d.ts)
  {
    input: 'src/index.ts',
    plugins: [dts()],
    output: { file: pkg.exports['.'].types, format: 'esm' },
  },
];
```

## Tree Shaking 원리

![Rollup Tree Shaking](/assets/posts/build-rollup-treeshake.svg)

Rollup의 Tree Shaking은 ES 모듈의 **정적 구조**에 기반합니다. `import`/`export`는 항상 파일 최상위에 정적으로 선언되기 때문에, 파싱 단계에서 실제로 사용되는 export를 추적할 수 있습니다.

```js
// ❌ CommonJS — Tree Shaking 불가
const { add } = require('./utils'); // 런타임에 결정

// ✅ ESM — Tree Shaking 가능
import { add } from './utils';      // 정적 분석 가능
```

### sideEffects 설정

라이브러리 배포 시 `package.json`에 사이드이펙트를 명시해야 최적화 도구들이 Tree Shaking을 안전하게 적용할 수 있습니다.

```json
{
  "name": "my-library",
  "sideEffects": false
}
```

전역 CSS나 폴리필 파일처럼 import하면 사이드이펙트가 있는 경우:

```json
{
  "sideEffects": ["**/*.css", "src/polyfills.js"]
}
```

## package.json exports 필드

라이브러리를 올바르게 배포하려면 `exports` 필드를 사용해 환경별 진입점을 지정해야 합니다.

```json
{
  "name": "my-library",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "import":  "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types":   "./dist/index.d.ts"
    },
    "./utils": {
      "import":  "./dist/utils.mjs",
      "require": "./dist/utils.cjs",
      "types":   "./dist/utils.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts"
}
```

`exports` 필드가 있으면 `main`과 `module`은 구형 번들러를 위한 폴백입니다. Node.js 12+와 모던 번들러는 `exports`를 우선합니다.

## 플러그인 생태계

```bash
# 핵심 플러그인
npm install --save-dev \
  @rollup/plugin-node-resolve \   # node_modules 해석
  @rollup/plugin-commonjs \       # CJS → ESM 변환
  @rollup/plugin-typescript \     # TS 변환
  @rollup/plugin-alias \          # 경로 별칭
  @rollup/plugin-replace \        # 텍스트 치환
  @rollup/plugin-terser \         # 최소화
  rollup-plugin-dts \             # .d.ts 번들
  rollup-plugin-peer-deps-external  # peerDeps 자동 external
```

### 커스텀 플러그인 작성

```js
// 모든 export에 JSDoc 주석을 추가하는 플러그인 (예시)
function addJsDocPlugin() {
  return {
    name: 'add-jsdoc',
    renderChunk(code) {
      return { code: `/** @module my-library */\n${code}`, map: null };
    },
  };
}
```

Rollup 플러그인은 Vite 플러그인과 **API 호환**됩니다. Rollup 플러그인을 Vite에서 그대로 사용할 수 있는 경우가 많습니다.

## webpack vs Rollup 선택 기준

| 시나리오 | 선택 |
|---------|------|
| React/Vue 웹 애플리케이션 | webpack (또는 Vite) |
| npm 라이브러리 배포 | **Rollup** |
| UI 컴포넌트 라이브러리 | **Rollup** |
| Node.js CLI 도구 | esbuild 또는 Rollup |
| 마이크로프론트엔드 | webpack (Module Federation) |

---

**지난 글:** [webpack — 모듈 번들러의 완전 정복](/posts/build-webpack/)

**다음 글:** [Vite — 차세대 프론트엔드 빌드 도구](/posts/build-vite/)

<br>
읽어주셔서 감사합니다. 😊
