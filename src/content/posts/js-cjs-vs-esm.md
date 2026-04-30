---
title: "CommonJS vs ES 모듈 — 두 시스템의 결정적 차이"
description: "Node.js의 CommonJS(require)와 ES 모듈(import)의 로딩 방식, 바인딩, 트리쉐이킹, 상호운용 방법을 비교하고 실무에서 어떤 것을 선택할지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "CommonJS", "CJS", "ESM", "ES 모듈", "require", "import", "Node.js"]
featured: false
draft: false
---

[지난 글](/posts/js-tla-modules/)에서 ES 모듈의 Top-Level Await를 살펴봤습니다. 이번에는 JavaScript 생태계에서 공존하는 두 모듈 시스템 — **CommonJS(CJS)** 와 **ES 모듈(ESM)** 의 결정적인 차이를 정리합니다. Node.js로 개발하다 보면 둘의 차이를 모르고 혼용해서 에러를 만나는 경우가 많습니다.

## 간단한 역사

**CommonJS**는 2009년 Node.js가 채택한 모듈 시스템입니다. `require()`로 동기 로드하고, `module.exports`로 내보냅니다. Node.js 생태계 전반에 깊이 자리잡은 사실상의 표준이었습니다.

**ES 모듈**은 2015년 ECMAScript 표준에 포함됐습니다. `import`/`export` 문법을 사용하고, 브라우저와 Node.js 모두에서 동작하는 공식 표준입니다. Node.js는 v12(실험적)에서, v16.17부터 안정적으로 ESM을 지원합니다.

## 핵심 문법 비교

```javascript
// CommonJS
const { add } = require('./math');
module.exports = { add, PI: 3.14 };
exports.subtract = (a, b) => a - b;

// ES 모듈
import { add } from './math.mjs';
export const PI = 3.14;
export function subtract(a, b) { return a - b; }
```

![CommonJS vs ES 모듈 비교](/assets/posts/js-cjs-vs-esm-comparison.svg)

## 주요 차이점 심층 분석

### 1. 로딩 방식: 동기 vs 비동기

`require()`는 **동기적**으로 동작합니다. 파일 시스템에서 즉시 읽어서 반환합니다. 브라우저에서는 네트워크 지연 때문에 동기 로딩이 불가능해 사용할 수 없습니다.

`import`는 **비동기적**으로 처리됩니다. 실행 전에 의존성 그래프를 완성하고, 필요한 모듈을 네트워크에서 병렬로 가져올 수 있습니다.

```javascript
// CJS: 조건부 require 가능
if (process.env.NODE_ENV === 'test') {
  const mock = require('./mock-db');
}

// ESM: 조건부면 dynamic import() 사용
if (process.env.NODE_ENV === 'test') {
  const { mock } = await import('./mock-db.mjs');
}
```

### 2. 바인딩: 복사 vs 라이브

CJS는 `require()` 시점의 **값 복사**를 반환합니다. ESM은 **라이브 바인딩**으로, 내보내는 모듈의 값이 변경되면 가져오는 쪽에도 즉시 반영됩니다.

### 3. 트리쉐이킹

CJS는 동적으로 `require`를 호출할 수 있어 번들러가 사용하지 않는 코드를 제거하기 어렵습니다. ESM은 정적 분석이 가능해 트리쉐이킹 효율이 훨씬 좋습니다.

```javascript
// CJS — 번들러가 어떤 게 사용되는지 모름
const { pick } = require('lodash'); // lodash 전체 포함

// ESM — 번들러가 'pick'만 포함
import { pick } from 'lodash-es';
```

## 상호운용 (Interop)

![CJS ↔ ESM 상호운용](/assets/posts/js-cjs-vs-esm-interop.svg)

### ESM에서 CJS 가져오기

Node.js에서 ESM은 CJS 모듈을 `default import`로 가져올 수 있습니다.

```javascript
// cjs-lib.cjs
module.exports = { foo: 42, bar: 'hello' };

// esm-main.mjs
import cjs from './cjs-lib.cjs';
console.log(cjs.foo); // 42
```

Node.js 22+에서는 일부 named import도 가능합니다.

### CJS에서 ESM 가져오기

`require()`로 ESM을 로드할 수 없습니다(`ERR_REQUIRE_ESM`). 대신 동적 `import()`를 사용합니다.

```javascript
// Node.js 22+에서는 require()로 ESM 가져오기 가능
// 하지만 TLA가 있는 ESM은 여전히 불가

async function main() {
  const { fn } = await import('./esm-module.mjs');
  fn();
}
main();
```

## Node.js에서 어떤 것을 사용할까?

| 선택 기준 | CJS | ESM |
|---------|-----|-----|
| Node.js 전용, 기존 코드베이스 | ✓ | |
| 브라우저·서버 공용 코드 | | ✓ |
| 트리쉐이킹이 중요한 라이브러리 | | ✓ |
| 레거시 패키지 지원 필요 | ✓ | |
| TLA 필요 | | ✓ |

새 프로젝트라면 ESM을 선택하는 것이 좋습니다. 라이브러리를 배포할 때는 두 형식을 모두 제공하거나(`"exports"` 필드 활용), ESM-only로 가는 추세입니다.

## package.json exports 필드

```json
{
  "name": "my-lib",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  }
}
```

이 설정으로 `import`/`require` 두 방식 모두를 지원하는 듀얼 패키지를 만들 수 있습니다.

## 정리

| 항목 | CJS | ESM |
|------|-----|-----|
| 문법 | require / module.exports | import / export |
| 로딩 | 동기 | 비동기 |
| 바인딩 | 값 복사 | 라이브 참조 |
| 트리쉐이킹 | 제한적 | 최적화 |
| 브라우저 사용 | 불가 | 가능 |
| TLA | 불가 | 가능 |
| 안정화 | 2009년 | 2015년 (Node: 2020년) |

두 시스템은 공존하며 상호운용됩니다. 하지만 새 코드는 ESM으로 작성하고, 필요한 경우에만 CJS를 유지하는 전략이 미래 지향적입니다.

---

**지난 글:** [Top-Level Await — 모듈 최상위의 비동기 처리](/posts/js-tla-modules/)

**다음 글:** [UMD·AMD·IIFE — 모듈 시스템의 역사](/posts/js-umd-amd-history/)

<br>
읽어주셔서 감사합니다. 😊
