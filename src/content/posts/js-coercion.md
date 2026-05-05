---
title: "암묵적 형변환 — 자동 타입 변환의 규칙"
description: "JavaScript가 연산자나 비교 시 자동으로 타입을 변환하는 규칙(Type Coercion)과 이로 인한 함정, 그리고 예측 가능한 코드를 작성하는 법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "TypeCoercion", "형변환", "암묵적변환", "동등비교", "연산자"]
featured: false
draft: false
---

[지난 글](/posts/js-explicit-conversion/)에서 명시적 형변환 함수들을 정리했습니다. 이번에는 개발자가 의도하지 않아도 엔진이 **자동으로 타입을 바꾸는** 암묵적 형변환(Type Coercion)을 다룹니다. JavaScript의 악명 높은 `[] == false` 같은 결과가 여기서 비롯됩니다.

## 암묵적 형변환이 발생하는 상황

암묵적 형변환은 주로 세 가지 상황에서 발생합니다.

```js
// 1. 이진 + 연산자
1 + '2'   // "12" — 문자열 연결

// 2. 산술 연산자 (-, *, /, %)
'6' - 2   // 4 — 문자열 → 숫자

// 3. 느슨한 비교 ==
0 == false   // true — 타입 변환 후 비교
```

## + 연산자: 덧셈 vs 문자열 연결

`+` 연산자는 JavaScript에서 가장 복잡한 연산자입니다. 피연산자 중 하나라도 문자열이면 **문자열 연결**이 되고, 그렇지 않으면 숫자 덧셈입니다.

```js
1 + 2         // 3
'1' + 2       // "12" — 숫자가 문자열로 변환
1 + '2'       // "12"
1 + true      // 2  (true → 1)
1 + false     // 1  (false → 0)
1 + null      // 1  (null → 0)
1 + undefined // NaN (undefined → NaN)
1 + []        // "1" ([] → "" → 문자열 연결)
1 + {}        // "1[object Object]"
[] + []       // ""
[] + {}       // "[object Object]"
```

![암묵적 형변환 — + 연산자 규칙](/assets/posts/js-coercion-rules.svg)

### {} + [] 의 미스터리

```js
// REPL에서 실행 시
{} + []    // 0  ← {} 가 블록문으로 파싱됨!

// 변수에 할당하거나 괄호로 감싸면
({}) + []  // "[object Object]"
const r = {} + [];  // "[object Object]"
```

문장의 시작에 `{}`가 오면 JavaScript 파서가 빈 블록문으로 해석합니다. 이후 `+[]`는 단항 `+`로 배열을 숫자로 변환 → `+""` → `0`이 됩니다.

## - * / % — 항상 숫자 변환

덧셈을 제외한 산술 연산자는 피연산자를 **항상 숫자로 변환**합니다.

```js
'6' - 2    // 4  ("6" → 6)
'6' * 2    // 12
'6' / 2    // 3
true - 1   // 0  (true → 1)
null - 1   // -1 (null → 0)
'abc' - 1  // NaN ("abc" → NaN)
[] - 1     // -1 ([] → 0)
```

## 느슨한 비교 == 와 형변환

`==`(추상 동등 비교)는 타입이 다르면 변환 규칙을 적용합니다. `===`(엄격 동등 비교)는 변환 없이 타입과 값을 모두 비교합니다.

```js
// == 형변환 규칙
0 == false      // true (false → 0)
'' == false     // true ('' → 0, false → 0)
0 == ''         // true ('' → 0)
0 == '0'        // true ('0' → 0)
null == undefined // true (특별 규칙)
null == 0       // false (null은 null/undefined만 ==)
[] == false     // true ([] → '' → 0, false → 0)
[] == ![]       // true (![] = false, [] → 0, false → 0)

// 이상한 결과들
'1' == true  // true ('1' → 1, true → 1)
'2' == true  // false ('2' → 2, true → 1)
```

![비교 연산자와 암묵적 형변환 흐름](/assets/posts/js-coercion-operators.svg)

