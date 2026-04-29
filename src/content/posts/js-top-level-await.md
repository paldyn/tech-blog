---
title: "최상위 await (Top-level await)"
description: "ES2022 최상위 await(TLA)를 사용해 ES 모듈 최상위 스코프에서 비동기 초기화를 수행하는 방법과 모듈 실행 순서, 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ES2022", "async", "await", "모듈", "비동기", "Top-level await"]
featured: false
draft: false
---

[지난 글](/posts/js-numeric-separator/)에서 숫자 구분자를 살펴봤습니다. 이번에는 ES2022에 추가된 **최상위 await(Top-level await, TLA)**를 다룹니다. async 함수 내부에서만 사용 가능했던 `await`를 ES 모듈의 최상위 스코프에서도 쓸 수 있게 된 기능입니다.

## TLA란?

기존에는 `await`를 `async` 함수 밖에서 쓰면 SyntaxError가 발생했습니다. 이 제약을 해결하기 위해 즉시 실행 비동기 함수(IIFE)를 자주 사용했지만, `export` 시점을 보장하기 어렵다는 문제가 있었습니다.

```javascript
// 기존 방식 — IIFE 우회
let db;
(async () => {
  db = await connectDB();
})();
export { db }; // db가 아직 undefined일 수 있음!

// TLA 방식
const db = await connectDB(); // 완료 후 export
export { db };
```

TLA에서는 `await`가 완전히 해소된 뒤에 모듈 평가가 완료되고, `export`된 값이 준비됩니다.

## 모듈 실행 순서

![최상위 await 모듈 실행 순서](/assets/posts/js-top-level-await-module-flow.svg)

TLA를 포함한 모듈을 `import`하는 부모 모듈은 해당 모듈이 완전히 평가될 때까지 **자신의 실행을 지연**합니다. 이는 동기 `import`처럼 보이지만 내부적으로는 비동기 그래프 평가입니다.

```javascript
// db.js — TLA 포함
export const client = await initDB('postgres://...');
console.log('db ready');

// app.js
import { client } from './db.js';
console.log('app start'); // db.js가 완료된 후 실행
```

실행 순서: `db ready` → `app start`

형제 모듈들은 병렬로 실행될 수 있으며, TLA를 가진 모듈에만 대기가 발생합니다.

## 주요 활용 패턴

![TLA 활용 패턴](/assets/posts/js-top-level-await-patterns.svg)

### 환경 감지 및 조건부 임포트

```javascript
// polyfill.js
if (!globalThis.fetch) {
  await import('./fetch-polyfill.js');
}
```

### 설정 파일 로딩

```javascript
// config.js
const response = await fetch('/api/config');
export const config = await response.json();
```

### 국제화 데이터 사전 로딩

```javascript
// i18n.js
const locale = navigator.language;
const messages = await import(`./locales/${locale}.js`);
export default messages.default;
```

## 제약 조건

TLA는 **ES 모듈 전용**입니다. CommonJS(`require`) 환경이나 스크립트 태그(`type` 없이)에서는 사용할 수 없습니다.

```javascript
// ✓ ES 모듈 (.mjs 또는 type="module")
const data = await loadData();

// ✗ CJS에서는 SyntaxError
// require() 환경은 async를 인식하지 못함
```

번들러(Webpack 5+, Vite, esbuild 등)는 TLA를 지원하지만, 타깃 환경에 따라 폴리필이나 변환이 필요할 수 있습니다.

## 성능 고려

TLA가 포함된 모듈을 가져오는 모든 부모 모듈이 블로킹되므로, **초기화에 오래 걸리는 작업**에 무분별하게 사용하면 앱 시작 시간이 늘어납니다.

```javascript
// 비용이 큰 작업은 lazy import 고려
const heavyLib = await import('./heavy.js');
// 진입점 모듈에 두지 말고 필요한 시점에 동적 임포트
```

초기화 순서가 명확히 보장되어야 하는 경우에 TLA는 매우 유용하지만, 남용하면 직렬 대기 그래프가 생겨 성능을 해칩니다.

---

**지난 글:** [숫자 구분자 (Numeric Separator)](/posts/js-numeric-separator/)

**다음 글:** [WeakRef와 FinalizationRegistry](/posts/js-weakref-finalization/)

<br>
읽어주셔서 감사합니다. 😊
