---
title: "Tree Shaking 심층 분석 — 죽은 코드 완전 제거"
description: "Tree Shaking이 작동하는 조건(정적 ESM), 실패하는 패턴(CJS·네임스페이스·클래스), sideEffects 선언, /*#__PURE__*/ 주석, 번들 분석 도구, 라이브러리 제작자가 챙겨야 할 것들을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Tree Shaking", "번들러", "ESM", "sideEffects", "Dead Code", "빌드최적화"]
featured: false
draft: false
---

[지난 글](/posts/build-source-map/)에서 소스맵의 구조와 보안 처리를 살펴봤습니다. 이번에는 **Tree Shaking**을 심층 분석합니다. "Tree Shaking을 쓴다"는 말은 많이 하지만, 실제로 작동하는지 확인하는 개발자는 드뭅니다. 번들 분석 도구로 확인해보면 제거되어야 할 코드가 버젓이 포함된 경우가 흔합니다.

## Tree Shaking의 전제 조건

Tree Shaking은 **정적 분석**에 기반합니다. 런타임에 결정되는 것은 분석할 수 없습니다.

**필수 조건**:
1. **ES 모듈(ESM)** — `import`/`export`가 파일 최상위에 정적으로 선언
2. **프로덕션 빌드** — `mode: 'production'` 또는 `minify: true`
3. **sideEffects 선언** — `package.json`에 `"sideEffects": false` 또는 파일 목록

![Tree Shaking 작동 조건과 실패 패턴](/assets/posts/build-tree-shaking-deep-analysis.svg)

## 성공하는 패턴

```js
// ✅ Named export — 분석 가능
export function add(a, b) { return a + b; }
export function sub(a, b) { return a - b; }

// ✅ Named import — add만 번들에 포함
import { add } from './math';

// ✅ Re-export — 체이닝해도 추적 가능
export { add } from './math';
```

## 실패하는 패턴

### 1. CommonJS

```js
// ❌ require — 런타임에 결정
const { add } = require('./math');

// ❌ module.exports 객체 — 전체가 번들에 포함
module.exports = { add, sub };
```

CJS로 배포된 라이브러리는 `@rollup/plugin-commonjs`가 ESM으로 변환하지만, 동적 `require`는 분석 불가로 전체 모듈이 포함됩니다.

### 2. 네임스페이스 import

```js
// ❌ 네임스페이스 import — sub가 사용되지 않아도 포함됨
import * as math from './math';
math.add(1, 2);

// ✅ Named import로 대체
import { add } from './math';
add(1, 2);
```

### 3. 재할당된 export

```js
// ❌ 변수에 할당 후 export — 분석 어려움
let fn = () => {};
export { fn };
fn = () => 'reassigned'; // 재할당

// ✅ const export
export const fn = () => {};
```

### 4. 클래스 메서드

```js
// ❌ 클래스 전체가 참조되면 메서드 단위 제거 불가
class MathUtils {
  add(a, b) { return a + b; }
  sub(a, b) { return a - b; }  // 미사용이어도 포함
}
export default MathUtils;

// ✅ 함수 단위 named export가 Tree Shaking에 유리
export function add(a, b) { return a + b; }
export function sub(a, b) { return a - b; }
```

## sideEffects 선언

번들러는 sideEffects 정보 없이는 보수적으로 모든 모듈을 포함합니다. `import`만 해도 모듈 실행이 전역 상태를 변경할 수 있다고 가정하기 때문입니다.

```json
// package.json — 라이브러리
{
  "name": "my-lib",
  "sideEffects": false
}
```

`false`는 "이 패키지의 모든 파일은 import만 해도 사이드이펙트 없음"을 선언합니다. CSS 주입, 전역 폴리필, `document.addEventListener` 같은 것이 있으면 해당 파일을 명시해야 합니다.

```json
{
  "sideEffects": [
    "**/*.css",
    "src/polyfills.js",
    "src/setup.ts"
  ]
}
```

## `/*#__PURE__*/` 주석

번들러에게 "이 표현식은 사이드이펙트 없음"을 알리는 힌트입니다. Babel, SWC, TypeScript 컴파일러가 클래스 데코레이터나 특정 패턴에서 자동으로 삽입하기도 합니다.

```js
// 번들러는 createComponent() 호출이 사이드이펙트를
// 일으킬 수 있다고 보수적으로 판단 → 미사용이어도 포함
const MyComponent = createComponent({ name: 'MyComponent' });

// /*#__PURE__*/ 주석으로 "안전한 제거 가능" 선언
const MyComponent = /*#__PURE__*/ createComponent({ name: 'MyComponent' });
```

```js
// React의 createElement 호출도 Pure 처리
const el = /*#__PURE__*/ React.createElement('div', null, 'Hello');
```

Rollup은 ES 클래스의 정적 메서드 호출에 `/*#__PURE__*/`를 자동 주입합니다.

## 번들러별 설정

![번들러별 Tree Shaking 설정](/assets/posts/build-tree-shaking-deep-tools.svg)

### webpack

```js
export default {
  mode: 'production',  // usedExports + sideEffects + minimize 자동 활성화
  optimization: {
    usedExports: true,      // 미사용 export에 /* unused harmony export */ 주석
    sideEffects: true,      // package.json sideEffects 참조
    minimize: true,         // 주석 달린 미사용 코드 최종 제거 (Terser)
    innerGraph: true,       // 내부 참조 추적 (클래스 메서드 등)
    concatenateModules: true, // 모듈 합성 (Scope Hoisting)
  },
};
```

### Rollup

```js
export default {
  treeshake: {
    preset: 'safest',             // 'recommended' | 'safest' | 'smallest'
    moduleSideEffects: false,     // 모든 모듈에 sideEffects 없다고 가정
    propertyReadSideEffects: false,
    unknownGlobalSideEffects: false,
  },
};
```

## 번들 분석 실습

```bash
# webpack
ANALYZE=true npm run build
# → 브라우저에 트리맵 자동 오픈

# Vite
npm install --save-dev rollup-plugin-visualizer
```

```ts
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      open: true,        // 빌드 후 자동 오픈
      gzipSize: true,    // Gzip 크기 표시
      template: 'treemap', // 'sunburst' | 'network' | 'list'
    }),
  ],
});
```

## 라이브러리 제작자 체크리스트

```bash
# 1. ESM 형식으로 빌드
# package.json "module" 또는 exports["."].import 필드

# 2. sideEffects 선언
# "sideEffects": false 또는 예외 파일 목록

# 3. TypeScript 설정
# tsconfig.json: "module": "ESNext", "moduleResolution": "Bundler"

# 4. 번들 분석으로 검증
npx publint .              # npm 배포 전 패키지 유효성
npx are-the-types-wrong .  # 타입 선언 정합성
```

```js
// 검증: 실제 Tree Shaking 되는지 테스트
import { add } from 'my-lib'; // sub는 import 안 함
console.log(add(1, 2));
// → 번들에 sub 코드가 없어야 함
```

---

**지난 글:** [소스맵 완전 정복 — 디버깅의 숨은 열쇠](/posts/build-source-map/)

**다음 글:** [코드 스플리팅 심층 분석 — 최적 청킹 전략](/posts/build-code-splitting/)

<br>
읽어주셔서 감사합니다. 😊
