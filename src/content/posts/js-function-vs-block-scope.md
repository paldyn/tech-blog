---
title: "함수 스코프 vs 블록 스코프"
description: "var의 함수 스코프와 let/const의 블록 스코프 차이를 이해하고, 루프 클로저 버그, 호이스팅, TDZ 동작까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 30
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "함수 스코프", "블록 스코프", "var", "let", "const", "호이스팅"]
featured: false
draft: false
---

[지난 글](/posts/js-lexical-scope/)에서 함수가 선언 위치에서 스코프를 갖는 렉시컬 스코프를 배웠습니다. 이번에는 **`var`가 만드는 함수 스코프**와 **`let`/`const`가 만드는 블록 스코프**의 차이를 명확히 비교합니다. 이 차이를 모르면 루프 클로저 버그 같은 고전적인 함정에 빠지기 쉽습니다.

## 함수 스코프(var)

`var`로 선언된 변수는 **함수 경계**를 스코프로 사용합니다. `if`, `for`, `while`, `{}` 블록은 `var`에게 새 스코프를 만들지 않습니다.

```javascript
function functionScope() {
  if (true) {
    var x = 'hello'; // 블록이 아닌 함수 스코프
  }
  console.log(x); // 'hello' — 블록 밖에서도 접근 가능

  for (var i = 0; i < 3; i++) {}
  console.log(i); // 3 — 루프 종료 후에도 접근 가능
}

functionScope();
console.log(typeof x); // 'undefined' — 함수 바깥에는 없음
```

함수 바깥에서는 접근할 수 없지만, 함수 안의 어느 블록에서든 접근됩니다.

## 블록 스코프(let, const)

`let`과 `const`는 **중괄호 블록** `{}`을 스코프 경계로 사용합니다.

```javascript
function blockScope() {
  if (true) {
    let a = 'let value';
    const b = 'const value';
    console.log(a, b); // 정상
  }
  // console.log(a); // ReferenceError: a is not defined
  // console.log(b); // ReferenceError: b is not defined

  for (let i = 0; i < 3; i++) {
    // i는 루프 블록 스코프
  }
  // console.log(i); // ReferenceError: i is not defined
}
```

블록 안에서만 유효하므로 의도치 않은 누출이 없습니다.

![함수 스코프 vs 블록 스코프 비교](/assets/posts/js-function-vs-block-scope-comparison.svg)

## 클래식 버그: 루프 클로저

`var`와 클로저의 조합은 자주 만나는 버그입니다.

```javascript
// 버그: var로 인한 공유 스코프
const callbacks_var = [];
for (var i = 0; i < 3; i++) {
  callbacks_var.push(() => i); // 모든 함수가 같은 i를 참조
}
callbacks_var[0](); // 3 (기대값: 0)
callbacks_var[1](); // 3 (기대값: 1)
callbacks_var[2](); // 3 (기대값: 2)

// 해결: let으로 반복마다 새 바인딩
const callbacks_let = [];
for (let j = 0; j < 3; j++) {
  callbacks_let.push(() => j); // 각 반복의 독립된 j를 참조
}
callbacks_let[0](); // 0
callbacks_let[1](); // 1
callbacks_let[2](); // 2
```

`let`은 반복마다 새로운 바인딩을 생성하므로 각 클로저가 독립된 값을 캡처합니다.

![클로저 + 루프: var vs let](/assets/posts/js-function-vs-block-scope-closure-loop.svg)

## 호이스팅 차이

`var`와 `let/const`는 호이스팅 방식이 다릅니다.

```javascript
// var: 선언이 함수 상단으로 호이스팅, undefined로 초기화
console.log(hoisted); // undefined (에러 없음)
var hoisted = 'value';

// let/const: 선언은 호이스팅되나 초기화 전 접근 불가 — TDZ
// console.log(notYet); // ReferenceError: Cannot access 'notYet' before initialization
let notYet = 'value';
```

`let`/`const`도 호이스팅되지만 선언 라인에 도달하기 전까지 **일시적 데드 존(TDZ, Temporal Dead Zone)** 상태입니다. 이 구간에서 접근하면 `ReferenceError`가 발생합니다.

TDZ는 의도치 않은 `undefined` 사용을 막아 버그를 조기에 발견할 수 있게 해줍니다.

## 재선언 차이

```javascript
var a = 1;
var a = 2; // OK — var는 재선언 허용
console.log(a); // 2

let b = 1;
// let b = 2; // SyntaxError: Identifier 'b' has already been declared

const c = 1;
// const c = 2;   // SyntaxError
// c = 3;          // TypeError: Assignment to constant variable
```

`const`는 재선언과 재할당 모두 금지합니다. 단, 객체/배열의 **내부 값 변경**은 허용됩니다.

```javascript
const obj = { x: 1 };
obj.x = 2;         // OK — 참조 값(주소)은 같음
// obj = {};        // TypeError — 재할당 불가
```

## switch와 블록 스코프

`switch`의 각 `case`는 공통 블록을 공유합니다. `let`을 `case` 안에서 쓰려면 명시적 블록이 필요합니다.

```javascript
switch (value) {
  case 'a': {
    let result = 'A result'; // 블록으로 분리
    console.log(result);
    break;
  }
  case 'b': {
    let result = 'B result'; // 위와 충돌 없음
    console.log(result);
    break;
  }
}
```

## var/let/const 선택 기준

현대 JavaScript에서 권장하는 선택 기준입니다.

| 상황 | 권장 |
|---|---|
| 재할당이 필요 없는 값 | `const` (기본값) |
| 재할당이 필요한 값 | `let` |
| 레거시 코드 유지보수 | `var` (새 코드에서는 비권장) |

`const`를 기본으로 쓰면 실수로 재할당했을 때 즉시 오류가 발생해 버그를 예방합니다. 재할당이 필요한 경우에만 `let`을 사용하세요.

## 전역에서의 차이

전역 스코프에서 `var`는 `window.x`처럼 전역 객체의 프로퍼티가 되지만, `let/const`는 그렇지 않습니다.

```javascript
var globalVar = 'via var';
let globalLet = 'via let';

console.log(window.globalVar); // 'via var'
console.log(window.globalLet); // undefined
```

함수 스코프와 블록 스코프의 차이는 단순한 문법 문제가 아니라 **예측 가능한 코드**를 위한 설계입니다. `const`와 `let`을 사용하면 호이스팅 혼란, 루프 클로저 버그, 의도치 않은 전역 오염을 모두 피할 수 있습니다. 다음 글에서는 함수 호출 시 생성되는 **실행 컨텍스트(Execution Context)** 를 살펴봅니다.

---

**지난 글:** [렉시컬 스코프](/posts/js-lexical-scope/)

**다음 글:** [실행 컨텍스트](/posts/js-execution-context/)

<br>
읽어주셔서 감사합니다. 😊
