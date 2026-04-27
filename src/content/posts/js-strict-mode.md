---
title: "Strict mode와 Sloppy mode — 더 안전한 JavaScript"
description: "ES5에서 도입된 strict mode가 해결하는 문제들, sloppy mode와의 차이점, 그리고 현대 JavaScript에서의 자동 적용 케이스를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "strict mode", "ES5", "sloppy mode", "보안", "버그"]
featured: false
draft: false
---

[지난 글](/posts/js-runtimes/)에서 브라우저, Node.js, Deno, Bun이라는 네 가지 런타임 환경을 비교했습니다. 이제 언어 자체의 이야기로 돌아와, JavaScript에 두 개의 "모드"가 있다는 사실을 살펴봅니다. 하나는 "관대한" 기본 모드이고, 하나는 2009년 ES5에서 도입된 **strict mode**입니다.

## 왜 두 가지 모드가 필요했나

JavaScript는 빠르게 작성된 언어였고, 초기 설계에는 많은 "관대한" 동작들이 있었습니다. 선언 없이 변수를 써도 자동으로 전역 변수가 생기는 것이 그 예입니다. 이런 동작은 초보자에게 편리해 보이지만 실제로는 버그의 온상이 됩니다.

2009년 ES5는 과거 코드와의 호환성을 유지하면서 이 문제를 해결하는 방법으로 **opt-in** 방식의 strict mode를 도입합니다. 기존 코드는 아무것도 바꾸지 않아도 되고, 새 코드만 더 엄격한 규칙을 선택할 수 있습니다.

"sloppy mode"라는 이름은 공식 명세에는 없고, strict mode의 반대를 가리키는 비공식 용어입니다.

## strict mode 활성화

```javascript
// 방법 1: 파일 최상단 — 전체 스크립트에 적용
"use strict";

function add(a, b) {
  return a + b;  // 이 함수도 strict mode
}

// 방법 2: 함수 내부 — 해당 함수와 중첩 함수에만 적용
function strictOnly() {
  "use strict";
  // 이 함수 내부만 strict
}

function sloppyFn() {
  // 여전히 sloppy
}
```

문자열 `"use strict"`는 파일이나 함수의 **첫 번째 표현식 구문**이어야 합니다. 앞에 일반 코드가 있으면 무시됩니다.

## 두 모드의 핵심 차이

![Strict vs Sloppy 차이](/assets/posts/js-strict-mode-differences.svg)

### 1. 미선언 변수

```javascript
// sloppy mode
x = 42;               // 전역 변수 window.x가 암묵적으로 생성됨
console.log(window.x); // 42 — 의도치 않은 전역 오염!

// strict mode
"use strict";
x = 42;  // ReferenceError: x is not defined
```

오타나 실수로 변수명을 잘못 입력했을 때 sloppy mode는 조용히 새 전역 변수를 만들지만, strict mode는 즉시 오류를 발생시킵니다.

### 2. 일반 함수의 this

```javascript
// sloppy mode
function show() {
  console.log(this); // Window (브라우저) 또는 global (Node)
}
show();

// strict mode
"use strict";
function show() {
  console.log(this); // undefined — this 바인딩 없음
}
show();
```

strict mode에서는 함수가 단순 호출될 때 `this`가 `undefined`입니다. sloppy mode의 암묵적 전역 객체 바인딩은 많은 버그의 원인이 됩니다.

### 3. 읽기 전용 프로퍼티에 쓰기

```javascript
"use strict";

const obj = {};
Object.defineProperty(obj, 'x', { value: 1, writable: false });

obj.x = 2;  // strict: TypeError
             // sloppy: 조용히 무시됨 (오류 없음!)
```

sloppy mode에서 실패한 할당은 조용히 무시되어 버그를 찾기 매우 어렵습니다.

### 4. 금지된 구문

```javascript
"use strict";

// with 문 — 스코프 오염의 원인, strict에서 금지
with (Math) { x = cos(0); }  // SyntaxError

// 중복 매개변수
function f(a, a) { }  // SyntaxError (sloppy에서는 허용)

// 8진수 리터럴 (구형 문법)
const n = 0777;  // SyntaxError (sloppy에서는 511)
// 대신 ES2015의 0o 표기를 사용
const m = 0o777; // 511 — strict에서도 OK
```

### 5. delete 제한

```javascript
"use strict";

var x = 1;
delete x;  // SyntaxError — 변수는 삭제 불가

// sloppy에서는 false를 반환하며 조용히 실패
```

## 현대 JavaScript에서 자동 적용되는 strict mode

![Strict mode 적용 범위](/assets/posts/js-strict-mode-activation.svg)

현대적인 코드 작성 방식 대부분이 자동으로 strict mode를 활성화합니다:

**ES Modules (`import`/`export`)**

```javascript
// module.js — 자동으로 strict mode
import { something } from './other.js';
undeclaredVar = 1;  // ReferenceError (선언 없어도)
```

**클래스(class)**

```javascript
class MyClass {
  method() {
    undeclaredVar = 1;  // ReferenceError — class 내부는 자동 strict
  }
}
```

**번들러 출력과 TypeScript**

Webpack, Vite, Rollup 등 대부분의 번들러와 TypeScript 컴파일러는 출력 파일에 `"use strict"`를 자동으로 추가합니다.

결론적으로, 현대 JavaScript 프로젝트(ESM, TypeScript, React 등)를 사용한다면 strict mode 선언을 직접 할 필요가 거의 없습니다. 이미 적용되어 있기 때문입니다.

## 레거시 코드에 strict mode 추가할 때 주의사항

기존 sloppy mode 코드에 `"use strict"`를 추가하면 기존에 조용히 무시되던 오류들이 갑자기 ReferenceError, TypeError로 터질 수 있습니다.

```javascript
// 기존 sloppy mode 코드 (전역 변수 사용 중)
counter = 0;      // 전역 변수
function increment() {
  counter++;      // 전역 counter 수정
}

// 갑자기 "use strict" 추가 → ReferenceError!
"use strict";
counter = 0;  // 오류 — 선언이 필요
```

레거시 코드에 strict mode를 적용할 때는 파일 단위나 함수 단위로 점진적으로 적용하고, 테스트를 통해 회귀(regression)를 확인하는 것이 안전합니다.

## 정리

| 항목 | Sloppy mode | Strict mode |
|------|-------------|-------------|
| 미선언 변수 | 전역 변수 생성 | ReferenceError |
| 함수 this | 전역 객체 | undefined |
| 읽기 전용 쓰기 | 조용히 무시 | TypeError |
| with 문 | 허용 | SyntaxError |
| 중복 매개변수 | 허용 | SyntaxError |
| 적용 방법 | 기본값 | "use strict" 또는 ESM/class |

Strict mode는 JavaScript의 위험한 기능들을 막고, 엔진이 더 잘 최적화할 수 있도록 돕습니다. 새 코드는 항상 strict environment에서 작성하는 것이 권장됩니다.

---

**지난 글:** [런타임 환경 — 브라우저 · Node · Deno · Bun](/posts/js-runtimes/)

**다음 글:** [var · let · const 차이](/posts/js-var-let-const/)

<br>
읽어주셔서 감사합니다. 😊
