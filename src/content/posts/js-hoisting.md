---
title: "호이스팅 — var와 함수 선언이 끌어올려지는 원리"
description: "JavaScript 엔진이 코드 실행 전 선언을 처리하는 호이스팅 메커니즘, var와 함수 선언식의 차이, 함수 표현식과 클래스 선언의 TDZ 적용을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["호이스팅", "var", "함수선언", "TDZ", "실행컨텍스트"]
featured: false
draft: false
---

[지난 글](/posts/js-var-let-const/)에서 `var`의 함수 스코프가 어떻게 블록을 무시하는지 살펴보았습니다. `var`의 또 다른 특이한 동작이 바로 **호이스팅(Hoisting)**입니다. 선언보다 앞에서 변수나 함수를 사용해도 오류가 나지 않는 현상인데, 처음 접하면 마법처럼 보입니다. 이번 글에서는 왜 이런 일이 일어나는지, 어떤 것이 호이스팅되고 어떤 것은 그렇지 않은지 정확하게 이해합니다.

## 호이스팅이란

JavaScript 엔진은 코드를 실행하기 전에 **실행 컨텍스트(Execution Context)**를 생성합니다. 이 과정에서 현재 스코프의 모든 선언(`var`, 함수 선언식)을 먼저 수집하고 메모리에 등록합니다. 이 동작이 마치 선언이 코드 맨 위로 "끌어올려진(hoisted)" 것처럼 보이기 때문에 호이스팅이라고 부릅니다. 실제로 코드가 재배치되는 것이 아니라, 엔진의 두 단계 처리(수집 → 실행) 결과입니다.

![호이스팅 — var와 함수 선언이 처리되는 과정](/assets/posts/js-hoisting-var-fn.svg)

## var 호이스팅 — 선언만 끌어올려진다

`var`로 선언된 변수는 선언은 호이스팅되지만 **할당은 원래 위치에서** 실행됩니다.

```javascript
console.log(name); // undefined (오류 없음!)
var name = 'Alice';
console.log(name); // 'Alice'
```

엔진은 이 코드를 다음과 같이 처리합니다.

```javascript
// 엔진이 실제로 처리하는 방식 (개념적)
var name; // 1단계: 선언 등록, undefined로 초기화
console.log(name); // undefined
name = 'Alice'; // 2단계: 할당은 원래 자리에서
console.log(name); // 'Alice'
```

이것이 버그의 원천입니다. 변수를 선언 전에 사용해도 오류가 아니라 `undefined`가 나오기 때문에 논리 오류를 발견하기 어렵습니다.

## 함수 선언식 호이스팅 — 전체가 끌어올려진다

함수 선언식(function declaration)은 `var`와 달리 **선언과 정의(함수 본문) 전체**가 호이스팅됩니다.

![함수 선언식 vs 함수 표현식 — 호이스팅 차이](/assets/posts/js-hoisting-fn-types.svg)

```javascript
// 선언보다 먼저 호출해도 동작
const result = add(2, 3); // 5
console.log(result);

function add(a, b) {
  return a + b;
}
```

이 동작을 이용해 함수를 파일 하단에 모아두고 상단에서 호출하는 스타일을 사용하는 팀도 있습니다. 하지만 혼란을 줄이기 위해 선언 후 사용하는 것을 권장하는 편입니다.

## 함수 표현식은 호이스팅되지 않는다

`var`에 함수를 할당하는 **함수 표현식**은 `var` 호이스팅 규칙을 따릅니다. 변수 선언은 호이스팅되지만 함수 할당은 되지 않습니다.

```javascript
console.log(typeof greet); // undefined (var 호이스팅)
greet('Alice');             // TypeError: greet is not a function

var greet = function(name) {
  return `Hello, ${name}`;
};
```

`const`나 `let`을 사용한 함수 표현식은 TDZ로 인해 `ReferenceError`가 발생합니다.

```javascript
greet('Bob'); // ReferenceError: Cannot access 'greet' before initialization
const greet = (name) => `Hi, ${name}`;
```

## 클래스 선언도 TDZ를 가진다

`class` 선언은 호이스팅은 되지만 `let`·`const`처럼 **TDZ**에 놓입니다.

```javascript
const obj = new MyClass(); // ReferenceError
class MyClass {
  constructor() { this.x = 1; }
}
```

## 동일 이름 — 함수 선언이 var를 덮는다

같은 이름으로 `var`와 함수 선언이 공존하면, **함수 선언이 우선**합니다.

```javascript
console.log(typeof foo); // "function"
var foo = 1;
function foo() {}
console.log(typeof foo); // "number" (할당 후)
```

실행 컨텍스트 생성 시 함수 선언이 `var` 선언을 덮어씁니다.

## 호이스팅 정리표

| 선언 종류 | 호이스팅 | 초기값 | TDZ |
|----------|---------|--------|-----|
| `var` | O | `undefined` | X |
| 함수 선언식 | O (전체) | 함수 객체 | X |
| `let` | O (선언만) | — | O |
| `const` | O (선언만) | — | O |
| `class` | O (선언만) | — | O |
| 함수 표현식 (`var`) | 선언만 | `undefined` | X |
| 함수 표현식 (`let`/`const`) | O (선언만) | — | O |

현대 JavaScript에서 `var`를 피하고 `let`/`const`를 사용하는 주요 이유 중 하나가 이 호이스팅 동작 차이입니다. `let`/`const`는 TDZ로 인해 선언 전 접근 시 명확한 오류를 던져 버그를 조기에 발견하게 해줍니다.

---

**지난 글:** [var, let, const — 변수 선언의 세 가지 방법](/posts/js-var-let-const/)

**다음 글:** [TDZ — Temporal Dead Zone의 실체](/posts/js-tdz/)

<br>
읽어주셔서 감사합니다. 😊
