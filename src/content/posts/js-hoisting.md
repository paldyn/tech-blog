---
title: "호이스팅의 본질 — JavaScript가 코드를 실행하기 전에 하는 일"
description: "호이스팅이 '코드가 위로 올라간다'는 오해를 바로잡고, 실행 컨텍스트 생성 단계에서 어떤 일이 일어나는지, 함수 선언문·var·let·const·class의 호이스팅이 각각 어떻게 다른지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "hoisting", "var", "let", "const", "execution-context", "tdz"]
featured: false
draft: false
---

[지난 글](/posts/js-var-let-const/)에서 `var`로 선언된 변수를 선언 이전에 참조하면 에러 없이 `undefined`가 반환된다는 것을 봤습니다. 이 직관에 반하는 동작의 이름이 **호이스팅(hoisting)**입니다. 많은 설명에서 "코드가 위로 올라간다"고 표현하지만, 이는 비유일 뿐 정확한 설명이 아닙니다. 실제로 무슨 일이 일어나는지 알아봅시다.

## 호이스팅이란 무엇인가 — 비유의 함정

"hoisting"은 영어로 "끌어올리기"를 뜻합니다. 다음 코드를 보면 그 이유를 알 수 있습니다.

```javascript
console.log(name); // undefined
var name = 'Lee';
console.log(name); // 'Lee'
```

선언이 코드 아래에 있는데 위에서 참조할 수 있습니다. 마치 선언이 맨 위로 "올라간" 것처럼 보입니다. 그래서 "호이스팅"이라 부르지만, 실제로 코드가 이동하는 것이 아닙니다.

## 실제 동작: 실행 컨텍스트 생성 단계

JavaScript 엔진은 코드를 실행하기 전에 **생성 단계(Creation Phase)**를 거칩니다. 이 단계에서 엔진은 현재 스코프(전역 또는 함수)를 스캔하며 **모든 선언을 미리 수집**합니다. 실제 할당 코드(오른쪽 값)는 아직 처리하지 않고, 선언만 처리합니다.

`var name = 'Lee'`에서 생성 단계에 일어나는 일:
- `name`이라는 식별자를 현재 스코프에 등록합니다
- `undefined`로 초기화합니다

그 다음 실행 단계에서 코드가 순서대로 실행되며, `name = 'Lee'` 할당이 만나는 시점에 값이 갱신됩니다.

따라서 `console.log(name)`이 선언 전에 나오더라도, 생성 단계에서 이미 `name`은 `undefined`로 존재하기 때문에 에러가 나지 않는 것입니다.

## 선언 종류별 호이스팅

모든 선언이 같은 방식으로 호이스팅되는 것은 아닙니다.

![선언 종류별 호이스팅 동작](/assets/posts/js-hoisting-types.svg)

### 함수 선언문: 완전 호이스팅

함수 선언문(`function` 키워드로 시작하는)은 선언과 함수 바디 전체가 호이스팅됩니다.

```javascript
sayHello(); // 'Hello!' — 선언 전에 호출해도 정상 동작

function sayHello() {
  console.log('Hello!');
}
```

함수 선언문은 생성 단계에서 함수 전체가 등록되기 때문에, 선언 이전 어디서든 호출할 수 있습니다. 이를 **완전 호이스팅(full hoisting)**이라 합니다.

### var: undefined로 초기화

`var`는 선언이 호이스팅되어 `undefined`로 초기화됩니다. 할당(`=` 오른쪽)은 호이스팅되지 않습니다.

```javascript
console.log(x); // undefined
var x = 10;
console.log(x); // 10
```

### 함수 표현식: var의 함정

변수에 함수를 담는 **함수 표현식**에서 `var`를 쓰면, 변수 선언은 호이스팅되지만 함수 자체는 아닙니다.

```javascript
sayBye(); // TypeError: sayBye is not a function
var sayBye = function() {
  console.log('Bye!');
};
```

`sayBye`는 생성 단계에서 `undefined`로 등록됩니다. `undefined()`를 호출하면 `TypeError`가 발생합니다. 함수 선언문과 혼동하기 쉬운 치명적인 차이입니다.

