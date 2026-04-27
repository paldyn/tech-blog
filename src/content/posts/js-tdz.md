---
title: "TDZ — Temporal Dead Zone (일시적 사각지대)"
description: "let·const·class 선언 전 접근 시 ReferenceError가 발생하는 이유, TDZ가 시작·종료되는 정확한 시점, 그리고 클로저·기본값 매개변수에서 나타나는 TDZ 함정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "tdz", "temporal-dead-zone", "let", "const", "hoisting", "reference-error"]
featured: false
draft: false
---

[지난 글](/posts/js-hoisting/)에서 `let`과 `const`는 호이스팅이 되지만 초기화되지 않아, 선언 전에 접근하면 `ReferenceError`가 발생한다고 했습니다. 이 접근 불가 구간을 **TDZ(Temporal Dead Zone, 일시적 사각지대)**라고 합니다. "일시적"이라는 표현처럼, TDZ는 영원히 지속되지 않고 선언문이 실행되는 순간 사라집니다.

## TDZ란 무엇인가

TDZ는 실행 컨텍스트의 **생성 단계**에서 `let`·`const`·`class` 식별자가 등록되는 시점부터, 실행 단계에서 해당 선언문이 실행되어 초기화되는 시점까지의 구간입니다.

```javascript
// 이 지점부터 TDZ 시작 (블록 진입 = 생성 단계)
{
  console.log(x); // ReferenceError: Cannot access 'x' before initialization
  let x = 'hello'; // ← 여기서 TDZ 종료, x가 'hello'로 초기화됨
  console.log(x); // 'hello'
}
```

`var`는 생성 단계에서 `undefined`로 초기화되므로 TDZ가 없습니다. `let`·`const`는 초기화를 실행 단계의 선언문으로 미루기 때문에 TDZ가 존재합니다.

## TDZ가 시작되는 정확한 시점

중요한 포인트는 TDZ가 **선언문이 있는 코드 줄 위쪽**에서 시작되는 것이 아니라, **현재 스코프(블록)가 생성되는 시점**에 시작된다는 것입니다. 이 차이가 클로저와 함수에서 미묘한 버그를 만들어냅니다.

```javascript
let x = 'outer'; // 외부 스코프

function f() {
  console.log(x); // ReferenceError — 'outer'를 출력하지 않습니다!
  let x = 'inner'; // 이 선언이 함수 전체에 TDZ를 만듦
}

f();
```

`f()` 함수 바디가 시작되는 순간, 함수 스코프의 생성 단계에서 내부의 `let x`가 TDZ에 진입합니다. 따라서 `console.log(x)` 시점에 `x`는 외부 스코프의 `x`를 참조하는 것이 아니라, 함수 내부의 `x`의 TDZ 구간에 걸려 `ReferenceError`가 발생합니다.

"선언이 아래에 있으니까 위에서는 외부 변수를 참조하겠지"라는 직관이 틀리는 순간입니다.

![TDZ 타임라인](/assets/posts/js-tdz-timeline.svg)

## TDZ가 종료되는 시점

TDZ는 선언문이 **실행**되는 시점에 종료됩니다. `let`은 선언 시 값을 제공하지 않아도 `undefined`로 초기화됩니다.

```javascript
{
  // TDZ 시작
  let a;     // ← TDZ 종료, a = undefined
  const b = 1; // ← TDZ 종료, b = 1 (const는 반드시 초기값 필요)
  // 이후부터 a, b 사용 가능
}
```

`const`는 선언과 동시에 초기화해야 하므로, 선언문에 초기값이 없으면 `SyntaxError`가 발생합니다.

```javascript
const c; // SyntaxError: Missing initializer in const declaration
```

## 기본값 매개변수에서의 TDZ

함수의 기본값 매개변수도 왼쪽에서 오른쪽 순서로 평가되며, 각 매개변수는 순서에 따라 초기화됩니다. 이 과정에서도 TDZ가 적용됩니다.

