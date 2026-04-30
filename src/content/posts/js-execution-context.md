---
title: "실행 컨텍스트 — JavaScript 코드가 동작하는 환경"
description: "JavaScript 엔진이 코드를 실행할 때 생성하는 실행 컨텍스트의 구조와 생성 단계·실행 단계를 살펴보고, 호이스팅과 스코프 체인의 근본 원리를 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "실행 컨텍스트", "호이스팅", "스코프 체인", "Variable Environment", "Lexical Environment"]
featured: false
draft: false
---

[지난 글](/posts/js-function-vs-block-scope/)에서 함수 스코프와 블록 스코프의 차이를 살펴봤습니다. 이번에는 그 스코프들이 실제로 어떻게 생성되고 관리되는지 — 즉 **실행 컨텍스트(Execution Context)** 라는 JavaScript 엔진 내부 구조를 들여다봅니다. 호이스팅이 왜 일어나는지, 스코프 체인이 어떻게 연결되는지, `this`가 어떻게 결정되는지를 이해하는 열쇠가 바로 여기 있습니다.

## 실행 컨텍스트란?

**실행 컨텍스트**는 JavaScript 엔진이 코드를 평가하고 실행하기 위해 만드는 환경 정보 묶음입니다. 자바스크립트가 실행될 때 최소 하나(전역 실행 컨텍스트)가 생성되며, 함수를 호출할 때마다 새로운 컨텍스트가 추가됩니다.

```javascript
var name = 'Alice';

function greet() {
  var msg = 'Hello, ' + name;
  console.log(msg);
}

greet(); // "Hello, Alice"
```

위 코드가 실행될 때 엔진은 전역 실행 컨텍스트(GEC)를 만들고, `greet()`를 호출할 때 함수 실행 컨텍스트(FEC)를 추가로 생성합니다.

![실행 컨텍스트 구조](/assets/posts/js-execution-context-structure.svg)

## 실행 컨텍스트의 세 가지 컴포넌트

### 1. Variable Environment (변수 환경)

`var`로 선언된 변수와 함수 선언을 수집합니다. **생성 단계**에서 먼저 메모리에 올라가며, 변수는 `undefined`로, 함수 선언은 전체 코드가 참조로 초기화됩니다. 이것이 바로 **호이스팅**의 본질입니다.

### 2. Lexical Environment (렉시컬 환경)

`let`, `const`, 함수 선언을 저장하고, 외부 스코프에 대한 참조(`outer`)를 가집니다. `outer` 참조로 스코프들이 체인처럼 연결되어 **스코프 체인**이 완성됩니다. 클로저가 동작하는 근거도 이 구조에 있습니다.

### 3. ThisBinding (this 바인딩)

이 컨텍스트에서 `this`가 가리킬 값을 결정합니다. 전역 컨텍스트에서는 `globalThis`(브라우저: `window`), 메서드 호출 컨텍스트에서는 호출 객체, `strict mode`에서는 `undefined`가 됩니다.

## 생성 단계와 실행 단계

실행 컨텍스트 수명은 두 단계로 나뉩니다.

![생성 단계 vs 실행 단계](/assets/posts/js-execution-context-phases.svg)

**생성 단계(Creation Phase)**: 코드를 한 줄도 실행하지 않고, 선언들을 스캔해 메모리를 할당합니다.

- `var` 변수 → `undefined`로 초기화
- 함수 선언 → 전체 함수 코드를 메모리에 저장
- `let`/`const` → TDZ(Temporal Dead Zone) 진입, 초기화 없음
- `this`, `outer` 참조 결정

**실행 단계(Execution Phase)**: 한 줄씩 코드를 실행하며 값을 할당합니다.

```javascript
console.log(x); // undefined — 생성 단계에서 var x가 이미 선언됨
console.log(y); // ReferenceError — let y는 TDZ 상태

var x = 10;
let y = 20;
```

## 실행 컨텍스트 스택

여러 컨텍스트는 **콜 스택(Call Stack)** 위에 쌓입니다. 함수가 호출되면 새 컨텍스트가 스택에 추가(push)되고, 반환하면 제거(pop)됩니다.

```javascript
function outer() {
  function inner() {
    // inner EC → outer EC → global EC
    // outer 참조로 체인 형성
  }
  inner();
}
outer();
```

`inner`의 Lexical Environment는 `outer`의 Lexical Environment를 `outer` 참조로 가리키고, `outer`는 전역 Lexical Environment를 가리킵니다. 이렇게 연결된 체인이 스코프 체인입니다.

## eval 실행 컨텍스트

`eval(code)`를 호출하면 별도의 실행 컨텍스트가 생성됩니다. 동적으로 코드를 실행하기 때문에 최적화가 어렵고 보안 위협이 있어, 실무에서는 거의 사용하지 않습니다.

## 정리

| 항목 | 내용 |
|------|------|
| 생성 시점 | 전역: 스크립트 시작 / 함수: 호출 시 |
| Variable Env | var, 함수 선언 — 호이스팅 원천 |
| Lexical Env | let/const, outer 참조 — 스코프 체인 |
| ThisBinding | 호출 방식에 따라 결정 |
| 생성 단계 | 선언 수집, undefined 초기화 |
| 실행 단계 | 값 할당, 코드 순차 실행 |

실행 컨텍스트는 JavaScript가 호이스팅, 스코프, 클로저, `this`를 동작시키는 엔진 수준의 설계입니다. 이 구조를 이해하면 언어의 "왜"가 자연스럽게 풀립니다.

---

**다음 글:** [배열 불변 메서드 — 원본을 건드리지 않는 방법들](/posts/js-array-immutable-methods/)

<br>
읽어주셔서 감사합니다. 😊
