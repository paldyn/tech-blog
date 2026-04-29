---
title: "숫자 구분자 (Numeric Separator)"
description: "ES2021 숫자 구분자(_)를 사용해 큰 숫자 리터럴의 가독성을 높이는 방법과 허용 규칙, 주의사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ES2021", "숫자", "가독성", "리터럴", "Numeric Separator"]
featured: false
draft: false
---

[지난 글](/posts/js-logical-assignment/)에서 논리 할당 연산자를 살펴봤습니다. 이번에는 같은 ES2021 스펙에 포함된 **숫자 구분자(Numeric Separator)**를 다룹니다. 기능 자체는 단순하지만, 대규모 수치를 다루는 코드에서 실수를 줄이는 데 의외로 큰 역할을 합니다.

## 숫자 구분자란?

숫자 리터럴 내부에 밑줄 `_`을 구분자로 삽입할 수 있는 문법입니다. 이 밑줄은 **런타임에 완전히 무시**되며, 값 자체에는 아무런 영향을 주지 않습니다.

```javascript
const million = 1_000_000;
console.log(million); // 1000000
console.log(1_000_000 === 1000000); // true
```

변수 이름에 쓰는 `_`와는 다릅니다. 변수 이름의 `_`는 식별자 문자이지만, 숫자 리터럴 내부의 `_`는 순수 시각적 분리 역할입니다.

## 모든 숫자 리터럴 형식에서 사용 가능

![숫자 구분자 가독성 비교](/assets/posts/js-numeric-separator-readability.svg)

10진수뿐만 아니라 16진수, 8진수, 2진수, 소수, BigInt 모두에 사용할 수 있습니다.

```javascript
// 10진수
const budget = 1_000_000_000;

// 16진수 (색상값, 주소 등)
const color = 0xFF_EC_D8;
const addr  = 0xDEAD_BEEF;

// 2진수 (비트 마스크)
const flags = 0b1101_0111;
const byte  = 0b0000_0001;

// 8진수
const perm = 0o755;       // 구분자 없어도 짧음

// BigInt
const bigNum = 9_007_199_254_740_991n;

// 소수
const pi = 3.141_592_653_589_793;
```

## 사용 규칙

![숫자 구분자 사용 규칙](/assets/posts/js-numeric-separator-rules.svg)

`_`를 어디에나 쓸 수 있는 건 아닙니다. 몇 가지 규칙이 있습니다.

```javascript
// 허용: 숫자 사이 어디든
1_000_000
0xFF_00
3.14_159

// SyntaxError: 맨 앞/맨 뒤
_1000     // 식별자로 해석됨
1000_     // SyntaxError

// SyntaxError: 연속 사용
1__000    // SyntaxError

// SyntaxError: 소수점 앞뒤
3._14     // SyntaxError
3_.14     // SyntaxError

// SyntaxError: 접두어(0x, 0b, 0o) 직후
0x_FF     // SyntaxError
```

## 문자열 변환 시 제거됨

`Number()`, `parseInt()` 같은 변환 함수는 문자열을 입력으로 받습니다. `_`가 포함된 문자열은 올바르게 파싱되지 않습니다.

```javascript
// 숫자 리터럴 → 그냥 사용
const n = 1_000;             // OK

// 문자열 → 함수 변환은 안 됨
Number('1_000');             // NaN
parseInt('1_000');           // 1  ← 1에서 파싱 멈춤

// JSON에도 사용 불가
JSON.parse('{"n": 1_000}'); // SyntaxError
```

사용자 입력값이나 외부 데이터를 파싱할 때는 `_`를 제거한 뒤 변환해야 합니다.

## 실전 활용

숫자 구분자가 특히 빛나는 곳은 다음과 같습니다.

```javascript
// 재무/통계 상수
const GDP_KR = 1_721_000_000_000_000; // 조 단위

// 비트 마스크
const READ  = 0b0000_0100;
const WRITE = 0b0000_0010;
const EXEC  = 0b0000_0001;

// 초/밀리초 단위 타임아웃
const ONE_HOUR_MS = 3_600_000;

// 암호/해시 관련 상수
const PBKDF2_ITERATIONS = 100_000;
```

단 하나의 문자 `_`만으로도 열 자리 이상의 숫자를 즉시 파악할 수 있게 됩니다.

---

**지난 글:** [논리 할당 연산자 (&&=, ||=, ??=)](/posts/js-logical-assignment/)

**다음 글:** [최상위 await (Top-level await)](/posts/js-top-level-await/)

<br>
읽어주셔서 감사합니다. 😊
