---
title: "Top-Level Await — 모듈 최상위의 비동기 처리"
description: "ES2022 Top-Level Await(TLA)로 모듈 최상위에서 직접 await를 사용하는 방법, 모듈 초기화 순서와 주의사항, 실전 활용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Top-Level Await", "TLA", "ESM", "비동기", "모듈 초기화", "ES2022"]
featured: false
draft: false
---

[지난 글](/posts/js-dynamic-import/)에서 동적 `import()`로 지연 로딩하는 방법을 배웠습니다. 이번에는 ES 모듈의 또 다른 비동기 기능인 **Top-Level Await(TLA)** 를 살펴봅니다. ES2022(Node.js 16.17+, Chrome 89+)부터 지원되며, 모듈의 최상위 코드에서 `async` 함수 없이 직접 `await`를 사용할 수 있습니다.

## TLA란?

기존에는 `await`를 `async` 함수 안에서만 사용할 수 있었습니다. 모듈 초기화 단계에서 비동기 작업(DB 연결, 설정 파일 읽기, 동적 폴리필 등)을 처리하려면 즉시 실행 비동기 함수(IIFE) 패턴이 필요했습니다.

TLA는 이 제약을 제거합니다. **ES 모듈의 최상위 코드에서 직접 `await`를 사용할 수 있습니다.**

```javascript
// config.mjs — TLA 사용
const response = await fetch('/config.json');
export const config = await response.json();
```

![Top-Level Await 이전 vs 이후](/assets/posts/js-tla-modules-before-after.svg)

## 모듈 초기화 순서

TLA를 이해하는 핵심은 **모듈 그래프에서의 초기화 순서**입니다.

TLA 모듈을 `import`하는 상위 모듈은, 해당 TLA 모듈의 `await`가 모두 완료될 때까지 초기화가 일시 중단됩니다.

```javascript
// db.mjs
export const db = await createConnection('postgres://localhost/mydb');

// auth.mjs  
export const auth = await loadCertificates();

// app.mjs — db와 auth 모두 완료 후 실행
import { db } from './db.mjs';
import { auth } from './auth.mjs';
// 이 시점에서 db, auth는 반드시 완성되어 있음
```

![TLA 모듈 초기화 순서](/assets/posts/js-tla-modules-order.svg)

병렬 관계인 `db.mjs`와 `auth.mjs`는 동시에 await가 진행됩니다. 둘 다 완료된 후에야 `app.mjs`의 나머지 코드가 실행됩니다.

## 주요 활용 패턴

### 설정 파일 비동기 로드

```javascript
// settings.mjs
const raw = await fetch('/api/settings');
export const settings = await raw.json();

// 사용하는 쪽
import { settings } from './settings.mjs';
// settings는 항상 완성된 상태
```

### 조건부 폴리필

```javascript
// polyfills.mjs
if (!('Temporal' in globalThis)) {
  const { Temporal } = await import('./temporal-polyfill.mjs');
  globalThis.Temporal = Temporal;
}
```

### WebAssembly 초기화

```javascript
// wasm.mjs
const wasmModule = await WebAssembly.instantiateStreaming(
  fetch('./math.wasm'),
  { /* imports */ }
);
export const { add, multiply } = wasmModule.instance.exports;
```

### i18n 메시지 로딩

```javascript
// i18n.mjs
const locale = navigator.language.startsWith('ko') ? 'ko' : 'en';
const { messages } = await import(`./locales/${locale}.mjs`);
export { messages, locale };
```

## 주의사항

### 직렬 블로킹

TLA는 의존하는 모든 상위 모듈을 차단합니다. 엔트리 포인트(`main.js`)가 긴 TLA 체인을 가지면 페이지 초기화가 느려질 수 있습니다.

```javascript
// ❌ 나쁜 예: 느린 TLA가 전체를 차단
export const data = await slowFetch(); // 3초

// ✅ 좋은 예: 필요한 곳에서 동적 import
export async function getData() {
  return await slowFetch();
}
```

### CommonJS 비호환

TLA는 **ES 모듈에서만** 사용할 수 있습니다. CommonJS(`require`)에서는 지원하지 않습니다.

### 에러 처리

TLA에서 발생한 에러는 해당 모듈을 `import`하는 모든 상위 모듈을 실패하게 만듭니다.

```javascript
// safe-init.mjs
let config;
try {
  config = await fetch('/config.json').then(r => r.json());
} catch {
  config = defaultConfig; // 실패 시 기본값
}
export { config };
```

## 호환성

| 환경 | 지원 버전 |
|------|---------|
| Chrome | 89+ |
| Firefox | 89+ |
| Safari | 15+ |
| Node.js | 14.8+(플래그), 16.17+(안정) |
| Deno | 1.0+ |
| Bun | 모든 버전 |

번들러에서는 Webpack 5.0+, Rollup 2.43+, Vite 2.0+이 TLA를 지원합니다.

## 정리

| 항목 | TLA 이전 | TLA |
|------|---------|-----|
| 최상위 await | 불가 (async 함수 필요) | 가능 |
| 모듈 초기화 | 동기적으로만 | 비동기 대기 가능 |
| export 안전성 | 경쟁 조건 위험 | 항상 완성된 값 |
| 사용 가능 환경 | 어디서든 | ES 모듈만 |

TLA는 모듈 초기화 로직을 간결하게 만들지만, 과도하게 사용하면 앱 시작 시간을 늘릴 수 있습니다. DB 연결, 인증 초기화, WASM 로딩처럼 **모듈이 사용되기 전에 반드시 완료되어야 하는 비동기 작업**에 적합합니다.

---

**지난 글:** [동적 import() — 지연 로딩과 코드 분할](/posts/js-dynamic-import/)

**다음 글:** [CommonJS vs ES 모듈 — 두 시스템의 결정적 차이](/posts/js-cjs-vs-esm/)

<br>
읽어주셔서 감사합니다. 😊
