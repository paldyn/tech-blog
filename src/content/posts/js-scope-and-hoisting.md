---
title: "스코프와 호이스팅 — 변수는 어디서 보이는가"
description: "JavaScript에서 변수가 유효한 범위(스코프)와 선언이 끌어올려지는 현상(호이스팅)을 깊이 이해합니다. var, let, const, function의 차이를 정확히 파악합니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "스코프", "호이스팅", "var", "let", "const", "TDZ", "실행컨텍스트"]
featured: false
draft: false
---

지난 [실행 컨텍스트 — JavaScript가 코드를 실행하는 방식](/posts/js-execution-context/) 글에서 함수가 일급 객체라는 것을 살펴봤습니다. 함수를 변수에 담고, 전달하고, 반환할 수 있었죠. 그런데 변수나 함수를 자유롭게 다루다 보면 자연스럽게 한 가지 의문이 생깁니다. **"이 변수는 지금 여기서 쓸 수 있는 건가?"**

이 질문에 답하는 개념이 **스코프(Scope)** 입니다. 그리고 스코프를 이해하다 보면 반드시 만나게 되는 낯선 현상이 있습니다. 선언하기 전에 변수를 읽어도 에러가 나지 않는 현상, **호이스팅(Hoisting)** 입니다.

---

## 스코프란 무엇인가

스코프는 "변수가 유효한 범위"입니다. 집에 비유하면, 내 방에 있는 물건은 내 방에서만 보입니다. 거실에서도 쓰고 싶다면 거실에 두어야 합니다.

JavaScript에는 크게 세 종류의 스코프가 있습니다.

**전역 스코프(Global Scope)** — 어디서든 접근 가능한 범위입니다. 파일의 가장 바깥에 선언된 변수가 여기에 속합니다.

**함수 스코프(Function Scope)** — 함수 내부에서만 유효한 범위입니다. `var`로 선언한 변수가 이 규칙을 따릅니다.

**블록 스코프(Block Scope)** — `{}`로 감싼 코드 블록 안에서만 유효한 범위입니다. `let`과 `const`가 이 규칙을 따릅니다. ES6에서 도입됐습니다.

```js
const globalVar = "전역";

function outer() {
  let outerVar = "외부 함수";

  if (true) {
    let blockVar = "블록";
    console.log(globalVar);  // ✓ "전역"
    console.log(outerVar);   // ✓ "외부 함수"
    console.log(blockVar);   // ✓ "블록"
  }

  console.log(blockVar); // ❌ ReferenceError — 블록 밖
}
```

![스코프 체인 — 안쪽에서 바깥쪽으로 변수를 탐색하는 구조](/assets/posts/js-scope-hoisting-diagram.svg)

---

## 스코프 체인: 안에서 밖으로

변수를 찾을 때 JavaScript 엔진은 안쪽 스코프부터 시작해 바깥쪽으로 이동합니다. 이 탐색 경로를 **스코프 체인(Scope Chain)** 이라고 합니다.

```js
const x = "전역";

function outer() {
  const x = "outer";

  function inner() {
    console.log(x); // "outer" — inner 스코프에 없으므로 outer로
  }

  inner();
}

outer();
```

`inner` 함수 안에 `x`가 없으면, 엔진은 `outer` 스코프로 올라가서 찾습니다. 거기서도 없으면 전역까지 올라갑니다. 전역에도 없으면 `ReferenceError`가 발생합니다.

반대 방향은 작동하지 않습니다. 바깥 스코프에서 안쪽 스코프의 변수를 직접 참조할 수 없습니다.

---

## var의 함정: 함수 스코프와 블록 무시

`var`는 ES6 이전부터 JavaScript에 있었던 변수 선언 방식입니다. 함수 스코프를 따르기 때문에 `{}`(블록) 경계를 무시합니다.

```js
if (true) {
  var leaked = "나는 블록을 탈출한다";
}
console.log(leaked); // "나는 블록을 탈출한다" — ⚠ 의도치 않은 동작
```

