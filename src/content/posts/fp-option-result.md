---
title: "Option/Result 타입 — 함수형 에러 처리"
description: "Option(Maybe)과 Result(Either) 타입으로 null 체크와 예외를 값으로 처리하는 방법, neverthrow 라이브러리로 TypeScript에서 에러 타입을 강제하는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "TypeScript", "함수형프로그래밍", "Option", "Result", "Either", "neverthrow", "에러처리"]
featured: false
draft: false
---

[지난 글](/posts/fp-immutable-immer/)에서 Immer와 Immutable.js를 다뤘습니다. 이번에는 FP에서 예외 대신 에러를 **값으로 다루는** 핵심 패턴, **Option** 과 **Result** 타입을 살펴봅니다.

## 전통적 에러 처리의 문제

JavaScript의 `try/catch`는 에러를 숨깁니다. 함수 시그니처만 봐서는 어떤 에러가 발생할 수 있는지 알 수 없습니다.

```js
// 이 함수가 어떤 에러를 던지는지 시그니처에서 알 수 없음
async function fetchUser(id) {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 에러를 처리해야 한다는 사실을 컴파일러가 강제할 수 없음
const user = await fetchUser(1); // 예외 가능성 보이지 않음
```

## Option 타입 — null을 감싸기

Option(또는 Maybe) 타입은 값이 있을 수도 없을 수도 있는 경우를 명시적으로 표현합니다.

![Option/Result 타입 개념](/assets/posts/fp-option-result-types.svg)

```js
// Option 구현
const Some = value => ({
  type: 'Some',
  value,
  map: fn => Some(fn(value)),
  flatMap: fn => fn(value),
  getOrElse: () => value,
  isSome: () => true,
  isNone: () => false,
});

const None = {
  type: 'None',
  map: () => None,
  flatMap: () => None,
  getOrElse: defaultVal => defaultVal,
  isSome: () => false,
  isNone: () => true,
};

// 사용
function findUser(id) {
  const user = database.find(u => u.id === id);
  return user ? Some(user) : None;
}

const name = findUser(42)
  .map(u => u.profile)
  .map(p => p.name)
  .getOrElse('Anonymous');
// 어느 단계에서 None이 나와도 안전
```

## Result 타입 — 에러를 값으로

Result는 성공(`Ok`)과 실패(`Err`) 두 경우를 타입으로 표현합니다. 함수 반환 타입에 에러 가능성이 명시됩니다.

```js
const Ok = value => ({
  ok: true,
  value,
  map: fn => Ok(fn(value)),
  flatMap: fn => fn(value),      // andThen
  mapErr: () => Ok(value),       // Ok는 에러 변환 무시
  match: ({ value: f }) => f(value),
});

const Err = error => ({
  ok: false,
  error,
  map: () => Err(error),         // Err는 변환 무시
  flatMap: () => Err(error),
  mapErr: fn => Err(fn(error)),  // 에러만 변환
  match: ({ error: f }) => f(error),
});

// 파싱 함수 — 에러 가능성이 반환 타입에 명시
function parseJSON(str) {
  try {
    return Ok(JSON.parse(str));
  } catch (e) {
    return Err(`JSON 파싱 실패: ${e.message}`);
  }
}

function validateUser(data) {
  if (!data.name) return Err('이름이 없습니다');
  if (!data.email) return Err('이메일이 없습니다');
  return Ok(data);
}

// 체이닝 — 에러가 자동 전파
const result = parseJSON(rawInput)
  .flatMap(validateUser)
  .map(user => ({ ...user, createdAt: new Date() }));

result.match({
  value: user => console.log('성공:', user.name),
  error: msg => console.error('실패:', msg),
});
```

## neverthrow — TypeScript에서 에러 타입 강제

`neverthrow` 라이브러리는 TypeScript와 결합해 Result 타입을 강력하게 활용합니다.

![neverthrow 사용 패턴](/assets/posts/fp-option-result-neverthrow.svg)

```bash
npm install neverthrow
```

```ts
import { ok, err, Result, ResultAsync } from 'neverthrow';

// 반환 타입에 에러가 강제됨
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err('0으로 나눌 수 없습니다');
  return ok(a / b);
}

// 비동기 버전
async function fetchUser(id: number): ResultAsync<User, ApiError> {
  return ResultAsync.fromPromise(
    fetch(`/api/users/${id}`).then(r => r.json()),
    e => new ApiError('FETCH_FAILED', String(e))
  );
}

// TypeScript가 에러 처리를 강제
const result = divide(10, 0);

// result.value에 직접 접근하면 타입 오류 — .match 강제
result.match({
  onOk: value => console.log(value),
  onErr: e => console.error(e),
});

// 체이닝
const pipeline = parseUserId(rawId)     // Result<number, string>
  .andThen(fetchUser)                    // ResultAsync<User, ApiError>
  .map(user => user.name)
  .mapErr(e => ({ code: 'PIPELINE_FAIL', details: e }));
```

## 실용적 패턴 — Go 스타일

TypeScript 없이 순수 JavaScript에서도 Result 패턴을 Go 스타일로 사용할 수 있습니다.

```js
// [value, error] 튜플 패턴 (Go 스타일)
async function safeAsync(promise) {
  try {
    return [await promise, null];
  } catch (e) {
    return [null, e];
  }
}

// 사용
const [user, userErr] = await safeAsync(fetchUser(1));
if (userErr) {
  console.error('유저 로드 실패:', userErr.message);
  return;
}

const [posts, postsErr] = await safeAsync(fetchPosts(user.id));
if (postsErr) {
  console.error('포스트 로드 실패:', postsErr.message);
  return;
}
```

이 패턴은 에러를 `try/catch` 블록 없이 명시적으로 처리할 수 있게 합니다.

## Optional Chaining과의 관계

JavaScript의 `?.` 연산자는 내장 Option 패턴입니다. `null`/`undefined`를 자동으로 처리합니다.

```js
// Option.map 체인과 동일한 의미
const city = user?.address?.city ?? 'Unknown';

// 복잡한 변환이 필요할 때는 명시적 Option이 더 표현력 있음
const formattedCity = Option.of(user)
  .map(u => u.address)
  .map(a => a.city)
  .map(c => c.toUpperCase())
  .getOrElse('UNKNOWN');
```

## 정리

Option과 Result 타입은 `null` 체크와 예외 처리를 **타입 시스템으로 강제**하는 FP 패턴입니다. JavaScript에서도 충분히 구현할 수 있고, TypeScript + neverthrow를 사용하면 컴파일 타임에 에러 처리 누락을 잡을 수 있습니다.

---

**지난 글:** [Immer와 Immutable.js — 불변 데이터 구조 라이브러리](/posts/fp-immutable-immer/)

**다음 글:** [에러를 값으로 — 함수형 에러 설계 패턴](/posts/fp-errors-as-values/)

<br>
읽어주셔서 감사합니다. 😊
