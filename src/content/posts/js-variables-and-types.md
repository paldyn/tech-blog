---
title: "변수와 타입 — var, let, const 그리고 8가지 데이터 타입"
description: "JavaScript에서 변수를 선언하는 세 가지 방법의 차이와, 값이 가질 수 있는 8가지 타입을 명확하게 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-21"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "변수", "var", "let", "const", "데이터타입", "typeof"]
featured: false
draft: false
---

지난 글에서 JavaScript가 무엇인지, 어떻게 탄생했는지 살펴봤습니다. 언어의 역사와 특징을 알았으니, 이제 코드를 직접 다룰 차례입니다. 모든 프로그램은 **데이터를 저장하고 처리**하는 일을 합니다. 그 첫 관문이 변수와 타입입니다.

---

## 변수란 무엇인가

변수는 값을 담아두는 이름 붙은 상자입니다. 상자에 이름을 붙이고(`name`), 값을 넣고(`"Alice"`), 나중에 그 이름으로 값을 꺼냅니다.

```js
let name = "Alice";
console.log(name); // "Alice"
```

JavaScript에서 변수를 선언하는 방법은 세 가지입니다: `var`, `let`, `const`. 이 셋은 단순한 문법 차이가 아니라, 스코프와 재할당 가능성에서 근본적으로 다르게 동작합니다.

---

## var — 오래된 방식

`var`는 JavaScript가 탄생할 때부터 있었습니다. 그런데 지금 와서 보면 꽤 이상한 동작을 합니다.

```js
function greet() {
  if (true) {
    var message = "안녕하세요";
  }
  console.log(message); // "안녕하세요" — if 블록 밖에서도 접근됨!
}
```

`var`는 **함수 스코프**를 가집니다. `if`, `for`, `while` 같은 블록은 경계로 인정하지 않습니다. 같은 이름으로 다시 선언해도 오류가 나지 않고, 선언 전에 접근해도 `undefined`를 반환합니다(호이스팅). 이런 특성들이 예기치 못한 버그를 만들어냈습니다.

---

## let과 const — ES6의 해답

2015년 ES6에서 `let`과 `const`가 추가됐습니다. 두 키워드 모두 **블록 스코프**를 가집니다.

```js
function greet() {
  if (true) {
    let message = "안녕하세요";
  }
  console.log(message); // ReferenceError: message is not defined
}
```

`{}`로 감싸진 블록 안에서 선언된 변수는 그 블록 밖에서 접근할 수 없습니다. 코드의 예측 가능성이 크게 높아집니다.

`let`은 재할당이 가능하고, `const`는 선언과 동시에 값을 지정해야 하며 이후 재할당이 불가합니다.

```js
let count = 0;
count = 1; // 가능

const PI = 3.14159;
PI = 3; // TypeError: Assignment to constant variable.
```

다만 `const`는 **변수 자체**가 가리키는 대상을 바꾸지 못한다는 의미입니다. 객체나 배열의 내부 값은 여전히 변경할 수 있습니다.

```js
const user = { name: "Alice" };
user.name = "Bob"; // 가능 — 객체 내부 수정
user = {};         // TypeError — 변수 재할당 불가
```

![var·let·const 스코프와 동작 비교표](/assets/posts/js-variables-scope.svg)

현대 JavaScript에서는 **기본적으로 `const`를 쓰고, 값이 바뀌어야 할 때만 `let`을 씁니다**. `var`는 레거시 코드를 읽을 때 이해하기 위해 알면 충분합니다.

---

## 8가지 데이터 타입

JavaScript의 모든 값은 딱 여덟 가지 타입 중 하나에 속합니다. 일곱 가지는 **원시 타입(Primitive)**, 하나는 **객체 타입(Object)** 입니다.

### 원시 타입 7가지

**Number** — 정수와 실수를 구분하지 않는 하나의 타입입니다. `42`도 `3.14`도 Number입니다. 특별한 값으로 `NaN`(Not a Number)과 `Infinity`도 있습니다.

**String** — 텍스트를 나타냅니다. 작은따옴표, 큰따옴표, 백틱 세 가지로 작성할 수 있고, 백틱은 ES6에서 추가된 **템플릿 리터럴**로 변수를 직접 삽입할 수 있습니다.

```js
const name = "Alice";
console.log(`안녕하세요, ${name}!`); // 안녕하세요, Alice!
```

**Boolean** — `true` 또는 `false`. 조건문의 기반입니다.

**undefined** — 변수를 선언했지만 값을 할당하지 않은 상태. JavaScript 엔진이 자동으로 부여합니다.

**null** — 개발자가 의도적으로 "아무것도 없음"을 표현할 때 씁니다. `undefined`는 "아직 값이 없음", `null`은 "의도적으로 비어있음"이라는 뉘앙스 차이가 있습니다.

**Symbol** — ES6에서 추가됐습니다. 생성할 때마다 완전히 고유한 값을 만들어냅니다. 객체 속성의 키로 사용하거나 충돌 없는 상수가 필요할 때 유용합니다.

**BigInt** — ES2020에서 추가됐습니다. Number로는 정확하게 표현할 수 없는 매우 큰 정수를 다룰 때 씁니다. 숫자 뒤에 `n`을 붙입니다(`9999999999999999n`).

### 객체 타입 — 나머지 모든 것

원시 타입 7가지를 제외한 모든 값은 객체입니다. 배열도, 함수도, 날짜도 내부적으로 객체입니다. 객체 타입의 가장 큰 특징은 **참조로 복사된다**는 것인데, 이 차이는 다음 글에서 자세히 다룹니다.

![JavaScript 8가지 타입 분류](/assets/posts/js-variables-types.svg)

---

## typeof 연산자

값의 타입을 확인할 때는 `typeof` 연산자를 씁니다.

```js
typeof 42          // "number"
typeof "hello"     // "string"
typeof true        // "boolean"
typeof undefined   // "undefined"
typeof Symbol()    // "symbol"
typeof 42n         // "bigint"
typeof {}          // "object"
typeof []          // "object" — 배열도 객체!
typeof null        // "object" — 역사적인 버그
typeof function(){} // "function"
```

`typeof null`이 `"object"`를 반환하는 것은 JavaScript 초기의 버그입니다. 수정하면 기존 코드가 깨지기 때문에 지금까지 유지되고 있습니다. null인지 확인하려면 `=== null`로 직접 비교해야 합니다.

---

## 타입 강제 변환(Type Coercion)

JavaScript는 연산 중에 타입을 자동으로 변환하는 경우가 많습니다.

```js
"5" + 3    // "53" — 숫자가 문자열로 변환됨
"5" - 3    // 2    — 문자열이 숫자로 변환됨
true + 1   // 2    — true가 1로 변환됨
```

`+` 연산자는 문자열이 있으면 문자열 결합으로, `-` 연산자는 숫자 연산으로 처리합니다. 이 암묵적 변환이 예기치 않은 결과를 만들 수 있어, 타입을 명시적으로 변환하는 것을 권장합니다.

```js
Number("5") + 3   // 8
String(42)        // "42"
Boolean(0)        // false
```

---

변수와 타입을 제대로 이해하면, 코드를 읽을 때 "이 값이 지금 어떤 타입이지?"를 자동으로 추적하게 됩니다. 다음 글에서는 원시 타입과 객체 타입이 메모리에서 어떻게 다르게 처리되는지를 살펴봅니다. 복사 버그의 원인이 바로 거기 있습니다.

---

**다음 글:** [원시 타입 vs 참조 타입 — 복사 버그의 근원](/posts/js-primitive-vs-reference/)

<br>
읽어주셔서 감사합니다. 😊
