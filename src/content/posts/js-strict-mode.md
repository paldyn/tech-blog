---
title: "strict mode — 안전한 JavaScript의 시작"
description: "'use strict' 지시어가 언어의 어떤 함정을 막아주는지, 클래스와 ESM에서의 자동 적용, 그리고 실무에서 strict mode를 활용하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["strict mode", "use strict", "보안", "ES5", "기초"]
featured: false
draft: false
---

[지난 글](/posts/js-runtimes/)에서 Node.js, Deno, Bun 등 다양한 런타임을 살펴보았습니다. 이번 글부터는 언어 자체로 들어갑니다. JavaScript에는 ES5(2009)에 추가된 **strict mode**라는 실행 모드가 있습니다. 단 한 줄의 문자열 선언으로, 언어의 역사적 설계 실수로부터 코드를 보호하고 조용히 실패하던 버그를 명시적 오류로 바꿔줍니다.

## Sloppy mode — JavaScript의 오래된 기본값

ES5 이전 JavaScript는 많은 위험한 동작을 조용히 허용했습니다. 이 기본 동작 방식을 비공식적으로 **Sloppy mode(느슨한 모드)**라고 부릅니다. 하위 호환성을 위해 아직도 기본값으로 유지됩니다.

![Sloppy mode vs Strict mode — 동작 차이](/assets/posts/js-strict-mode-differences.svg)

가장 악명 높은 예시는 **미선언 변수의 암묵적 전역 변수화**입니다. `x = 10`처럼 `var`, `let`, `const` 없이 값을 할당하면 Sloppy mode에서는 전역 객체의 속성이 됩니다. 의도치 않은 전역 오염의 원인이자, 식별하기 어려운 버그의 온상입니다.

## "use strict" — 한 줄로 달라지는 것들

`'use strict'` 지시어(directive)를 추가하면 엔진이 더 엄격한 규칙으로 코드를 실행합니다.

### 미선언 변수 사용 금지

```javascript
'use strict';
x = 10; // ReferenceError: x is not defined
```

### 일반 함수에서 this가 undefined

```javascript
'use strict';
function whatIsThis() {
  return this;
}
whatIsThis(); // undefined (Sloppy: window/global)
```

이 변화는 매우 중요합니다. 메서드를 다른 문맥에서 호출할 때 `this`가 의도치 않게 전역 객체를 가리켜 속성을 오염시키는 버그를 방지합니다.

### 쓸 수 없는 속성에 쓰기 금지

```javascript
'use strict';
const obj = {};
Object.defineProperty(obj, 'frozen', { value: 42, writable: false });
obj.frozen = 100; // TypeError: Cannot assign to read only property
// Sloppy에서는 조용히 무시됨
```

### delete 불가 속성 삭제 금지

```javascript
'use strict';
delete Object.prototype; // TypeError
```

### 중복 매개변수 금지

```javascript
'use strict';
function f(a, a) { } // SyntaxError: Duplicate parameter name
```

### with 문 금지

```javascript
'use strict';
with (obj) { } // SyntaxError
```

`with` 문은 동적으로 스코프를 변경하기 때문에 최적화를 방해하고 코드 동작을 예측하기 어렵게 만듭니다. Strict mode에서는 완전히 금지됩니다.

## 활성화 방법

![Strict Mode 활성화 방법](/assets/posts/js-strict-mode-activation.svg)

**파일 전체 적용**: 파일 맨 첫 줄에 `'use strict'`를 놓습니다. 주석만 위에 있어도 됩니다.

**함수 단위 적용**: 특정 함수 본문 첫 줄에 선언해 해당 함수 스코프에만 적용합니다. 레거시 파일에 조금씩 적용할 때 유용합니다.

**자동 적용되는 경우**:
- **ES 모듈(ESM)**: `import`/`export`를 사용하는 모듈 파일은 항상 strict mode
- **클래스(class)**: 클래스 본문은 항상 strict mode
- `eval()` 내 코드가 strict mode 컨텍스트에서 실행될 때

```javascript
// 클래스는 자동 strict mode
class Counter {
  #count = 0; // private 필드도 strict mode 덕에 안전
  increment() {
    this.#count++; // this가 undefined이면 TypeError로 명확히 실패
  }
}
```

## 실무에서의 Strict mode

현대 JavaScript 프로젝트에서 strict mode를 별도로 신경 쓸 필요가 거의 없습니다. Webpack, Vite, Rollup 같은 번들러는 기본적으로 ESM을 사용하고, TypeScript는 `"strict": true` 옵션이 포함된 엄격한 타입 검사와 함께 strict mode를 적용합니다.

```json
// tsconfig.json — TypeScript strict mode
{
  "compilerOptions": {
    "strict": true,       // 엄격한 타입 검사 활성화
    "alwaysStrict": true  // 출력 파일에 'use strict' 자동 삽입
  }
}
```

레거시 스크립트(`<script>` 태그로 로드되는 `.js` 파일)를 작성한다면 수동으로 `'use strict'`를 추가하는 습관이 중요합니다. 특히 여러 파일을 하나로 번들하는 경우, 파일 최상단이 아닌 함수 수준에서 적용해야 다른 파일에 영향을 주지 않습니다.

## 정리

Strict mode는 JavaScript의 과거 실수를 방어하는 첫 번째 도구입니다. 현대 도구체인을 사용한다면 이미 적용되어 있을 가능성이 높습니다. 하지만 그 동작 원리를 알아야 `this`가 `undefined`인 이유, 미선언 변수가 오류인 이유를 디버깅할 때 당황하지 않을 수 있습니다.

---

**지난 글:** [JavaScript 런타임 — Node.js, Deno, Bun 비교](/posts/js-runtimes/)

**다음 글:** [var, let, const — 변수 선언의 세 가지 방법](/posts/js-var-let-const/)

<br>
읽어주셔서 감사합니다. 😊
