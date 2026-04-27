---
title: "호이스팅 — 선언이 끌어올려지는 메커니즘"
description: "JavaScript 엔진이 코드를 실행하기 전에 선언을 스코프 최상단으로 끌어올리는 호이스팅의 동작 원리를 var·함수 선언식·함수 표현식별로 분석합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "hoisting", "var", "function-declaration", "function-expression", "scope", "execution-context"]
featured: false
draft: false
---

[지난 글](/posts/js-var-let-const/)에서 이어집니다.

## 호이스팅이란

JavaScript 엔진은 코드를 실행하기 전에 **컴파일 단계**를 거칩니다. 이 단계에서 엔진은 스코프 내의 변수 선언과 함수 선언을 먼저 처리합니다. 그 결과, 마치 선언이 스코프 최상단으로 끌어올려진 것처럼 동작합니다. 이를 **호이스팅(hoisting)**이라 합니다.

호이스팅은 코드가 물리적으로 이동하는 것이 아닙니다. 엔진이 실행 전에 스코프를 스캔하면서 선언을 미리 등록하는 것입니다. 개념을 이해하기 위해 "끌어올려진다"고 표현합니다.

---

## var의 호이스팅

![호이스팅 — var의 선언은 최상단으로 끌어올려진다](/assets/posts/js-hoisting-var.svg)

`var`로 선언한 변수는 두 단계로 처리됩니다.

1. **컴파일 단계:** 선언(`var x`)이 스코프 최상단에 등록되고, `undefined`로 초기화됩니다.
2. **실행 단계:** 할당(`x = 5`)은 원래 코드에 있는 위치에서 실행됩니다.

```javascript
// 개발자가 작성한 코드
console.log(x); // undefined (에러 아님!)
var x = 5;
console.log(x); // 5

// JavaScript 엔진이 실제로 처리하는 순서
var x;            // 선언 호이스트 — undefined
console.log(x);   // undefined
x = 5;            // 할당은 제자리
console.log(x);   // 5
```

첫 번째 `console.log`가 에러가 아닌 `undefined`를 출력하는 이유입니다. `var x`의 선언이 이미 처리됐지만, `= 5` 할당은 아직 실행되지 않았기 때문입니다.

이 동작이 버그의 온상이 됩니다. 개발자는 `ReferenceError`를 기대하지만 `undefined`를 받게 되고, 조용히 잘못된 값이 흘러갑니다.

---

## 함수 선언식 vs 함수 표현식

호이스팅에서 가장 중요한 차이 중 하나는 **함수 선언식**과 **함수 표현식**의 동작 차이입니다.

![함수 호이스팅 — 선언식 vs 표현식](/assets/posts/js-hoisting-function.svg)

### 함수 선언식 — 전체가 호이스트됨

```javascript
// 선언 전에 호출 가능
greet(); // "Hello!" — 정상 동작

function greet() {
  return 'Hello!';
}
```

함수 선언식(`function` 키워드로 시작하는 형태)은 **함수 전체가 스코프 최상단으로 호이스트**됩니다. 선언문이 코드 어디에 있든 해당 스코프 내 어디서든 호출할 수 있습니다.

```javascript
// 엔진이 실제로 보는 순서
function greet() { // 전체가 먼저 등록됨
  return 'Hello!';
}

greet(); // "Hello!"
```

### var 함수 표현식 — 변수만 undefined로 호이스트

```javascript
// TypeError 발생!
show(); // TypeError: show is not a function

var show = function() {
  return 'Hi';
};
```

`var show = function() {...}`는 변수 `show`가 `var`이므로 선언만 호이스트됩니다. 함수 표현식 자체(오른쪽 `function() {...}`)는 원래 위치에서 실행됩니다.

```javascript
// 엔진이 실제로 보는 순서
var show;        // show = undefined
show();          // TypeError: undefined is not a function
show = function() {
  return 'Hi';
};
```

`undefined()`를 호출했으니 `TypeError`가 발생합니다. `ReferenceError`가 아님에 주의하세요 — 변수 자체는 존재하지만 함수가 아닙니다.

### let·const 함수 표현식 — TDZ로 ReferenceError

