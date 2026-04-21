---
title: "함수는 일급 객체다 — 값처럼 다루는 함수"
description: "JavaScript에서 함수를 변수에 저장하고, 인자로 전달하고, 반환값으로 쓸 수 있다는 것이 왜 강력한지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-04-21"
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "함수", "일급객체", "고차함수", "콜백", "화살표함수", "함수형프로그래밍"]
featured: false
draft: false
---

지난 글에서 원시 타입과 객체 타입이 메모리에서 다르게 동작한다는 것을 살펴봤습니다. 그 차이의 핵심은 "값처럼 다루어지느냐"에 있었습니다. 이번 글은 그 연장선입니다. JavaScript에서 **함수도 값**입니다. 숫자나 문자열처럼 변수에 넣고, 전달하고, 반환할 수 있습니다.

이것이 처음에는 당연해 보일 수도 있지만, 모든 언어가 이렇지는 않습니다. 그리고 이 특성이 JavaScript의 콜백, 클로저, 고차 함수, React 컴포넌트까지 모든 것의 기반입니다.

---

## 일급 객체란

프로그래밍 언어에서 어떤 개념이 **일급 객체(First-Class Object)** 라고 불리려면 세 가지를 충족해야 합니다.

1. 변수에 저장할 수 있어야 한다
2. 함수의 인자로 전달할 수 있어야 한다
3. 함수의 반환값으로 쓸 수 있어야 한다

숫자와 문자열은 당연히 이 셋이 모두 가능합니다. JavaScript에서는 함수도 마찬가지입니다.

![함수가 일급 객체인 세 가지 이유 — 저장·전달·반환](/assets/posts/js-functions-first-class-concept.svg)

---

## 함수를 변수에 저장한다

```js
const greet = function(name) {
  return `안녕하세요, ${name}님!`;
};

console.log(greet("Alice")); // 안녕하세요, Alice님!
```

`greet`는 함수 자체를 담은 변수입니다. 숫자 `42`를 변수에 담듯이 함수를 담았습니다. 이렇게 변수에 담긴 함수를 **함수 표현식**이라고 합니다.

반대로 `function greet() {}` 형태는 **함수 선언식**이라고 부릅니다. 두 방식은 기능적으로 비슷하지만 호이스팅 동작이 다릅니다.

---

## 함수를 인자로 전달한다: 콜백

함수를 다른 함수의 인자로 전달할 때, 그 함수를 **콜백(Callback)** 이라고 부릅니다. "나중에 부르라고(call back) 넘겨준 함수"라는 의미입니다.

```js
function doTwice(fn, value) {
  fn(value);
  fn(value);
}

function sayHi(name) {
  console.log(`Hi, ${name}!`);
}

doTwice(sayHi, "Bob");
// Hi, Bob!
// Hi, Bob!
```

배열 메서드에서 콜백은 일상적으로 쓰입니다.

```js
const numbers = [1, 2, 3, 4, 5];

const doubled = numbers.map(n => n * 2);
// [2, 4, 6, 8, 10]

const evens = numbers.filter(n => n % 2 === 0);
// [2, 4]
```

`map`과 `filter`는 **고차 함수(Higher-Order Function)** 입니다. 함수를 인자로 받거나 반환하는 함수를 고차 함수라고 부릅니다.

---

## 함수를 반환한다: 팩토리와 클로저

함수가 새 함수를 만들어 반환할 수도 있습니다. 이를 이용하면 **설정값을 품은 함수**를 만들 수 있습니다.

```js
function makeMultiplier(factor) {
  return function(number) {
    return number * factor;
  };
}

const double = makeMultiplier(2);
const triple = makeMultiplier(3);

console.log(double(5)); // 10
console.log(triple(5)); // 15
```

`makeMultiplier(2)`를 호출하면 `factor`가 `2`인 새 함수가 반환됩니다. 반환된 함수는 `factor`를 기억하고 있습니다. 이것이 **클로저(Closure)** 의 기초 개념입니다. 클로저는 다음 시리즈에서 깊게 다룹니다.

---

## 세 가지 함수 작성 방식

JavaScript에서 함수를 작성하는 방법은 크게 세 가지입니다.

![함수 선언식·표현식·화살표 함수 비교](/assets/posts/js-functions-types.svg)

**함수 선언식** 은 `function` 키워드로 시작하고, 선언 전에도 호출할 수 있습니다(호이스팅). 코드의 어느 위치에서든 사용 가능해서 공통 유틸 함수에 적합합니다.

**함수 표현식** 은 변수에 함수를 할당합니다. 선언 이후에만 사용할 수 있어 실행 흐름이 명확해집니다.

**화살표 함수** 는 ES6에서 추가됐습니다. `=>` 문법으로 더 간결하게 쓸 수 있습니다.

```js
// 함수 선언식
function add(a, b) { return a + b; }

// 함수 표현식
const add = function(a, b) { return a + b; };

// 화살표 함수 (가장 간결)
const add = (a, b) => a + b;
```

화살표 함수는 단순히 짧은 문법이 아닙니다. 일반 함수와 두 가지 중요한 차이가 있습니다.

**`this`를 바인딩하지 않습니다.** 일반 함수는 호출 방식에 따라 `this`가 달라지지만, 화살표 함수는 선언된 위치의 `this`를 그대로 사용합니다. `this`에 대해서는 시리즈 7편에서 상세히 다룹니다.

**`arguments` 객체가 없습니다.** 가변 인자를 다루려면 rest 파라미터(`...args`)를 사용해야 합니다.

---

## 즉시 실행 함수 표현식(IIFE)

함수를 선언하자마자 바로 호출하는 패턴도 있습니다.

```js
(function() {
  const temp = "이 변수는 밖에서 접근 불가";
  console.log("즉시 실행!");
})();
```

전역 스코프를 오염시키지 않고 코드를 실행할 때 유용합니다. ES6 모듈이 보편화된 지금은 덜 쓰이지만, 레거시 코드에서 자주 볼 수 있습니다.

---

## 순수 함수란

함수를 값처럼 다루는 문화에서 **순수 함수(Pure Function)** 라는 개념도 자연스럽게 등장합니다.

순수 함수는 두 가지 조건을 만족합니다.
- 같은 입력이면 항상 같은 출력을 반환한다
- 함수 외부의 상태를 바꾸지 않는다(사이드 이펙트 없음)

```js
// 순수 함수
function add(a, b) { return a + b; }

// 순수하지 않은 함수 (외부 변수 참조)
let count = 0;
function increment() { count += 1; } // 외부 상태 변경
```

순수 함수는 예측 가능하고 테스트하기 쉽습니다. 리액트의 컴포넌트 함수도 이 원칙을 따릅니다.

---

함수가 일급 객체라는 사실은 JavaScript 전체를 관통하는 특성입니다. 다음 글에서는 이 함수들이 어떤 범위에서 변수를 바라보는지—**스코프와 호이스팅**을 살펴봅니다. 함수 선언식이 왜 선언 전에 호출될 수 있는지, 그 메커니즘을 파헤칩니다.

---

**다음 글:** 스코프와 호이스팅 — 변수는 어디서 보이는가

<br>
읽어주셔서 감사합니다. 😊
