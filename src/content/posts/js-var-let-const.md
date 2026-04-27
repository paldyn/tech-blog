---
title: "var·let·const — 스코프와 호이스팅 완전 정리"
description: "JavaScript의 세 가지 변수 선언 키워드 var·let·const의 스코프 차이, 호이스팅 동작, 재선언·재할당 가능 여부를 코드와 그림으로 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "var", "let", "const", "scope", "hoisting", "block-scope", "function-scope"]
featured: false
draft: false
---

[지난 글](/posts/js-strict-mode/)에서 이어집니다.

## 세 가지 방법으로 변수를 만들 수 있다

JavaScript에서 변수를 선언하는 방법은 세 가지입니다.

```javascript
var   name = 'Alice'; // ES3 시대부터 존재
let   age  = 30;      // ES6(2015)에서 추가
const PI   = 3.14;    // ES6(2015)에서 추가
```

세 키워드는 겉으로는 비슷해 보이지만 **스코프(scope)**, **호이스팅(hoisting)**, **재선언·재할당 가능 여부**에서 명확하게 다릅니다. 차이를 정확히 이해하면 실수를 피하고, 다른 사람의 코드를 읽는 속도도 빨라집니다.

---

## 핵심 차이 한눈에 보기

![var·let·const 스코프 차이](/assets/posts/js-var-let-const-scope.svg)

| | `var` | `let` | `const` |
|---|---|---|---|
| 스코프 | 함수 스코프 | 블록 스코프 | 블록 스코프 |
| 호이스팅 | 선언 + `undefined` 초기화 | 선언만 (TDZ 진입) | 선언만 (TDZ 진입) |
| 재할당 | 가능 | 가능 | 불가 (TypeError) |
| 재선언 | 가능 (위험) | 불가 (SyntaxError) | 불가 (SyntaxError) |

---

## 스코프 — 변수가 살아있는 영역

### var의 함수 스코프

![블록 스코프 이해하기](/assets/posts/js-var-let-const-block.svg)

`var`는 **함수 경계만 인식**합니다. `if`, `for`, `while` 등의 블록 `{}`은 `var`에게 아무 의미가 없습니다.

```javascript
function test() {
  if (true) {
    var x = 10; // if 블록 안에 선언
  }
  console.log(x); // 10 — 블록 밖에서도 접근 가능!
}

for (var i = 0; i < 3; i++) {}
console.log(i); // 3 — for 블록 밖으로 누수
```

반복문에서 `var i`를 선언하면 `i`가 블록 밖으로 새어 나옵니다. 예상치 못한 값 오염의 원인이 됩니다.

### let·const의 블록 스코프

```javascript
function test() {
  if (true) {
    let x = 10; // 블록 안에 갇힘
  }
  console.log(x); // ReferenceError — 블록 밖에서 없음
}

for (let i = 0; i < 3; i++) {}
console.log(i); // ReferenceError — i는 for 블록 안에만 존재
```

`let`과 `const`는 `{}`로 감싸진 블록 안에 격리됩니다. 변수가 필요한 곳에서만 존재하고, 그 범위 밖으로는 절대 빠져나가지 않습니다.

---

## 재할당과 재선언

### var — 재선언까지 허용

```javascript
var count = 1;
var count = 2; // 재선언 — 에러 없음!
console.log(count); // 2
```

같은 스코프에서 `var`로 같은 이름의 변수를 여러 번 선언해도 에러가 없습니다. 긴 파일에서 실수로 같은 이름을 선언했을 때 조용히 덮어쓰기 때문에 버그를 찾기가 매우 어렵습니다.

### let — 재할당은 가능, 재선언은 불가

```javascript
let score = 100;
score = 200;    // 재할당 — 허용
let score = 300; // SyntaxError: Identifier 'score' has already been declared
```

### const — 재할당도 재선언도 불가

```javascript
const MAX = 100;
MAX = 200; // TypeError: Assignment to constant variable
```

`const`는 한 번 할당하면 바인딩을 바꿀 수 없습니다. 단, 객체나 배열은 내부 값을 변경할 수 있습니다.

```javascript
const user = { name: 'Alice' };
user.name = 'Bob'; // 허용 — 객체 내부 프로퍼티 변경
user = {};         // TypeError — 변수 자체를 재할당 불가
```

---

## 호이스팅 — var와 let·const의 차이

호이스팅은 다음 글(js-hoisting)에서 자세히 다루지만, 핵심 차이를 먼저 짚어봅니다.

```javascript
console.log(a); // undefined — var는 호이스팅 + undefined 초기화
var a = 1;

console.log(b); // ReferenceError — TDZ (일시적 사각지대)
let b = 2;
```

`var`는 선언이 스코프 최상단으로 끌어올려지면서 동시에 `undefined`로 초기화됩니다. 선언 전에 접근해도 에러 없이 `undefined`를 반환합니다.

`let`과 `const`도 호이스팅은 됩니다. 하지만 **초기화는 선언문이 실행되는 시점까지 미뤄집니다.** 그 사이 구간을 TDZ(Temporal Dead Zone, 일시적 사각지대)라 부르며, TDZ 안에서 접근하면 `ReferenceError`가 발생합니다.

---

## var를 쓰면 안 되는 이유

`var`의 동작이 나쁜 것은 아닙니다. 설계 당시의 맥락이 있습니다. 하지만 현대 코드베이스에서 `var`는 다음 세 가지 문제를 안고 있습니다.

1. **블록을 무시하는 스코프** — `for`, `if` 블록에서 선언한 변수가 밖으로 새어 나옵니다.
2. **재선언 허용** — 같은 이름을 두 번 선언해도 에러가 없어 버그를 감춥니다.
3. **undefined로 먼저 초기화** — 선언 전 접근이 에러 없이 통과해 문제를 숨깁니다.

---

## 실무 권장 원칙

```
기본은 const → 값이 바뀌어야 할 때만 let → var는 사용하지 않는다
```

`const`를 기본으로 사용하면 코드를 읽는 사람이 "이 변수는 한 번 할당되고 바뀌지 않는다"는 것을 즉시 알 수 있습니다. `let`이 필요한 곳은 루프 카운터, 누산기, 상태 변수처럼 값이 명시적으로 변해야 하는 경우입니다.

```javascript
// 좋은 패턴
const API_URL = 'https://api.example.com';
const users = [];          // 배열 자체는 바뀌지 않음

for (let i = 0; i < 10; i++) { // 카운터는 let
  users.push(i);
}

// 피해야 할 패턴
var total = 0;
var total = 100; // 재선언 — 버그의 씨앗
```

---

## 정리

`var`는 함수 스코프, `let`과 `const`는 블록 스코프입니다. `var`는 재선언이 허용되지만 `let`/`const`는 `SyntaxError`를 냅니다. `const`는 재할당도 불가입니다. 호이스팅 측면에서 `var`는 선언과 동시에 `undefined`로 초기화되지만, `let`/`const`는 선언문 전까지 TDZ에 놓입니다.

기본은 `const`, 필요할 때만 `let`, `var`는 사용하지 않는 것이 현대 JavaScript의 표준 관행입니다.

---

**지난 글:** [Strict mode — 'use strict'로 달라지는 JavaScript](/posts/js-strict-mode/)  
**다음 글:** [호이스팅 — 선언이 끌어올려지는 메커니즘](/posts/js-hoisting/)

<br>
읽어주셔서 감사합니다. 😊
