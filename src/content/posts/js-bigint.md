---
title: "BigInt — 안전한 정수 범위를 넘어서"
description: "JavaScript BigInt의 탄생 배경, Number.MAX_SAFE_INTEGER 한계, 리터럴 문법, 연산 규칙, JSON 직렬화 패턴, 그리고 실전 사용 시나리오를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "bigint", "number", "정수", "암호화", "64비트", "원시타입"]
featured: false
draft: false
---

[지난 글](/posts/js-number-ieee754/)에서 IEEE 754 부동소수점의 한계, 특히 `Number.MAX_SAFE_INTEGER`(2⁵³ − 1)를 넘는 정수가 정확하게 표현되지 않는 문제를 살펴봤습니다. BigInt는 바로 이 공백을 메우기 위해 ES2020에 도입된 원시 타입입니다. 64비트 DB 식별자, 암호화 알고리즘의 256비트 정수, 블록체인 해시처럼 `number`로는 감당할 수 없는 값을 정확히 다룰 수 있습니다.

## 왜 BigInt가 필요한가

`number`는 IEEE 754 배정밀도 포맷으로 53비트 정수를 정확히 표현합니다. 이 범위를 조금이라도 벗어나는 순간 값이 뭉개집니다.

```javascript
// 안전 범위 초과 시 정밀도 손실
9007199254740992 + 1;  // 9007199254740992 (같은 값!)
9007199254740993;      // 9007199254740992 로 저장됨

// Twitter/X Snowflake ID처럼 64비트 정수를 JSON으로 받으면
JSON.parse('{"id": 9223372036854775807}');
// { id: 9223372036854776000 } ← 이미 틀림
```

데이터베이스가 64비트 정수 ID를 사용하는 시스템에서 이 손실은 치명적입니다. BigInt는 메모리가 허용하는 한 임의 크기의 정수를 정확히 표현합니다.

## BigInt 생성 문법

BigInt를 만드는 방법은 두 가지입니다.

```javascript
// 1. 리터럴: 숫자 뒤에 n 접미사
const a = 42n;
const b = 9007199254740993n; // MAX_SAFE_INTEGER + 2

// 2. 생성자: 문자열 또는 정수로
const c = BigInt(42);
const d = BigInt("9223372036854775807"); // 문자열로 큰 값 안전하게

// 16진수, 8진수, 2진수 리터럴도 지원
const hex = 0x1fn;    // 31n
const oct = 0o77n;    // 63n
const bin = 0b1010n;  // 10n
```

`typeof 42n`은 `"bigint"`를 반환합니다. BigInt는 `number`와 별개의 원시 타입입니다.

![BigInt vs Number 표현 범위](/assets/posts/js-bigint-structure.svg)

## 산술 연산 규칙

BigInt는 `+`, `-`, `*`, `**`, `/`, `%` 모두 지원합니다. 단, **나눗셈은 항상 정수 나눗셈**이고, `number`와 **혼합 연산은 TypeError**를 던집니다.

```javascript
const x = 10n;
const y = 3n;

x + y;   // 13n
x - y;   // 7n
x * y;   // 30n
x ** 2n; // 100n
x / y;   // 3n  ← 소수점 버림 (Math.floor 아님, 0 방향 절삭)
x % y;   // 1n

// 혼합 불가 — 명시적 변환 필요
x + 1;         // TypeError: Cannot mix BigInt and other types
Number(x) + 1; // 11 (BigInt → Number 변환)
x + 1n;        // 11n (BigInt끼리 연산)
```

단항 `+` 연산자는 BigInt에 사용할 수 없습니다(`+42n`은 TypeError). `++`, `--`는 사용 가능합니다.

## 비교와 동등 연산

느슨한 동등(`==`)은 암묵적 형변환이 발생해 `1n == 1`이 `true`지만, 엄격한 동등(`===`)은 타입이 달라 `false`입니다.

```javascript
1n == 1;    // true  (타입 강제 변환)
1n === 1;   // false (타입 다름)
1n < 2;     // true  (비교는 형변환 허용)
2n > 1;     // true
```

`Math.max()`, `Math.min()` 같은 `Math` 객체의 메서드는 BigInt를 지원하지 않습니다.

## JSON 직렬화

`JSON.stringify`는 BigInt를 직렬화하지 못하고 TypeError를 발생시킵니다. `replacer` 함수로 처리해야 합니다.

```javascript
const data = { id: 9223372036854775807n, name: "Alice" };

// 기본: TypeError
JSON.stringify(data); // TypeError: Do not know how to serialize a BigInt

// 해결: replacer 활용
const json = JSON.stringify(data, (key, value) =>
  typeof value === 'bigint' ? value.toString() : value
);
// '{"id":"9223372036854775807","name":"Alice"}'

// 파싱 시 reviver 활용
const parsed = JSON.parse(json, (key, value) =>
  key === 'id' ? BigInt(value) : value
);
// { id: 9223372036854775807n, name: 'Alice' }
```

API 경계에서 64비트 정수를 주고받을 때 이 패턴을 표준화해두면 정밀도 손실 없이 안전하게 처리할 수 있습니다.

![BigInt 사용 시나리오와 주의사항](/assets/posts/js-bigint-usecases.svg)

## 실전 사용 시나리오

**64비트 DB 식별자**: PostgreSQL의 `bigserial`, MySQL의 `BIGINT UNSIGNED`, MongoDB의 ObjectId 등을 JavaScript에서 안전하게 처리할 때 BigInt가 필수입니다.

**암호화**: RSA 공개키 암호화, 타원 곡선 암호화에서 256~4096비트의 정수 연산이 필요합니다. `crypto` 모듈과 함께 사용하거나, Web Crypto API 결과를 BigInt로 변환해 다룰 수 있습니다.

**블록체인 / 스마트 컨트랙트 ABI 파싱**: Ethereum의 `uint256` 타입은 256비트 정수입니다. ethers.js나 viem 같은 라이브러리가 내부적으로 BigInt를 활용합니다.

```javascript
// 비트 연산도 지원
const flags = 0b1010n;
const mask  = 0b1100n;
flags & mask;  // 0b1000n = 8n
flags | mask;  // 0b1110n = 14n
flags ^ mask;  // 0b0110n = 6n
~flags;        // -11n
flags << 2n;   // 0b101000n = 40n
flags >> 1n;   // 0b0101n = 5n
```

비트 시프트 연산자의 피연산자도 반드시 BigInt여야 합니다(`flags << 2`는 TypeError).

## 성능 주의

BigInt 연산은 `number` 연산보다 훨씬 느립니다. V8 엔진 기준으로 단순 덧셈도 수십 배 느릴 수 있습니다. `number`의 안전 범위 내에서는 BigInt를 쓰지 않고, 정말 필요한 경우에만 사용해야 합니다.

---

**지난 글:** [number의 IEEE 754 정밀도와 함정](/posts/js-number-ieee754/)

**다음 글:** [string과 유니코드 완전 해부](/posts/js-string-unicode/)

<br>
읽어주셔서 감사합니다. 😊
