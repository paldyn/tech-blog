---
title: "TDZ (Temporal Dead Zone) — 시간적 사각지대"
description: "let과 const의 Temporal Dead Zone이 무엇인지, 왜 존재하는지, 그리고 예기치 못한 TDZ 오류 패턴을 실제 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-23"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "TDZ", "Temporal Dead Zone", "let", "const", "호이스팅", "ReferenceError"]
featured: false
draft: false
---

[지난 글](/posts/js-hoisting/)에서 JavaScript의 호이스팅을 살펴보면서 `let`과 `const`는 선언만 호이스팅되고 초기화는 되지 않는다고 했습니다. 이 "선언은 됐지만 아직 초기화되지 않은" 구간이 바로 **TDZ(Temporal Dead Zone, 시간적 사각지대)**입니다. 이번 글에서는 TDZ가 왜 존재하는지, 그리고 어떤 상황에서 예기치 못한 TDZ 오류를 만나게 되는지 살펴봅니다.

## TDZ란 무엇인가

TDZ는 변수의 **블록 시작부터 변수 초기화(선언 코드 실행) 직전까지**의 구간입니다. 이 구간에서 해당 변수에 접근하면 `ReferenceError`가 발생합니다.

```javascript
{
  // ← 블록 시작, TDZ 시작 (x가 호이스팅됨 — 선언만, 초기화 안됨)

  console.log(x); // ReferenceError: Cannot access 'x' before initialization
                  // "x is not defined"가 아닌 이 메시지가 핵심 증거

  let x = 5;     // ← 여기서 x 초기화, TDZ 끝
  console.log(x); // 5
}
```

`"Cannot access 'x' before initialization"` 오류 메시지가 중요합니다. `"x is not defined"`는 변수가 존재하지 않는다는 뜻이지만, TDZ 오류는 변수가 존재하되 아직 초기화되지 않았다는 뜻입니다. 이것이 `let`/`const`가 호이스팅된다는 증거입니다.

![TDZ 타임라인](/assets/posts/js-tdz-timeline.svg)

## var와의 비교

```javascript
// var — TDZ 없음, 즉시 undefined
{
  console.log(a); // undefined (오류 없음)
  var a = 10;
  console.log(a); // 10
}

// let — TDZ 존재
{
  console.log(b); // ReferenceError!
  let b = 10;
  console.log(b); // 10
}
```

`var`는 선언과 동시에 `undefined`로 초기화가 호이스팅됩니다. `let`은 선언만 호이스팅되고 초기화는 실제 코드 위치에서 이루어집니다.

## TDZ가 존재하는 이유

TDZ는 설계상의 선택입니다. 왜 만들었을까요?

**1. `const`의 의미 보장**

```javascript
// TDZ가 없다면...
{
  console.log(x); // undefined ← const인데 undefined?
  const x = 42;   // 이 시점에서 42로 바뀜
}
```

`const`는 한 번 초기화되면 변경 불가한 변수입니다. 초기화 전에 `undefined`를 반환한다면 `const`가 값을 바꾸는 것처럼 보여 의미가 퇴색됩니다.

**2. 선언 전 접근은 버그**

선언 이전에 변수를 사용하는 것은 논리적 오류입니다. `var`의 `undefined` 반환은 이 버그를 숨기지만, TDZ는 즉각적인 오류로 버그를 드러냅니다.

**3. 더 안전한 코드**

초기화되지 않은 변수에 접근을 막으면 예기치 않은 `undefined` 관련 버그가 크게 줄어듭니다.

## TDZ가 발생하는 의외의 상황

![TDZ 발생 상황](/assets/posts/js-tdz-tricky.svg)

### 기본 매개변수의 TDZ

```javascript
// 매개변수도 순서대로 초기화된다
function greet(name, greeting = name.toUpperCase()) {
  //                           ^ name은 이미 초기화됨 — OK
  return `${greeting}, world`;
}

function bad(a = b, b = 1) {
  // a 평가 시점에 b는 아직 TDZ!
}
bad(); // ReferenceError: Cannot access 'b' before initialization
bad(1, 2); // OK — a가 기본값 없이 제공됨
```

### typeof와 TDZ

`typeof`는 선언되지 않은 변수를 `"undefined"`로 안전하게 처리하는 유일한 연산자입니다. 하지만 TDZ에 있는 변수는 `typeof`도 예외입니다:

```javascript
// 선언 안 된 변수 — typeof는 안전
typeof undeclaredVar; // "undefined" — 오류 없음

// TDZ에 있는 변수 — typeof도 오류!
typeof x;     // ReferenceError!
let x = 1;
```

이것이 `let`/`const`가 실제로 호이스팅된다는 또 다른 증거입니다. 엔진은 x가 이 스코프에 있다는 것을 알고 있어서 TDZ 오류를 던집니다.

### 클래스 상속의 TDZ

`extends`를 사용한 클래스에서 `super()` 호출 전 `this`는 TDZ 상태입니다:

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }
}

class Dog extends Animal {
  constructor(name) {
    // this.name = name;  // ReferenceError! — super() 전 this는 TDZ
    super(name);          // super() 이후 this 사용 가능
    this.type = "dog";
  }
}
```

이는 부모 클래스가 먼저 초기화되어야 자식 클래스의 `this`가 의미 있어지기 때문입니다.

### 클로저와 TDZ

```javascript
// 함수 안에서 바깥의 let을 참조
let count = 0;
function increment() {
  return count++;  // OK — count는 이미 초기화됨
}

// 조심해야 할 패턴
{
  const fn = () => x;  // x는 나중에 선언
  let x = 10;
  fn(); // OK — fn 호출 시점에는 x가 이미 초기화됨
}

{
  fn(); // ReferenceError!
  const fn = () => x;
  let x = 10;
  // fn 호출 시점에 fn 자체가 TDZ에 있음
}
```

핵심: TDZ는 **변수 접근 시점**이 아닌 **함수 선언 내 참조 시점**을 기준으로 판단하지 않습니다. 실제 런타임에 코드가 실행되는 시점에 해당 변수가 TDZ인지 확인합니다.

## TDZ와 실행 컨텍스트

TDZ는 실행 컨텍스트의 생성 단계(Creation Phase)와 연결됩니다. 블록이 시작될 때 엔진은 해당 블록 스코프의 `let`/`const` 선언을 환경 레코드(Environment Record)에 등록합니다. 이때 상태는 `<uninitialized>`입니다.

```
블록 시작 →  환경 레코드: { x: <uninitialized> }  ← TDZ
          →  console.log(x)  → ReferenceError
          →  let x = 5;      → 환경 레코드: { x: 5 }  ← TDZ 끝
          →  console.log(x)  → 5
```

즉, TDZ는 실제로 "죽은 구간"이 아니라, 변수가 `<uninitialized>` 상태로 존재하는 구간입니다.

## 정리

| 상태 | var | let/const |
|------|-----|-----------|
| 호이스팅 | 선언 + undefined 초기화 | 선언만 (TDZ) |
| 선언 전 접근 | undefined | ReferenceError |
| 초기화 위치 | 블록 시작 | 코드상의 선언 위치 |
| typeof 접근 | "undefined" | ReferenceError |

TDZ는 불편해 보일 수 있지만, 실제로는 선언 전 접근이라는 논리적 오류를 즉각 알려주어 버그를 훨씬 빨리 잡을 수 있게 해줍니다.

---

**지난 글:** [호이스팅의 본질](/posts/js-hoisting/)

**다음 글:** [원시 타입 7가지](/posts/js-primitive-types/)

<br>
읽어주셔서 감사합니다. 😊
