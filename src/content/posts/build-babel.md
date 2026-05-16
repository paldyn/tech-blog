---
title: "Babel 완전 해부 — 트랜스파일러의 동작 원리"
description: "Babel이 JavaScript를 변환하는 파이프라인(parse→transform→generate), @babel/core의 역할, 프리셋과 플러그인 구조, Polyfill 전략, 실전 설정까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Babel", "트랜스파일러", "AST", "preset-env", "플러그인", "폴리필", "빌드도구"]
featured: false
draft: false
---

[지난 글](/posts/ts-incremental-adoption/)에서 TypeScript를 기존 JavaScript 프로젝트에 점진적으로 도입하는 전략을 살펴봤습니다. 이번부터는 **빌드 도구** 시리즈를 시작합니다. 첫 주제는 Babel입니다. "Babel은 최신 JS를 구형 브라우저에서 돌아가도록 변환해준다"는 것은 누구나 알지만, 내부에서 정확히 무슨 일이 일어나는지 아는 개발자는 많지 않습니다. 파이프라인을 해부하면 플러그인 작성, 성능 최적화, 트러블슈팅 모두가 쉬워집니다.

## Babel이 하는 일

Babel의 핵심 역할은 세 가지입니다.

1. **문법 변환** — ES2015+ 화살표 함수, 클래스, 옵셔널 체이닝 같은 새 문법을 구형 브라우저가 이해하는 ES5 패턴으로 변환
2. **소스 타입 변환** — TypeScript, JSX, Flow 타입 주석 제거
3. **Polyfill 주입** — `Promise`, `Array.prototype.flat` 같이 런타임에 존재해야 하는 API를 자동으로 삽입

문법 변환과 폴리필은 다릅니다. 문법은 파서가 이해하지 못하면 오류가 나지만, 폴리필 대상은 런타임에 메서드가 없을 때 오류가 납니다. Babel은 둘 다 처리합니다.

## 변환 파이프라인

![Babel 변환 파이프라인](/assets/posts/build-babel-pipeline.svg)

Babel의 변환은 `@babel/core`가 조율하는 세 단계로 이루어집니다.

### 1단계 — Parse: 소스 → AST

`@babel/parser`(구 Babylon)가 소스 코드를 토크나이징하고, **AST(Abstract Syntax Tree)** 를 생성합니다. AST는 프로그램의 구조를 트리 형태로 표현한 JSON 객체입니다.

```js
// 화살표 함수 AST 노드 (단순화)
{
  type: "ArrowFunctionExpression",
  params: [{ type: "Identifier", name: "x" }],
  body: {
    type: "BinaryExpression",
    operator: "+",
    left:  { type: "Identifier", name: "x" },
    right: { type: "NumericLiteral", value: 1 }
  }
}
```

### 2단계 — Transform: AST 순회 + 변환

`@babel/traverse`가 AST를 **Visitor 패턴**으로 순회합니다. 플러그인은 특정 노드 타입에 대한 방문자(visitor) 함수를 등록합니다. 방문자가 `ArrowFunctionExpression` 노드를 만나면 `FunctionExpression` 노드로 교체합니다.

```js
// 직접 만든 Babel 플러그인 예시
export default function myPlugin() {
  return {
    visitor: {
      // ArrowFunctionExpression 노드를 방문할 때
      ArrowFunctionExpression(path) {
        // 일반 함수로 변환
        path.replaceWith(
          t.functionExpression(
            null,
            path.node.params,
            t.blockStatement([t.returnStatement(path.node.body)])
          )
        );
      }
    }
  };
}
```

### 3단계 — Generate: AST → 코드

`@babel/generator`가 변환된 AST를 다시 문자열 소스 코드로 직렬화합니다. 이 과정에서 소스맵도 함께 생성됩니다.

## 설치와 기본 설정

```bash
npm install --save-dev @babel/core @babel/cli \
  @babel/preset-env core-js
```

```json
// babel.config.json
{
  "presets": [
    ["@babel/preset-env", {
      "targets": "> 0.5%, last 2 versions, not dead",
      "useBuiltIns": "usage",
      "corejs": 3
    }]
  ]
}
```

