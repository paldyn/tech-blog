---
title: "TDZ — 일시적 사각지대의 정체"
description: "let·const가 호이스팅됨에도 선언 전 접근이 ReferenceError를 내는 이유, TDZ(Temporal Dead Zone)의 정확한 범위와 예외 케이스를 코드로 분석합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "tdz", "temporal-dead-zone", "let", "const", "hoisting", "referenceerror"]
featured: false
draft: false
---

[지난 글](/posts/js-hoisting/)에서 이어집니다.

## TDZ란 무엇인가

**TDZ(Temporal Dead Zone, 일시적 사각지대)**는 `let`과 `const`로 선언된 변수가 스코프에 진입한 시점부터 실제 선언문이 실행되기 전까지의 구간입니다. 이 구간 안에서 해당 변수에 접근하면 즉시 `ReferenceError`가 발생합니다.

"Temporal"은 **시간적**이라는 뜻입니다. 위치가 아닌 시간(실행 순서)에 따라 결정됩니다. 코드 파일 상단에 선언이 있어도, 블록 진입 시점부터 선언문 실행 직전까지는 TDZ입니다.

---

## var와 let·const의 초기화 차이

![일시적 사각지대 — var vs let·const](/assets/posts/js-tdz-timeline.svg)

핵심은 **초기화 시점**의 차이입니다.

| | 호이스팅 | 초기화 시점 |
|---|---|---|
| `var` | 스코프 진입 시 | 스코프 진입 시 (`undefined`) |
| `let` | 스코프 진입 시 | 선언문 실행 시 |
| `const` | 스코프 진입 시 | 선언문 실행 시 |

`var`는 호이스팅과 동시에 `undefined`로 초기화됩니다. 선언 전 접근해도 변수는 이미 존재하므로 `undefined`를 돌려줍니다.

`let`과 `const`는 호이스팅은 되지만 **초기화는 선언문이 실행될 때까지 일어나지 않습니다.** 그 사이 구간이 TDZ입니다. 엔진은 변수가 스코프에 존재한다는 것을 알고 있지만, 아직 값이 없는 상태로 표시해두고, 이 상태에서 접근하면 에러를 던집니다.

```javascript
// var — TDZ 없음
console.log(a); // undefined (에러 없음)
var a = 10;
console.log(a); // 10

// let — TDZ 있음
console.log(b); // ReferenceError: Cannot access 'b' before initialization
let b = 10;
console.log(b); // 10 (여기선 정상)
```

---

## TDZ가 발생하는 위치

TDZ는 **블록이 시작되는 시점**부터 **선언문이 평가되는 시점**까지입니다.

```javascript
{
  // ← 여기서부터 TDZ 시작 (블록 진입)
  console.log(x); // ReferenceError
  console.log(x); // ReferenceError
  let x = 5;      // ← 여기서 TDZ 종료, x = 5로 초기화
  console.log(x); // 5
}
```

선언문 자체가 실행되는 순간 TDZ가 끝나고 변수를 사용할 수 있습니다.

---

## TDZ의 실전 예제 — 어디서 터지나

![TDZ 실전 예제 — 어디서 터지나](/assets/posts/js-tdz-examples.svg)

### 패턴 1: 선언 전 사용

```javascript
console.log(name); // ReferenceError
let name = 'Alice';
```

가장 단순한 패턴입니다. 선언보다 먼저 사용했습니다.

### 패턴 2: typeof도 TDZ에선 에러

`typeof` 연산자는 선언되지 않은 변수에 사용해도 에러가 나지 않는 것으로 유명합니다.

```javascript
console.log(typeof undeclaredVar); // "undefined" — 에러 없음
```

하지만 TDZ 안에 있는 `let`/`const` 변수에는 `typeof`도 에러를 냅니다.

```javascript
console.log(typeof x); // ReferenceError — TDZ!
let x = 10;
```

이 동작은 `let`/`const`도 호이스팅이 된다는 것을 증명합니다. 엔진은 `x`가 이 스코프에 `let`으로 선언되어 있다는 것을 알고 있고, TDZ를 적용합니다. 선언조차 없었다면 `typeof undeclaredVar`처럼 `"undefined"`를 반환했을 것입니다.

