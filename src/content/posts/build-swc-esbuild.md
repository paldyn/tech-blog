---
title: "SWC · esbuild — Rust·Go 기반 초고속 변환기"
description: "SWC와 esbuild의 아키텍처, Babel 대비 속도 우위의 원리, @swc/core API, esbuild build API, 플러그인 한계, Next.js·Vite가 이 도구들을 어떻게 활용하는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "SWC", "esbuild", "Rust", "Go", "트랜스파일러", "번들러", "빌드도구"]
featured: false
draft: false
---

[지난 글](/posts/build-babel/)에서 Babel의 파이프라인과 플러그인 시스템을 살펴봤습니다. Babel은 기능이 완전하지만, 대규모 코드베이스에서 빌드 시간이 수십 초를 넘기 시작하면 개발자 경험이 급격히 나빠집니다. 이를 해결하기 위해 등장한 것이 **SWC**(Rust)와 **esbuild**(Go)입니다. 두 도구는 각기 다른 방식으로 속도 문제를 해결하며, 지금은 사실상 모든 주요 프레임워크의 내부 엔진으로 자리를 잡았습니다.

## 왜 이렇게 빠른가

![SWC vs esbuild vs Babel 비교](/assets/posts/build-swc-esbuild-compare.svg)

Babel이 JavaScript로 구현된 데 비해, SWC는 Rust, esbuild는 Go로 작성됐습니다. 속도 차이의 핵심 이유는 두 가지입니다.

1. **컴파일 언어**: Rust와 Go는 네이티브 바이너리로 컴파일됩니다. JIT 워밍업 없이 즉시 최대 속도로 실행됩니다.
2. **병렬 처리**: esbuild는 Go의 goroutine을 활용해 파일 파싱·링킹을 완전히 병렬화합니다. SWC도 Rayon 크레이트를 통해 멀티스레드 변환을 지원합니다.

두 도구 모두 **타입 검사를 생략**합니다. TypeScript 파일에서 타입 정보를 그냥 제거(erase)할 뿐, 타입 오류는 별도 `tsc --noEmit`으로 잡아야 합니다. 이것이 속도 우위의 또 다른 이유입니다.

## SWC 상세

SWC(Speedy Web Compiler)는 Vercel이 관리하는 Rust 기반 트랜스파일러입니다. **Next.js**는 v12부터 Babel을 SWC로 교체해 로컬 빌드 시간을 3배 단축했습니다.

### @swc/core API

```bash
npm install --save-dev @swc/core @swc/cli
```

```js
import { transform, transformFile } from '@swc/core';

// 문자열 소스 변환
const { code, map } = await transform(`
  const greet = (name: string) => \`Hello, \${name}!\`;
`, {
  filename: 'index.ts',
  sourceMaps: true,
  jsc: {
    parser: { syntax: 'typescript', tsx: false },
    target: 'es2020',
    transform: {
      // React 17+ JSX transform
      react: { runtime: 'automatic' }
    }
  },
  module: { type: 'es6' }
});

// 파일 직접 변환
await transformFile('./src/index.ts', { /* 동일 옵션 */ });
```

```bash
# CLI 사용
npx swc src -d dist --source-maps
npx swc src/index.ts -o dist/index.js
```

### .swcrc 설정 파일

```json
{
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": true,
      "decorators": true
    },
    "transform": {
      "react": {
        "runtime": "automatic",
        "importSource": "react"
      }
    },
    "target": "es2020",
    "loose": false,
    "externalHelpers": true
  },
  "module": { "type": "es6" },
  "sourceMaps": true,
  "exclude": ["node_modules"]
}
```

`externalHelpers: true`를 사용하면 `@swc/helpers` 패키지에서 헬퍼 함수를 import해 번들 크기를 줄일 수 있습니다.

## esbuild 상세

esbuild는 Evan Wallace가 만든 Go 기반 번들러입니다. 번들링, 변환, 최소화를 단일 도구로 처리합니다. Babel 대비 최대 100배 빠르다는 벤치마크로 JavaScript 빌드 생태계에 충격을 줬습니다.

### build API

![SWC · esbuild 설정 코드](/assets/posts/build-swc-esbuild-usage.svg)

```bash
npm install --save-dev esbuild
```

```js
import * as esbuild from 'esbuild';

