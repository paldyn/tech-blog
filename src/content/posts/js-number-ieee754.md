---
title: "number와 IEEE 754 — 0.1 + 0.2가 0.3이 아닌 이유"
description: "JavaScript number 타입의 64비트 IEEE 754 부동소수점 구조, 안전 정수 범위, NaN의 특수한 동작, 부동소수점 오차 해결 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["number", "IEEE754", "NaN", "부동소수점", "정밀도"]
featured: false
draft: false
---

[지난 글](/posts/js-primitive-types/)에서 JavaScript의 7가지 원시 타입을 개괄했습니다. 이번 글은 그 중 `number` 타입을 깊이 파헤칩니다. JavaScript의 숫자는 모두 64비트 부동소수점(IEEE 754 double precision)으로 표현됩니다. 이 한 가지 선택이 `0.1 + 0.2 !== 0.3`이라는 유명한 결과를 만들어냅니다. 왜 그런지, 실무에서 어떻게 대처하는지 알아봅니다.

## IEEE 754 64비트 구조

![IEEE 754 64비트 부동소수점 구조](/assets/posts/js-number-ieee754-structure.svg)

64비트는 세 부분으로 나뉩니다. **부호(1비트)**는 양수/음수를 결정합니다. **지수(11비트)**는 소수점 위치를 2의 거듭제곱으로 표현합니다. **가수(52비트)**는 유효 자릿수를 저장합니다.

```javascript
// 표현 가능한 수의 범위
Number.MAX_VALUE;              // 1.7976931348623157e+308
Number.MIN_VALUE;              // 5e-324 (양의 최솟값)
Number.EPSILON;                // 2.220446049250313e-16
Number.MAX_SAFE_INTEGER;       // 9007199254740991 (2^53 - 1)
Number.MIN_SAFE_INTEGER;       // -9007199254740991
```

## 0.1 + 0.2가 0.3이 아닌 이유

10진수 0.1과 0.2는 이진수로 무한 소수입니다. 10진수 1/3이 소수로 0.333...이 되는 것처럼, 1/10은 이진수로 0.0001100110011...이 됩니다. 52비트 가수로 이를 저장할 때 반올림이 발생하고, 두 반올림된 값을 더하면 미세한 오차가 누적됩니다.

```javascript
console.log(0.1 + 0.2);                 // 0.30000000000000004
console.log(0.1 + 0.2 === 0.3);         // false

// 해결책 1: 허용 오차(epsilon) 비교
const approxEqual = (a, b) =>
  Math.abs(a - b) < Number.EPSILON;
approxEqual(0.1 + 0.2, 0.3);            // true

// 해결책 2: toFixed 문자열 반올림 후 비교
(0.1 + 0.2).toFixed(10) === (0.3).toFixed(10); // true

// 해결책 3: 정수로 변환해 계산
const add = (a, b, decimals = 10) => {
  const factor = Math.pow(10, decimals);
  return Math.round(a * factor + b * factor) / factor;
};
add(0.1, 0.2); // 0.3

// 해결책 4: BigInt (정수만 가능)
// 금융 계산은 센트 단위 정수로 관리
const priceInCents = 10n + 20n; // 30n
```

## 안전한 정수 범위

가수 52비트는 53비트 정밀도를 제공합니다(암묵적 1비트 포함). 따라서 2^53 - 1을 넘는 정수는 정확하게 표현되지 않을 수 있습니다.

```javascript
console.log(Number.MAX_SAFE_INTEGER);           // 9007199254740991
console.log(Number.MAX_SAFE_INTEGER + 1);       // 9007199254740992 (정확)
console.log(Number.MAX_SAFE_INTEGER + 2);       // 9007199254740992 (같음! 오류)

Number.isSafeInteger(9007199254740991);         // true
Number.isSafeInteger(9007199254740992);         // false
```

데이터베이스 ID, 금융 데이터, 타임스탬프 같은 큰 정수를 다룰 때는 `BigInt`나 문자열을 사용해야 합니다.

## NaN과 특수 값

![NaN과 특수 숫자 값](/assets/posts/js-number-ieee754-nan-special.svg)

**NaN(Not a Number)**은 유효하지 않은 숫자 연산의 결과입니다. `typeof NaN === 'number'`인 아이러니가 있습니다. NaN의 가장 특이한 성질은 **자기 자신과 같지 않다**는 것입니다.

```javascript
NaN === NaN;          // false ← 유일하게 자기와 다른 값
NaN !== NaN;          // true

// NaN 생성 케이스
0 / 0;                // NaN
parseInt('abc');      // NaN
Math.sqrt(-1);        // NaN
undefined + 1;        // NaN

// 올바른 NaN 확인 방법
Number.isNaN(NaN);    // true
Number.isNaN('abc');  // false (형변환 없음!)
isNaN('abc');         // true  (형변환 후 — 위험)
```

전역 `isNaN()`은 인수를 숫자로 변환 후 체크하기 때문에 `'abc'`도 `NaN`으로 처리합니다. `Number.isNaN()`이 정확합니다.

**+0과 -0**은 `===`로 같아 보이지만 `Object.is()`로는 다릅니다.

```javascript
+0 === -0;            // true
Object.is(+0, -0);   // false
1 / -0;              // -Infinity
1 / +0;              // +Infinity
```

**Infinity**는 오버플로우나 0으로 나누기에서 발생합니다. `Number.isFinite()`로 유한 여부를 확인합니다.

## Number 유틸리티 함수 정리

```javascript
// 파싱
Number('42');           // 42
Number('');             // 0 (주의!)
Number(null);           // 0 (주의!)
Number(undefined);      // NaN
parseInt('42px', 10);   // 42 (접두 정수만)
parseFloat('3.14abc');  // 3.14

// 검사
Number.isInteger(42);       // true
Number.isInteger(42.0);     // true
Number.isInteger(42.5);     // false
Number.isFinite(Infinity);  // false
Number.isNaN(NaN);          // true
Number.isSafeInteger(2**53); // false

// 출력
(3.14159).toFixed(2);    // '3.14'
(1234567).toLocaleString(); // '1,234,567'
(0.00001).toExponential(); // '1e-5'
```

JavaScript의 `number`는 편리하지만 정밀도 함정이 있습니다. 금융 계산은 항상 정수 단위로 처리하거나, `BigInt` 혹은 검증된 라이브러리(Decimal.js 등)를 사용하는 것이 안전합니다.

---

**지난 글:** [원시 타입 7가지 — JavaScript의 기본 자료형](/posts/js-primitive-types/)

<br>
읽어주셔서 감사합니다. 😊
