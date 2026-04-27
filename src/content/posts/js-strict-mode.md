---
title: "Strict mode — 'use strict'로 달라지는 JavaScript"
description: "JavaScript의 엄격 모드(Strict mode)가 무엇인지, sloppy mode와 어떻게 다른지, 어디에 선언하느냐에 따라 범위가 어떻게 달라지는지를 코드로 비교합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "strict-mode", "use-strict", "sloppy-mode", "best-practices", "es5"]
featured: false
draft: false
---

[지난 글](/posts/js-runtimes/)에서 이어집니다.

## JavaScript는 두 가지 모드로 동작한다

JavaScript에는 코드가 실행되는 방식을 결정하는 두 가지 모드가 있습니다.

- **Sloppy mode (기본):** ES5 이전부터 이어진 관대한 실행 방식. 오류를 조용히 무시하거나 예측하기 어려운 동작을 허용합니다.
- **Strict mode:** `'use strict'` 선언으로 활성화하는 엄격한 실행 방식. 잠재적 버그를 초기에 에러로 드러냅니다.

Strict mode는 ES5(2009)에서 도입됐습니다. 기존 코드와의 하위 호환성을 유지하면서도 더 안전한 코딩 방식을 강제할 방법이 필요했기 때문입니다. `'use strict'`는 문자열 리터럴이기 때문에 이 지시어를 이해하지 못하는 구형 엔진은 단순히 문자열로 처리하고 넘어갑니다.

---

## Sloppy mode vs Strict mode — 코드로 비교

![Sloppy Mode vs Strict Mode](/assets/posts/js-strict-mode-compare.svg)

위 그림에서 Sloppy mode는 `x = 10`처럼 선언 없이 변수에 값을 할당해도 에러 없이 전역 변수를 만들어버립니다. `with` 문도 허용하고, 함수 내 `this`는 전역 객체(`window`)를 가리킵니다.

Strict mode에서는 이 모든 동작이 즉각적인 에러로 바뀝니다. 선언 없는 할당은 `ReferenceError`, `with` 문은 `SyntaxError`, 함수 내 `this`는 `undefined`가 됩니다. 오류가 조용히 넘어가는 대신 즉시 발견됩니다.

---

## 어디에 선언하느냐에 따라 범위가 달라진다

![Strict mode 적용 방법과 금지 규칙](/assets/posts/js-strict-mode-rules.svg)

### 파일 전체에 적용

```javascript
'use strict';

// 이 파일의 모든 코드가 strict mode로 실행됨
x = 10; // ReferenceError
```

파일 최상단에 `'use strict'`를 선언하면 해당 파일 전체에 strict mode가 적용됩니다. 팀 컨벤션으로 정해두면 전체 코드베이스를 일관되게 관리할 수 있습니다.

### 함수 단위로 적용

```javascript
function strictFn() {
  'use strict';
  // 이 함수 안에서만 strict mode
  x = 10; // ReferenceError
}

function sloppyFn() {
  // 이 함수는 sloppy mode
  x = 10; // 전역 변수 생성 (에러 없음)
}
```

함수 내부 첫 줄에 선언하면 그 함수와 중첩 함수에만 적용됩니다. 레거시 코드베이스에서 일부 함수만 마이그레이션할 때 유용합니다.

### 자동 적용 환경

별도 선언 없이 strict mode가 자동으로 활성화되는 환경이 있습니다.

| 환경 | 설명 |
|---|---|
| ES 모듈 (`import`/`export`) | 모듈은 항상 strict mode |
| 클래스 본문 (`class {}`) | 클래스 내부는 항상 strict mode |
| Deno / Bun | 기본적으로 strict mode 적용 |

현대 JavaScript 개발에서는 ES 모듈을 쓰는 순간 strict mode가 자동으로 적용됩니다. React, Vue, Svelte 등 모던 프레임워크는 모두 모듈 시스템을 기반으로 하므로, 별도 선언 없이도 strict mode 환경에서 코드를 작성하게 됩니다.

