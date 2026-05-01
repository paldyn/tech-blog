---
title: "모듈 캐시와 순환 의존성 — 한 번 로드, 영원한 공유"
description: "JavaScript 모듈 시스템의 캐싱 메커니즘(싱글턴 효과)과 순환 의존성 발생 시 ESM live binding과 CJS 복사 방식의 차이, 해결 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "모듈", "Module Cache", "순환 의존성", "ESM", "CJS", "live binding"]
featured: false
draft: false
---

[지난 글](/posts/js-import-maps/)에서 브라우저 Import Maps로 bare specifier를 URL에 매핑하는 방법을 살펴봤습니다. 이번에는 모듈이 로드되고 나서 런타임 내부에서 어떻게 관리되는지, 그리고 순환 의존성이 발생했을 때 무슨 일이 일어나는지를 살펴봅니다.

## 모듈 캐시 — 싱글턴으로 동작하는 모듈

모든 모듈 시스템(ESM, CJS 모두)은 **모듈 맵(Module Map)** 혹은 **캐시**를 유지합니다. 동일한 URL(또는 파일 경로)로 요청되는 모듈은 처음 로드 이후 캐시에서 반환되고, 다시 평가되지 않습니다.

```js
// counter.js
export let count = 0;
export function inc() { count++; }
```

```js
// a.js
import { inc } from './counter.js';
inc(); // count = 1

// b.js (같은 앱, 같은 실행 컨텍스트)
import { count } from './counter.js';
console.log(count); // 1 — a.js의 변경이 반영됨
```

`counter.js`는 한 번만 평가되고, `a.js`와 `b.js` 모두 같은 인스턴스를 참조합니다. 이 **싱글턴 효과** 덕분에 모듈 수준 상태(카운터, 캐시, 이벤트 버스)를 앱 전체에서 공유하기 쉽지만, 반대로 예상치 못한 상태 공유 버그도 생길 수 있습니다.

![모듈 캐시와 싱글턴 효과](/assets/posts/js-module-cache-cycles-cache.svg)

## Node.js CJS에서 캐시 무효화

Node.js의 `require`는 `require.cache` 객체를 통해 캐시를 직접 조작할 수 있습니다.

```js
// 캐시에서 제거 → 다음 require 시 재평가
delete require.cache[require.resolve('./counter')];
const fresh = require('./counter'); // 새로 로드
```

주로 테스트에서 모듈 상태를 초기화하거나, 핫 리로드를 구현할 때 사용합니다.

ESM에는 이런 API가 없습니다. `import()`는 캐시된 모듈을 반환하며, 재평가를 강제할 공식 방법이 없습니다. 개발 환경에서 우회하려면 URL에 쿼리 파라미터를 추가하는 방법을 씁니다.

```js
// ESM 캐시 우회 (개발 전용 — 프로덕션에는 부적합)
const mod = await import(`./counter.js?v=${Date.now()}`);
```

## 순환 의존성이란

A가 B를 import하고 B가 다시 A를 import하는 구조를 **순환 의존성(circular dependency)** 이라고 합니다. 규모 있는 프로젝트에서는 의도치 않게 발생하기 쉽습니다.

```
a.js → b.js → a.js (순환)
```

문제는 모듈 평가 순서에 있습니다. 최초 진입점에서 a.js를 로드하면 b.js를 먼저 평가해야 하는데, b.js는 a.js가 필요합니다. 런타임은 무한 루프를 막기 위해 a.js의 **현재까지 완성된 부분**만 b.js에 제공합니다.

## ESM — Live Binding으로 순환 허용

ESM은 **live binding** 방식입니다. 모듈이 export하는 값은 복사본이 아니라 원본 바인딩에 대한 참조입니다.

```js
// a.mjs
import { b } from './b.mjs';
export const a = 'A';
export function run() {
  console.log(b); // 호출 시점에 b 참조
}
```

```js
// b.mjs
import { a } from './a.mjs';
export const b = 'B';
```

`run()`이 호출되는 시점에는 b.mjs의 초기화가 이미 완료되어 있으므로 `b`는 정상적으로 `'B'`를 가리킵니다. 핵심은 **함수 내부에서만 순환 바인딩을 참조**한다는 점입니다.

반면 최상위 레벨에서 즉시 사용하면 다릅니다.

```js
// a.mjs 최상위에서
import { b } from './b.mjs';
console.log(b); // 순환 초기화 중 → undefined 가능
```

![순환 의존성: ESM vs CJS 비교](/assets/posts/js-module-cache-cycles-circular.svg)

## CJS — 복사로 인한 undefined 버그

`require`는 모듈 평가 시점에 `module.exports`의 **현재 값을 복사**합니다. 순환이 발생하면 아직 초기화되지 않은 빈 객체 사본을 받게 됩니다.

```js
// a.cjs
const { b } = require('./b'); // b.cjs 로드 시작 → b.cjs가 a.cjs를 require
exports.a = 'A';              // 이 시점에 a.cjs exports는 {}

// b.cjs
const { a } = require('./a'); // a.cjs는 아직 exports.a 미완성
console.log(a);               // undefined!
exports.b = 'B';
```

## 순환 의존성 해결 전략

1. **공통 모듈로 분리**: A와 B가 공통으로 사용하는 로직을 C로 빼내면 순환이 끊어집니다.
2. **함수 내부에서 참조**: 최상위 즉시 사용을 피하고 함수 호출 시점에 참조하면 ESM에서 안전합니다.
3. **동적 import로 지연**: 순환 엣지를 `await import()`로 바꿔 초기화 완료 후 참조하게 합니다.

```js
// 동적 import로 순환 해소
export async function getB() {
  const { b } = await import('./b.mjs');
  return b;
}
```

4. **린터 감지**: `eslint-plugin-import`의 `import/no-cycle` 규칙으로 빌드 전에 순환을 잡습니다.

모듈 캐시와 순환 의존성을 이해하면, 상태 공유 패턴을 설계하거나 번들 분석 도구가 "circular dependency detected" 경고를 낼 때 정확한 원인을 찾을 수 있습니다.

---

**지난 글:** [Import Maps — 빌드 없이 브라우저에서 bare specifier 사용하기](/posts/js-import-maps/)

**다음 글:** [JavaScript 동시성 모델 — 싱글 스레드가 멈추지 않는 이유](/posts/js-concurrency-model/)

<br>
읽어주셔서 감사합니다. 😊
