---
title: "명시적 형변환 — Number, String, Boolean"
description: "Number(), parseInt(), String(), Boolean() 등 JavaScript의 명시적 형변환 함수들의 동작 규칙과 함정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "형변환", "Number", "parseInt", "String", "Boolean", "타입변환"]
featured: false
draft: false
---

[지난 글](/posts/js-typeof-instanceof-limits/)에서 타입 판별 연산자의 한계를 살펴봤습니다. 이번에는 개발자가 **의도적으로** 값의 타입을 바꾸는 명시적 형변환(explicit type conversion)을 다룹니다. 암묵적 형변환과 달리, 명시적 변환은 코드를 읽는 사람에게 "여기서 타입이 바뀐다"는 신호를 줍니다.

## Number() — 엄격한 숫자 변환

`Number()`는 값을 숫자로 변환하며, 변환이 불가능하면 `NaN`을 반환합니다.

```js
Number('42')       // 42
Number('3.14')     // 3.14
Number('42px')     // NaN  — 숫자로 시작해도 뒤에 문자가 있으면
Number('')         // 0    — 빈 문자열은 0
Number('  ')       // 0    — 공백만 있는 문자열도 0
Number(null)       // 0    — null → 0
Number(undefined)  // NaN  — undefined → NaN
Number(true)       // 1
Number(false)      // 0
Number([])         // 0    — 빈 배열 → ""→ 0
Number([1])        // 1    — 원소 1개 배열 → 해당 값
Number([1, 2])     // NaN  — 원소 2개 이상 배열
```

`Number()`는 입력 전체가 유효한 숫자 표현이어야 변환합니다. `"42px"`처럼 숫자가 아닌 문자가 섞이면 `NaN`을 반환합니다.

![명시적 형변환 — 변환 함수 총정리](/assets/posts/js-explicit-conversion-methods.svg)

## parseInt() 와 parseFloat()

`parseInt()`와 `parseFloat()`는 문자열을 **왼쪽부터 파싱**해 숫자를 추출합니다. 숫자가 아닌 문자를 만나면 파싱을 멈춥니다.

```js
parseInt('42px', 10)    // 42  — 뒤의 'px' 무시
parseInt('3.14', 10)    // 3   — 정수만 반환
parseFloat('3.14em')    // 3.14 — 소수점 지원, 뒤 무시
parseFloat('')          // NaN — 빈 문자열은 NaN
parseInt('0xFF', 16)    // 255 — 16진수 파싱
parseInt('  42  ', 10)  // 42  — 앞 공백 무시
```

**중요**: `parseInt`의 두 번째 인자는 **기수(radix)** 입니다. 항상 명시하세요.

```js
// ❌ radix 미명시 — 엔진에 따라 다름 (ES3 이전: "0" 시작은 8진수)
parseInt('010')  // 8 또는 10 (구현마다 다름)

// ✅ 항상 명시
parseInt('010', 10) // 10
parseInt('010', 8)  // 8
```

### [1,2,3].map(parseInt) 함정

```js
// ❌ 유명한 함정
[1, 2, 3].map(parseInt)  // [1, NaN, NaN]

// 이유: map 콜백은 (value, index, array) 세 인자를 전달
// parseInt(1, 0)  → 1  (radix 0은 10으로 처리)
// parseInt(2, 1)  → NaN (radix 1은 유효하지 않음)
// parseInt(3, 2)  → NaN (2진수에서 '3'은 유효하지 않음)

// ✅ 해결
[1, 2, 3].map((n) => parseInt(n, 10))  // [1, 2, 3]
[1, 2, 3].map(Number)                  // [1, 2, 3]
```

![Number vs parseInt vs parseFloat 비교](/assets/posts/js-explicit-conversion-results.svg)

## String() — 문자열 변환

```js
String(42)          // "42"
String(3.14)        // "3.14"
String(null)        // "null"
String(undefined)   // "undefined"
String(true)        // "true"
String(false)       // "false"
String([1, 2, 3])   // "1,2,3"
String({})          // "[object Object]"

// 숫자 → 문자열 포맷 옵션
(255).toString(16)    // "ff"   — 16진수
(8).toString(2)       // "1000" — 2진수
(3.14159).toFixed(2)  // "3.14" — 소수점 자리수
(1234567).toLocaleString('ko-KR') // "1,234,567"

// ⚠ 리터럴에 직접 .toString() 호출 시 SyntaxError
// 42.toString() — SyntaxError (점이 소수점으로 파싱)
// 해결:
(42).toString()     // OK
let n = 42;
n.toString()        // OK
```

## Boolean() — 진리값 변환

JavaScript에는 **7가지 falsy 값**이 있고, 그 외 모든 값은 truthy입니다.

```js
// 7가지 falsy
Boolean(false)      // false
Boolean(0)          // false
Boolean(-0)         // false
Boolean(0n)         // false (BigInt 0)
Boolean('')         // false
Boolean(null)       // false
Boolean(undefined)  // false
Boolean(NaN)        // false

// 자주 헷갈리는 truthy
Boolean('0')        // true  — 비어있지 않은 문자열
Boolean('false')    // true  — 비어있지 않은 문자열
Boolean([])         // true  — 빈 배열도 truthy
Boolean({})         // true  — 빈 객체도 truthy
```

## 이중 부정(!!)으로 Boolean 변환

`!!`는 `Boolean()`과 동일하게 동작하는 관용적 표현입니다.

```js
!!0         // false
!!''        // false
!!'hello'   // true
!![]        // true
!!null      // false

// 실용적 활용
function hasValue(v) {
  return !!v; // Boolean(v)와 동일
}
```

## 산술 연산자를 이용한 변환 관용구

```js
// 문자열 → 숫자: 단항 +
+'42'      // 42
+'3.14'    // 3.14
+''        // 0
+null      // 0
+undefined // NaN

// 숫자 → 정수: 비트 OR
3.9 | 0    // 3  — Math.trunc()와 유사
-3.9 | 0   // -3

// 숫자 → 정수: ~~(이중 비트 NOT)
~~3.9   // 3
~~-3.9  // -3
```

단항 `+`는 `Number()`와 동일하게 동작하지만, 코드 가독성을 위해 명시적 `Number()`를 선호하는 팀이 많습니다.

## 정리

- `Number()`: 전체 문자열이 유효해야 변환. 비유효 → NaN. 빈문자열/null → 0
- `parseInt(str, radix)`: 왼쪽부터 파싱, 정수만, radix 항상 명시
- `parseFloat(str)`: 왼쪽부터 파싱, 소수점 포함
- `String()`: 모든 값을 문자열로. null → "null", undefined → "undefined"
- `Boolean()`: 7가지 falsy 외 모두 true. `[]`, `{}` 는 truthy
- `[].map(parseInt)` 함정: map이 index를 radix로 전달 → 항상 래퍼 함수 사용

---

**지난 글:** [typeof · instanceof의 한계와 올바른 타입 판별](/posts/js-typeof-instanceof-limits/)

**다음 글:** [암묵적 형변환 — 자동 타입 변환의 규칙](/posts/js-coercion/)

<br>
읽어주셔서 감사합니다. 😊
