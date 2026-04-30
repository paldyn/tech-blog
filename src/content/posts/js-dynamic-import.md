---
title: "동적 import() — 지연 로딩과 코드 분할"
description: "ES2020 동적 import()로 필요할 때만 모듈을 로드하는 지연 로딩과 라우트 기반 코드 분할 구현 방법, 정적 import와의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "동적 import", "코드 분할", "지연 로딩", "ESM", "번들 최적화"]
featured: false
draft: false
---

[지난 글](/posts/js-import-export-types/)에서 `import`와 `export`의 모든 문법 형태를 살펴봤습니다. 이번에는 정적 `import`와 다른 **동적 `import()`** 를 다룹니다. 초기 번들 크기를 줄이고, 사용자가 특정 기능을 필요로 할 때만 코드를 불러오는 **지연 로딩(lazy loading)** 과 **코드 분할(code splitting)** 의 핵심 도구입니다.

## 동적 import()란?

`import(specifier)`는 런타임에 모듈을 비동기로 로드하는 **함수처럼 생긴 구문**입니다. `Promise<ModuleNamespace>`를 반환합니다.

```javascript
// 정적 import: 항상 파일 최상위에서, 항상 로드됨
import { heavyLib } from './heavy.mjs';

// 동적 import: 필요한 시점에, 조건부로 로드
const { heavyLib } = await import('./heavy.mjs');
```

정적 `import`는 번들에 항상 포함되지만, 동적 `import()`는 별도 청크(chunk)로 분리되어 필요할 때 네트워크 요청으로 가져옵니다.

![정적 import vs 동적 import()](/assets/posts/js-dynamic-import-comparison.svg)

## 기본 문법

```javascript
// await를 쓰는 방법 (async 함수 안 또는 TLA 환경)
const module = await import('./module.mjs');
console.log(module.default); // default export
console.log(module.add);     // named export

// 구조 분해
const { add, PI } = await import('./math.mjs');

// .then() 체이닝
import('./analytics.mjs')
  .then(({ track }) => track('page_view'))
  .catch(console.error);
```

## 반환값 구조

`import()`가 resolve되면 **모듈 네임스페이스 객체**를 받습니다. 이 객체는 `default`, 그리고 모든 named export를 프로퍼티로 가집니다.

```javascript
const ns = await import('./math.mjs');
// ns.default — default export
// ns.add      — named export 'add'
// ns.PI       — named export 'PI'
```

## 주요 활용 패턴

![동적 import() 활용 패턴](/assets/posts/js-dynamic-import-patterns.svg)

### 라우트 기반 코드 분할

SPA에서 각 페이지를 별도 청크로 분리해 초기 로딩 속도를 개선합니다.

```javascript
const routes = {
  '/home':  () => import('./pages/Home.mjs'),
  '/about': () => import('./pages/About.mjs'),
  '/chart': () => import('./pages/Chart.mjs'),
};

async function navigate(path) {
  const { default: Page } = await routes[path]();
  Page.render();
}
```

### 조건부 폴리필

구형 브라우저에서만 폴리필을 불러옵니다.

```javascript
if (!('structuredClone' in globalThis)) {
  await import('./polyfills/structured-clone.mjs');
}
```

### 사용자 액션 트리거

버튼 클릭, 스크롤 진입 시 무거운 라이브러리를 로드합니다.

```javascript
document.getElementById('chart-btn').addEventListener('click', async () => {
  const { Chart } = await import('https://cdn.example.com/chart.mjs');
  new Chart(ctx, config);
});
```

## import.meta.url과 함께 사용

모듈 내부에서 현재 파일의 URL 기준으로 상대 경로를 동적으로 구성할 수 있습니다.

```javascript
const locale = navigator.language.slice(0, 2); // 'ko', 'en', ...
const { messages } = await import(
  new URL(`./i18n/${locale}.mjs`, import.meta.url)
);
```

번들러(Webpack, Vite)는 이런 동적 경로를 패턴으로 분석해 관련 파일을 자동으로 분리합니다.

## 번들러에서의 동작

Webpack이나 Vite는 `import()` 호출을 감지해 자동으로 **별도 청크**를 생성합니다.

```javascript
// Vite/Rollup의 주석으로 청크 이름 지정
const module = await import(
  /* webpackChunkName: "analytics" */
  './analytics.mjs'
);
```

## 에러 처리

네트워크 오류나 모듈 오류는 `Promise` rejection으로 전파됩니다.

```javascript
try {
  const { parse } = await import('./parser.mjs');
  parse(data);
} catch (err) {
  console.error('모듈 로드 실패:', err);
}
```

## 정리

| 항목 | 정적 import | 동적 import() |
|------|------------|--------------|
| 위치 | 최상위만 | 어디서든 |
| 경로 | 리터럴만 | 표현식 가능 |
| 로드 시점 | 파일 파싱 시 | 호출 시 |
| 반환값 | 없음(바인딩) | Promise |
| 번들 | 항상 포함 | 별도 청크 |
| 용도 | 핵심 의존성 | 지연/조건부 |

초기 페이지 로드 성능이 중요하다면 핵심 코드만 정적으로, 나머지는 동적 `import()`로 지연하는 전략이 효과적입니다.

---

**지난 글:** [import/export 문법 총정리](/posts/js-import-export-types/)

**다음 글:** [Top-Level Await — 모듈 최상위의 비동기 처리](/posts/js-tla-modules/)

<br>
읽어주셔서 감사합니다. 😊
