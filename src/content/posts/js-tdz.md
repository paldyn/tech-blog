---
title: "TDZ — Temporal Dead Zone의 실체"
description: "let과 const가 호이스팅되면서도 선언 전 접근 시 ReferenceError를 던지는 이유, TDZ가 typeof와 기본 매개변수에 미치는 영향, 그리고 TDZ가 설계된 이유를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TDZ", "Temporal Dead Zone", "let", "const", "호이스팅"]
featured: false
draft: false
---

[지난 글](/posts/js-hoisting/)에서 `var`와 함수 선언이 호이스팅된다는 것을 살펴보았습니다. `let`과 `const`도 호이스팅된다고 언급했는데, 그렇다면 왜 선언 전에 접근하면 `undefined`가 아닌 `ReferenceError`가 발생할까요? 그 이유가 **TDZ(Temporal Dead Zone, 시간적 사각지대)**입니다.

## TDZ란 무엇인가

`let`과 `const`로 선언된 변수는 해당 블록 스코프가 시작될 때부터 호이스팅되어 엔진에 등록됩니다. 하지만 실제 선언 코드에 도달하기 전까지는 **초기화(initialize)**되지 않은 상태, 즉 TDZ에 놓입니다. 이 구간에서 해당 변수에 접근하면 `ReferenceError`가 발생합니다.

![TDZ — 변수 생명주기](/assets/posts/js-tdz-lifecycle.svg)

`var`는 호이스팅 시점에 `undefined`로 초기화됩니다. 반면 `let`/`const`는 호이스팅은 되지만 초기화는 선언 코드가 실행될 때까지 미뤄집니다. 이 간격이 TDZ입니다.

```javascript
{
  // 블록 시작 = x가 TDZ에 진입
  console.log(x); // ReferenceError: Cannot access 'x' before initialization
  let x = 10;    // 이 줄에서 TDZ 종료, x = 10으로 초기화
  console.log(x); // 10
}
```

"Temporal(시간적)"이라는 단어가 핵심입니다. 코드상 위치가 아니라 *실행 시간* 기준입니다. 같은 스코프라도 선언 전에 실행되는 코드라면 TDZ 오류가 발생합니다.

## typeof도 TDZ에서는 안전하지 않다

`var`를 쓸 때는 `typeof`로 변수 존재 여부를 안전하게 확인할 수 있었습니다.

```javascript
typeof undeclaredVar; // 'undefined' — 오류 없음 (var)
```

하지만 `let`/`const`가 TDZ에 있는 상태에서 `typeof`를 사용하면 `ReferenceError`가 발생합니다.

```javascript
{
  typeof x; // ReferenceError! (TDZ)
  let x = 1;
}
```

이것은 `typeof`의 전통적 "안전망" 역할이 `let`/`const`에서는 통하지 않음을 의미합니다.

## TDZ의 함정들

![TDZ — 흔한 함정 패턴](/assets/posts/js-tdz-pitfalls.svg)

### 기본 매개변수의 순서

함수 기본값 매개변수는 왼쪽부터 오른쪽 순서로 초기화됩니다. 이전 매개변수를 뒤에 오는 매개변수의 기본값으로 참조하면 TDZ 오류가 발생합니다.

```javascript
// 잘못된 순서
function broken(a = b, b = 1) { return [a, b]; }
broken(); // ReferenceError: b is not defined

// 올바른 순서
function fixed(b = 1, a = b) { return [a, b]; }
fixed(); // [1, 1]
```

### 클래스 필드 초기화 순서

클래스 필드도 선언 순서대로 초기화됩니다. 뒤에 선언된 필드를 앞에서 참조하면 `undefined`나 오류가 발생합니다.

```javascript
class Config {
  timeout = this.base * 2; // base가 아직 undefined!
  base = 1000;
}
const c = new Config();
console.log(c.timeout); // NaN (undefined * 2)
console.log(c.base);    // 1000

// 올바른 순서
class ConfigFixed {
  base = 1000;
  timeout = this.base * 2; // 1000이 먼저 초기화
}
```

### 클로저와 TDZ

클로저가 TDZ 구간에서 생성되면 그 클로저가 나중에 실행될 때는 이미 초기화된 후일 수 있습니다. 하지만 클로저 *내부에서* TDZ 변수를 즉시 참조하면 오류입니다.

```javascript
{
  // TDZ가 진행 중인 상태에서 함수 정의
  const fn = () => x; // 정의 자체는 OK — x를 아직 읽지 않음
  let x = 42;
  console.log(fn()); // 42 — x가 초기화된 후에 호출
}
```

## TDZ가 설계된 이유

TDZ는 의도적인 언어 설계입니다. 목적은 두 가지입니다.

1. **버그 조기 발견** — `var`의 `undefined` 리턴은 실수를 조용히 허용했습니다. TDZ는 선언 전 접근을 즉시 `ReferenceError`로 알려줍니다.

2. **const 의미론 지원** — `const`는 한 번 초기화되면 재할당할 수 없습니다. TDZ가 없다면 초기화 전 `undefined` 상태가 존재하는 시기가 있어 "한 번만 할당"이라는 의미론이 깨집니다.

## TDZ 요약

```javascript
// ✓ 동작하는 패턴
let y = 10;
console.log(y); // 10

const fn = () => y; // y 참조를 나중에 실행
console.log(fn());  // 10

// ✗ TDZ 오류 패턴
console.log(z);    // ReferenceError
let z = 5;

typeof w;          // ReferenceError (TDZ)
let w = 'hello';
```

TDZ를 피하는 가장 간단한 방법은 **변수를 사용하기 전에 선언하는 것**입니다. 현대 `let`/`const` 기반 코드에서 TDZ 오류는 "코드 구조 문제"를 알려주는 신호이므로, 오류를 회피하려 하지 말고 선언 순서를 정리하는 것이 올바른 접근입니다.

---

**지난 글:** [호이스팅 — var와 함수 선언이 끌어올려지는 원리](/posts/js-hoisting/)

**다음 글:** [원시 타입 7가지 — JavaScript의 기본 자료형](/posts/js-primitive-types/)

<br>
읽어주셔서 감사합니다. 😊