// 번들 빌드
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,           // 의존성 번들링
  outdir: 'dist',
  platform: 'browser',   // 또는 'node'
  target: ['chrome90', 'firefox88'],
  format: 'esm',
  splitting: true,        // 코드 스플리팅 (esm만 지원)
  sourcemap: true,
  minify: true,
  external: ['react', 'react-dom'],  // 번들에서 제외
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});
```

### transform API (파일 단위)

```js
const result = await esbuild.transform(`
  const fn = async (x: number) => x ** 2;
`, {
  loader: 'ts',
  target: 'es2018',
  minify: false,
});
console.log(result.code);
```

### watch 모드 (개발 서버)

```js
const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist',
});

// 변경 감지 후 자동 재빌드
await ctx.watch();

// 내장 개발 서버 (선택)
const { host, port } = await ctx.serve({ servedir: 'dist' });
console.log(`http://${host}:${port}`);
```

## 플러그인 한계

SWC와 esbuild 모두 커스텀 플러그인을 지원하지만 Babel만큼 풍부하지 않습니다.

```js
// esbuild 플러그인 예시: .yaml 파일 처리
import yaml from 'js-yaml';
import { readFileSync } from 'fs';

const yamlPlugin = {
  name: 'yaml',
  setup(build) {
    build.onLoad({ filter: /\.ya?ml$/ }, (args) => {
      const text = readFileSync(args.path, 'utf8');
      const data = yaml.load(text);
      return {
        contents: `export default ${JSON.stringify(data)}`,
        loader: 'js',
      };
    });
  },
};

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist',
  plugins: [yamlPlugin],
});
```

SWC의 플러그인은 Wasm으로 컴파일된 Rust 코드여야 합니다. JavaScript로 SWC 플러그인을 작성하는 것은 현재 지원되지 않습니다.

## 프레임워크에서의 활용

| 프레임워크 | SWC | esbuild |
|-----------|-----|---------|
| Next.js | TS/JSX 변환 (기본) | — |
| Vite | — | 의존성 사전 번들링 |
| Remix | esbuild 컴파일 | 번들링 |
| Turbopack | SWC 기반 | — |
| Jest (swc) | `@swc/jest` 변환 | — |

Vite는 의존성(node_modules)은 esbuild로 사전 번들링하고, 사용자 코드는 Rollup으로 번들링하는 **이중 구조**를 사용합니다. 다음 글에서 다룰 Vite에서 자세히 살펴봅니다.

## Babel에서 마이그레이션

### Jest에서 Babel → SWC

```bash
npm uninstall babel-jest @babel/core @babel/preset-env
npm install --save-dev @swc/core @swc/jest
```

```js
// jest.config.js
export default {
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
};
```

### webpack에서 babel-loader → swc-loader

```js
// webpack.config.js
{
  test: /\.(ts|tsx)$/,
  use: {
    loader: 'swc-loader',
    options: {
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        target: 'es2020',
      }
    }
  }
}
```

## 선택 기준

- **Babel**: 커스텀 플러그인이 필수이거나, 레거시 생태계와 호환이 필요한 경우
- **SWC**: Next.js·Vite 프로젝트, Jest 속도를 높이고 싶은 경우
- **esbuild**: Node.js 라이브러리 빌드, 초고속 번들링이 필요한 스크립트/CLI 도구

세 도구를 조합하는 것도 흔한 패턴입니다. Vite가 좋은 예입니다.

---

**지난 글:** [Babel 완전 해부 — 트랜스파일러의 동작 원리](/posts/build-babel/)

**다음 글:** [webpack — 모듈 번들러의 완전 정복](/posts/build-webpack/)

<br>
읽어주셔서 감사합니다. 😊