### let · const · class: TDZ

`let`, `const`, `class`는 호이스팅이 되지만 초기화되지 않습니다. 선언문에 도달하기 전까지 **TDZ(Temporal Dead Zone, 일시적 사각지대)**에 놓입니다.

```javascript
console.log(y); // ReferenceError: Cannot access 'y' before initialization
let y = 20;
```

TDZ 안에서 변수에 접근하면 `ReferenceError`가 발생합니다. `var`와 달리 에러가 명시적으로 발생하므로 버그를 훨씬 빨리 찾을 수 있습니다.

![호이스팅 동작 다이어그램](/assets/posts/js-hoisting-diagram.svg)

## 실행 컨텍스트와 호이스팅의 관계

호이스팅은 실행 컨텍스트(Execution Context)의 생성 단계에서 일어납니다. JavaScript 코드가 실행될 때마다 실행 컨텍스트가 만들어지며, 이 과정은 두 단계로 나뉩니다.

**생성 단계(Creation Phase)**
- 변수 환경(Variable Environment)을 생성합니다
- 현재 스코프의 모든 `var` 선언을 찾아 `undefined`로 초기화합니다
- 모든 함수 선언문을 찾아 함수 객체를 생성하고 등록합니다
- `let`·`const`·`class`는 등록만 하고 초기화하지 않습니다 (TDZ 시작)

**실행 단계(Execution Phase)**
- 코드를 위에서 아래로 한 줄씩 실행합니다
- 할당문을 만나면 변수에 값을 저장합니다
- `let`·`const`의 선언문을 만나면 초기화(TDZ 종료)합니다

## 함수 스코프와 호이스팅

함수 내부에서도 동일한 메커니즘이 작동합니다. 각 함수 호출마다 새로운 실행 컨텍스트가 생성되고, 그 안의 선언들이 함수 범위 내에서 호이스팅됩니다.

```javascript
function outer() {
  console.log(a); // undefined (inner var 호이스팅)
  if (true) {
    var a = 1;
  }
  console.log(a); // 1
}
```

`outer` 함수가 호출될 때 새 실행 컨텍스트가 생성되고, `var a`가 함수 스코프 내에서 `undefined`로 호이스팅됩니다.

## 호이스팅이 일어나는 이유

호이스팅은 설계 실수라기보다는 JavaScript가 단일 패스 파서로 동작하던 초기 시대의 유산입니다. 함수 선언문의 호이스팅은 특히 실용적 이유가 있었습니다. 코드 어느 곳에서나 함수를 정의하고 어느 곳에서나 호출할 수 있게 해주므로, 파일 구성 순서를 신경 쓰지 않아도 됩니다.

```javascript
// 메인 로직 먼저, 구현은 아래
main();

function main() {
  helper1();
  helper2();
}

function helper1() { /* ... */ }
function helper2() { /* ... */ }
```

이렇게 "상위 수준 흐름을 먼저, 세부 구현은 아래"로 코드를 구성할 수 있어서 가독성에 도움이 됩니다.

## 실무 권장 패턴

호이스팅의 혼란을 피하는 가장 간단한 방법은 **사용하기 전에 선언**하는 것입니다.

```javascript
// 권장: 선언 후 사용
const MAX = 100;
let count = 0;

function greet(name) {
  console.log(`Hi, ${name}`);
}

// 함수 표현식을 const로 선언 — TDZ 덕분에 실수 방지
const sayBye = function() {
  console.log('Bye');
};
```

`let`·`const` 사용, 함수 선언문보다 함수 표현식 선호, 선언을 스코프 맨 위로 모으는 관례 등이 호이스팅으로 인한 버그를 예방합니다. ESLint의 `no-use-before-define` 규칙이 이를 자동으로 잡아줍니다.

---

**지난 글:** [var · let · const 차이](/posts/js-var-let-const/)

**다음 글:** [TDZ — Temporal Dead Zone](/posts/js-tdz/)

<br>
읽어주셔서 감사합니다. 😊