## == 변환 알고리즘 (요약)

1. 타입이 같으면 `===`와 동일하게 비교
2. `null == undefined` → `true` (그 외 null/undefined는 false)
3. number vs string → string을 `Number()`로 변환
4. boolean 포함 → boolean을 `Number()`로 변환 후 재비교
5. object vs primitive → object를 `ToPrimitive()`로 변환 후 재비교

```js
// 실전 == 쓰기 좋은 경우: null/undefined 동시 체크
function process(value) {
  if (value == null) {  // null 또는 undefined
    return defaultValue;
  }
  // ...
}

// 나머지는 항상 === 사용
```

## 관계 연산자 <, >, <=, >=

```js
// 둘 다 문자열이면 사전순 비교
'10' < '9'   // true! ('1' < '9' 사전순)

// 하나라도 숫자면 숫자 변환
10 < '9'     // false (10 < 9는 false)
'10' < 9     // false

// 날짜 비교 시 숫자로 변환
new Date('2024-01-01') < new Date('2024-12-31') // true
```

## 논리 연산자의 단락 평가

```js
// || : 첫 번째 truthy 반환
'' || 'default'      // "default"
0 || 42              // 42
null || 'fallback'   // "fallback"
'hello' || 'world'   // "hello"

// && : 첫 번째 falsy 반환, 없으면 마지막 값
'' && 'something'    // ""
1 && 2               // 2
null && fn()         // null (fn() 호출 안 됨)

// ?? : null/undefined만 체크 (ES2020)
0 ?? 'default'       // 0 (0은 falsy지만 null/undefined 아님)
'' ?? 'default'      // "" 
null ?? 'default'    // "default"
undefined ?? 'hello' // "hello"
```

`||`와 `??`의 차이가 중요합니다. `||`는 모든 falsy를 체크하지만, `??`는 `null`과 `undefined`만 체크합니다.

## 템플릿 리터럴에서의 형변환

```js
// 템플릿 리터럴은 내부적으로 String() 호출
const n = 42;
`값: ${n}`      // "값: 42"
`값: ${null}`   // "값: null"
`값: ${{}}`     // "값: [object Object]"
`값: ${[1,2]}`  // "값: 1,2"

// toString()이 정의된 객체는 그것을 사용
const obj = { toString() { return 'custom'; } };
`${obj}`  // "custom"
```

## 실무 권장 사항

```js
// 1. 항상 === 사용 (ESLint eqeqeq 규칙 활성화)
// 예외: null/undefined 동시 체크 시 == null

// 2. + 연산 시 타입 명확히 하기
const total = Number(price) + Number(tax); // 숫자임을 보장
const label = String(count) + ' items';   // 문자열임을 보장

// 3. ?? 로 기본값 설정 (||보다 정확)
const port = config.port ?? 3000;  // 0도 유효한 값으로 처리

// 4. 관계 연산자 사용 시 숫자 변환 보장
const nums = ['10', '9', '100'];
nums.sort((a, b) => Number(a) - Number(b)); // [9, 10, 100]
// 기본 sort(): ['10', '100', '9'] (사전순)
```

## 정리

- `+`: 문자열이 있으면 연결, 없으면 숫자 덧셈. `{}+[]` 파싱 주의
- `- * / %`: 항상 숫자 변환 (더 예측 가능)
- `==`: 복잡한 변환 규칙 → 실무에서 `===` 권장
- `==`의 예외: `null == undefined` → true, `null == 0` → false
- `||` vs `??`: `||`는 모든 falsy, `??`는 null/undefined만
- 관계 연산자: 두 값 모두 문자열이면 사전순 비교 → 명시적 숫자 변환 필요

---

**지난 글:** [명시적 형변환 — Number, String, Boolean](/posts/js-explicit-conversion/)

**다음 글:** [Symbol.toPrimitive — 객체의 원시값 변환 제어](/posts/js-toprimitive/)

<br>
읽어주셔서 감사합니다. 😊
