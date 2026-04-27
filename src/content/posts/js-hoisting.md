---
title: "호이스팅의 본질 — 선언이 끌어올려지는 원리"
description: "JavaScript 호이스팅이 실제로 어떻게 동작하는지, var/let/const/함수 선언문의 호이스팅 차이와 실행 컨텍스트와의 연관성을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-23"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "호이스팅", "hoisting", "var", "실행 컨텍스트", "스코프"]
featured: false
draft: false
---

[지난 글](/posts/js-var-let-const/)에서 `var`, `let`, `const`의 스코프 규칙과 재선언/재할당 제한을 살펴봤습니다. 그 과정에서 "호이스팅"을 잠깐 언급했는데, 이번 글에서 호이스팅의 본질을 깊이 파고들겠습니다. 많은 사람이 "코드가 위로 이동한다"고 오해하지만, 실제로는 엔진의 코드 처리 순서와 관련된 더 정확한 이야기가 있습니다.

## 호이스팅이란 무엇인가

호이스팅(hoisting)은 **"끌어올리기"**라는 뜻입니다. JavaScript 엔진이 코드를 실행하기 전에 변수와 함수 선언을 해당 스코프의 최상단으로 끌어올리는 동작처럼 보이는 현상을 말합니다.

중요한 점: 코드가 실제로 이동하지는 않습니다. 엔진이 **두 단계**로 코드를 처리하기 때문에 생기는 현상입니다:

1. **생성 단계(Creation Phase)**: 실행 컨텍스트를 만들고 스코프에 있는 모든 선언을 등록
2. **실행 단계(Execution Phase)**: 코드를 위에서 아래로 순서대로 실행

선언이 생성 단계에서 먼저 처리되기 때문에, 실행 단계에서는 선언 코드보다 앞에 있는 참조도 이미 등록된 상태입니다.

![호이스팅 메커니즘](/assets/posts/js-hoisting-mechanism.svg)

## var의 호이스팅

`var` 선언은 가장 관대한 호이스팅을 합니다. **선언과 `undefined` 초기화**가 함께 끌어올려집니다.

```javascript
console.log(x); // undefined — 오류 없음!
var x = 10;
console.log(x); // 10
```

엔진이 실제로 처리하는 순서:

```javascript
// 엔진 내부 처리 (개념적)
var x = undefined;  // 생성 단계: 선언 + 초기화

console.log(x);     // undefined
x = 10;             // 실행 단계: 값 할당
console.log(x);     // 10
```

이 때문에 `var`로 선언된 변수를 선언 이전에 참조해도 `ReferenceError`가 아닌 `undefined`를 반환합니다.

### 함수 스코프와 호이스팅

`var`는 함수 스코프이므로, 함수 안에서의 `var`는 함수 내 최상단으로 호이스팅됩니다:

```javascript
function example() {
  console.log(y); // undefined — 함수 내 호이스팅
  if (false) {
    var y = 5;    // 실행되지 않아도 선언은 호이스팅됨!
  }
  console.log(y); // undefined
}
```

이 동작이 `var`가 혼란스러운 이유입니다. `if (false)` 블록 안의 선언조차도 함수 최상단으로 끌어올려집니다.

## 함수 선언문의 호이스팅

함수 선언문(`function` 키워드로 시작하는 것)은 **완전 호이스팅**이 일어납니다. 선언뿐 아니라 **함수 본문 전체**가 끌어올려져 선언 이전에도 호출할 수 있습니다.

```javascript
// 선언 전에 호출 — 정상 작동!
const result = double(5);
console.log(result); // 10

function double(n) {
  return n * 2;
}
```

이는 의도적인 설계입니다. 함수를 파일 하단에 정의해 두고 상단에서 사용하는 코딩 스타일을 지원하기 위해서입니다.

## 함수 표현식은 다르다

함수 표현식(변수에 함수를 할당하는 것)은 함수 선언문과 다르게 동작합니다:

```javascript
// var로 선언된 함수 표현식
console.log(fn); // undefined — var가 호이스팅됨
fn();            // TypeError: fn is not a function

var fn = function() {
  return "hello";
};
```

`var fn`은 `undefined`로 초기화되어 호이스팅됩니다. 실제 함수 할당은 원래 코드 위치에서 실행됩니다. 따라서 할당 전에 호출하면 `undefined()`가 되어 `TypeError`가 발생합니다.

```javascript
// let/const로 선언된 함수 표현식 — TDZ
console.log(fn); // ReferenceError — TDZ에 있음
fn();

const fn = () => "hello";
```

## let, const, class의 호이스팅

`let`, `const`, `class`도 호이스팅됩니다. 하지만 `var`와 달리 **초기화 없이 선언만** 호이스팅됩니다. 이로 인해 **TDZ(Temporal Dead Zone)**가 생깁니다.

```javascript
console.log(a); // ReferenceError — TDZ에 있음
let a = 10;

new MyClass();  // ReferenceError — class도 TDZ
class MyClass {}
```

TDZ는 블록 시작부터 실제 선언 코드까지의 구간입니다. 이 구간에서 변수에 접근하면 `ReferenceError`가 발생합니다. TDZ에 대한 자세한 설명은 다음 글에서 이어집니다.

![호이스팅 유형 정리](/assets/posts/js-hoisting-types.svg)

## 같은 이름의 함수와 변수 호이스팅

같은 스코프에 같은 이름으로 함수 선언과 `var` 선언이 있다면 어떻게 될까요?

```javascript
console.log(typeof foo); // "function" — 함수가 우선
var foo = 1;
console.log(typeof foo); // "number" — 이제 값으로 덮임

function foo() {}        // 함수 선언이 var보다 먼저 호이스팅
```

엔진은 함수 선언을 먼저, `var` 선언을 나중에 처리합니다. 단, 실행 단계에서 `var foo = 1`이 실행되면 함수를 숫자로 덮어씁니다.

## 실무에서의 호이스팅

호이스팅을 이해하는 것은 중요하지만, 호이스팅에 의존하는 코드는 피하는 것이 좋습니다:

```javascript
// 피해야 할 패턴 (hoisting 의존)
console.log(count); // undefined
doSomething();      // 함수 선언문이라 동작하지만...

var count = 0;
function doSomething() { /* ... */ }

// 권장 패턴 — 선언 후 사용
const count = 0;

const doSomething = () => { /* ... */ };
doSomething();  // 명확하게 선언 후 호출
```

특히 `const`와 `let`을 기본으로 사용하면 TDZ가 실수를 잡아주어 호이스팅 관련 버그를 예방할 수 있습니다.

---

**지난 글:** [var · let · const 차이](/posts/js-var-let-const/)

**다음 글:** [TDZ (Temporal Dead Zone)](/posts/js-tdz/)

<br>
읽어주셔서 감사합니다. 😊