```bash
# 파일 변환
npx babel src --out-dir dist

# 단일 파일
npx babel src/index.js -o dist/index.js

# 변환 결과 확인
npx babel src/index.js --plugins @babel/plugin-transform-arrow-functions
```

## 프리셋과 플러그인 구조

![babel.config.json 구성 레이어](/assets/posts/build-babel-config.svg)

**실행 순서** 규칙은 헷갈리기 쉽습니다.

- **플러그인**: 정순 실행 (배열의 앞에서 뒤로)
- **프리셋**: 역순 실행 (배열의 뒤에서 앞으로)

역순인 이유는 여러 프리셋이 합성될 때 낮은 수준 변환이 먼저 적용되어야 하기 때문입니다. 보통 `preset-env`를 마지막에 두고, 언어별 프리셋(`preset-react`, `preset-typescript`)을 앞에 둡니다.

```json
{
  "presets": [
    "@babel/preset-env",
    "@babel/preset-react",
    "@babel/preset-typescript"
  ]
}
```

위 설정에서 실제 실행 순서는 `preset-typescript` → `preset-react` → `preset-env`입니다.

## Polyfill 전략

`@babel/polyfill`은 2020년에 deprecated 됐습니다. 현재 권장 방법은 두 가지입니다.

### useBuiltIns: "usage" (권장)

코드에서 실제로 사용하는 폴리필만 자동 감지해서 삽입합니다.

```js
// 소스
const p = new Promise((r) => r(42));
[1, 2, 3].includes(2);

// 변환 후 (자동 삽입)
import "core-js/modules/es.promise.js";
import "core-js/modules/es.array.includes.js";
const p = new Promise((r) => r(42));
[1, 2, 3].includes(2);
```

### @babel/plugin-transform-runtime (라이브러리 개발 시)

전역 오염 없이 헬퍼 함수를 모듈에서 import합니다. 라이브러리를 개발할 때 전역 폴리필 주입은 사용자 코드와 충돌할 수 있으므로 이 플러그인을 사용합니다.

```bash
npm install --save-dev @babel/plugin-transform-runtime
npm install --save @babel/runtime-corejs3
```

```json
{
  "plugins": [
    ["@babel/plugin-transform-runtime", { "corejs": 3 }]
  ]
}
```

## browserslist 연동

`@babel/preset-env`의 `targets`는 [browserslist](https://browsersl.ist/) 쿼리를 받습니다. `package.json`이나 `.browserslistrc`로 분리하면 ESLint, PostCSS, Autoprefixer와 공유할 수 있습니다.

```
// .browserslistrc
> 0.5%
last 2 versions
Firefox ESR
not dead
not IE 11
```

```bash
# 지원 브라우저 목록 확인
npx browserslist "> 0.5%, last 2 versions, not dead"
```

## 성능 고려사항

### @babel/register (개발 전용)

Node.js `require` 훅으로 런타임 변환합니다. 느리기 때문에 프로덕션에는 절대 사용하지 않습니다.

```js
require('@babel/register');
require('./app'); // app.js가 런타임에 변환됨
```

### 캐시 활용

Babel은 기본적으로 변환 결과를 `node_modules/.cache/babel-loader/`에 캐시합니다. webpack과 함께 쓸 때 `cacheDirectory: true` 옵션을 활성화하면 증분 빌드 속도가 크게 향상됩니다.

```js
// webpack.config.js
{
  test: /\.js$/,
  use: {
    loader: 'babel-loader',
    options: { cacheDirectory: true }
  }
}
```

## SWC / esbuild와의 관계

Babel은 JavaScript로 작성된 트랜스파일러이며, 플러그인 생태계가 풍부합니다. 반면 Rust 기반의 SWC나 Go 기반의 esbuild는 10~100배 빠르지만 커스텀 플러그인 API가 제한적입니다. 다음 글에서 이 도구들을 자세히 비교합니다.

---

**지난 글:** [TypeScript 점진적 도입 — JS 프로젝트에서 TS로](/posts/ts-incremental-adoption/)

**다음 글:** [SWC · esbuild — Rust·Go 기반 초고속 변환](/posts/build-swc-esbuild/)

<br>
읽어주셔서 감사합니다. 😊
