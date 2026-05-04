---
title: "AggregateError — 여러 에러를 하나로"
description: "AggregateError는 여러 에러를 errors 배열로 묶어 하나의 에러로 전달합니다. Promise.any의 동작과 폼 검증 같은 실전 활용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "AggregateError", "Promise.any", "에러처리", "검증", "ES2021"]
featured: false
draft: false
---

[지난 글](/posts/js-error-cause-2022/)에서 에러 원인 체인을 구성하는 방법을 살펴봤습니다. 이번에는 여러 에러를 하나로 묶어 전달하는 `AggregateError`를 다룹니다.

## AggregateError 기본 구조

`AggregateError`는 여러 에러를 `.errors` 배열에 담아 하나의 에러로 표현합니다. ES2021에서 `Promise.any`와 함께 도입됐습니다.

```js
const e = new AggregateError(
  [new Error('에러1'), new Error('에러2')],
  '여러 작업이 실패했습니다'
);

console.log(e.name);      // 'AggregateError'
console.log(e.message);   // '여러 작업이 실패했습니다'
console.log(e.errors);    // [Error: 에러1, Error: 에러2]
console.log(e.errors[0].message); // '에러1'
```

생성자 시그니처: `new AggregateError(iterable, message?, options?)`

## Promise.any와 AggregateError

`Promise.any`는 전달된 Promise 중 하나라도 fulfilled되면 그 값을 반환합니다. **모두 rejected되면** `AggregateError`를 throw합니다.

```js
const endpoints = [
  'https://api-a.example.com/data',
  'https://api-b.example.com/data',
  'https://api-c.example.com/data',
];

try {
  // 가장 먼저 성공하는 응답 사용
  const data = await Promise.any(
    endpoints.map(url => fetch(url).then(r => r.json()))
  );
  renderData(data);
} catch (e) {
  if (e instanceof AggregateError) {
    // 모든 엔드포인트 실패
    console.error('모든 서버 응답 실패:');
    e.errors.forEach((err, i) =>
      console.error(`  [${i}] ${err.message}`)
    );
  }
}
```

![AggregateError — 구조와 Promise.any](/assets/posts/js-aggregate-error-structure.svg)

## 직접 생성 — 폼 검증

복수의 검증 오류를 한 번에 수집해서 throw하는 패턴에서 특히 유용합니다.

```js
function validateForm(data) {
  const errors = [];

  if (!data.email.includes('@')) {
    errors.push(new Error('이메일 형식이 올바르지 않습니다'));
  }
  if (data.password.length < 8) {
    errors.push(new Error('비밀번호는 8자 이상이어야 합니다'));
  }
  if (!data.name.trim()) {
    errors.push(new Error('이름을 입력해주세요'));
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, '폼 검증에 실패했습니다');
  }
}
```

모든 검증 오류를 모아서 한 번에 throw하면, 사용자에게 여러 오류를 동시에 보여줄 수 있습니다.

![AggregateError 직접 생성과 활용](/assets/posts/js-aggregate-error-custom.svg)

## 에러 집계 — Promise.allSettled와의 차이

`Promise.allSettled`는 모든 Promise의 결과를 `{ status, value/reason }` 형태로 반환합니다. `AggregateError`는 실패한 것들만 모아 에러로 전달합니다.

```js
// allSettled: 모든 결과 수집 (실패해도 reject 안 함)
const results = await Promise.allSettled(tasks);
const failed = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason);

if (failed.length > 0) {
  throw new AggregateError(failed, `${failed.length}개 작업 실패`);
}

// any: 하나라도 성공하면 OK — 모두 실패 시 AggregateError
const first = await Promise.any(tasks);
```

## 여러 비동기 오류 수집

여러 독립적인 작업을 병렬로 실행하고, 실패한 것들을 모아 하나의 `AggregateError`로 처리하는 패턴입니다.

```js
async function runAll(tasks) {
  const results = await Promise.allSettled(tasks);
  const errors = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason);

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `${errors.length}/${tasks.length}개 작업 실패`
    );
  }

  return results.map(r => r.value);
}

try {
  const data = await runAll([fetchA(), fetchB(), fetchC()]);
} catch (e) {
  if (e instanceof AggregateError) {
    // 몇 개 성공했는지 알 수 있음
    console.error(e.message); // "2/3개 작업 실패"
    e.errors.forEach(err => console.error('-', err.message));
  }
}
```

## 브라우저/런타임 지원

| 환경 | 지원 버전 |
|------|----------|
| Node.js | 15.0.0+ |
| Chrome | 85+ |
| Firefox | 79+ |
| Safari | 14+ |

## 정리

- `new AggregateError(errors, message)` — 에러 배열을 하나로 묶음
- `.errors` 배열로 개별 에러에 접근
- `Promise.any`가 모두 실패 시 자동으로 throw
- 폼 검증, 배치 처리 결과 수집에 직접 생성해서 활용
- `instanceof AggregateError`로 구분 후 `.errors`를 순회

---

**지난 글:** [Error cause (ES2022) — 에러 원인 연결](/posts/js-error-cause-2022/)

**다음 글:** [비동기 에러 패턴 — 실전 설계 전략](/posts/js-async-error-patterns/)

<br>
읽어주셔서 감사합니다. 😊
