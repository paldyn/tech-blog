---
title: "Truthy · Falsy — 조건식에서의 값 판별"
description: "JavaScript의 7가지 falsy 값과 자주 헷갈리는 truthy 값들, 조건식·논리 연산자에서의 활용 패턴과 주의점을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "truthy", "falsy", "조건식", "논리연산자", "단락평가", "??"]
featured: false
draft: false
---

[지난 글](/posts/js-toprimitive/)에서 객체를 원시값으로 변환하는 규칙을 살펴봤습니다. 이번에는 조건식에서 값이 참·거짓으로 판별되는 규칙인 **truthy · falsy**를 정리합니다. 간단한 개념이지만 `[]`, `{}`, `"0"` 같은 헷갈리는 케이스가 실무 버그를 유발합니다.

## Falsy 값 — 딱 7가지

`if (value)` 조건식에서 `false`로 평가되는 값은 정확히 7가지입니다.

```js
// 7가지 falsy
Boolean(false)      // false
Boolean(0)          // false  — 0
Boolean(-0)         // false  — 음수 0
Boolean(0n)         // false  — BigInt 0
Boolean('')         // false  — 빈 문자열
Boolean(null)       // false
Boolean(undefined)  // false
Boolean(NaN)        // false

// 모두 if에서 false
if (false || 0 || -0 || 0n || '' || null || undefined || NaN) {
  // 절대 실행 안 됨
}
```

## Truthy — 나머지 모두

7가지 falsy를 제외한 **모든 값**은 truthy입니다. 자주 헷갈리는 케이스를 정리합니다.

```js
// 헷갈리는 truthy!
Boolean('0')        // true  — 비어있지 않은 문자열
Boolean('false')    // true  — 비어있지 않은 문자열
Boolean(' ')        // true  — 공백 문자열도 truthy
Boolean([])         // true  — 빈 배열도 truthy!
Boolean({})         // true  — 빈 객체도 truthy!
Boolean(-1)         // true  — 0이 아닌 숫자
Boolean(Infinity)   // true
Boolean(-Infinity)  // true
Boolean(function(){}) // true — 함수
```

![Falsy 값 7종과 Truthy 값](/assets/posts/js-truthy-falsy-values.svg)

### document.all — 유일한 falsy 객체

```js
// 역사적 이유로 존재하는 예외
Boolean(document.all) // false (레거시 브라우저 감지용)
typeof document.all   // "undefined" (또 다른 예외!)
// 실무에서는 이 특성을 사용하지 않는 것이 권장됨
```

## 논리 연산자와 단락 평가

논리 연산자는 불리언 값을 반환하지 않습니다. **원래 피연산자 값을 그대로 반환**합니다.

```js
// ||: 첫 번째 truthy 반환, 없으면 마지막 값
'' || 'hello'        // "hello"
0 || 42              // 42
null || undefined    // undefined
1 || 2               // 1  (첫 번째가 truthy)

// &&: 첫 번째 falsy 반환, 없으면 마지막 값
'' && 'hello'        // "" (첫 번째가 falsy)
1 && 2               // 2  (모두 truthy → 마지막)
null && fn()         // null (fn 호출 안 됨)

// ??: null/undefined만 건너뜀 (ES2020)
0 ?? 'default'       // 0   (0은 falsy지만 ?? 기준으로는 valid)
'' ?? 'default'      // ""
null ?? 'default'    // "default"
undefined ?? 'hello' // "hello"
```

## 실전 활용 패턴

```js
// 존재 여부 확인 (null/undefined 포함 모든 falsy)
if (user) { /* user가 있을 때 */ }
if (!error) { /* 에러 없을 때 */ }

// 기본값 — 0과 ""도 falsy이므로 주의
const name = input || '익명';     // input이 "" 또는 0이면 '익명'으로

// 기본값 — null/undefined만 건너뛰고 싶을 때
const port = env.PORT ?? 3000;    // PORT가 0이어도 0을 사용

// 배열 falsy 필터링
const items = [0, 1, '', null, 2, undefined, false, 3];
items.filter(Boolean); // [1, 2, 3]

// 중첩 속성 안전 접근
const role = user && user.profile && user.profile.role;
const role2 = user?.profile?.role; // Optional chaining이 더 명확
```

![Truthy · Falsy 실전 활용 패턴](/assets/posts/js-truthy-falsy-usage.svg)

## 주의해야 할 함정

```js
// ❌ qty가 0일 때 버그 (0은 falsy!)
const qty = cartItem.qty || 1;  // qty=0 → 1로 대체!

// ✅ null/undefined만 체크
const qty = cartItem.qty ?? 1;  // qty=0 → 0 유지

// ❌ 빈 배열이 truthy임을 모를 때
if (!items) { showEmpty(); }   // items=[] 도 통과 안 됨!

// ✅ 배열의 length로 확인
if (items.length === 0) { showEmpty(); }

// ❌ JSX에서 0이 렌더링됨
{count && <List />}             // count=0 → "0" 이 화면에!

// ✅ 명시적 boolean
{count > 0 && <List />}
{!!count && <List />}
{Boolean(count) && <List />}
```

## NaN의 특별한 성질

```js
// NaN은 자기 자신과도 같지 않음
NaN === NaN    // false!
NaN == NaN     // false!

// NaN 판별 방법
Number.isNaN(NaN)        // true  (권장)
Number.isNaN('hello')    // false (문자열은 NaN이 아님)
isNaN('hello')           // true  (전역 isNaN: 변환 후 비교 → 주의!)

// NaN 발생 케이스
0 / 0                    // NaN
parseInt('abc', 10)      // NaN
Math.sqrt(-1)            // NaN
undefined + 1            // NaN
```

## 조건식에서의 형변환 순서

```js
// if 문에서의 동작
// 1. 조건식 평가
// 2. ToBoolean 적용 (Boolean() 함수와 동일)
// 3. true면 then 블록, false면 else 블록

// 삼항 연산자도 동일
const msg = user ? '환영합니다' : '로그인 필요';

// while 루프 조건
while (queue.length) {
  process(queue.shift()); // queue가 비면 종료
}
```

## 정리

- falsy는 딱 7가지: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`
- 나머지 모두 truthy: `"0"`, `"false"`, `[]`, `{}`, 함수, `Infinity`
- `||`: 첫 번째 truthy 반환 (0, ""도 건너뜀)
- `&&`: 첫 번째 falsy 반환, 없으면 마지막 값
- `??`: null/undefined만 건너뜀 (0, ""는 유효한 값으로 처리)
- JSX `{count && ...}`: count가 0이면 "0"이 렌더링 → `count > 0 &&` 사용
- `NaN !== NaN`: NaN 판별에는 `Number.isNaN()` 사용

---

**지난 글:** [Symbol.toPrimitive — 객체의 원시값 변환 제어](/posts/js-toprimitive/)

<br>
읽어주셔서 감사합니다. 😊
