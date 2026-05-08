---
title: "NaN과 특수 숫자값 비교 — 자기 자신과 같지 않은 값"
description: "NaN의 고유한 비교 동작, -0과 Infinity의 특성, isNaN vs Number.isNaN 차이, Object.is를 활용한 정확한 판별 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "NaN", "특수값", "Number.isNaN", "Object.is", "-0", "Infinity"]
featured: false
draft: false
---

[지난 글](/posts/js-truthy-falsy/)에서 조건식에서 값이 참·거짓으로 판별되는 규칙을 살펴봤습니다. 이번에는 JavaScript의 숫자 타입이 가진 특이한 값들 — NaN, -0, Infinity — 의 비교 동작을 파고듭니다. 이 값들은 일반적인 `===` 비교에서 기대와 다르게 동작하며, 올바른 판별 방법을 모르면 조용한 버그가 생깁니다.

---

## NaN이란

NaN은 "Not a Number"의 약자이지만, `typeof NaN === 'number'`입니다. 이름과 타입이 모순처럼 보이지만, IEEE 754 명세에서 정의한 특수 비트 패턴으로 "수치 연산이 유효한 수를 만들어내지 못했다"는 의미를 나타냅니다.

```javascript
typeof NaN;        // "number"
0 / 0;             // NaN
Math.sqrt(-1);     // NaN
parseInt('abc');   // NaN
Number(undefined); // NaN
```

NaN이 발생하는 상황은 크게 세 가지입니다: 0을 0으로 나누기, 음수의 제곱근처럼 실수 범위를 벗어나는 연산, 숫자로 변환할 수 없는 값의 변환.

---

## 자기 자신과 같지 않다

NaN의 가장 놀라운 특성은 **자기 자신과의 비교가 `false`**라는 것입니다. IEEE 754 표준이 의도적으로 그렇게 정의했습니다.

```javascript
const a = 0 / 0; // NaN

a === a; // false  ← NaN의 유일한 특수성
a == a;  // false
a !== a; // true   ← NaN 판별에 활용 가능

NaN === NaN; // false
NaN == NaN;  // false
```

이 동작 덕분에 `x !== x`라는 표현식이 `true`이면 `x`는 반드시 NaN입니다. 이는 과거 `isNaN`이 없던 시절 사용하던 트릭이지만, 지금은 더 명시적인 방법을 사용합니다.

---

## isNaN vs Number.isNaN

전역 `isNaN()`과 `Number.isNaN()`은 동작이 다릅니다. 전역 버전은 먼저 인수를 숫자로 강제 변환한 뒤 판별합니다.

```javascript
// 전역 isNaN — 강제 변환 후 판별
isNaN('abc');       // true  ← 'abc' → NaN 변환 후 판별
isNaN(undefined);   // true  ← undefined → NaN
isNaN('');          // false ← '' → 0
isNaN(null);        // false ← null → 0
isNaN(true);        // false ← true → 1

// Number.isNaN — 변환 없이 NaN인지만 판별
Number.isNaN('abc');       // false
Number.isNaN(undefined);   // false
Number.isNaN(NaN);         // true ✓
Number.isNaN(0 / 0);       // true ✓
```

실무에서는 `Number.isNaN()`을 사용하는 것이 원칙입니다. 전역 `isNaN()`은 문자열을 넘겨도 `true`가 나올 수 있어 오탐(false positive)이 발생합니다.

---

## -0과 Object.is

JavaScript에는 양의 0(`+0`)과 음의 0(`-0`)이 존재합니다. `===` 연산자는 이 둘을 같다고 판별하지만, `Object.is()`는 구분합니다.

![NaN 비교 동작](/assets/posts/js-nan-comparison-behavior.svg)

```javascript
+0 === -0; // true  ← === 는 구분 못함
Object.is(+0, -0); // false ← 구분함

(-0).toString();       // "0"  ← 문자열 변환 시 부호 소실
JSON.stringify(-0);    // "0"

// 방향이 중요한 계산에서 -0이 의미를 가질 수 있음
1 / +0; // Infinity
1 / -0; // -Infinity
```

물리 시뮬레이션이나 그래픽 연산처럼 방향이 중요한 맥락에서 -0을 정확히 판별해야 한다면 `Object.is()`를 사용합니다.

---

## 특수값 비교 한눈에 보기

![특수 숫자값 비교표](/assets/posts/js-nan-comparison-special-values.svg)

표에서 볼 수 있듯이 연산자마다 동작이 다릅니다. 정리하면:

- **`===`**: NaN은 자기 자신과 `false`, -0과 +0은 `true`
- **`Object.is()`**: NaN은 `true`, -0과 +0은 `false` — 가장 엄격
- **`isNaN()`**: 강제 변환 후 판별, 오탐 위험
- **`Number.isNaN()`**: 변환 없이 NaN만 정확히 판별
- **`Number.isFinite()`**: NaN·Infinity 모두 `false`

---

## NaN 전파와 실무 패턴

NaN은 전파(contagion) 특성이 있습니다. 한번 계산에 NaN이 섞이면 결과도 NaN이 됩니다.

```javascript
NaN + 1;           // NaN
NaN * 0;           // NaN
Math.max(1, NaN, 3); // NaN
[1, NaN, 3].reduce((a, b) => a + b, 0); // NaN

// 배열에서 NaN 포함 여부 확인
const arr = [1, NaN, 3];
arr.includes(NaN);         // true  ← includes는 Object.is 기반
arr.indexOf(NaN);          // -1   ← indexOf는 === 기반
arr.findIndex(Number.isNaN); // 1  ✓
arr.some(Number.isNaN);    // true ✓
```

`Array.prototype.includes`는 내부적으로 `Object.is()`와 동등한 비교를 사용하므로 NaN도 찾을 수 있지만, `indexOf`는 `===` 기반이라 NaN을 찾지 못합니다.

---

## 입력 유효성 검사 패턴

사용자 입력이나 외부 API 응답에서 숫자를 파싱할 때 NaN이 나올 수 있습니다.

```javascript
function parsePositiveNumber(input) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) {
    throw new RangeError(`유효한 양수가 아님: ${input}`);
  }
  return n;
}

// API 응답에서 안전하게 숫자 사용
function safeAverage(values) {
  const nums = values.filter(Number.isFinite);
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
```

`Number.isFinite()`는 `Number.isNaN()`과 `!isInfinity` 두 검사를 한 번에 수행합니다. 일반적인 숫자 유효성 검사에는 `Number.isFinite()`를 쓰는 것이 더 간결합니다.

---

## 요약

| 목적 | 권장 방법 |
|------|-----------|
| NaN인지 확인 | `Number.isNaN(x)` |
| 유한한 숫자인지 확인 | `Number.isFinite(x)` |
| -0과 +0 구분 | `Object.is(x, -0)` |
| 두 NaN이 같은지 확인 | `Object.is(x, y)` |
| 배열에서 NaN 검색 | `arr.includes(NaN)` |
| 배열에서 NaN 위치 | `arr.findIndex(Number.isNaN)` |

---

**지난 글:** [Truthy · Falsy — 조건식에서의 값 판별](/posts/js-truthy-falsy/)

**다음 글:** [배열 메서드 총람 — 순회·변환·검색·집계](/posts/js-array-methods-overview/)

<br>
읽어주셔서 감사합니다. 😊
