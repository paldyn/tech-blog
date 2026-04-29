---
title: "논리 할당 연산자 (&&=, ||=, ??=)"
description: "ES2021에서 도입된 세 가지 논리 할당 연산자의 단락 평가 원리와 기존 패턴과의 비교, 실전 활용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ES2021", "논리 연산자", "단락 평가", "할당", "&&=", "||=", "??="]
featured: false
draft: false
---

[지난 글](/posts/js-proxy-reflect/)에서 Proxy와 Reflect로 객체 동작을 가로채는 방법을 살펴봤습니다. 이번에는 ES2021에 추가된 **논리 할당 연산자** `&&=`, `||=`, `??=`를 다룹니다. 이 세 연산자는 기존의 논리 연산자가 제공하는 단락 평가(short-circuit evaluation)와 할당(assignment)을 하나로 합쳐, 조건부 기본값 설정 코드를 훨씬 간결하게 만들어 줍니다.

## 세 연산자 한눈에 보기

![논리 할당 연산자 — 동등 표현](/assets/posts/js-logical-assignment-operators.svg)

`&&=`, `||=`, `??=`는 각각 `&&`, `||`, `??` 연산자의 단락 평가 방식을 그대로 사용하면서 조건이 충족될 때만 오른쪽 값을 왼쪽 변수에 할당합니다. **부작용(side effect)이 있는 우변은 조건이 충족될 때만 실행**되므로, 불필요한 함수 호출이나 연산을 방지할 수 있습니다.

```javascript
// 기존 방식 (중복 참조)
if (!config.timeout) config.timeout = 5000;

// ??= 사용
config.timeout ??= 5000;

// 기존 방식
user = user && sanitize(user);

// &&= 사용
user &&= sanitize(user);
```

## &&= — truthy일 때만 할당

`x &&= y`는 `x`가 **truthy**일 때만 `x = y` 할당을 수행합니다.

```javascript
let user = { name: 'Alice' };
user &&= validate(user);
// user가 truthy이므로 validate(user) 결과 할당

let guest = null;
guest &&= validate(guest);
// guest가 null(falsy)이므로 validate() 호출 자체가 일어나지 않음
// guest는 여전히 null
```

오른쪽 함수가 실행되는지 여부가 왼쪽 값에 달려 있기 때문에, 조건부 변환(sanitize, normalize)에 유용합니다.

## ||= — falsy일 때만 할당

`x ||= y`는 `x`가 **falsy**(`false`, `0`, `''`, `null`, `undefined`, `NaN`)일 때 `x = y`를 수행합니다.

```javascript
let name = '';
name ||= '익명';
console.log(name); // '익명'

let score = 0;
score ||= 100;
console.log(score); // 100  ← 주의: 0은 falsy
```

`0`이나 `''`처럼 **의도적으로 유효한 falsy 값**도 대체해 버리므로, 그런 경우에는 `??=`가 적합합니다.

## ??= — null 또는 undefined일 때만 할당

`x ??= y`는 `x`가 **`null` 또는 `undefined`**인 경우에만 할당합니다. `0`, `''`, `false` 등은 그대로 유지됩니다.

```javascript
let count = 0;
count ??= 10;
console.log(count); // 0  ← 0은 null/undefined가 아님

let value = null;
value ??= 'default';
console.log(value); // 'default'
```

## 단락 평가와 부작용

![논리 할당 — 단락 평가 비교](/assets/posts/js-logical-assignment-usecases.svg)

세 연산자 모두 단락 평가를 따르므로, 조건이 맞지 않으면 우변 표현식 자체가 실행되지 않습니다. 예를 들어 `x &&= expensiveCompute()`는 `x`가 falsy면 `expensiveCompute()`를 호출조차 하지 않습니다.

```javascript
let cache = null;

// ??= : cache가 null이므로 한 번만 fetch 실행
cache ??= await fetch('/api/data').then(r => r.json());

// 두 번째 호출 — cache가 이미 값이 있으므로 fetch 생략
cache ??= await fetch('/api/data').then(r => r.json());
```

## 세 연산자 비교 요약

| 연산자 | 할당 조건 | 유지되는 falsy 값 |
|--------|-----------|------------------|
| `&&=` | 좌변 truthy | — |
| `\|\|=` | 좌변 falsy | — |
| `??=` | 좌변 null/undefined | `0`, `''`, `false` |

## 주의사항

`||=`과 `&&=`는 `=`(단순 할당)과 달리 **항상 할당하지 않습니다**. 따라서 Vue나 React의 반응형 시스템처럼 setter 트래킹에 의존하는 경우, 조건이 맞지 않을 때 setter가 호출되지 않을 수 있다는 점을 염두에 두어야 합니다.

```javascript
// Vue reactive 객체에서의 주의
state.count ||= 0;
// count가 이미 falsy가 아니면 setter가 호출되지 않음
// → 반응형 트리거가 발생하지 않을 수 있음
```

---

**지난 글:** [Proxy와 Reflect](/posts/js-proxy-reflect/)

**다음 글:** [숫자 구분자 (Numeric Separator)](/posts/js-numeric-separator/)

<br>
읽어주셔서 감사합니다. 😊
