---
title: "코드 스플리팅 심층 분석 — 최적 청킹 전략"
description: "코드 스플리팅의 세 가지 방법(Entry·Dynamic Import·splitChunks), React.lazy와 Suspense, Prefetch/Preload 힌트, runtimeChunk 분리, contenthash 캐시 전략, 청크 크기 최적화까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "코드스플리팅", "Dynamic Import", "webpack", "Vite", "React.lazy", "캐시전략", "성능최적화"]
featured: false
draft: false
---

[지난 글](/posts/build-tree-shaking-deep/)에서 Tree Shaking으로 미사용 코드를 제거하는 방법을 살펴봤습니다. 번들 크기를 줄이는 또 다른 핵심 전략이 **코드 스플리팅**입니다. 하나의 거대한 번들 대신 여러 청크로 분할해, 초기 로드 시 필요한 코드만 받고 나머지는 필요할 때 지연 로드합니다.

## 왜 코드 스플리팅이 필요한가

SPA(Single Page Application)는 모든 라우트·기능이 하나의 JavaScript 파일에 묶이기 쉽습니다. 사용자가 랜딩 페이지만 보는데 차트 라이브러리 300KB, 어드민 페이지 200KB가 같이 로드됩니다.

코드 스플리팅의 이점:

1. **초기 로드 단축** — 필요한 코드만 다운로드
2. **병렬 다운로드** — 브라우저가 여러 청크를 동시에 다운로드
3. **캐시 효율** — 자주 바뀌는 앱 코드와 안 바뀌는 벤더 코드 분리

![코드 스플리팅 전략](/assets/posts/build-code-splitting-strategy.svg)

## 세 가지 스플리팅 방법

### 1. Entry Points (수동 분할)

```js
// webpack.config.js
entry: {
  main:  './src/main.ts',
  admin: './src/admin.ts',
},
```

각 Entry에서 시작되는 의존성 그래프를 독립 청크로 빌드합니다. 단순하지만 공유 모듈이 중복될 수 있습니다. `splitChunks`와 함께 사용해야 효과적입니다.

### 2. Dynamic Import (지연 로드)

가장 강력한 방법입니다. 런타임에 필요할 때 청크를 요청합니다.

```js
// 이벤트 트리거 시 로드
button.addEventListener('click', async () => {
  const { createChart } = await import('./chart');
  createChart('#container', data);
});

// 조건부 로드
if (user.isAdmin) {
  const { AdminPanel } = await import('./AdminPanel');
  render(AdminPanel);
}
```

#### webpack 매직 주석

```js
// 청크 이름 지정
const { Modal } = await import(
  /* webpackChunkName: "modal" */
  './Modal'
);

// Prefetch: 브라우저 유휴 시간에 미리 다운로드
const { Chart } = await import(
  /* webpackChunkName: "chart" */
  /* webpackPrefetch: true */
  './Chart'
);

// Preload: 현재 내비게이션과 함께 높은 우선순위로 로드
const { Hero } = await import(
  /* webpackPreload: true */
  './Hero'
);
```

### 3. splitChunks / manualChunks (자동 분할)

![splitChunks · manualChunks 설정](/assets/posts/build-code-splitting-config.svg)

## React.lazy + Suspense

React에서 Dynamic Import를 UI와 통합하는 공식 패턴입니다.

```tsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// 청크 단위로 분할
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings  = lazy(() => import('./pages/Settings'));
const Admin     = lazy(() => import('./pages/Admin'));

// 앱 라우터
function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings"  element={<Settings />}  />
        <Route path="/admin"     element={<Admin />}     />
      </Routes>
    </Suspense>
  );
}
```

빌드 시 각 `lazy()` 인자 경로가 독립 청크로 분리됩니다. 라우트 이동 시 해당 청크만 다운로드합니다.

### 에러 경계와 함께

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function AppWithBoundary() {
  return (
    <ErrorBoundary fallback={<p>페이지 로드 실패</p>}>
      <Suspense fallback={<Spinner />}>
        <Dashboard />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## contenthash와 장기 캐시 전략

분할된 청크의 파일 이름에 `[contenthash]`를 사용하면 파일 내용이 바뀔 때만 해시가 변경됩니다. CDN 캐시를 최대한 활용할 수 있습니다.

```js
// webpack.config.js
output: {
  filename:       '[name].[contenthash:8].js',
  chunkFilename:  '[name].[contenthash:8].chunk.js',
},
optimization: {
  runtimeChunk: 'single',   // 런타임 코드를 별도 청크로 분리
  // 런타임 청크는 자주 바뀌므로 분리해야 vendor 해시가 안정됨
},
```

**`runtimeChunk: 'single'`이 왜 필요한가?** webpack 런타임 코드(모듈 맵)는 새 청크가 추가될 때마다 변경됩니다. 런타임을 별도 청크로 분리하지 않으면, 새 청크가 추가될 때 vendor 청크의 contenthash도 바뀌어 캐시가 무효화됩니다.

## Vite에서 청크 최적화

```ts
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        // 특정 패키지 → 전용 청크
        if (id.includes('react') || id.includes('react-dom')) {
          return 'react-vendor';
        }
        if (id.includes('@tanstack/react-query')) {
          return 'query-vendor';
        }
        // 나머지 node_modules → 공통 vendor
        if (id.includes('node_modules')) {
          return 'vendor';
        }
      },
    },
  },
  chunkSizeWarningLimit: 500, // KB, 기본 500
},
```

## 청크 크기 분석과 목표

```bash
# webpack
npx webpack-bundle-analyzer dist/stats.json

# Vite
# rollup-plugin-visualizer 설치 후 빌드
npm run build -- --mode analyze
```

일반적인 권장 청크 크기 목표:

| 청크 종류 | 권장 크기 |
|---------|---------|
| 초기 로드 (main) | < 150KB gzipped |
| 개별 라우트 청크 | < 100KB gzipped |
| Vendor 청크 | 200–400KB gzipped |
| 총합 (초기) | < 500KB gzipped |

## 너무 잘게 나누면 안 된다

청크가 너무 많으면 HTTP 요청 오버헤드와 모듈 초기화 비용이 증가합니다. HTTP/2에서는 병렬 요청이 자유롭지만, 수백 개의 청크는 여전히 문제입니다.

```js
// minSize 설정으로 너무 작은 청크 방지
splitChunks: {
  minSize: 20_000,    // 20KB 미만은 분할하지 않음
  maxSize: 250_000,   // 250KB 초과는 다시 분할
  maxInitialRequests: 6, // 초기 로드 최대 청크 수
  maxAsyncRequests: 8,   // 비동기 로드 최대 청크 수
}
```

---

**지난 글:** [Tree Shaking 심층 분석 — 죽은 코드 완전 제거](/posts/build-tree-shaking-deep/)

**다음 글:** [Jest — JavaScript 테스트 프레임워크 완전 정복](/posts/test-jest/)

<br>
읽어주셔서 감사합니다. 😊
