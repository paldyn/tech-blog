---
title: "Number와 Math — 수치 연산 완전 정복"
description: "Number 정적 메서드·상수, Math 객체의 올림·내림·반올림·난수·삼각함수, 소수점 처리와 안전 정수 범위를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Number", "Math", "수학", "부동소수점", "난수", "Math.round"]
featured: false
draft: false
---

[지난 글](/posts/js-object-static-methods/)에서 Object 정적 메서드를 살펴봤습니다. 이번에는 `Number` 객체의 정적 메서드·상수와 `Math` 객체의 수학 함수들을 정리합니다. 실무에서 자주 사용하는 반올림, 범위 제한, 난수 생성, 포맷팅 패턴을 중심으로 다룹니다.

---

## Number 상수

JavaScript의 number는 IEEE 754 배정밀도 부동소수점이므로, 안전하게 표현 가능한 정수 범위가 있습니다.

![Number 정적 메서드와 상수](/assets/posts/js-number-math-number.svg)

```javascript
Number.MAX_SAFE_INTEGER; // 9007199254740991 (2^53 - 1)
Number.MIN_SAFE_INTEGER; // -9007199254740991

// 이 범위를 넘으면 정밀도 손실
9007199254740992 === 9007199254740993; // true — 구분 불가!

// 안전 정수 여부 확인
Number.isSafeInteger(Number.MAX_SAFE_INTEGER);     // true
Number.isSafeInteger(Number.MAX_SAFE_INTEGER + 1); // false

// 2^53 이상의 정수는 BigInt 사용
const big = 9007199254740993n; // BigInt
```

---

## Number 정적 메서드

```javascript
// 파싱
Number.parseInt('42px');     // 42
Number.parseFloat('3.14em'); // 3.14
Number('42');                // 42
Number('42px');              // NaN — 완전 변환 아니면 NaN

// 판별
Number.isNaN(NaN);           // true
Number.isFinite(Infinity);   // false
Number.isInteger(3.0);       // true
Number.isInteger(3.5);       // false
Number.isSafeInteger(2 ** 53); // false
```

`Number.parseInt`와 전역 `parseInt`는 동작이 동일하지만, `Number.parseInt`를 쓰는 것이 모듈화 의도에 맞습니다.

---

## 인스턴스 메서드 — 포맷팅

```javascript
const n = 3.14159265;

n.toFixed(2);      // "3.14"   — 소수점 자리 고정 (문자열 반환)
n.toPrecision(4);  // "3.142"  — 유효 숫자 4자리
n.toExponential(2); // "3.14e+0"

// 16진수 변환
(255).toString(16); // "ff"
(255).toString(2);  // "11111111"
(255).toString(8);  // "377"

// 다시 숫자로
parseInt('ff', 16); // 255
parseInt('11111111', 2); // 255

// toFixed의 함정 — 문자열 반환
typeof (1.5).toFixed(0); // 'string'
+(1.5).toFixed(0);       // 2 (숫자로 변환 필요)
```

`toFixed`는 반올림에 일부 브라우저/엔진별 차이가 있습니다. 정확한 금전 연산에는 정수로 변환 후 처리하거나 전용 라이브러리를 씁니다.

---

## EPSILON으로 부동소수점 비교

`Number.EPSILON`은 1과 1보다 큰 최소 부동소수점 값 사이의 차이입니다.

```javascript
0.1 + 0.2 === 0.3; // false

// EPSILON을 활용한 허용 오차 비교
function almostEqual(a, b, eps = Number.EPSILON * 100) {
  return Math.abs(a - b) < eps;
}

almostEqual(0.1 + 0.2, 0.3); // true
```

금전 연산처럼 정밀도가 중요한 경우 소수점 자리를 정수로 이동(`* 100`)해서 계산하거나, `decimal.js`같은 라이브러리를 사용합니다.

---

## Math 객체

`Math`는 생성자가 아니라 정적 메서드와 상수를 담은 일반 객체입니다.

![Math 객체 주요 메서드](/assets/posts/js-number-math-math.svg)

```javascript
// 상수
Math.PI;   // 3.141592653589793
Math.E;    // 2.718281828459045
Math.LN2;  // 0.6931471805599453

// 반올림 계열
Math.round(4.5);  // 5   (0.5는 올림)
Math.round(-4.5); // -4  (주의: 음수는 올림 방향)
Math.ceil(4.1);   // 5   (항상 올림)
Math.floor(-4.1); // -5  (항상 내림)
Math.trunc(-4.9); // -4  (소수부 제거, 0 방향)
```

---

## 자주 쓰는 Math 패턴

```javascript
// 절대값, 최대·최소, 부호
Math.abs(-7);          // 7
Math.max(1, 5, 3);     // 5
Math.min(1, 5, 3);     // 1
Math.sign(-3);         // -1

// 배열에서 최대·최소
Math.max(...[1, 5, 3]); // 5
Math.min(...[1, 5, 3]); // 1

// 숫자 범위 고정 (clamp)
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
clamp(150, 0, 100); // 100
clamp(-10, 0, 100); // 0

// 거듭제곱
Math.pow(2, 10); // 1024
2 ** 10;         // 1024 (ES2016 ** 연산자 권장)
Math.sqrt(9);    // 3
Math.cbrt(27);   // 3 (세제곱근)
Math.hypot(3, 4); // 5 (피타고라스: √(3²+4²))
```

---

## 난수 생성

`Math.random()`은 `[0, 1)` 범위(0 포함, 1 미포함)의 유사 난수를 반환합니다.

```javascript
// [0, 1) 실수
Math.random(); // 0.7432...

// [min, max) 실수
const rand = (min, max) => Math.random() * (max - min) + min;

// [min, max] 정수
const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

randInt(1, 6); // 주사위 1~6

// 배열에서 랜덤 요소
const pick = arr => arr[randInt(0, arr.length - 1)];
pick(['가위', '바위', '보']); // 랜덤

// 배열 셔플 (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

보안이 필요한 난수(암호화, 토큰)는 `crypto.getRandomValues()`를 사용합니다. `Math.random()`은 예측 가능한 유사 난수입니다.

---

## 로그와 삼각함수

```javascript
Math.log(Math.E);  // 1 (자연로그)
Math.log2(8);      // 3
Math.log10(1000);  // 3

// 삼각함수 (라디안)
Math.sin(Math.PI / 2);  // 1
Math.cos(0);            // 1
Math.tan(Math.PI / 4);  // ≈ 1

// 각도 변환
const toRad = deg => deg * Math.PI / 180;
const toDeg = rad => rad * 180 / Math.PI;
```

---

**지난 글:** [Object 정적 메서드 총정리](/posts/js-object-static-methods/)

**다음 글:** [Date와 타임존 — 날짜 다루기의 모든 것](/posts/js-date-timezone/)

<br>
읽어주셔서 감사합니다. 😊
