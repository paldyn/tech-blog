---
title: "스코프 체인"
description: "JavaScript 엔진이 변수를 찾는 경로인 스코프 체인의 구조, 변수 섀도잉, 전역 오염, ReferenceError 발생 원리를 명확히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 28
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "스코프", "스코프 체인", "변수", "클로저"]
featured: false
draft: false
---

[지난 글](/posts/js-async-generator/)에서 비동기 데이터 스트림을 처리하는 비동기 제너레이터를 살펴봤습니다. 이번에는 JavaScript의 변수 탐색 메커니즘인 **스코프 체인(Scope Chain)** 을 다룹니다. 스코프 체인을 이해하면 변수가 어디서 왜 보이는지, ReferenceError가 왜 발생하는지 직관적으로 파악할 수 있습니다.

## 스코프란?

**스코프(Scope)** 는 변수가 접근 가능한 유효 범위입니다. JavaScript에서 스코프는 코드가 **어디에 위치하느냐**에 따라 정적으로 결정됩니다.

```javascript
const x = 'global'; // 전역 스코프

function outer() {
  const y = 'outer'; // outer 스코프

  function inner() {
    const z = 'inner'; // inner 스코프

    console.log(z); // ① inner 스코프에서 발견
    console.log(y); // ② outer 스코프에서 발견
    console.log(x); // ③ 전역 스코프에서 발견
  }

  inner();
}

outer();
```

`inner`에서 `z`를 찾을 때 JavaScript 엔진은 현재 스코프부터 외부로 올라가며 탐색합니다. 이 탐색 경로가 **스코프 체인**입니다.

![스코프 체인 구조](/assets/posts/js-scope-chain-diagram.svg)

## 스코프 체인 동작 방식

엔진은 변수를 다음 순서로 탐색합니다.

1. **현재 실행 컨텍스트의 변수 환경** 검색
2. 발견 안 되면 **외부 렉시컬 환경(Outer Lexical Environment)** 으로 이동
3. 발견될 때까지 반복 → 전역까지 올라가도 없으면 `ReferenceError`

```javascript
function a() {
  const msg = 'from a';
  function b() {
    function c() {
      console.log(msg); // c → b → a에서 발견 → 'from a'
    }
    c();
  }
  b();
}
a();
```

체인의 링크는 함수가 **선언된 위치**에서 형성됩니다. 호출 위치와 무관합니다. 이것이 렉시컬 스코프(Lexical Scope)이며, 다음 글에서 자세히 다룹니다.

## 변수 섀도잉

내부 스코프에 외부와 **같은 이름의 변수**를 선언하면, 내부 변수가 외부 변수를 **가립니다(shadows)**. 외부 변수는 사라지지 않고, 해당 스코프 안에서만 보이지 않게 됩니다.

```javascript
const name = 'global';

function greet() {
  const name = 'local'; // 외부 name을 섀도잉
  console.log(name);    // 'local'
}

greet();
console.log(name); // 'global' — 영향 없음
```

의도적 섀도잉은 함수 안에서 전역 변수와 충돌 없이 같은 이름을 재사용할 때 유용합니다. 그러나 실수로 섀도잉하면 예상치 못한 동작이 생깁니다.

![변수 섀도잉과 스코프 오염](/assets/posts/js-scope-chain-shadowing.svg)

## var와 스코프 오염

`var`는 함수 스코프를 따릅니다. 블록(`{}`) 안에서 선언해도 함수 전체에서 접근됩니다.

```javascript
function example() {
  for (var i = 0; i < 3; i++) {
    // i는 블록이 아닌 함수 스코프
  }
  console.log(i); // 3 — 루프 밖에서도 접근 가능

  if (true) {
    var message = 'hello'; // 블록 무시
  }
  console.log(message); // 'hello'
}

// let과 const는 블록 스코프
function clean() {
  for (let j = 0; j < 3; j++) {}
  // console.log(j); // ReferenceError: j is not defined
}
```

`var`의 스코프 오염은 버그의 원인이 되므로 현대 JS에서는 `let`과 `const`를 사용합니다.

## 전역 오염

최상위 레벨에서 `var`로 선언하거나 선언 없이 값을 할당하면 전역 객체(`window`, `globalThis`)의 프로퍼티가 됩니다.

```javascript
var globalVar = 'I am global';
console.log(window.globalVar); // 'I am global'

function oops() {
  undeclared = 'leaked!'; // 선언 없이 할당 → 전역 오염
}
oops();
console.log(window.undeclared); // 'leaked!'
```

`'use strict'` 모드에서는 선언 없는 할당이 `ReferenceError`를 발생시킵니다. 전역 오염을 방지합니다.

## 모듈 스코프

ES 모듈(`.mjs` 또는 `type="module"`)은 파일마다 독립적인 **모듈 스코프**를 갖습니다. 최상위 선언이 전역으로 노출되지 않습니다.

```javascript
// math.mjs
const PI = 3.14159; // 모듈 스코프 — 전역 아님
export const area = r => PI * r * r;

// main.mjs
import { area } from './math.mjs';
console.log(typeof PI); // 'undefined' — 노출 안 됨
```

## 스코프 체인과 클로저

스코프 체인의 가장 강력한 활용은 **클로저**입니다. 함수가 자신이 선언된 외부 스코프의 변수를 기억하는 현상입니다.

```javascript
function makeCounter(start = 0) {
  let count = start; // makeCounter 스코프

  return {
    increment() { return ++count; },
    decrement() { return --count; },
    value()     { return count; },
  };
}

const counter = makeCounter(10);
counter.increment(); // 11
counter.increment(); // 12
counter.decrement(); // 11
counter.value();     // 11
```

`increment`는 `makeCounter`가 반환된 후에도 `count`가 있는 스코프를 체인을 통해 참조합니다. 클로저에 대해서는 이후 시리즈에서 별도로 깊이 다룹니다.

## 스코프 체인 최적화

- 변수를 현재 스코프에 가까이 선언할수록 탐색 속도가 빠릅니다.
- 전역 변수 접근이 반복된다면 지역 변수에 캐싱합니다.
- 현대 엔진은 컴파일 시점에 스코프 체인을 정적으로 분석해 최적화합니다.

스코프 체인은 클로저, 렉시컬 스코프, 실행 컨텍스트 모두와 깊이 연결된 핵심 개념입니다. 다음 글에서는 스코프가 **어떻게 결정되는지**를 다루는 **렉시컬 스코프(Lexical Scope)** 를 살펴봅니다.

---

**지난 글:** [비동기 제너레이터](/posts/js-async-generator/)

**다음 글:** [렉시컬 스코프](/posts/js-lexical-scope/)

<br>
읽어주셔서 감사합니다. 😊
