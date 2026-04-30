---
title: "UMD·AMD·IIFE — 모듈 시스템의 역사"
description: "JavaScript에 공식 모듈 시스템이 없던 시절 개발자들이 만든 IIFE, AMD, UMD 패턴의 탄생 배경, 구조, 한계와 오늘날 ESM으로의 전환을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "UMD", "AMD", "IIFE", "CommonJS", "모듈 역사", "RequireJS"]
featured: false
draft: false
---

[지난 글](/posts/js-cjs-vs-esm/)에서 CommonJS와 ES 모듈을 비교했습니다. 이번에는 그 이전, **공식 모듈 시스템이 없던 시절** JavaScript 개발자들이 어떻게 코드를 구조화했는지 살펴봅니다. IIFE, AMD, UMD는 그 시절의 산물이지만, 지금도 일부 코드베이스에서 만날 수 있습니다.

## 모듈이 없던 시절

ES2015 이전의 JavaScript에는 `import`도 `require`도 없었습니다. 코드를 분리하면 모두 `<script>` 태그로 순서에 맞게 로드해야 했고, 모든 선언은 전역 스코프를 오염시켰습니다.

```javascript
// 2005년식 코드 — 전역 오염
var jQuery = { ... };
var _ = { ... };
var MyApp = { ... }; // window.MyApp
```

의존성 순서 오류, 변수 충돌, 테스트 불가 — 대형 프로젝트에서 심각한 문제가 됐습니다.

![JavaScript 모듈 시스템의 역사](/assets/posts/js-umd-amd-history-timeline.svg)

## IIFE 패턴

**즉시 실행 함수 표현식(IIFE, Immediately Invoked Function Expression)** 은 함수 스코프를 이용해 전역 오염을 막는 방법입니다.

```javascript
const Counter = (function() {
  let count = 0; // 외부에서 접근 불가
  return {
    inc: () => ++count,
    get: () => count,
  };
})();
```

- **장점**: 스코프 격리, 클로저로 private 상태 가능
- **단점**: 의존성 관리 없음, 여전히 수동 로드 순서 필요

## AMD — Asynchronous Module Definition

2010년경 **RequireJS**가 도입한 비동기 모듈 정의 방식입니다. 브라우저에서 비동기로 스크립트를 로드해야 했기 때문에 탄생했습니다.

```javascript
// 모듈 정의
define(['jquery', 'lodash'], function($, _) {
  return {
    greet: (name) => $(`<h1>Hello, ${_.escape(name)}</h1>`).appendTo(document.body),
  };
});

// 모듈 사용
require(['myModule'], function(mod) {
  mod.greet('World');
});
```

- **장점**: 브라우저 비동기 로드, 명시적 의존성
- **단점**: 장황한 문법, RequireJS 런타임 필요, 서버에서는 CJS 더 적합

## CommonJS — Node.js의 표준

2009년 Node.js가 채택한 동기 모듈 시스템입니다. 파일 시스템에서 동기적으로 읽을 수 있는 서버 환경에 최적화됐습니다.

```javascript
// 내보내기
const add = (a, b) => a + b;
module.exports = { add };

// 가져오기
const { add } = require('./math');
```

npm 생태계 전체가 CJS 기반으로 성장했습니다.

## UMD — Universal Module Definition

AMD와 CJS의 장점을 결합하고, 레거시 전역 변수 방식도 지원하는 **범용 래퍼**입니다. 어떤 환경에서도 동작하도록 런타임에 모듈 시스템을 감지합니다.

```javascript
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);             // AMD
  } else if (typeof module !== 'undefined') {
    module.exports = factory();      // CommonJS
  } else {
    root.MyLib = factory();          // 전역 변수
  }
}(this, function() {
  return { /* 라이브러리 코드 */ };
}));
```

- **장점**: 어디서든 동작, 라이브러리 배포에 유리
- **단점**: 보일러플레이트 코드가 길고 읽기 어려움, 정적 분석 불가

![AMD · UMD · IIFE 코드 패턴](/assets/posts/js-umd-amd-history-patterns.svg)

## 각 시스템의 비교

| 시스템 | 등장 | 환경 | 로딩 | 특징 |
|--------|------|------|------|------|
| IIFE | ~2008 | 브라우저 | 동기 | 스코프 격리만 |
| AMD | 2010 | 브라우저 | 비동기 | RequireJS 필요 |
| CJS | 2009 | Node.js | 동기 | npm 생태계 |
| UMD | 2012 | 브라우저+서버 | 동기/비동기 | 범용 래퍼 |
| ESM | 2015 | 표준 | 비동기 | 공식 표준 |

## 오늘날의 상황

ESM이 브라우저와 Node.js 모두에서 네이티브 지원되면서 AMD와 UMD는 사실상 레거시가 됐습니다. 번들러(Webpack, Rollup, esbuild, Vite)가 CJS ↔ ESM 변환을 처리해주므로, 새 코드는 ESM으로 작성하면 됩니다.

IIFE 패턴은 여전히 유용합니다. 번들된 스크립트에서 전역 스코프를 오염시키지 않기 위한 방어 패턴으로, 번들러가 자동 생성하기도 합니다.

```javascript
// Rollup이 iife 포맷으로 번들할 때 생성하는 코드
var MyLib = (function(exports) {
  // 번들된 코드
  return exports;
}({}));
```

UMD는 npm에서 오래된 라이브러리를 배포할 때 여전히 볼 수 있지만, 새 라이브러리는 ESM + CJS 듀얼 패키지(`package.json exports` 필드)로 배포합니다.

## 정리

JavaScript 모듈 역사는 언어 설계의 공백을 커뮤니티가 채운 이야기입니다. IIFE → AMD/CJS → UMD → ESM으로 이어지는 과정은 "어떻게 코드를 재사용하고 의존성을 관리할 것인가"라는 근본 문제를 풀어가는 20년간의 실험이었습니다. 오늘날 ESM이 그 답을 표준화했습니다.

---

**지난 글:** [CommonJS vs ES 모듈 — 두 시스템의 결정적 차이](/posts/js-cjs-vs-esm/)

**다음 글:** [트리 쉐이킹 — 사용하지 않는 코드를 제거하는 기술](/posts/js-tree-shaking/)

<br>
읽어주셔서 감사합니다. 😊
