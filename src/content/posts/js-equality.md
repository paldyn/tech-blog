---
title: "동등 비교 완전 정리 — ==, ===, Object.is"
description: "JavaScript의 느슨한 동등(==), 엄격한 동등(===), Object.is()의 차이, 추상 동등 알고리즘의 형변환 규칙, NaN과 -0의 함정, 그리고 올바른 비교 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "동등비교", "==", "===", "Object.is", "NaN", "형변환"]
featured: false
draft: false
---

[지난 글](/posts/js-reference-and-memory/)에서 참조 복사와 값 복사의 차이를 살펴보며 `===`로 객체를 비교하면 참조를 비교한다는 점을 확인했습니다. 이번에는 JavaScript의 세 가지 동등 비교 — `==`, `===`, `Object.is()` — 를 체계적으로 정리합니다.

## == 느슨한 동등 (Abstract Equality)

`==`는 두 값의 타입이 다를 때 **형변환(coercion)**을 시도한 후 비교합니다. ECMAScript 스펙의 추상 동등 비교(Abstract Equality Comparison) 알고리즘이 동작합니다.

핵심 규칙을 요약하면:
1. 타입이 같으면 `===`와 동일하게 비교
2. `null == undefined`는 항상 `true` (특별 규칙)
3. 숫자-문자열: 문자열을 숫자로 변환
4. 불리언-숫자: 불리언을 숫자로 변환 (`true→1`, `false→0`)
5. 객체-원시: `ToPrimitive`로 객체를 원시값으로 변환

```javascript
// 형변환 연쇄의 예: [] == ![]
// ![] → false ([]은 truthy)
// [] == false
// [] → '' → 0, false → 0
// 0 == 0 → true
[] == ![]; // true ← 충격적이지만 맞음
```

![느슨한 동등 == 형변환 규칙 요약](/assets/posts/js-equality-abstract.svg)

## === 엄격한 동등 (Strict Equality)

`===`는 형변환 없이 **타입과 값 모두** 일치해야 `true`를 반환합니다. 두 가지 예외가 있습니다.

- `NaN === NaN`은 `false` (IEEE 754 명세상 NaN은 자기 자신과 같지 않음)
- `+0 === -0`은 `true` (부동소수점의 두 영점을 같다고 취급)

```javascript
1 === 1;       // true
1 === '1';     // false (타입 다름)
NaN === NaN;   // false (예외!)
+0 === -0;     // true  (예외!)
null === null; // true
undefined === undefined; // true
```

이 두 예외가 문제가 되는 상황은 드물지만, 부동소수점 계산 결과가 NaN인지 확인하거나 수학 라이브러리에서 +0과 -0을 구별해야 할 때 `===`만으로는 부족합니다.

## Object.is() — SameValue 알고리즘

`Object.is(a, b)`는 ECMAScript의 SameValue 알고리즘을 구현합니다. `===`와 거의 같지만 NaN과 -0 처리가 다릅니다.

```javascript
Object.is(NaN, NaN);  // true  (=== 와 다름)
Object.is(+0, -0);    // false (=== 와 다름)
Object.is(1, 1);      // true
Object.is(null, null); // true
```

React의 `useState`는 내부적으로 `Object.is`를 사용해 이전 상태와 새 상태를 비교합니다. NaN이 포함된 상태도 올바르게 처리하기 위해서입니다.

![엄격 동등과 Object.is 비교](/assets/posts/js-equality-strict.svg)

## NaN 감지

NaN은 "숫자가 아닌 숫자(Not-a-Number)"로, 유효하지 않은 수학 연산의 결과입니다.

```javascript
0 / 0;           // NaN
parseInt('abc'); // NaN
Math.sqrt(-1);   // NaN
```

NaN을 감지하는 올바른 방법:

```javascript
// ✓ 권장 (형변환 없음)
Number.isNaN(NaN);   // true
Number.isNaN('NaN'); // false (문자열은 NaN이 아님)

// ❌ 함정: 전역 isNaN은 형변환 후 검사
isNaN('NaN');        // true (문자열을 숫자로 변환 후 NaN)
isNaN('hello');      // true (의도치 않게)

// NaN의 자기 비일치를 활용 (고전적 방법)
const val = NaN;
val !== val; // true (NaN만 성립)
```

## -0의 존재

IEEE 754는 +0과 -0을 구별합니다. JavaScript에서는 대부분 구분되지 않지만 몇 가지 상황에서 차이가 납니다.

```javascript
-0 === 0;           // true
-0 === +0;          // true
Object.is(-0, 0);   // false ← 구별 가능

// 문자열화 시 차이
String(-0);         // '0' (음수 부호 사라짐)
(-0).toString();    // '0'

// 나눗셈 결과 부호 확인 시
1 / -0;  // -Infinity
1 / +0;  // +Infinity
```

## 실전 가이드라인

**`===`을 기본으로 사용하세요.** 형변환을 예상하고 명시적으로 원할 때만 `==`를 씁니다.

**`==`가 유용한 유일한 관용구**: `value == null`은 `value === null || value === undefined`의 단축 표현으로, 이 경우에만 `==` 사용이 널리 허용됩니다.

```javascript
// 이것만 == 허용
if (value == null) {
  // value가 null이거나 undefined일 때
}

// 나머지는 모두 ===
if (count === 0) { }
if (name === '') { }
```

ESLint의 `eqeqeq` 규칙(`"error"` 또는 `"allow-null"`)으로 코드베이스 전체에 이 규칙을 강제할 수 있습니다.

---

**지난 글:** [참조와 메모리 — 값 복사 vs 참조 복사](/posts/js-reference-and-memory/)

**다음 글:** [산술·비교·논리 연산자 완전 정복](/posts/js-arithmetic-comparison-logical/)

<br>
읽어주셔서 감사합니다. 😊
