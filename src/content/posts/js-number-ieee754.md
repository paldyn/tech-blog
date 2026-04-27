---
title: "number의 IEEE 754 정밀도와 함정"
description: "JavaScript number 타입의 IEEE 754 배정밀도 구조, 0.1+0.2≠0.3의 이유, NaN·-0·Infinity의 특성, 그리고 부동소수점 문제를 안전하게 다루는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-24"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "number", "IEEE754", "부동소수점", "NaN", "BigInt", "정밀도"]
featured: false
draft: false
---

[지난 글](/posts/js-primitive-types/)에서 JavaScript의 7가지 원시 타입을 소개하며 `number` 타입이 IEEE 754 배정밀도 부동소수점 형식이라고 언급했습니다. 이번 글에서는 이 형식이 구체적으로 어떻게 작동하며, 왜 `0.1 + 0.2 === 0.3`이 `false`가 되는지, 그리고 이를 안전하게 다루는 방법을 파고들겠습니다.

## 왜 0.1 + 0.2가 0.3이 아닌가

```javascript
0.1 + 0.2;         // 0.30000000000000004
0.1 + 0.2 === 0.3; // false
```

처음 이 결과를 본 개발자 대부분이 충격을 받습니다. 이것은 JavaScript의 버그가 아니라, **이진수(binary) 부동소수점 표현의 본질적 한계**입니다.

10진수의 `1/3 = 0.333...`이 무한소수인 것처럼, 10진수의 `0.1`은 이진수로 표현하면 무한소수입니다:

```
0.1 (십진수) = 0.0001100110011001100... (이진수, 무한 반복)
0.2 (십진수) = 0.0011001100110011001... (이진수, 무한 반복)
```

64비트는 유한하므로 어딘가에서 잘라내야 합니다(반올림). 이 반올림 오차가 덧셈 후에 눈에 보이는 오차로 나타나는 것입니다.

## IEEE 754 배정밀도 구조

JavaScript의 `number`는 64비트 IEEE 754 배정밀도 형식입니다.

![IEEE 754 구조와 함정](/assets/posts/js-number-ieee754-structure.svg)

64비트는 세 부분으로 나뉩니다:
- **부호 비트(1bit)**: 양수(0) / 음수(1)
- **지수 비트(11bit)**: 값의 크기 범위 결정. 실제 지수는 저장값 - 1023
- **가수 비트(52bit)**: 정밀도 결정. 실제로는 1.xxx 형태이므로 53비트 유효

이 구조가 표현할 수 있는 최대 안전 정수가 `2^53 - 1 = 9007199254740991`입니다. 이보다 큰 정수는 정밀도 손실이 생깁니다.

## 특수 값들

### NaN — 숫자가 아닌 숫자

NaN(Not a Number)은 정의할 수 없는 수학적 연산의 결과입니다:

```javascript
0 / 0;           // NaN
Math.sqrt(-1);   // NaN
parseInt("abc"); // NaN
typeof NaN;      // "number" (역설적!)

// NaN의 특성: 자기 자신과 같지 않음
NaN === NaN; // false — IEEE 754 명세
NaN !== NaN; // true

// 올바른 NaN 검사
Number.isNaN(NaN);        // true
Number.isNaN("NaN");      // false (전역 isNaN과 다름!)
Object.is(x, NaN);        // true (x가 NaN일 때)

// 전역 isNaN은 문자열도 NaN으로 취급하므로 주의
isNaN("hello");           // true (형변환 후 검사)
Number.isNaN("hello");    // false (형변환 없이 검사)
```

### -0 — 음의 영

IEEE 754는 +0과 -0을 구별합니다. JavaScript에서는 대부분 같게 취급하지만 차이가 있습니다:

```javascript
-0 === 0;           // true — 함정!
Object.is(-0, 0);   // false — 정확한 구별

// 표시에서의 차이
String(-0);         // "0" — 부호 사라짐
JSON.stringify(-0); // "0"

// 실용적 용도: 방향 정보 유지
function getDirection(velocity) {
  return velocity > 0 ? "forward" : "backward";
}
getDirection(-0); // "backward" (0도 음수 방향!)
```

