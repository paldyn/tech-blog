---
title: "Strict mode와 sloppy mode — JavaScript의 두 얼굴"
description: "'use strict'가 JavaScript의 어떤 위험한 동작을 막아주는지, strict mode가 어떻게 선언되고 자동으로 적용되는지, 실무에서 왜 항상 켜져 있는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "strict-mode", "sloppy-mode", "use-strict", "es5"]
featured: false
draft: false
---

[지난 글](/posts/js-runtimes/)에서 브라우저·Node.js·Deno·Bun 각 런타임이 JavaScript 엔진 위에 어떤 API를 얹어 제공하는지 살펴봤습니다. 이번에는 언어 자체의 동작 방식을 결정하는 **strict mode**를 이야기합니다.

## Sloppy mode: 너그러운 자유의 대가

JavaScript가 처음 만들어졌을 때, 설계자들은 초보자 친화적인 언어를 목표로 했습니다. 변수를 선언하지 않아도 에러가 나지 않고, 문법적으로 조금 잘못된 코드도 작동하는 식이었죠. 이 너그러운 기본 동작 방식을 **sloppy mode** 또는 **non-strict mode**라고 부릅니다.

가장 대표적인 sloppy mode의 특성을 하나 보겠습니다.

```javascript
// 변수 선언 없이 값 할당 — sloppy mode에서는 에러가 없습니다
typo = 10; // 오타를 냈지만 전역 변수 'typo'가 자동으로 생성됩니다

function add(a, b) {
  reslt = a + b; // 'result'의 오타 — 전역 오염 발생!
  return reslt;
}
```

이 코드는 에러 없이 실행됩니다. `typo`와 `reslt`는 선언 없이 전역 객체(`window` 또는 `global`)의 프로퍼티가 됩니다. 오타 하나가 전역 상태를 오염시켜도 개발자는 알아채기 어렵습니다. 대규모 코드베이스에서 이런 버그는 찾기가 매우 어렵습니다.

## Strict mode: 문제를 조용히 넘기지 않는다

ES5(2009)에서 도입된 **strict mode**는 이런 위험한 동작들을 에러로 바꿔줍니다. 파일 최상단이나 함수 최상단에 `'use strict';`라는 문자열 리터럴(지시자, directive)을 추가하면 활성화됩니다.

```javascript
'use strict';

typo = 10; // ReferenceError: typo is not defined
```

미선언 변수에 할당을 시도하면 즉시 `ReferenceError`가 발생합니다. 조용히 오류를 만드는 대신 큰 소리로 알려주는 것이죠.

![Sloppy Mode vs Strict Mode 비교](/assets/posts/js-strict-mode-comparison.svg)

## Strict mode가 막는 것들

**1. 미선언 변수 사용 금지**
```javascript
'use strict';
x = 1; // ReferenceError
```

**2. 읽기 전용 프로퍼티 쓰기 금지**
```javascript
'use strict';
const obj = Object.freeze({ x: 1 });
obj.x = 2; // TypeError
```

**3. 삭제 불가능한 프로퍼티 delete 금지**
```javascript
'use strict';
delete Object.prototype; // TypeError
```

**4. 중복 매개변수 이름 금지**
```javascript
'use strict';
function f(a, a) {} // SyntaxError
```

**5. `with` 문 금지**

`with`는 스코프 체인을 동적으로 변경해 최적화를 어렵게 만들고 코드 의미를 불명확하게 합니다.

```javascript
'use strict';
with (obj) {} // SyntaxError
```

**6. 일반 함수의 `this`가 `undefined`**

sloppy mode에서는 일반 함수를 호출하면 `this`가 전역 객체(`window` 또는 `global`)를 가리킵니다. strict mode에서는 `undefined`가 됩니다.

```javascript
function checkThis() {
  'use strict';
  console.log(this); // undefined
}

checkThis(); // this가 undefined
```

이는 버그를 조기에 잡는 데 매우 유용합니다. sloppy mode에서 `this.name = 'Lee'`처럼 쓰면 의도치 않게 전역 객체의 프로퍼티를 덮어쓸 수 있었는데, strict mode는 이를 `TypeError`로 바꿉니다.

