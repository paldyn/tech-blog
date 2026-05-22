---
title: "에러를 값으로 — 함수형 에러 설계 패턴"
description: "Railway Oriented Programming으로 에러를 파이프라인에서 자동 전파하는 설계, 구별 가능한 유니온 타입으로 에러 계층 구조화, 집계 에러 패턴으로 폼 유효성 검사를 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "TypeScript", "FP", "에러처리", "Railway", "Result", "유효성검사", "함수형프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/fp-option-result/)에서 Option과 Result 타입을 소개했습니다. 이번에는 **에러를 값으로 다루는 설계 패턴**을 더 깊이 살펴봅니다. Railway Oriented Programming, 에러 계층 설계, 집계 에러 패턴까지 다룹니다.

## Railway Oriented Programming

Scott Wlaschin이 제안한 **Railway Oriented Programming(ROP)** 은 에러 처리를 시각적으로 이해하기 쉽게 만드는 설계 방식입니다.

성공은 **상단 레일**, 실패는 **하단 레일**로 진행됩니다. 각 단계 함수는 성공 시 상단 레일을 계속 타고, 실패 시 하단 레일로 전환됩니다. 한번 하단 레일로 진입하면 이후 단계는 건너뜁니다.

![Railway Oriented Programming](/assets/posts/fp-errors-as-values-railway.svg)

```js
// 각 함수가 Result를 반환
function parseOrder(raw) {
  try {
    const data = JSON.parse(raw);
    return Ok(data);
  } catch {
    return Err({ type: 'PARSE_ERROR', input: raw });
  }
}

function validateOrder(data) {
  if (!data.items?.length) {
    return Err({ type: 'VALIDATION_ERROR', field: 'items', msg: '항목이 없습니다' });
  }
  if (!data.userId) {
    return Err({ type: 'VALIDATION_ERROR', field: 'userId', msg: '사용자 ID가 없습니다' });
  }
  return Ok(data);
}

async function saveOrder(data) {
  try {
    const saved = await db.orders.create(data);
    return Ok(saved);
  } catch (e) {
    return Err({ type: 'DB_ERROR', cause: e });
  }
}

// 파이프라인 — 에러가 자동 우회
const result = await parseOrder(rawInput)
  .andThen(validateOrder)
  .andThen(saveOrder);

result.match({
  onOk: order => res.json({ id: order.id }),
  onErr: err => res.status(400).json({ error: err }),
});
```

## 구별 가능한 에러 유니온 타입

TypeScript에서 에러를 **구별 가능한 유니온(Discriminated Union)** 으로 정의하면 컴파일러가 모든 에러 케이스 처리를 강제합니다.

![에러 계층과 집계 에러 패턴](/assets/posts/fp-errors-as-values-patterns.svg)

```ts
// 에러 타입 계층 정의
type ParseError = { type: 'PARSE_ERROR'; input: string };
type ValidationError = { type: 'VALIDATION_ERROR'; field: string; message: string };
type DatabaseError = { type: 'DB_ERROR'; code: string; cause?: Error };
type NotFoundError = { type: 'NOT_FOUND'; resource: string; id: string | number };

type AppError = ParseError | ValidationError | DatabaseError | NotFoundError;

// 소진적(exhaustive) 매칭 — 처리 누락 시 컴파일 에러
function formatError(error: AppError): string {
  switch (error.type) {
    case 'PARSE_ERROR':
      return `파싱 실패: ${error.input}`;
    case 'VALIDATION_ERROR':
      return `${error.field}: ${error.message}`;
    case 'DB_ERROR':
      return `데이터베이스 오류: ${error.code}`;
    case 'NOT_FOUND':
      return `${error.resource} (ID: ${error.id})를 찾을 수 없습니다`;
    // TypeScript가 누락된 케이스를 오류로 보고
  }
}
```

## 집계 에러 — 여러 에러 한번에 수집

폼 유효성 검사처럼 **여러 에러를 동시에 수집**해야 하는 경우, 단일 에러를 전파하는 Result가 아니라 에러 목록을 수집하는 Validation 타입이 필요합니다.

