---
title: "함수 선언식 vs 함수 표현식"
description: "JavaScript 함수 선언식과 함수 표현식의 호이스팅 차이, 스코프 동작, 기명 함수 표현식의 재귀 참조, 조건부 함수 정의 패턴을 깊이 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "함수선언식", "함수표현식", "호이스팅", "function-declaration", "function-expression", "named-function"]
featured: false
draft: false
---

[지난 글](/posts/js-template-literals/)에서 템플릿 리터럴과 태그드 템플릿을 살펴봤습니다. 이번에는 JavaScript 함수를 정의하는 두 가지 핵심 방법인 **함수 선언식**과 **함수 표현식**의 차이를 정확히 이해합니다. 같은 함수를 만들지만 호이스팅 동작, 스코프, 이름 바인딩이 다르기 때문에 어떤 상황에서 무엇을 선택해야 하는지 알아야 합니다.

## 문법 형태

두 방식 모두 `function` 키워드를 쓰지만 위치가 다릅니다.

```javascript
// 함수 선언식 — function이 문장의 시작
function add(a, b) {
  return a + b;
}

// 익명 함수 표현식 — 값으로서 변수에 할당
const add = function(a, b) {
  return a + b;
};

// 기명 함수 표현식 — 이름이 있지만 외부에서는 접근 불가
const add = function addNumbers(a, b) {
  return a + b;
};
```

파서가 `function`을 문장의 첫 토큰으로 만나면 선언식, 표현식 위치(할당 우변, 인수, 조건문 등)에서 만나면 표현식으로 처리합니다.

## 핵심 차이: 호이스팅

함수 선언식은 **전체 함수 본문이** 스코프 최상단으로 끌어올려집니다. 따라서 선언 전에 호출해도 정상 동작합니다.

```javascript
// 선언 전 호출 — 정상 작동
result = greet('Kim');    // '안녕, Kim!'

function greet(name) {
  return `안녕, ${name}!`;
}
```

함수 표현식은 변수 선언(`const`/`let`/`var`)의 규칙을 따릅니다. `const`·`let`은 TDZ로 인해 선언 전 접근이 ReferenceError이고, `var`는 선언만 올라가고 값이 `undefined`로 남습니다.

```javascript
// const 함수 표현식 — TDZ
fn();               // ReferenceError
const fn = function() {};

// var 함수 표현식 — undefined 호출 시도
fn();               // TypeError: fn is not a function
var fn = function() {};
```

![함수 선언식 vs 표현식 비교](/assets/posts/js-function-decl-vs-expr-compare.svg)

## 호이스팅 내부 동작

JavaScript 엔진은 코드를 두 단계로 처리합니다.

1. **파싱/컴파일 단계** — 함수 선언식을 스코프에 등록(전체 본문 포함). `var`는 선언만 등록(`undefined`). `const`/`let`은 TDZ에 넣음.
2. **실행 단계** — 코드를 순서대로 실행. 함수 표현식 할당문에 도달하면 그때 변수에 함수가 바인딩됨.

```javascript
// 실제 실행 순서 (엔진 관점)
function a() { return 1; }   // 1. 선언식 전체 호이스팅
var b;                        // 2. var 선언만 (undefined)
// TDZ: c는 접근 불가

console.log(a());  // 1
console.log(b);    // undefined
// console.log(c) // ReferenceError
b = function() {};
const c = function() {};
```

![함수 호이스팅 동작 원리](/assets/posts/js-function-decl-vs-expr-hoisting.svg)

## 블록 안의 함수 선언식

`if`, `for` 같은 블록 내부의 함수 선언식 동작은 비엄격 모드에서 브라우저마다 다릅니다. strict mode에서는 블록 스코프로 제한되어 일관성 있게 동작합니다.

```javascript
'use strict';
if (true) {
  function blockFn() { return 1; }
}
typeof blockFn; // 'undefined' — 블록 밖에서 접근 불가

// 조건부 함수 정의는 표현식으로 해야 안전
const handler = condition
  ? function() { /* A */ }
  : function() { /* B */ };
```

## 기명 함수 표현식의 장점

함수 표현식에 이름을 붙이면 두 가지 이점이 있습니다.

**스택 트레이스 가독성**: 익명 함수는 오류 스택에 `anonymous`로 표시되지만 기명 함수는 이름이 나타납니다.

**내부 자기 참조**: 이름은 함수 본문 내에서만 접근 가능하므로 재귀에 안전합니다. 외부 변수명이 바뀌어도 재귀가 깨지지 않습니다.

```javascript
const fac = function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
};

// 변수명 변경해도 재귀 동작
const f = fac;
fac = null;
f(5); // 120 — factorial 내부 참조는 유지됨
```

## `.name` 프로퍼티

ES2015부터 함수 추론 이름(inferred name)을 지원합니다. 변수에 익명 함수를 할당하면 변수명이 함수 이름으로 추론됩니다.

```javascript
const fn = function() {};
fn.name;              // 'fn' (추론됨)

const obj = {
  method: function() {}
};
obj.method.name;      // 'method'

function declared() {}
declared.name;        // 'declared'
```

## 언제 무엇을 선택하나

실제 코드베이스에서 권장되는 가이드라인입니다.

- **모듈의 공개 함수·유틸리티** → 함수 선언식. 파일 어디서든 사용 가능하고 의도가 명확.
- **콜백·핸들러·즉시 실행 값** → 함수 표현식(또는 화살표 함수).
- **조건부 함수 생성** → 반드시 함수 표현식.
- **재귀 함수 표현식** → 기명 함수 표현식으로 안전한 자기 참조.

```javascript
// 권장: 유틸리티는 선언식
function formatDate(date) { /* ... */ }

// 권장: 콜백은 표현식
array.map(function(item) { return item * 2; });
// 또는 화살표 함수
array.map(item => item * 2);
```

---

**지난 글:** [템플릿 리터럴 완전 정복](/posts/js-template-literals/)

**다음 글:** [화살표 함수와 this](/posts/js-arrow-function-and-this/)

<br>
읽어주셔서 감사합니다. 😊
