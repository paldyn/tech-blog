---
title: "모듈 시스템 — CommonJS에서 ES Module까지"
description: "전역 스크립트 공유의 혼돈에서 벗어나 코드를 독립된 모듈로 나누는 방법. CommonJS와 ES Module의 차이, named/default export, 동적 import(), 트리 쉐이킹까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-25"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "모듈", "CommonJS", "ESModule", "import", "export", "트리쉐이킹", "번들러"]
featured: false
draft: false
---

[지난 글](/posts/js-modern-syntax/)에서 이어집니다.

모던 문법 정리에 이어, 이번에는 코드를 파일 단위로 나누고 조합하는 방법인 **모듈 시스템**을 살펴봅니다. 모듈은 JavaScript 생태계를 이해하는 데 빠질 수 없는 개념입니다. `require`와 `import`가 공존하는 이유, `.mjs`와 `.cjs` 확장자가 생긴 배경, 그리고 번들러가 하는 일까지 차례로 짚어봅니다.

---

## 모듈이 없던 세상

초기 JavaScript는 모듈 개념이 없었습니다. 브라우저에서 여러 스크립트 파일을 불러오면 모두 **같은 전역 스코프**를 공유했습니다.

```html
<script src="jquery.js"></script>
<script src="utils.js"></script>
<script src="app.js"></script>
```

이 순서가 틀리면 오류가 납니다. `utils.js`에서 `window.helper = function() {}`를 정의하면 어느 파일이든 `helper()`를 호출할 수 있는데, 이는 이름 충돌과 의존 관계 파악 어려움으로 이어졌습니다. 수백 개의 파일을 가진 프로젝트에서는 전역 이름 오염이 심각한 문제였습니다.

이를 해결하기 위해 개발자들은 **즉시 실행 함수 표현식(IIFE)**으로 스코프를 만들어 격리했습니다.

```js
var MyLib = (function () {
  var private = 'only here';
  return { publicMethod: function () { ... } };
})();
```

고전적인 패턴이지만 의존성 선언이나 비동기 로딩 같은 기능은 없었습니다.

---

## CommonJS — Node.js가 가져온 해법

2009년 Node.js가 등장하면서 서버 측 JavaScript가 가능해졌습니다. 서버에서 파일을 불러오는 것은 브라우저와 달리 동기적으로 가능했고, Node.js는 **CommonJS** 모듈 형식을 채택했습니다.

```js
// math.js — 내보내기
const PI = 3.14159;

function add(a, b) { return a + b; }
function multiply(a, b) { return a * b; }

module.exports = { PI, add, multiply };

// app.js — 가져오기
const { add, PI } = require('./math');
const path = require('path');   // 내장 모듈
const lodash = require('lodash');   // npm 패키지
```

`require()`는 **동기** 함수입니다. 호출하는 순간 파일을 읽고, 평가하고, 결과를 반환합니다. 한 번 로드된 모듈은 캐시에 저장되어 두 번 실행되지 않습니다.

CommonJS의 중요한 특징은 **런타임 평가**입니다. `require()`를 조건문 안에서 쓸 수도 있습니다.

```js
if (process.env.NODE_ENV === 'development') {
  const devTools = require('./devtools');
}
```

유연하지만, 이 유연성이 **정적 분석을 어렵게** 만드는 단점이기도 합니다.

---

## ES Module — 언어 표준으로

ES2015(ES6)에서 언어 사양에 모듈 시스템이 포함되었습니다. **ES Module(ESM)**이 표준입니다.

![CommonJS vs ES Module](/assets/posts/js-module-system-types.svg)

ES Module의 `import` 선언은 파일 최상단에 위치해야 하며, 문자열 리터럴만 경로로 쓸 수 있습니다.

```js
// math.js — named export
export const PI = 3.14159;
export function add(a, b) { return a + b; }
export function multiply(a, b) { return a * b; }

// main.js — named import
import { add, PI } from './math.js';
import { add as sum } from './math.js';   // 별칭
import * as math from './math.js';        // 네임스페이스 임포트
```

ES Module은 **정적**입니다. 실행 전에 어떤 모듈이 어떤 이름을 내보내는지 분석할 수 있습니다. 이것이 번들러의 트리 쉐이킹을 가능하게 합니다.

---

## Named Export vs Default Export

ES Module에는 두 종류의 내보내기가 있습니다.

**Named export**는 이름을 가진 여러 개의 항목을 내보냅니다.

```js
export const PI = 3.14;
export function add(a, b) { return a + b; }
export class Calculator { ... }
```

**Default export**는 파일당 하나만 가능하고 이름 없이 내보냅니다.

```js
// calculator.js
export default class Calculator {
  add(a, b) { return a + b; }
}

// main.js
import Calculator from './calculator.js';      // 이름은 임의 지정
import Calc from './calculator.js';            // 같은 것
```

두 가지를 섞을 수 있지만, 한 파일에 default export와 named export를 함께 쓰면 혼란스러울 수 있습니다. 라이브러리는 named export를 선호하는 추세입니다. default export는 자동 완성이 안 되고, 모듈 사용자가 이름을 임의로 지을 수 있어 코드베이스 전체에서 통일성이 깨집니다.