```ts
type ValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; errors: ValidationError[] };

function validateSignup(data: unknown): ValidationResult<SignupData> {
  const errors: ValidationError[] = [];

  if (typeof data !== 'object' || !data) {
    return { valid: false, errors: [{ type: 'VALIDATION_ERROR', field: 'data', message: '객체가 아닙니다' }] };
  }

  const d = data as Record<string, unknown>;

  if (!d.name || typeof d.name !== 'string') {
    errors.push({ type: 'VALIDATION_ERROR', field: 'name', message: '이름은 필수 문자열입니다' });
  }
  if (!d.email || !/^\S+@\S+$/.test(String(d.email))) {
    errors.push({ type: 'VALIDATION_ERROR', field: 'email', message: '유효한 이메일이 아닙니다' });
  }
  if (!d.password || String(d.password).length < 8) {
    errors.push({ type: 'VALIDATION_ERROR', field: 'password', message: '비밀번호는 8자 이상이어야 합니다' });
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, value: d as SignupData };
}
```

## 기존 예외 코드를 Result로 래핑

레거시 코드나 외부 라이브러리는 예외를 던집니다. 경계에서 Result로 래핑하면 나머지 코드를 순수하게 유지할 수 있습니다.

```ts
import { ResultAsync, fromThrowable } from 'neverthrow';

// 동기 예외 → Result
const safeParseJSON = fromThrowable(
  JSON.parse,
  e => ({ type: 'PARSE_ERROR' as const, message: String(e) })
);

// 비동기 Promise → ResultAsync
function readFile(path: string): ResultAsync<string, IoError> {
  return ResultAsync.fromPromise(
    fs.promises.readFile(path, 'utf-8'),
    e => ({ type: 'IO_ERROR' as const, path, cause: e })
  );
}

// 체이닝
const result = await readFile('./config.json')
  .andThen(content => safeParseJSON(content))
  .map(config => config.apiUrl);
```

## try/catch 경계 패턴

모든 코드를 Result로 바꾸기 어렵다면, **경계(boundary)** 에서만 try/catch를 사용하고 내부는 Result로 처리합니다.

```ts
// HTTP 핸들러 경계
app.post('/orders', async (req, res) => {
  try {
    const result = await processOrder(req.body); // 내부는 Result 체인

    result.match({
      onOk: order => res.status(201).json(order),
      onErr: error => {
        switch (error.type) {
          case 'VALIDATION_ERROR':
            res.status(400).json({ field: error.field, message: error.message });
            break;
          case 'DB_ERROR':
            res.status(503).json({ message: '서비스 일시 불가' });
            break;
          default:
            res.status(500).json({ message: '내부 오류' });
        }
      }
    });
  } catch (e) {
    // 완전히 예상치 못한 에러만 여기서 처리
    console.error('Unhandled error:', e);
    res.status(500).json({ message: '내부 오류' });
  }
});
```

## 언제 예외, 언제 Result?

| 상황 | 권장 |
|---|---|
| 프로그래밍 오류 (버그) | `throw` — 빠른 실패, 스택 추적 |
| 예측 가능한 비즈니스 실패 | `Result` — 타입 안전, 흐름 제어 |
| 외부 API 에러 | `Result` + 래퍼 함수 |
| 경계(HTTP 핸들러, 최상위) | `try/catch` |
| null/undefined 가능성 | `Option` 또는 `?.` |

## 정리

에러를 값으로 다루면 **에러 처리가 타입 시스템에 의해 강제**되고, 파이프라인 안에서 자연스럽게 전파됩니다. Railway Oriented Programming은 복잡한 비즈니스 로직을 선형적이고 읽기 쉽게 만드는 강력한 패턴입니다.

---

**지난 글:** [Option/Result 타입 — 함수형 에러 처리](/posts/fp-option-result/)

**다음 글:** [옵저버·발행-구독 패턴 — 느슨한 결합의 이벤트 설계](/posts/pattern-observer-pubsub/)

<br>
읽어주셔서 감사합니다. 😊
