---
title: "Vite — 차세대 프론트엔드 빌드 도구"
description: "Vite의 이중 아키텍처(개발:ESM Native·프로덕션:Rollup), 사전 번들링, HMR, 환경 변수, CSS Modules, Glob Import, 라이브러리 모드, 커스텀 플러그인 작성까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Vite", "번들러", "HMR", "ESM", "Rollup", "esbuild", "프론트엔드빌드"]
featured: false
draft: false
---

[지난 글](/posts/build-rollup/)에서 Rollup이 라이브러리 배포의 표준이 된 이유를 살펴봤습니다. **Vite**는 Evan You(Vue 제작자)가 만든 프론트엔드 빌드 도구입니다. 개발 환경에서 브라우저의 네이티브 ESM을 직접 활용해 번들링 없이 서버를 시작하고, 프로덕션 빌드는 Rollup에 위임하는 **이중 아키텍처**가 핵심입니다. 2021년 등장 이후 가장 빠르게 성장한 프론트엔드 빌드 도구입니다.

## 왜 Vite인가

기존 webpack 기반 개발 서버는 코드를 수정하면 전체 번들을 다시 빌드한 뒤 Hot Update를 적용합니다. 프로젝트 규모가 커질수록 서버 시작 시간과 HMR 반응 속도가 느려지는 구조적 한계가 있습니다.

Vite는 두 가지 방식으로 이를 해결합니다.

1. **사전 번들링**: `node_modules` 의존성을 esbuild로 한 번만 번들링해 `.vite/` 캐시에 저장
2. **네이티브 ESM 서버**: 소스 코드는 번들 없이 브라우저가 직접 `import`로 요청, 서버는 요청된 파일만 변환해 응답

![Vite 이중 아키텍처](/assets/posts/build-vite-architecture.svg)

## 시작하기

```bash
# 템플릿으로 프로젝트 생성
npm create vite@latest my-app -- --template react-ts
cd my-app && npm install && npm run dev
```

생성되는 기본 구조:

```
my-app/
├── public/          # 정적 파일 (Vite가 변환하지 않음)
├── src/
│   ├── main.ts
│   └── App.tsx
├── index.html       # 진입점 (webpack과 달리 루트에 위치)
├── vite.config.ts
└── tsconfig.json
```

`index.html`이 프로젝트 루트에 있는 이유는 Vite가 HTML을 진입점으로 직접 처리하기 때문입니다. `<script type="module" src="/src/main.ts">`가 브라우저의 ESM 요청 출발점이 됩니다.

## vite.config.ts 핵심 옵션

```ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc'; // SWC 사용
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      visualizer({ open: true, gzipSize: true }),
    ],
    resolve: {
      alias: { '@': '/src' },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': { target: 'http://localhost:4000', changeOrigin: true },
      },
    },
    build: {
      target: 'esnext',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            router: ['react-router-dom'],
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(env.npm_package_version),
    },
  };
});
```

## 환경 변수

Vite는 `.env` 파일을 자동으로 로드합니다. 클라이언트 코드에 노출되는 변수는 **`VITE_` 접두사**가 필수입니다.

```
# .env
VITE_API_URL=https://api.example.com
DB_PASSWORD=secret    # VITE_ 없음 → 클라이언트 노출 안 됨
```

```ts
// 클라이언트 코드
const apiUrl = import.meta.env.VITE_API_URL;
const isProd = import.meta.env.PROD;      // boolean
const isDev  = import.meta.env.DEV;       // boolean
const mode   = import.meta.env.MODE;      // 'development' | 'production'
```

## 플러그인 시스템

![Vite 플러그인 & 주요 기능](/assets/posts/build-vite-plugins.svg)

Rollup 플러그인 훅과 호환됩니다. Vite 전용 훅도 있습니다.

```ts
// 커스텀 Vite 플러그인 — 모든 .svg를 React 컴포넌트로 변환
import { readFileSync } from 'fs';

function svgPlugin() {
  return {
    name: 'svg-react',
    transform(src: string, id: string) {
      if (!id.endsWith('.svg')) return;
      const svg = readFileSync(id, 'utf-8');
      // SVG를 React 컴포넌트로 래핑
      return {
        code: `
          import React from 'react';
          export default function SvgIcon(props) {
            return React.createElement('div', {
              dangerouslySetInnerHTML: { __html: ${JSON.stringify(svg)} },
              ...props
            });
          }
        `,
        map: null,
      };
    },
  };
}
```

## CSS 지원

```ts
// vite.config.ts — CSS Modules 설정
css: {
  modules: {
    localsConvention: 'camelCaseOnly',
  },
  preprocessorOptions: {
    scss: { additionalData: `@use "@/styles/variables" as *;` },
  },
  postcss: './postcss.config.js',
},
```

```ts
// 컴포넌트에서
import styles from './Button.module.css';
// → styles.primaryButton (camelCase 변환)
```

## 라이브러리 모드

Vite는 라이브러리 빌드도 지원합니다. 내부적으로 Rollup을 사용합니다.

```ts
// vite.config.ts — 라이브러리 모드
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyLib',
      fileName: (format) => `my-lib.${format}.js`,
      formats: ['es', 'cjs', 'umd'],
    },
    rollupOptions: {
      external: ['react'],
      output: { globals: { react: 'React' } },
    },
  },
});
```

## Vite의 한계

- **CommonJS 의존성**: CJS 모듈은 esbuild 사전 번들링이 필수. 일부 레거시 패키지에서 호환 문제 발생
- **개발/프로덕션 불일치**: 개발은 ESM 서버, 프로덕션은 Rollup 번들 — 드물지만 동작 차이 발생 가능
- **대규모 MFA**: Module Federation이 없음 (Vite Federation 플러그인으로 부분 대응)

---

**지난 글:** [Rollup — 라이브러리 번들러의 표준](/posts/build-rollup/)

**다음 글:** [Parcel · Turbopack — 무설정·Rust 번들러](/posts/build-parcel-turbopack/)

<br>
읽어주셔서 감사합니다. 😊
