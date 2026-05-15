---
title: "CommonJS & require() · Node.js 모듈 시스템"
description: "Node.js CommonJS 모듈 시스템의 require() 해석 알고리즘, module.exports와 exports의 차이, 모듈 래퍼 함수, require.cache를 활용한 캐시 제어, 순환 의존성 처리 방식을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "CommonJS", "require", "module.exports", "모듈 시스템", "순환 의존성"]
featured: false
draft: false
---

[지난 글](/posts/node-architecture/)에서 Node.js의 V8, libuv, 이벤트 루프 구조를 살펴봤습니다. 이번에는 **CommonJS 모듈 시스템**을 깊이 파헤칩니다. `require()`가 어떻게 모듈을 찾고 로드하는지, `module.exports`와 `exports`가 왜 다르게 동작하는지 이해하면 많은 버그를 예방할 수 있습니다.

---

## CommonJS란

CommonJS(CJS)는 Node.js의 기본 모듈 포맷입니다. `.js` 파일에 `type: "module"`이 없으면 기본적으로 CJS로 처리됩니다. 동기적 `require()`로 의존성을 가져오고, `module.exports`로 내보냅니다.

```js
// math.js
function add(a, b) { return a + b; }
function sub(a, b) { return a - b; }

module.exports = { add, sub };

// app.js
const { add, sub } = require('./math');
console.log(add(2, 3)); // 5
```

---

## require() 해석 순서

`require('X')`를 호출하면 Node.js는 아래 순서로 모듈을 찾습니다.

![require() 모듈 해석 순서](/assets/posts/node-cjs-require-resolution.svg)

1. **캐시 확인**: `require.cache[resolvedPath]`에 이미 로드된 모듈이 있으면 즉시 반환
2. **코어 모듈**: `fs`, `http`, `path` 같은 내장 모듈이면 즉시 반환
3. **상대/절대 경로**: `./`, `../`, `/`로 시작하면 해당 경로에서 파일 탐색
4. **node_modules 탐색**: 현재 디렉토리 → 부모 → 루트까지 `node_modules` 순환 탐색

파일 탐색 시 확장자 없이 지정하면 `.js` → `.json` → `.node` → `index.js` 순으로 시도합니다.

```js
require('./utils');
// 탐색 순서:
// 1. ./utils.js
// 2. ./utils.json
// 3. ./utils.node
// 4. ./utils/index.js
// 5. ./utils/package.json의 "main" 필드
```

---

## 모듈 래퍼 함수

Node.js는 모든 모듈 파일을 **래퍼 함수**로 감쌉니다. 이 때문에 최상위 `var` 선언이 전역으로 오염되지 않고, `__filename`, `__dirname` 같은 변수를 사용할 수 있습니다.

```js
// Node.js가 내부적으로 실행하는 코드 (실제 Node 소스 기반)
(function(exports, require, module, __filename, __dirname) {
  // 여기에 파일 내용 삽입
  const { add } = require('./math'); // require는 매개변수로 주입됨
  console.log(__filename);           // 현재 파일 절대 경로
  console.log(__dirname);            // 현재 디렉토리 절대 경로
});
```

---

## module.exports vs exports

`exports`는 초기에 `module.exports`와 **같은 객체를 가리키는 참조**입니다. 속성을 추가하는 한 둘 다 동작합니다. 그러나 `exports`를 **재할당**하면 연결이 끊어집니다.

![module.exports vs exports](/assets/posts/node-cjs-require-code.svg)

```js
// 안전: 속성 추가 (exports, module.exports 모두 OK)
exports.name = '홍길동';
module.exports.name = '홍길동'; // 동일 효과

// 위험: exports 재할당 — module.exports는 여전히 {}
exports = { name: '홍길동' }; // 이 모듈을 require하면 {} 반환

// 안전: module.exports 교체
module.exports = { name: '홍길동' }; // 이 모듈을 require하면 { name: '홍길동' } 반환
```

클래스나 함수 하나를 기본 내보내기 할 때는 `module.exports`를 직접 교체합니다.

```js
// calculator.js — 클래스 기본 내보내기
class Calculator {
  add(a, b) { return a + b; }
  sub(a, b) { return a - b; }
}
module.exports = Calculator;

// app.js
const Calculator = require('./calculator');
const calc = new Calculator();
```

---

## require.cache — 모듈 캐시

한번 로드된 모듈은 `require.cache` 객체에 저장됩니다. 키는 절대 경로, 값은 `Module` 객체입니다.

```js
const path = require('path');
const configPath = path.resolve('./config.js');

// 캐시에서 강제 제거 (hot reload 구현 시)
delete require.cache[configPath];
const freshConfig = require('./config'); // 파일 다시 읽음

// 현재 캐시된 모듈 목록 확인
console.log(Object.keys(require.cache));
```

캐시 덕분에 여러 모듈이 같은 파일을 `require`해도 파일을 한 번만 읽고 실행됩니다. 싱글톤 패턴이 자연스럽게 구현됩니다.

---

## 순환 의존성

A가 B를 require하고, B도 A를 require하는 상황입니다. Node.js는 **부분 exports**로 이를 처리합니다. 순환이 발생하면 아직 완전히 채워지지 않은 `module.exports`(빈 객체 또는 일부만 채워진 상태)를 반환합니다.

```js
// a.js
console.log('a 시작');
const b = require('./b');
console.log('a에서 b.done =', b.done);
module.exports.done = true;

// b.js
console.log('b 시작');
const a = require('./a'); // a가 아직 완전히 실행되지 않음!
console.log('b에서 a.done =', a.done); // undefined (a.done이 아직 세팅 안 됨)
module.exports.done = true;

// main.js
require('./a');
// 출력:
// a 시작
// b 시작
// b에서 a.done = undefined  ← 부분 exports
// a에서 b.done = true
```

순환 의존성은 아키텍처 문제의 신호입니다. 가능하면 의존 방향을 단방향으로 설계하세요.

---

## JSON과 .node 파일 로딩

```js
// JSON 파일 직접 import
const pkg = require('./package.json');
console.log(pkg.version); // 자동으로 파싱됨

// .node — C++ 네이티브 애드온 (node-gyp로 빌드)
const addon = require('./build/Release/addon.node');
addon.hello(); // C++ 함수 호출
```

---

**지난 글:** [Node.js 아키텍처 · V8·libuv·이벤트 루프](/posts/node-architecture/)

**다음 글:** [Node.js ESM · ES 모듈 완전 가이드](/posts/node-esm/)

<br>
읽어주셔서 감사합니다. 😊