`if` 블록 안에 선언했음에도 밖에서 접근됩니다. 같은 코드를 `let`으로 바꾸면 블록 밖에서 `ReferenceError`가 발생합니다. 예측 가능한 코드를 위해 현대 JavaScript에서는 `let`과 `const`를 기본으로 사용합니다.

---

## 호이스팅이란

호이스팅은 "끌어올리기"라는 뜻입니다. JavaScript 엔진이 코드를 실행하기 전에, 변수와 함수 **선언**을 해당 스코프의 맨 위로 끌어올려 등록하는 동작입니다.

중요한 것은 **값(초기화)은 끌어올리지 않는다**는 점입니다. 선언만 올라갑니다.

![var, let/const, function 선언식의 호이스팅 방식 비교](/assets/posts/js-scope-hoisting-compare.svg)

---

## var 호이스팅: undefined로 초기화

`var`는 선언과 동시에 `undefined`로 초기화됩니다. 그래서 선언 전에 접근해도 에러가 나지 않고 `undefined`가 반환됩니다.

```js
console.log(name); // undefined (에러 없음)
var name = "Alice";
console.log(name); // "Alice"
```

엔진이 실제로 처리하는 방식은 이렇습니다.

```js
var name; // 선언 + undefined 초기화 → 호이스팅
console.log(name); // undefined
name = "Alice";    // 값 할당은 원래 위치에서
console.log(name); // "Alice"
```

에러가 나지 않아서 버그를 찾기 어렵게 만드는 원인이 됩니다.

---

## let/const 호이스팅: TDZ(일시적 사각지대)

`let`과 `const`도 호이스팅됩니다. 그러나 초기화는 선언 줄에 도달할 때까지 일어나지 않습니다. 선언 전 접근은 **TDZ(Temporal Dead Zone, 일시적 사각지대)** 에 걸려 `ReferenceError`를 발생시킵니다.

```js
console.log(age); // ❌ ReferenceError: Cannot access 'age' before initialization
let age = 25;
console.log(age); // 25
```

TDZ는 오히려 좋은 동작입니다. 의도치 않은 사용을 에러로 알려주기 때문에 버그를 빠르게 발견할 수 있습니다.

---

## 함수 선언식 호이스팅: 전체가 올라간다

함수 선언식은 가장 완전한 형태로 호이스팅됩니다. 선언뿐 아니라 **함수 본체 전체**가 스코프 맨 위로 올라갑니다.

```js
greet(); // ✓ "안녕하세요!" — 선언 전에 호출 가능

function greet() {
  console.log("안녕하세요!");
}
```

반면 **함수 표현식**은 변수 호이스팅 규칙을 따릅니다. `var`로 선언했다면 `undefined`가, `let`/`const`로 선언했다면 TDZ가 적용됩니다.

```js
sayHi(); // ❌ TypeError: sayHi is not a function

var sayHi = function() {
  console.log("Hi!");
};
```

`sayHi`는 호이스팅되어 `undefined`인 상태에서 호출했으므로 함수가 아니라는 에러가 납니다.

---

## 스코프와 반복문

`var`의 함수 스코프 특성은 반복문에서 유명한 버그를 만들어냅니다.

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// 출력: 3, 3, 3 — 의도는 0, 1, 2
```

`var i`는 함수 스코프여서 반복문이 끝날 때까지 같은 변수를 공유합니다. 타이머가 실행될 때는 이미 `i`가 `3`입니다.

`let`으로 바꾸면 각 반복마다 새 블록 스코프를 만들어 의도대로 동작합니다.

```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// 출력: 0, 1, 2 ✓
```

---

스코프와 호이스팅은 JavaScript 실행의 기초 메커니즘입니다. 이것을 이해하면 다음 개념인 **클로저**가 훨씬 선명하게 보입니다. 클로저는 함수가 자신이 선언될 때의 스코프를 기억하는 현상입니다. 스코프 체인을 이해했다면 절반은 이미 알고 있습니다.

---

**지난 글:** [실행 컨텍스트 — JavaScript가 코드를 실행하는 방식](/posts/js-execution-context/)

**다음 글:** [클로저 — 함수가 기억하는 것들](/posts/js-closure/)

<br>
읽어주셔서 감사합니다. 😊