---

## Strict mode가 금지하는 것들

### 선언 없는 변수 할당

```javascript
'use strict';
name = 'Alice'; // ReferenceError: name is not defined
```

Sloppy mode에서는 전역 변수가 자동으로 생성됩니다. 의도하지 않은 전역 변수 오염의 주요 원인이었습니다.

### 함수 내 this

```javascript
'use strict';

function show() {
  console.log(this); // undefined
}
show(); // 일반 호출 시 this = undefined

// sloppy mode에서는 window/global
```

메서드가 아닌 일반 함수 호출 시 strict mode는 `this`를 `undefined`로 만듭니다. `this`를 잘못 사용하는 버그를 즉시 발견할 수 있습니다.

### with 문

```javascript
'use strict';
with (Math) { // SyntaxError
  console.log(PI);
}
```

`with` 문은 스코프 체인을 동적으로 변경해 정적 분석을 불가능하게 만들었습니다. Strict mode에서는 완전히 금지됩니다.

### 중복 매개변수

```javascript
'use strict';
function add(a, a) { // SyntaxError
  return a + a;
}
```

Sloppy mode에서는 뒤에 오는 `a`가 앞의 `a`를 덮어쓰는 방식으로 허용됐습니다. 의도하지 않은 버그의 온상이었습니다.

### delete 불가 대상 삭제

```javascript
'use strict';
delete Object.prototype; // TypeError

var x = 1;
delete x; // SyntaxError (선언된 변수 삭제 불가)
```

### 8진수 리터럴

```javascript
'use strict';
var n = 0777; // SyntaxError (ES3 스타일 8진수)
var m = 0o777; // 허용 (ES6 스타일 8진수)
```

### arguments.callee

```javascript
'use strict';
(function() {
  console.log(arguments.callee); // TypeError
})();
```

재귀 함수에서 함수 이름 없이 자신을 참조할 때 쓰이던 `arguments.callee`는 최적화를 방해해 strict mode에서 금지됩니다.

---

## 실무에서 어떻게 쓰나

현대 JavaScript 개발에서 `'use strict'`를 직접 쓸 일은 줄었습니다. ES 모듈(`.mjs`, `type: "module"`)이나 TypeScript, 번들러(Vite, webpack)를 사용하면 자동으로 strict mode 환경이 됩니다.

그러나 레거시 코드베이스, 브라우저에서 직접 실행하는 `<script>` 태그, 또는 CommonJS 환경(Node.js의 `.js` 파일)에서는 여전히 명시적 선언이 중요합니다.

```javascript
// 레거시 스크립트 — 명시적 선언 필요
'use strict';

// 모던 ESM 환경 — 자동 strict mode
import { something } from './module.js';
```

**원칙:** `var` 대신 `let`/`const`를 쓰고, ES 모듈을 사용하면 대부분의 Sloppy mode 문제는 자연스럽게 해결됩니다.

---

## 정리

Strict mode는 JavaScript의 위험한 동작을 에러로 바꿔 버그를 조기에 발견하게 해줍니다. 파일 전체, 함수 단위, 또는 ES 모듈/클래스처럼 자동으로 적용되는 세 가지 방법이 있습니다. 선언 없는 전역 변수, 잘못된 `this`, `with` 문, 중복 매개변수 등 Sloppy mode가 조용히 허용하던 것들을 모두 즉각적인 에러로 잡아냅니다.

다음 글에서는 JavaScript 변수 선언의 세 가지 키워드 — `var`, `let`, `const`의 차이와 스코프 규칙을 살펴봅니다.

---

**지난 글:** [런타임 환경 — 브라우저·Node·Deno·Bun의 차이](/posts/js-runtimes/)  
**다음 글:** [var·let·const — 스코프와 호이스팅 완전 정리](/posts/js-var-let-const/)

<br>
읽어주셔서 감사합니다. 😊
