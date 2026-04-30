---
title: "ES 모듈 기초 — import/export 핵심 이해"
description: "ES2015에 도입된 ECMAScript 모듈(ESM)의 정적 구조, 라이브 바인딩, 모듈 스코프, 단일 평가 등 핵심 개념과 브라우저·Node.js 사용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ESM", "ES 모듈", "import", "export", "모듈 시스템", "라이브 바인딩"]
featured: false
draft: false
---

[지난 글](/posts/js-promise-with-resolvers/)에서 비동기 제어를 위한 `Promise.withResolvers()`를 살펴봤습니다. 이번에는 JavaScript 코드를 구조화하는 가장 표준적인 방법, **ES 모듈(ECMAScript Modules, ESM)** 을 처음부터 다집니다. "그냥 import/export 쓰면 되는 거 아닌가?"라고 생각할 수 있지만, ESM에는 다른 모듈 시스템과 구별되는 근본적인 특성들이 있습니다.

## ES 모듈이란?

ES 모듈은 ES2015(ES6)에 표준화된 JavaScript 공식 모듈 시스템입니다. 파일 단위로 코드를 분리하고, `export`로 내보내고, `import`로 가져옵니다.

```javascript
// math.mjs — 내보내기
export function add(a, b) { return a + b; }
export const PI = 3.14159;

// main.mjs — 가져오기
import { add, PI } from './math.mjs';
console.log(add(2, 3)); // 5
console.log(PI);        // 3.14159
```

![ES 모듈 핵심 특성](/assets/posts/js-esm-basics-features.svg)

## ESM의 6가지 핵심 특성

### 1. 정적 구조

`import`와 `export`는 **파일 최상위 레벨**에서만 사용할 수 있습니다. 조건문이나 함수 안에 넣을 수 없습니다.

```javascript
// 불가 — 동적 import는 별도 문법(import())을 사용
if (condition) {
  import { foo } from './foo.mjs'; // SyntaxError
}
```

이 제약 덕분에 엔진이 실행 전 의존성 그래프를 완성할 수 있고, 번들러가 사용하지 않는 코드를 제거(트리 쉐이킹)할 수 있습니다.

### 2. 라이브 바인딩

ESM의 가장 중요한 특징입니다. `export`된 값은 **복사본이 아니라 살아있는 참조(Live Binding)** 입니다.

![라이브 바인딩 vs 복사 바인딩](/assets/posts/js-esm-basics-live-binding.svg)

내보내는 모듈에서 값을 변경하면, 가져오는 모듈에서도 즉시 반영됩니다. CommonJS의 `require`는 값을 복사하기 때문에 이런 동기화가 일어나지 않습니다.

### 3. 모듈 스코프

모듈 안에서 선언한 변수는 전역이 아닌 **모듈 스코프**에 속합니다. `export`를 붙이지 않는 한 외부에서 접근할 수 없습니다.

```javascript
// 이 변수는 모듈 내부에서만 접근 가능
const privateHelper = () => {};

// export 해야 외부에서 사용 가능
export const publicAPI = () => {};
```

### 4. 엄격 모드 자동 적용

모든 ES 모듈은 자동으로 `'use strict'` 상태로 동작합니다. 따라서 `with` 구문, 암묵적 전역 변수, 중복 매개변수 이름 등이 모두 에러가 됩니다.

### 5. 단일 평가

동일한 모듈 경로를 여러 파일에서 `import`해도 모듈 코드는 **단 한 번만 실행**됩니다. 이후에는 캐시된 결과를 반환합니다.

```javascript
// a.mjs
import './side-effect.mjs';

// b.mjs
import './side-effect.mjs';

// side-effect.mjs의 코드는 전체 실행에서 딱 한 번만 실행됩니다
```

### 6. 비동기 로딩

브라우저에서 `<script type="module">`은 기본적으로 `defer` 동작을 합니다. 파싱이 블로킹되지 않습니다.

```html
<!-- defer 없이도 비동기로 로드됨 -->
<script type="module" src="main.mjs"></script>
```

## 브라우저에서 사용하기

```html
<script type="module">
  import { greet } from './greet.mjs';
  greet('world');
</script>
```

CORS 정책이 적용됩니다. `file://` 프로토콜에서는 동작하지 않으니 로컬 서버가 필요합니다.

## Node.js에서 사용하기

Node.js는 ESM을 `.mjs` 확장자 또는 `package.json`의 `"type": "module"` 설정으로 활성화합니다.

```json
// package.json
{
  "type": "module"
}
```

```javascript
// 확장자 명시 필수
import { add } from './math.mjs';
```

## 정리

| 특성 | 설명 |
|------|------|
| 정적 구조 | 최상위에서만 import/export, 트리 쉐이킹 가능 |
| 라이브 바인딩 | 내보낸 값 변경 시 즉시 반영 |
| 모듈 스코프 | 파일 단위 독립 스코프 |
| 엄격 모드 | 항상 strict mode |
| 단일 평가 | 동일 모듈은 한 번만 실행 |
| 비동기 로딩 | 브라우저에서 defer 기본 |

ES 모듈은 브라우저부터 서버까지 모든 환경에서 통용되는 표준 모듈 시스템입니다. 다음 글에서는 `import`와 `export`의 다양한 문법 종류를 상세히 살펴봅니다.

---

**지난 글:** [Promise.withResolvers() — 외부에서 제어하는 Promise](/posts/js-promise-with-resolvers/)

**다음 글:** [import/export 문법 총정리](/posts/js-import-export-types/)

<br>
읽어주셔서 감사합니다. 😊