### 패턴 3: 함수 기본값이 TDZ 변수를 참조

```javascript
function fn(x = y, y = 1) {}
fn(); // ReferenceError — x의 기본값을 평가할 때 y가 TDZ에 있음
```

함수 매개변수 기본값은 왼쪽부터 오른쪽 순서로 평가됩니다. `x = y`를 평가할 때 `y`는 아직 TDZ에 있어 에러가 납니다. 선언 순서를 바꾸면 해결됩니다.

```javascript
function fn(y = 1, x = y) {} // 올바른 순서
fn(); // 정상 동작
```

### 패턴 4: 클래스도 TDZ를 따른다

```javascript
new MyClass(); // ReferenceError

class MyClass {
  constructor() {}
}
```

`class` 선언도 `let`/`const`와 동일한 TDZ 규칙을 따릅니다. 선언 전에 `new`로 인스턴스를 생성하려 하면 `ReferenceError`가 발생합니다.

---

## TDZ 안전 패턴

```javascript
// 항상 선언을 먼저
let config = { timeout: 3000 };
const API_URL = 'https://api.example.com';

// 선언 후 사용
console.log(config.timeout); // 3000
console.log(API_URL);        // "https://api.example.com"
```

규칙은 단순합니다: **선언을 사용보다 위에 두세요.** 블록 또는 스코프의 맨 위에 모든 `let`/`const` 선언을 모아두면 TDZ 관련 에러는 원천 차단됩니다.

---

## TDZ가 존재하는 이유

TDZ는 의도적인 설계입니다. 두 가지 목표를 달성합니다.

**1. 코딩 실수를 즉시 에러로 드러낸다**

`var`처럼 선언 전 접근이 `undefined`를 반환하면, 개발자는 문제를 인식하지 못한 채 잘못된 값이 흘러가게 됩니다. TDZ는 이런 실수를 `ReferenceError`로 즉각 알립니다.

**2. const의 의미를 보장한다**

`const`는 초기화와 동시에 값이 정해져야 합니다. 선언 전 구간을 `undefined`로 허용하면 "초기화 전에는 undefined, 초기화 후에는 고정값"이 되어 `const`의 의미가 모호해집니다. TDZ는 `const` 변수가 항상 명확한 초기값을 가지도록 강제합니다.

---

## let·const가 호이스팅된다는 증거

TDZ 자체가 `let`/`const`의 호이스팅 증거입니다.

```javascript
let x = 'outer';

{
  console.log(x); // ReferenceError — 'outer'가 출력되지 않음!
  let x = 'inner';
}
```

만약 `let x = 'inner'`가 호이스팅되지 않았다면, 블록 안에서 `console.log(x)`는 외부 스코프의 `x = 'outer'`를 찾아 `"outer"`를 출력해야 합니다. 그러나 `ReferenceError`가 발생합니다.

이는 엔진이 블록에 진입하는 순간 `let x`를 블록 스코프 최상단에 등록(호이스팅)하고, TDZ를 적용했기 때문입니다. 블록 안에서 `x`는 외부 `x`가 아닌 내부 `x`에 묶이고, 그 내부 `x`는 아직 초기화되지 않아 에러가 납니다.

---

## 정리

TDZ는 `let`과 `const` 변수가 블록 스코프에 진입한 시점부터 선언문이 실행될 때까지 접근을 차단하는 구간입니다. `var`는 TDZ가 없어 선언 전 접근 시 `undefined`를 반환하고, `let`/`const`는 TDZ로 인해 `ReferenceError`를 냅니다. `typeof`조차 TDZ 안에선 에러를 내며, 이는 `let`/`const`가 실제로 호이스팅된다는 증거이기도 합니다.

해결책은 단순합니다 — 선언을 항상 사용보다 먼저 두세요.

---

**지난 글:** [호이스팅 — 선언이 끌어올려지는 메커니즘](/posts/js-hoisting/)

<br>
읽어주셔서 감사합니다. 😊