```javascript
// ReferenceError 발생!
display(); // ReferenceError: Cannot access 'display' before initialization

const display = () => {
  return 'Hi';
};
```

`const`(또는 `let`)로 선언된 함수 표현식은 TDZ(일시적 사각지대)에 놓입니다. 변수 자체가 TDZ에 갇혀 있어 `TypeError`가 아닌 `ReferenceError`가 발생합니다.

---

## 스코프별 호이스팅

호이스팅은 전역 스코프와 함수 스코프 모두에서 동작합니다.

```javascript
var globalVar = 'global';

function outer() {
  console.log(innerVar); // undefined — 함수 스코프 내 호이스팅
  
  function inner() {
    var innerVar = 'inner';
  }
  
  var innerVar = 'outer-inner';
}
```

각 함수는 자신만의 스코프를 가지고, 그 스코프 안에서 독립적으로 호이스팅이 일어납니다.

### let·const도 호이스팅된다

흔한 오해 중 하나는 "let과 const는 호이스팅이 안 된다"는 것입니다. 사실은 호이스팅이 **됩니다.** 다만 `var`처럼 `undefined`로 초기화되지 않고, TDZ에 진입한 상태로 등록됩니다.

```javascript
let x = 'global';

{
  console.log(x); // ReferenceError — TDZ (전역 x를 쓰지 않음)
  let x = 'local'; // 이 선언이 블록 최상단으로 호이스트됨
}
```

블록 안에 `let x = 'local'`이 있으므로, `x`는 블록 스코프 최상단에 호이스트됩니다. 전역 `x`를 가리지 않고, 대신 블록 `x`가 TDZ에 진입합니다. 따라서 선언 전 접근은 전역 `x`가 아닌 `ReferenceError`를 냅니다.

이 동작이 `let`/`const`도 호이스팅된다는 증거입니다.

---

## 호이스팅 관련 흔한 실수

### 루프에서 var 사용

```javascript
// 의도: 0, 1, 2를 각각 출력
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// 실제 출력: 3, 3, 3

// 이유: var i는 루프 밖 스코프에 하나만 존재
// setTimeout 실행 시점에 i는 이미 3
```

`let`을 사용하면 각 반복마다 새로운 `i`가 생성됩니다.

```javascript
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// 출력: 0, 1, 2 — 각 반복마다 독립적인 i
```

### 함수 선언식의 과도한 의존

함수 선언식을 어디서든 호출할 수 있다는 점은 편리하지만, 코드 읽기 어렵게 만들 수 있습니다. 호출 지점보다 선언이 아래에 있으면 위쪽 코드만 읽어서는 함수가 무엇인지 알 수 없습니다.

```javascript
// 읽기 어려운 패턴 — 선언이 훨씬 아래에 있음
initialize();
renderUI();
bindEvents();

function initialize() { /* ... */ }
function renderUI() { /* ... */ }
function bindEvents() { /* ... */ }
```

컨벤션을 정해 선언을 먼저, 호출을 나중에 두는 것이 읽기 쉬운 코드를 만듭니다.

---

## 정리

호이스팅은 JavaScript 엔진이 코드를 실행하기 전에 선언을 미리 처리하는 메커니즘입니다.

- `var`: 선언이 스코프 최상단으로 호이스트되고 `undefined`로 초기화됩니다.
- 함수 선언식: 함수 전체가 호이스트됩니다 — 선언 전 호출이 가능합니다.
- `var` 함수 표현식: 변수만 `undefined`로 호이스트 — 호출 시 `TypeError`
- `let`/`const`: 선언은 호이스트되지만 TDZ에 진입 — 선언 전 접근 시 `ReferenceError`

`let`과 `const`를 사용하면 호이스팅의 혼란스러운 동작(`undefined` 반환)을 피하고, 문제를 즉시 에러로 드러낼 수 있습니다.

---

**지난 글:** [var·let·const — 스코프와 호이스팅 완전 정리](/posts/js-var-let-const/)  
**다음 글:** [TDZ — 일시적 사각지대의 정체](/posts/js-tdz/)

<br>
읽어주셔서 감사합니다. 😊
