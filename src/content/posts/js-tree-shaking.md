---
title: "트리 쉐이킹 — 사용하지 않는 코드를 제거하는 기술"
description: "번들러가 사용되지 않는 export를 최종 번들에서 제거하는 트리 쉐이킹의 원리, 동작 조건, sideEffects 설정, named export 활용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "트리 쉐이킹", "tree shaking", "번들러", "ESM", "dead code elimination", "sideEffects"]
featured: false
draft: false
---

[지난 글](/posts/js-umd-amd-history/)에서 JavaScript 모듈 시스템의 역사를 살펴봤습니다. ES 모듈의 정적 구조 덕분에 가능해진 강력한 최적화가 **트리 쉐이킹(Tree Shaking)** 입니다. 나무를 흔들어 죽은 잎을 떨어뜨리듯, 번들러가 사용하지 않는 코드를 최종 번들에서 제거하는 기술입니다.

## 트리 쉐이킹이란?

대형 라이브러리에서 함수 하나만 import해도 라이브러리 전체가 번들에 포함된다면 낭비입니다. 트리 쉐이킹은 **실제로 사용된 export만 번들에 포함**하고 나머지를 제거합니다.

```javascript
// utils.mjs — 4개 함수 정의
export function add(a, b) { return a + b; }
export function subtract(a, b) { return a - b; }
export function multiply(a, b) { return a * b; }
export function divide(a, b) { return a / b; }

// main.mjs — add만 사용
import { add } from './utils.mjs';
console.log(add(2, 3));
```

번들러는 `add`만 사용됐음을 정적 분석으로 파악해 `subtract`, `multiply`, `divide`를 제거합니다.

![트리 쉐이킹 — 죽은 코드 제거](/assets/posts/js-tree-shaking-concept.svg)

## 동작 원리

트리 쉐이킹은 ES 모듈의 **정적 구조**에 의존합니다.

1. **의존성 그래프 구성**: 번들러가 모든 `import`/`export`를 정적으로 분석해 그래프를 만듭니다.
2. **마킹(Marking)**: 엔트리 포인트(`main.js`)에서 시작해 실제로 참조된 export에 "사용됨" 표시를 합니다.
3. **쉐이킹(Shaking)**: 표시되지 않은 export — "죽은 코드(dead code)" — 를 번들에서 제거합니다.

CommonJS(`require`)는 런타임에 동적으로 모듈을 로드할 수 있어 번들러가 어떤 export가 필요한지 사전에 알 수 없습니다. 이것이 ESM이 트리 쉐이킹에 필수인 이유입니다.

## 트리 쉐이킹 동작 조건

```javascript
// 1. ES 모듈 사용 필수
import { add } from './utils.mjs'; // ✓ (ESM)
const { add } = require('./utils'); // ✗ (CJS, 트리쉐이킹 불가)

// 2. 번들러 production 모드
// Rollup: 기본 활성화
// Webpack: mode: 'production' 필요
// Vite: 빌드 시 자동 활성화
```

## sideEffects 설정

번들러는 `import`만 있고 사용이 없는 모듈을 제거할 때 신중합니다. **부수 효과(side effect)** 가 있을 수 있기 때문입니다. `package.json`의 `sideEffects` 필드로 번들러에게 힌트를 줍니다.

```json
{
  "name": "my-lib",
  "sideEffects": false
}
```

`"sideEffects": false`는 "이 패키지의 모든 파일은 import해도 부수 효과가 없다"는 선언입니다. CSS 임포트나 폴리필처럼 부수 효과가 있는 파일은 배열로 명시합니다.

```json
{
  "sideEffects": [
    "*.css",
    "./src/polyfills.mjs"
  ]
}
```

![sideEffects 설정과 주의사항](/assets/posts/js-tree-shaking-sideeffects.svg)

## Named Export가 유리한 이유

```javascript
// ❌ Default export — 전체 포함 위험
import utils from './utils.mjs';
utils.add(1, 2); // 번들러가 어떤 메서드를 쓸지 추론 어려움

// ✓ Named export — 정확하게 add만
import { add } from './utils.mjs';
add(1, 2);
```

Named export는 번들러가 정확히 어떤 코드가 필요한지 알 수 있어 트리 쉐이킹 효율이 좋습니다.

## 실전 예: lodash vs lodash-es

```javascript
// ❌ CJS lodash — 전체 번들 (70KB+)
import _ from 'lodash';
_.debounce(fn, 300);

// ✓ ESM lodash-es — debounce만 포함 (~3KB)
import { debounce } from 'lodash-es';
debounce(fn, 300);

// 또는 서브패스 임포트
import debounce from 'lodash/debounce';
```

lodash-es는 ESM 포맷으로 제공되어 트리 쉐이킹이 완전히 동작합니다.

## 번들러별 설정

### Webpack

```javascript
// webpack.config.js
module.exports = {
  mode: 'production', // 자동으로 TerserPlugin + tree shaking 활성화
  optimization: {
    usedExports: true,  // 사용된 exports 마킹
    sideEffects: true,  // package.json sideEffects 존중
  },
};
```

### Rollup

```javascript
// rollup.config.js — 기본적으로 tree shaking 활성화
export default {
  input: 'src/main.mjs',
  output: { file: 'bundle.mjs', format: 'esm' },
  treeshake: { moduleSideEffects: false },
};
```

## 클래스와 트리 쉐이킹

클래스 메서드는 트리 쉐이킹이 어렵습니다. 번들러가 어떤 메서드가 호출될지 런타임 전에 알 수 없는 경우가 많기 때문입니다.

```javascript
// 클래스 — 전체 포함 위험
export class MathUtils {
  add(a, b) { return a + b; }
  subtract(a, b) { return a - b; }
}

// 개별 함수 — 트리쉐이킹 최적
export function add(a, b) { return a + b; }
export function subtract(a, b) { return a - b; }
```

유틸 함수 라이브러리를 클래스 대신 개별 함수로 export하면 소비자가 필요한 것만 가져갈 수 있습니다.

## 정리

| 항목 | CJS | ESM |
|------|-----|-----|
| 트리쉐이킹 | 제한적/불가 | 완전 지원 |
| 정적 분석 | 어려움 | 가능 |
| 필요 조건 | — | ESM + 번들러 + sideEffects |

트리 쉐이킹은 ESM 정적 구조 → 번들러 정적 분석 → 미사용 코드 제거로 이어지는 파이프라인입니다. 라이브러리를 만든다면 ESM 포맷 + `sideEffects: false` + named export를 기본으로 설정해 소비자의 번들 크기를 줄여주세요.

---

**지난 글:** [UMD·AMD·IIFE — 모듈 시스템의 역사](/posts/js-umd-amd-history/)

<br>
읽어주셔서 감사합니다. 😊