실용적인 규칙: React 컴포넌트는 default export, 유틸 함수와 상수는 named export를 씁니다.

---

## 동적 import() — ES2020

`import` 선언은 정적이지만, `import()` 함수는 동적입니다. Promise를 반환하며, 런타임에 조건부로 모듈을 불러올 수 있습니다.

```js
// 조건부 로딩
if (user.isAdmin) {
  const { AdminPanel } = await import('./admin-panel.js');
  AdminPanel.init();
}

// 이벤트 기반 지연 로딩
button.addEventListener('click', async () => {
  const { Chart } = await import('./chart-library.js');
  new Chart(canvas, data);
});

// 변수 경로 (번들러가 정적 분석 불가 — 주의)
const locale = navigator.language;
const messages = await import(`./locales/${locale}.js`);
```

번들러는 `import()`를 코드 분할(code splitting)의 경계로 인식합니다. `import()`된 모듈은 별도 chunk 파일로 분리되어, 실제 필요할 때 네트워크를 통해 불러옵니다. 큰 의존성(차트 라이브러리, 에디터 등)을 처음 로딩 비용 없이 사용할 수 있습니다.

---

## 번들러와 트리 쉐이킹

브라우저는 ES Module을 직접 지원하지만, 수백 개의 파일을 개별로 불러오면 HTTP 요청이 폭발합니다. **번들러**(Webpack, Rollup, Vite, esbuild)는 모든 파일을 하나 또는 몇 개의 최적화된 파일로 묶습니다.

![모듈 번들링 & 트리 쉐이킹](/assets/posts/js-module-system-bundling.svg)

**트리 쉐이킹**은 사용되지 않는 export를 최종 번들에서 제거하는 최적화입니다. ES Module의 정적 분석 덕분에 가능합니다.

```js
// math.js
export function add(a, b) { return a + b; }     // 사용됨
export function multiply(a, b) { return a * b; } // 미사용

// main.js
import { add } from './math.js';   // multiply는 import 안 함
```

번들러는 `multiply`가 사용되지 않음을 정적으로 알 수 있어 최종 번들에서 제거합니다. CommonJS는 런타임에야 어떤 값이 쓰이는지 알 수 있어 트리 쉐이킹이 어렵습니다.

트리 쉐이킹이 잘 작동하려면 라이브러리가 사이드 이펙트 없이 순수한 함수/클래스만 export해야 합니다. `package.json`에 `"sideEffects": false`를 선언하면 번들러에게 이를 알립니다.

---

## Node.js에서 두 형식 공존

Node.js는 CJS와 ESM을 모두 지원합니다. 둘을 구분하는 방법:

- `.mjs` 확장자 → ESM
- `.cjs` 확장자 → CommonJS
- `package.json`의 `"type": "module"` → 해당 패키지의 `.js`를 ESM으로 처리
- `"type": "commonjs"` → `.js`를 CJS로 처리 (기본값)

```json
// package.json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  }
}
```

라이브러리를 배포할 때는 두 형식을 모두 제공하는 **이중 패키지(dual package)**가 모범 사례입니다. 사용자가 CJS 환경이든 ESM 환경이든 올바른 파일을 사용할 수 있도록 합니다.

ESM에서 CJS 모듈을 import할 수 있지만, CJS에서 ESM을 `require()`할 수 없습니다. 비동기 문맥에서만 `await import()`로 가능합니다.

---

## 순환 의존성

A가 B를 import하고, B가 A를 import하면 **순환 의존성**이 발생합니다.

```js
// a.js
import { b } from './b.js';
export const a = 'a: ' + b;

// b.js
import { a } from './a.js';
export const b = 'b: ' + a;   // a는 아직 초기화 전
```

ES Module은 순환 의존성을 허용하지만, 초기화 순서에 따라 값이 `undefined`가 될 수 있습니다. CommonJS도 마찬가지로 순환 시 불완전한 exports 객체를 받습니다.

순환 의존성은 코드 설계 문제의 신호입니다. 공유 상태나 타입을 별도 파일로 추출하거나, 의존 방향을 단방향으로 정리하는 것이 해결책입니다.

---

모듈 시스템은 현대 JavaScript 개발의 기반입니다. `import`와 `export`를 쓸 줄 아는 것을 넘어, CommonJS와 ESM의 차이, 트리 쉐이킹이 왜 중요한지, 동적 import()로 무엇을 얻는지를 이해하면 성능 최적화와 패키지 선택에서 더 나은 판단을 내릴 수 있습니다.

다음 글에서는 일상적으로 가장 많이 다루는 자료구조인 배열을 위한 **배열 메서드**들을 정리합니다. `map`, `filter`, `reduce`부터 ES2023의 불변 메서드까지, 선언적 배열 조작의 모든 것입니다.

---

**지난 글:** [모던 문법 — ES2018 이후 필수 문법 정리](/posts/js-modern-syntax/)

**다음 글:** [콜백 패턴 — 비동기의 시작과 콜백 헬](/posts/js-callback-pattern/)

<br>
읽어주셔서 감사합니다. 😊