### Infinity와 -Infinity

```javascript
1 / 0;              // Infinity
-1 / 0;             // -Infinity
Infinity + 1;       // Infinity
Infinity - Infinity; // NaN

Number.MAX_VALUE;           // 1.7976931348623157e+308
Number.MAX_VALUE * 2;       // Infinity
Number.isFinite(Infinity);  // false
Number.isFinite(42);        // true
```

## 안전 정수 범위

```javascript
Number.MAX_SAFE_INTEGER;  // 9007199254740991 (2^53 - 1)
Number.MIN_SAFE_INTEGER;  // -9007199254740991

// 이 범위를 벗어나면 정밀도 손실
9007199254740992 === 9007199254740993; // true! (다른 값인데 같다고 함)

// 안전 정수 범위 체크
Number.isSafeInteger(9007199254740991);  // true
Number.isSafeInteger(9007199254740992);  // false
```

## 부동소수점 문제 해결 패턴

![부동소수점 해결 방법](/assets/posts/js-number-ieee754-solutions.svg)

### 방법 1: toFixed로 반올림 비교

```javascript
// 소수점 자리수를 제한해서 비교
const result = 0.1 + 0.2;
+result.toFixed(10) === 0.3; // true

// 화폐 표시
(1.005).toFixed(2); // "1.00" (주의: 반올림이 정확하지 않을 수도)
```

### 방법 2: Number.EPSILON으로 근사 비교

```javascript
// EPSILON = 2^-52, 약 2.22e-16
function nearlyEqual(a, b, epsilon = Number.EPSILON) {
  return Math.abs(a - b) < epsilon;
}

nearlyEqual(0.1 + 0.2, 0.3); // true
```

### 방법 3: 정수로 변환 후 연산 (금융 계산 권장)

```javascript
// 금액은 원 단위(정수)로 저장, 표시만 소수점
const priceInCents = 1099;    // 10.99달러를 센트로
const taxInCents = 55;        // 0.55달러
const totalInCents = priceInCents + taxInCents; // 1154 (정확)
const display = (totalInCents / 100).toFixed(2); // "11.54"
```

### 방법 4: BigInt (큰 정수)

```javascript
// 안전 정수 범위를 초과하는 정수
const userId = 9007199254740993n; // BigInt 리터럴 (n suffix)

// 문자열에서 변환
const big = BigInt("9007199254740993");

// 주의: number와 혼용 불가
9007199254740993n + 1;   // TypeError
9007199254740993n + 1n;  // 9007199254740994n (정확)
```

## 실용 규칙

```javascript
// 1. 부동소수점 비교는 === 대신 근사 비교
Math.abs(a - b) < Number.EPSILON

// 2. NaN 체크는 Number.isNaN() 사용
Number.isNaN(value)         // 추천
isNaN(value)                // 형변환 주의

// 3. 금융/정밀 계산은 정수 또는 BigInt
// 또는 decimal.js, big.js 같은 라이브러리 사용

// 4. 큰 정수 (DB ID, Unix timestamp ms 등)는 BigInt 또는 문자열
const id = "9007199254740993"; // 문자열로 다루거나
const id2 = 9007199254740993n; // BigInt 사용

// 5. 특수값 체크
Number.isFinite(x)  // NaN과 Infinity 모두 걸러냄
Number.isInteger(x) // 정수 여부
```

JavaScript의 `number` 타입은 많은 용도에서 충분히 정확하지만, 금융 계산이나 매우 큰 정수를 다룰 때는 그 한계를 알고 적절한 대안을 선택해야 합니다.

---

**지난 글:** [원시 타입 7가지](/posts/js-primitive-types/)

**다음 글:** [BigInt](/posts/js-bigint/)

<br>
읽어주셔서 감사합니다. 😊
