---
title: "커링과 부분 적용"
description: "커링과 부분 적용의 개념 차이를 명확히 이해하고, 범용 curry 헬퍼 구현부터 배열 파이프라인, 설정 고정 패턴까지 실전 활용법을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "커링", "부분 적용", "함수형 프로그래밍", "고차 함수"]
featured: false
draft: false
---

[지난 글](/posts/js-pure-functions-side-effects/)에서 순수 함수와 부수 효과를 구분하는 법을 배웠습니다. 이번에는 함수의 **인자를 나누어 적용**하는 두 기법인 커링(Currying)과 부분 적용(Partial Application)을 살펴봅니다. 두 개념은 자주 혼용되지만 의미가 다릅니다.

## 커링이란?

커링은 여러 인자를 받는 함수를 **한 번에 하나의 인자만 받는 함수들의 체인**으로 변환하는 기법입니다. 수학자 하스켈 커리(Haskell Curry)의 이름에서 유래했습니다.

```javascript
// 일반 함수: 두 인자를 동시에 받음
const add = (a, b) => a + b;
add(2, 3); // 5

// 커링된 함수: 인자를 하나씩 받음
const curriedAdd = a => b => a + b;
curriedAdd(2)(3); // 5

// 첫 번째 인자만 적용 → 새 함수 반환
const add10 = curriedAdd(10);
add10(5);  // 15
add10(20); // 30
```

핵심은 `curriedAdd(10)`이 **즉시 계산하지 않고 새 함수를 반환**한다는 점입니다. 나머지 인자가 채워질 때까지 계산을 미룹니다.

![커링 vs 부분 적용 개념](/assets/posts/js-currying-partial-application-concept.svg)

## 부분 적용이란?

부분 적용은 **일부 인자를 미리 고정**해서 더 적은 인자를 받는 새 함수를 만드는 기법입니다. 커링처럼 반드시 한 개씩 받아야 한다는 제약이 없습니다.

```javascript
function multiply(a, b) {
  return a * b;
}

// Function.prototype.bind로 부분 적용
const double = multiply.bind(null, 2); // a=2 고정
double(5);  // 10
double(21); // 42

// 직접 구현
function partial(fn, ...presetArgs) {
  return function (...laterArgs) {
    return fn(...presetArgs, ...laterArgs);
  };
}

const triple = partial(multiply, 3);
triple(7); // 21
```

| 구분 | 커링 | 부분 적용 |
|---|---|---|
| 인자 수 | 항상 1개씩 | 여러 개 가능 |
| 반환 | 단항 함수 체인 | 인자가 줄어든 함수 |
| 목적 | 함수 조합 용이 | 설정 사전 고정 |

## 범용 curry 헬퍼

실전에서는 기존 함수를 그대로 커링할 수 있는 헬퍼가 유용합니다.

```javascript
const curry = (fn) => {
  const arity = fn.length; // 함수의 선언된 인자 수
  return function curried(...args) {
    if (args.length >= arity) {
      return fn(...args);          // 인자가 다 모이면 실행
    }
    return (...more) => curried(...args, ...more); // 아니면 대기
  };
};

// 사용 예
const add3 = curry((a, b, c) => a + b + c);

add3(1)(2)(3);    // 6 — 커링 방식
add3(1, 2)(3);    // 6 — 혼합 방식
add3(1)(2, 3);    // 6 — 혼합 방식
add3(1, 2, 3);    // 6 — 일반 호출
```

이 헬퍼는 인자가 충분히 모이는 순간 실행하므로 커링과 부분 적용을 동시에 지원합니다.

![커링 실전 활용 패턴](/assets/posts/js-currying-partial-application-usage.svg)

## 배열 파이프라인에서의 활용

커링이 가장 빛나는 곳은 `map`, `filter`, `reduce` 체인입니다. 콜백을 inline 화살표 함수로 쓰는 대신 커링된 함수를 재사용할 수 있습니다.

```javascript
const curry = (fn) => {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
};

const gt  = curry((min, n) => n > min);
const mul = curry((factor, n) => n * factor);
const add = curry((a, b) => a + b);

const result = [1, 5, 3, 8, 2, 9]
  .filter(gt(3))          // [5, 8, 9]
  .map(mul(10))           // [50, 80, 90]
  .reduce(add, 0);        // 220

console.log(result); // 220
```

`gt(3)`, `mul(10)`, `add`는 독립적으로 테스트할 수 있고, 다른 파이프라인에서도 재사용됩니다.

## 설정 고정 패턴

부분 적용의 대표적 활용은 **설정값을 고정**해 여러 호출에서 재사용하는 것입니다.

```javascript
// API 요청 함수: baseURL과 headers를 고정
const request = curry(async (baseURL, headers, path) => {
  const res = await fetch(`${baseURL}${path}`, { headers });
  return res.json();
});

const apiGet = request('https://api.example.com')({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
});

// 이제 경로만 넘기면 됨
const user    = await apiGet('/users/1');
const posts   = await apiGet('/posts');
const profile = await apiGet('/me');
```

반복되는 설정을 한 번만 명시하고, 이후에는 변하는 부분만 전달합니다.

## 로깅 유틸리티

```javascript
const log = curry((level, tag, message) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${level} [${tag}] ${message}`);
});

const info  = log('INFO');
const warn  = log('WARN');
const error = log('ERROR');

const authWarn  = warn('AUTH');
const dbError   = error('DB');

authWarn('토큰이 곧 만료됩니다');     // [ts] WARN [AUTH] 토큰이 곧 만료됩니다
dbError('커넥션 타임아웃');            // [ts] ERROR [DB] 커넥션 타임아웃
```

`warn('AUTH')` 한 줄로 태그가 고정된 경고 로거를 만들 수 있습니다.

## 주의 사항

- **가변 인자 함수에 주의**: `fn.length`는 rest 파라미터(`...args`)를 0으로 셉니다. 가변 인자 함수는 직접 커링 버전을 작성해야 합니다.
- **성능**: 클로저를 중첩 생성하므로 tight loop 안에서는 오버헤드가 될 수 있습니다.
- **디버깅**: 깊게 중첩된 커링 체인은 스택 트레이스가 복잡해집니다.

커링과 부분 적용은 **재사용 가능한 특화 함수**를 만드는 강력한 도구입니다. 다음 글에서는 이 개념과 연결되는 **메모이제이션(Memoization)** 을 살펴봅니다.

---

**지난 글:** [순수 함수와 부수 효과](/posts/js-pure-functions-side-effects/)

**다음 글:** [메모이제이션](/posts/js-memoization/)

<br>
읽어주셔서 감사합니다. 😊