**7. 미래 예약어 사용 금지**

`implements`, `interface`, `let`, `package`, `private`, `protected`, `public`, `static`, `yield`를 식별자로 사용할 수 없습니다.

## Strict mode 선언 방법과 적용 범위

`'use strict'`는 **프롤로그 지시자**입니다. 파일이나 함수에서 실질적인 코드보다 먼저 등장해야 합니다. 중간에 선언하면 효과가 없습니다.

```javascript
// 파일 전체에 적용 (파일 맨 첫 줄)
'use strict';

// 또는 함수 단위로 적용
function myFunc() {
  'use strict';
  // 이 함수 안에서만 strict
}

// 주의: 중간에 쓰면 무효
let x = 1;
'use strict'; // 이미 늦었습니다 — 효과 없음
```

클래스 내부와 ES 모듈은 자동으로 strict mode입니다.

![Strict Mode 적용 범위](/assets/posts/js-strict-mode-scope.svg)

## 실무에서 strict mode는 항상 켜져 있다

현대 JavaScript 개발 환경에서 `'use strict'`를 직접 쓸 일은 거의 없습니다. 다음 중 하나라도 해당되면 코드는 이미 strict mode에서 실행되고 있습니다.

**ES Modules**: `import` 또는 `export`가 있는 파일은 자동으로 strict mode입니다. ESM을 사용하는 모든 현대 프론트엔드 코드가 여기에 해당합니다.

**클래스 바디**: `class` 내부의 메서드와 생성자는 항상 strict mode입니다.

**TypeScript**: 컴파일된 JS 출력에 자동으로 `'use strict'`가 삽입됩니다.

**Babel**: 트랜스파일된 코드에 자동으로 삽입됩니다.

Node.js에서 `.mjs` 확장자나 `package.json`에 `"type": "module"`을 쓰면 ESM으로 처리되어 역시 자동으로 strict mode입니다.

```javascript
// ESM 파일 (자동 strict)
import { something } from './module.js';
// 이 파일 전체가 strict mode — 'use strict' 불필요
undeclared = 1; // ReferenceError
```

## 레거시 스크립트에서의 주의사항

여러 JS 파일을 번들하지 않고 `<script>` 태그로 직접 불러오는 레거시 환경에서는, 파일 단위 strict mode 선언이 의도치 않게 다른 파일에 영향을 줄 수 있습니다. 이 경우 파일 전체를 IIFE(즉시 실행 함수 표현식)로 감싸고 그 안에서 `'use strict'`를 선언하는 패턴이 안전합니다.

```javascript
(function () {
  'use strict';
  // 이 IIFE 안에서만 strict
})();
```

jQuery나 오래된 라이브러리를 연결할 때 strict mode가 아닌 코드와 충돌하지 않게 하는 방어적 패턴이었습니다. 현대 빌드 도구를 사용한다면 이런 걱정은 불필요합니다.

## 왜 strict mode를 이해해야 하는가

오늘날 대부분의 코드가 strict mode에서 돌아감에도 이것을 이해해야 하는 이유가 있습니다.

첫째, `this` 바인딩 규칙이 sloppy와 strict에서 다릅니다. `this` 관련 버그를 디버깅할 때 mode에 따라 `this`가 전역 객체인지 `undefined`인지 달라지기 때문에, 실행 환경의 mode를 파악하는 것이 중요합니다.

둘째, `eval`이나 `Function` 생성자로 동적으로 만든 코드는 별도의 스코프를 가지며 strict mode가 아닐 수 있습니다.

셋째, 레거시 시스템 유지보수나 오래된 라이브러리 코드를 분석할 때 sloppy mode의 동작 방식을 알아야 합니다.

---

**지난 글:** [런타임 환경 — 브라우저 · Node · Deno · Bun](/posts/js-runtimes/)

**다음 글:** [var · let · const 차이](/posts/js-var-let-const/)

<br>
읽어주셔서 감사합니다. 😊
