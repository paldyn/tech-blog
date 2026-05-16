---
title: "webpack — 모듈 번들러의 완전 정복"
description: "webpack의 의존성 그래프, Loader와 Plugin의 차이, splitChunks 코드 스플리팅, HMR, Module Federation, 그리고 실전 최적화 전략까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "webpack", "번들러", "Loader", "Plugin", "코드스플리팅", "HMR", "Module Federation"]
featured: false
draft: false
---

[지난 글](/posts/build-swc-esbuild/)에서 SWC와 esbuild가 Babel보다 빠른 이유를 살펴봤습니다. 이번에는 **webpack**을 다룹니다. webpack은 2014년 등장한 이후 프론트엔드 빌드 도구의 사실상 표준이 됐습니다. Vite, Rollup, Parcel이 등장한 지금도 복잡한 엔터프라이즈 애플리케이션에서는 여전히 webpack이 압도적으로 많이 쓰입니다. 이유는 하나입니다. 가장 풍부한 커스터마이징 능력.

## webpack이 하는 일

webpack은 JavaScript 모듈과 그 의존 파일들(CSS, 이미지, 폰트, WASM 등)을 정적 에셋으로 **번들링**합니다. 핵심 아이디어는 "모든 것은 모듈"입니다. CSS도, 이미지도, JSON도 `import`로 다룰 수 있게 합니다.

![webpack 빌드 파이프라인](/assets/posts/build-webpack-architecture.svg)

## 설치와 기본 사용

```bash
npm install --save-dev webpack webpack-cli
npx webpack --config webpack.config.js
```

`package.json`에 스크립트를 등록합니다.

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "dev":   "webpack serve --mode development"
  }
}
```

## webpack.config.js 핵심 구조

![webpack.config.js 전체 구조](/assets/posts/build-webpack-config.svg)

```js
// webpack.config.js (ESM)
import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

const isProd = process.env.NODE_ENV === 'production';

export default {
  mode: isProd ? 'production' : 'development',
  entry: { main: './src/index.ts' },
  output: {
    filename: isProd ? '[name].[contenthash:8].js' : '[name].js',
    path: path.resolve(import.meta.dirname, 'dist'),
    clean: true,            // 빌드 전 dist 정리
    publicPath: '/',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'swc-loader', exclude: /node_modules/ },
      {
        test: /\.module\.css$/,
        use: [
          isProd ? MiniCssExtractPlugin.loader : 'style-loader',
          { loader: 'css-loader', options: { modules: true } },
          'postcss-loader',
        ],
      },
      { test: /\.(png|svg|jpg|webp)$/, type: 'asset/resource' },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './public/index.html' }),
    ...(isProd ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash:8].css' })] : []),
    ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : []),
  ],
  optimization: {
    splitChunks: { chunks: 'all' },
    runtimeChunk: 'single',  // 런타임 코드 분리 → 장기 캐시
  },
};
```

## Loader vs Plugin

Loader와 Plugin은 webpack을 확장하는 두 가지 방법입니다. 혼동하기 쉽지만 역할이 다릅니다.

| | Loader | Plugin |
|---|---|---|
| 역할 | **파일 단위** 변환 | **빌드 프로세스** 개입 |
| 실행 시점 | 모듈 로딩 중 | 전체 빌드 라이프사이클 |
| 설정 위치 | `module.rules` | `plugins` 배열 |
| 예시 | `swc-loader`, `css-loader` | `HtmlWebpackPlugin`, `DefinePlugin` |

Loader는 **역순으로 실행**됩니다. `['style-loader', 'css-loader', 'postcss-loader']`로 배열에 쓰면 실제 실행 순서는 `postcss-loader` → `css-loader` → `style-loader`입니다.

## 코드 스플리팅

webpack은 세 가지 방식으로 코드를 분할합니다.

### 1. Entry Points (수동)

```js
entry: {
  app: './src/app.ts',
  admin: './src/admin.ts',
}
```

### 2. splitChunks (자동)

```js
optimization: {
  splitChunks: {
    chunks: 'all',
    minSize: 20000,           // 20KB 이상만 분리
    minChunks: 2,             // 2개 이상 청크에서 사용된 경우
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: -10,
      },
      react: {
        test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
        name: 'react-vendor',
        priority: -5,
      },
    },
  },
}
```

### 3. Dynamic Import (지연 로딩)

```js
// 버튼 클릭 시 모달 코드 지연 로딩
button.addEventListener('click', async () => {
  const { Modal } = await import('./Modal');
  new Modal().show();
});

// webpackChunkName으로 청크 이름 지정
const Chart = await import(/* webpackChunkName: "chart" */ './Chart');
```

## HMR (Hot Module Replacement)

개발 서버에서 파일이 변경될 때 페이지 전체를 새로고침하지 않고 변경된 모듈만 교체합니다.

```js
// webpack.config.js
devServer: {
  hot: true,          // HMR 활성화 (기본값 true)
  port: 3000,
  historyApiFallback: true,  // SPA 라우팅 지원
  proxy: [
    { context: ['/api'], target: 'http://localhost:4000' }
  ],
}
```

```js
// 모듈에서 HMR API 사용
if (import.meta.webpackHot) {
  import.meta.webpackHot.accept('./store', () => {
    // store 모듈이 바뀌면 실행
    replaceStore(require('./store'));
  });
}
```

## Module Federation (마이크로프론트엔드)

webpack 5에서 도입된 Module Federation은 **서로 다른 빌드가 런타임에 모듈을 공유**할 수 있게 합니다.

```js
// host 앱 — webpack.config.js
import { ModuleFederationPlugin } from 'webpack/container';

plugins: [
  new ModuleFederationPlugin({
    name: 'host',
    remotes: {
      shop: 'shop@http://localhost:3001/remoteEntry.js',
    },
    shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
  }),
]
```

```js
// host 앱에서 원격 컴포넌트 사용
const ProductList = React.lazy(() => import('shop/ProductList'));
```

```js
// shop 앱 — webpack.config.js
plugins: [
  new ModuleFederationPlugin({
    name: 'shop',
    filename: 'remoteEntry.js',
    exposes: { './ProductList': './src/ProductList' },
    shared: { react: { singleton: true } },
  }),
]
```

## 빌드 성능 최적화

```js
// 캐시 설정 (증분 빌드)
cache: {
  type: 'filesystem',
  buildDependencies: { config: [import.meta.filename] },
},

// 병렬 처리
module: {
  rules: [{
    test: /\.tsx?$/,
    use: [
      { loader: 'thread-loader' },  // 워커 스레드에서 실행
      'swc-loader',
    ],
  }]
}
```

webpack의 `filesystem` 캐시는 두 번째 빌드부터 劇적으로 빨라집니다. Next.js가 내부적으로 이 캐시를 활용하는 이유입니다.

---

**지난 글:** [SWC · esbuild — Rust·Go 기반 초고속 변환](/posts/build-swc-esbuild/)

**다음 글:** [Rollup — 라이브러리 번들러의 표준](/posts/build-rollup/)

<br>
읽어주셔서 감사합니다. 😊
