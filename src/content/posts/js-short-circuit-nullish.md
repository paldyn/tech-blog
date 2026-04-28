---
title: "단락 평가, Nullish 병합, 논리 대입 연산자"
description: "JavaScript 단락 평가(&&, ||)의 반환값 동작, Nullish 병합 연산자(??)와 ||의 차이, 논리 대입(&&=, ||=, ??=) 연산자의 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "단락평가", "nullish", "??", "&&=", "||=", "??=", "논리연산자"]
featured: false
draft: false
---

[지난 글](/posts/js-arithmetic-comparison-logical/)에서 논리 연산자가 단락 평가 후 값을 반환한다는 점을 소개했습니다. 이번에는 이 단락 평가의 동작 원리를 깊이 파고들고, ES2020에 추가된 Nullish 병합 연산자(`??`)와 ES2021의 논리 대입 연산자(`&&=`, `||=`, `??=`)까지 함께 다룹니다.

## 단락 평가 (Short-Circuit Evaluation)

JavaScript의 `&&`와 `||`는 왼쪽 피연산자를 평가한 결과에 따라 오른쪽 평가를 완전히 건너뜁니다. 이를 **단락(short-circuit)** 이라 합니다. 그리고 결과를 불리언으로 변환하지 않고 **마지막으로 평가된 값**을 그대로 반환합니다.

```javascript
// && : 왼쪽이 truthy면 오른쪽 반환, falsy면 왼쪽 반환
'hello' && 42;      // 42  (왼쪽 truthy → 오른쪽)
null && 42;         // null (왼쪽 falsy → 단락)
0 && 'text';        // 0   (왼쪽 falsy → 단락)

// || : 왼쪽이 truthy면 왼쪽 반환, falsy면 오른쪽 반환
'hello' || 'default'; // 'hello'
null || 'default';    // 'default'
0 || 'default';       // 'default' (0은 falsy)
```

오른쪽이 **부작용(side effect)**이 있을 때 단락이 중요합니다.

```javascript
let count = 0;
false && count++;
console.log(count); // 0 (오른쪽 평가 자체가 일어나지 않음)

true && count++;
console.log(count); // 1
```

## || 의 기본값 함정

`||`는 0, 빈 문자열, false 같은 **falsy 값**을 모두 "없는 것"으로 취급합니다. 이 때문에 유효한 값을 실수로 덮어쓰는 버그가 발생합니다.

```javascript
// port가 0이면 3000으로 잘못 대체됨!
const port = config.port || 3000;
// config.port = 0 → port = 3000 (버그!)

// count가 0이면 10으로 잘못 대체됨!
const count = options.count || 10;
// options.count = 0 → count = 10 (버그!)
```

## ?? Nullish 병합 연산자 (ES2020)

`??`는 왼쪽이 `null` 또는 `undefined`일 때만 오른쪽을 반환합니다. 0, '', false는 유효한 값으로 그대로 통과시킵니다.

```javascript
0 ?? 'default';       // 0   (0은 nullish가 아님)
'' ?? 'default';      // ''  (빈 문자열 유지)
false ?? 'default';   // false
null ?? 'default';    // 'default' (null이므로 교체)
undefined ?? 'default'; // 'default'
```

이제 포트 번호 예시가 올바르게 동작합니다.

```javascript
const port = config.port ?? 3000;
// config.port = 0  → port = 0  ✓
// config.port = null → port = 3000 ✓
// config.port = undefined → port = 3000 ✓
```

![|| vs ?? falsy vs nullish 비교](/assets/posts/js-short-circuit-nullish-comparison.svg)

## ?? 와 && / || 혼합 — 괄호 필수

`??`를 `&&`나 `||`와 괄호 없이 혼합하면 SyntaxError가 발생합니다. JavaScript 파서가 우선순위 모호성을 차단하기 위해 명시적 괄호를 요구합니다.

```javascript
// SyntaxError
a ?? b || c;
a ?? b && c;

// 괄호로 해결
(a ?? b) || c;
a ?? (b || c);
```

## 논리 대입 연산자 (ES2021)

논리 대입은 논리 연산자와 대입을 결합합니다. 단락 평가가 적용되므로 오른쪽이 실제로 필요할 때만 평가됩니다.

**`&&=`**: 왼쪽이 truthy일 때만 오른쪽을 대입

```javascript
let user = { name: 'Alice', active: true };
user.active &&= false; // active가 truthy → false로 갱신
user.active;           // false
```

**`||=`**: 왼쪽이 falsy일 때만 오른쪽을 대입

```javascript
let name = '';
name ||= '익명'; // ''는 falsy → '익명' 대입
name;            // '익명'

let count = 0;
count ||= 10;    // 0은 falsy → 10 대입 (주의!)
```

**`??=`**: 왼쪽이 null 또는 undefined일 때만 오른쪽을 대입

```javascript
let a = 0;
a ??= 99; // 0은 nullish가 아님 → 변화 없음
a;        // 0 ✓

let b = null;
b ??= 99; // null은 nullish → 99 대입
b;        // 99
```

`??=`는 객체 기본값 초기화에 매우 유용합니다.

```javascript
function configure(options = {}) {
  options.timeout ??= 5000;
  options.retries ??= 3;
  options.verbose ??= false;
  return options;
}
```

기존 값이 있으면 그대로 두고, null/undefined인 경우에만 기본값을 채웁니다.

![단락 평가 실전 패턴](/assets/posts/js-short-circuit-nullish-patterns.svg)

## 실전 선택 가이드

| 상황 | 권장 연산자 |
|------|-------------|
| 0, '', false도 유효한 기본값 | `??` |
| truthy 여부로 기본값 결정 | `\|\|` |
| 조건부 함수 실행 | `&&` |
| null/undefined인 경우만 초기화 | `??=` |
| falsy인 경우 초기화 | `\|\|=` |

```javascript
// 실무 예시: API 응답 처리
function processUser(data) {
  const user = data ?? {};
  user.name ??= '익명';
  user.role ??= 'guest';
  user.score ??= 0;        // 0도 유효한 점수
  return user;
}
```

---

**지난 글:** [산술·비교·논리 연산자 완전 정복](/posts/js-arithmetic-comparison-logical/)

**다음 글:** [옵셔널 체이닝 ?.](/posts/js-optional-chaining/)

<br>
읽어주셔서 감사합니다. 😊