```javascript
// OK: a가 먼저 초기화되므로 b의 기본값에서 사용 가능
function f(a = 1, b = a + 1) {
  console.log(b); // 2
}

// 에러: a의 기본값을 평가할 때 b는 아직 TDZ
function g(a = b, b = 2) {
  // ReferenceError: Cannot access 'b' before initialization
}
g(); // 에러 발생
```

![TDZ 함정 — 클로저와 기본값](/assets/posts/js-tdz-closure.svg)

## typeof 연산자와 TDZ

흥미롭게도 `typeof`는 일반적으로 존재하지 않는 변수에 `undefined`를 반환합니다. 그러나 TDZ 구간의 변수에는 예외적으로 `ReferenceError`를 발생시킵니다.

```javascript
// 선언 없는 변수 — typeof는 안전
console.log(typeof undeclaredVar); // 'undefined'

// TDZ 구간의 변수 — typeof도 에러!
{
  console.log(typeof x); // ReferenceError!
  let x = 1;
}
```

이 동작은 다소 일관성이 없어 보이지만, TDZ의 목적(선언 전 접근을 명시적 에러로 알려주기)을 `typeof` 체크로도 우회할 수 없게 설계된 것입니다.

## 클래스 선언과 TDZ

`class`도 `let`·`const`와 마찬가지로 TDZ가 적용됩니다. 클래스 인스턴스를 선언 전에 만들려 하면 에러가 발생합니다.

```javascript
const instance = new MyClass(); // ReferenceError

class MyClass {
  constructor() {
    this.value = 42;
  }
}
```

이는 ES5의 함수 생성자(constructor function)와 다른 동작입니다. 함수 선언문은 완전히 호이스팅되므로 선언 전에 `new`로 인스턴스를 만들 수 있었습니다.

```javascript
// 함수 선언문은 호이스팅됨
const obj = new OldStyle(); // 정상 동작

function OldStyle() {
  this.value = 42;
}
```

## TDZ가 있는 이유

TDZ는 왜 존재할까요? `let`과 `const`를 설계할 때 "선언 전 접근"이 항상 프로그래머의 실수라고 판단했기 때문입니다. `var`의 경우처럼 `undefined`로 조용히 통과시키면 버그를 숨겨버립니다. 에러를 명시적으로 발생시키는 것이 더 안전합니다.

또한 TDZ는 `const`의 의미적 일관성을 보장합니다. `const`로 선언된 변수는 선언과 동시에 최종 값이 결정되어야 합니다. 만약 초기화 전에 `undefined`로 접근 가능하다면, `const`가 "변하지 않는다"는 의미를 가질 수 없게 됩니다.

## 실무에서 TDZ 피하기

TDZ는 `var`의 조용한 실패 대신 명시적 에러를 제공하므로, 사실 개발자에게 유리합니다. 실무에서 TDZ 에러를 만나지 않으려면 다음 원칙을 지키면 됩니다.

**선언을 블록의 맨 위에 모으기**: `let`·`const`를 스코프 시작 부분에 몰아서 선언하면 TDZ 구간을 최소화할 수 있습니다.

```javascript
function doSomething() {
  // 모든 let/const를 함수 맨 위에 선언
  const config = loadConfig();
  let retries = 0;
  let result;

  // 이후 로직에서 사용
  while (retries < 3) {
    result = tryFetch(config);
    if (result) break;
    retries++;
  }

  return result;
}
```

**클로저 안에서 외부 변수와 같은 이름 피하기**: 클로저 내부에서 외부와 같은 이름의 `let`·`const`를 선언하면 의도치 않게 TDZ 에러를 만날 수 있습니다. ESLint의 `no-shadow` 규칙이 이를 방지합니다.

TDZ는 JavaScript의 엄격한 면 중 하나이지만, 버그를 조기에 발견하게 해주는 안전장치이기도 합니다. `let`과 `const`를 사용하면 할수록, 불필요한 `undefined` 버그 없이 더 안전한 코드를 작성할 수 있습니다.

---

**지난 글:** [호이스팅의 본질](/posts/js-hoisting/)

**다음 글:** [원시 타입 7가지](/posts/js-primitive-types/)

<br>
읽어주셔서 감사합니다. 😊
