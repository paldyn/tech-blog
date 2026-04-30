---
title: "import/export 문법 총정리"
description: "ES 모듈의 named export, default export, re-export, namespace import 등 모든 import/export 문법을 예제와 함께 정리하고 적합한 사용 상황을 안내합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ESM", "import", "export", "named export", "default export", "re-export"]
featured: false
draft: false
---

[지난 글](/posts/js-esm-basics/)에서 ES 모듈의 핵심 특성(정적 구조, 라이브 바인딩, 모듈 스코프 등)을 살펴봤습니다. 이번에는 실제로 코드를 작성할 때 필요한 **`import`와 `export`의 모든 문법 형태**를 예제 중심으로 총정리합니다.

## export 문법

### Named Export (이름 있는 내보내기)

한 모듈에서 여러 개를 내보낼 수 있고, 이름으로 식별합니다.

```javascript
// 선언과 동시에 내보내기
export function multiply(a, b) { return a * b; }
export const PI = 3.14159;
export class Vector { /* ... */ }

// 선언 후 목록으로 내보내기
const x = 10, y = 20;
export { x, y };

// 이름 바꿔 내보내기
export { multiply as mul };
```

가져올 때는 중괄호 `{}` 안에 정확한 이름을 씁니다.

```javascript
import { multiply, PI } from './math.mjs';
import { mul } from './math.mjs'; // 별칭 사용
```

![export 문법 총정리](/assets/posts/js-import-export-types-export.svg)

### Default Export (기본 내보내기)

모듈당 **하나만** 허용됩니다. 가져오는 쪽에서 이름을 자유롭게 정할 수 있습니다.

```javascript
// math.mjs
export default function add(a, b) { return a + b; }

// 또는 익명으로
export default class {}
export default 42;
```

```javascript
// 가져오는 쪽 — 이름을 원하는 대로
import myAdd from './math.mjs';
import calculateSum from './math.mjs'; // 같은 것
```

### Named + Default 혼합

한 모듈에서 default와 named를 함께 내보낼 수 있습니다.

```javascript
export default class App {}
export const version = '1.0.0';
```

```javascript
import App, { version } from './app.mjs';
```

### Re-export (재내보내기)

다른 모듈의 내보내기를 중개해 외부에 노출하는 **배럴 파일(barrel file)** 패턴에 자주 사용됩니다.

```javascript
// index.mjs — 진입점 통합
export { add, multiply } from './math.mjs';
export * from './utils.mjs';          // 모두 재내보내기
export * as str from './string.mjs';  // 네임스페이스로 묶어 재내보내기
export { default as App } from './app.mjs'; // default를 named로
```

## import 문법

![import 문법 총정리](/assets/posts/js-import-export-types-import.svg)

### Named Import

```javascript
import { add, PI } from './math.mjs';
import { add as sum } from './math.mjs'; // 이름 바꾸기
```

### Default Import

```javascript
import MyApp from './app.mjs'; // 이름 자유
```

### Namespace Import

모듈의 모든 named export를 하나의 객체로 묶어 가져옵니다.

```javascript
import * as MathUtils from './math.mjs';
console.log(MathUtils.PI);
console.log(MathUtils.add(1, 2));
```

트리 쉐이킹 관점에서 번들러가 어떤 export를 쓰는지 정적으로 추적하기 어려워질 수 있습니다.

### Side-effect Import

값은 가져오지 않고 모듈 코드 실행만 유발합니다. 폴리필이나 글로벌 설정에 씁니다.

```javascript
import './polyfill.mjs';   // 실행만
import './setup-globals.mjs';
```

## import 바인딩은 읽기 전용

가져온 named binding에 직접 재할당하면 `TypeError`가 발생합니다.

```javascript
import { PI } from './math.mjs';
PI = 3; // TypeError: Assignment to constant variable
```

값 변경은 반드시 내보내는 모듈의 함수를 통해야 합니다. 이것이 라이브 바인딩의 의도입니다.

## 어떤 export 형태를 써야 할까?

| 상황 | 권장 형태 |
|------|---------|
| 유틸 함수 여러 개 | Named export |
| 메인 클래스/컴포넌트 | Default export |
| 라이브러리 진입점 | Named export + re-export |
| 폴리필, 초기화 코드 | Side-effect import |
| 여러 서브 모듈 묶기 | Namespace import |

Default export는 이름이 바뀔 수 있어 IDE 자동 완성에 덜 친화적입니다. 대규모 코드베이스에서는 named export를 주로 사용하는 팀이 많습니다.

## 확장자 규칙

Node.js와 최신 브라우저에서는 모듈 경로에 확장자를 명시해야 합니다.

```javascript
import { add } from './math.mjs'; // 명시 필수
import { add } from './math';     // 번들러에서는 OK, 네이티브 ESM에서는 에러
```

Webpack, Vite 같은 번들러는 확장자 생략을 허용하지만, 네이티브 ESM 환경(브라우저, Deno)에서는 명시가 필수입니다.

---

**지난 글:** [ES 모듈 기초 — import/export 핵심 이해](/posts/js-esm-basics/)

**다음 글:** [동적 import() — 지연 로딩과 코드 분할](/posts/js-dynamic-import/)

<br>
읽어주셔서 감사합니다. 😊
