---
title: "var · let · const 차이 — 스코프, 호이스팅, 재할당"
description: "JavaScript 변수 선언의 세 가지 방법인 var, let, const의 스코프 규칙, 호이스팅 동작, 재선언/재할당 제한을 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "var", "let", "const", "스코프", "호이스팅", "ES6"]
featured: false
draft: false
---

[지난 글](/posts/js-strict-mode/)에서 JavaScript에 두 가지 실행 모드가 있고, strict mode가 위험한 동작을 막아준다는 것을 살펴봤습니다. 이번 글에서는 변수를 선언하는 세 가지 키워드 `var`, `let`, `const`의 결정적인 차이를 다룹니다. 이 세 가지의 차이를 제대로 이해하는 것이 JavaScript 코드의 예측 가능성을 높이는 첫걸음입니다.

## 한눈에 보는 차이

![var · let · const 비교](/assets/posts/js-var-let-const-scope.svg)

## var — 함수 스코프의 유산

`var`는 JavaScript 초기부터 있던 변수 선언 방법입니다. 가장 큰 특징은 **함수 스코프(function-scoped)**입니다. 블록(`{}`)을 스코프 경계로 인식하지 않습니다.

```javascript
function example() {
  if (true) {
    var x = 10;   // if 블록 안에서 선언
  }
  console.log(x); // 10 — 블록 밖에서도 접근 가능!
}

// for 루프의 var
for (var i = 0; i < 3; i++) {}
console.log(i); // 3 — 루프 밖에서도 살아있음
```

또한 `var`는 같은 스코프에서 **재선언**이 가능합니다:

```javascript
var x = 1;
var x = 2; // 오류 없음 — 조용히 덮어씀
console.log(x); // 2
```

그리고 전역에서 선언한 `var`는 `window` 객체에 등록됩니다:

```javascript
var globalVar = "hello";
console.log(window.globalVar); // "hello" (브라우저)
```

이 동작들은 모두 의도치 않은 버그를 만들기 쉽습니다.

## let — 블록 스코프의 시대

ES2015에서 도입된 `let`은 **블록 스코프(block-scoped)**입니다. `if`, `for`, `while`, 일반 `{}` 블록 모두를 스코프 경계로 인식합니다.

```javascript
if (true) {
  let blockVar = "hello";
  console.log(blockVar); // "hello"
}
console.log(blockVar); // ReferenceError — 블록 밖에서 접근 불가

let x = 1;
let x = 2; // SyntaxError — 재선언 불가
```

`let`은 전역 객체(`window`)에 등록되지 않아 전역 오염을 방지합니다.

### for 루프에서의 let vs var

가장 흔한 함정이 여기서 발생합니다:

![for 루프 클로저 함정](/assets/posts/js-var-let-const-loop.svg)

`var`로 선언된 `i`는 함수 스코프이기 때문에 루프의 모든 반복이 **같은 `i`**를 공유합니다. 클로저를 사용해 각 반복의 `i` 값을 캡처하려 해도, 클로저가 실행될 시점에는 루프가 끝나 `i`가 최종값(`3`)이 되어 있습니다.

`let`은 반복마다 **새로운 바인딩**을 만들어 각 클로저가 독립적인 `i`를 캡처합니다.

## const — 재할당 불가 변수

`const`는 `let`과 동일한 블록 스코프를 가지지만, **재할당이 불가**합니다.

```javascript
const PI = 3.14159;
PI = 3;  // TypeError: Assignment to constant variable

const arr = [1, 2, 3];
arr.push(4);   // OK! — 배열 자체가 아니라 내용을 변경
arr = [5, 6];  // TypeError — arr 변수 자체는 재할당 불가
```

중요한 점: `const`는 값의 **불변(immutable)**을 보장하는 것이 아니라, **바인딩의 불변**을 보장합니다. `const`로 선언된 객체나 배열의 내용은 변경할 수 있습니다.

```javascript
const user = { name: "Alice" };
user.name = "Bob";     // OK — 객체 내용 수정 가능
user.age = 30;         // OK — 프로퍼티 추가도 가능
user = { name: "Charlie" };  // TypeError — 재할당은 불가
```

객체의 내용까지 변경 불가하게 만들려면 `Object.freeze()`를 사용해야 합니다.

## 어떤 것을 써야 할까

현대 JavaScript 개발의 실용적 규칙:

1. **기본으로 `const` 사용** — 변수가 재할당될 필요가 없다면 항상 `const`
2. **재할당이 필요할 때만 `let`** — 카운터, 누적 변수, 조건부 초기화 등
3. **`var`는 사용하지 않음** — 레거시 코드 유지보수 외에는 피하라

```javascript
// 좋은 코드 패턴
const MAX_RETRIES = 3;          // 변경 안 됨 → const
const users = [];               // 내용은 바뀌지만 변수 자체는 → const
users.push({ name: "Alice" });  // OK

let count = 0;                  // 루프 카운터 → let
for (let i = 0; i < 10; i++) { // 루프 변수 → let
  count += i;
}

// 조건부 초기화
let message;
if (isError) {
  message = "Error occurred";
} else {
  message = "Success";
}
```

`const`를 기본으로 쓰면 코드 읽는 사람이 "이 값은 바뀌지 않는다"는 의도를 즉시 파악할 수 있어 가독성이 높아집니다.

## 호이스팅 차이 요약

세 키워드 모두 호이스팅(hoisting)됩니다—즉, 선언이 스코프 최상단으로 끌어올려집니다. 그러나 방식이 다릅니다:

```javascript
console.log(a); // undefined — var는 선언 + undefined 초기화가 호이스팅
var a = 1;

console.log(b); // ReferenceError — let/const는 TDZ(Temporal Dead Zone)
let b = 2;
```

`let`과 `const`의 TDZ(Temporal Dead Zone)는 다음 글에서 자세히 다룹니다.

---

**지난 글:** [Strict mode와 Sloppy mode](/posts/js-strict-mode/)

**다음 글:** [호이스팅의 본질](/posts/js-hoisting/)

<br>
읽어주셔서 감사합니다. 😊
