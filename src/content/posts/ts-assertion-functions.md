---
title: "단언 함수 — asserts 키워드와 불변식 검사"
description: "TypeScript 단언 함수(Assertion Functions)의 asserts 반환 타입, assert(condition), assertDefined(val), 초기화 검사 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 2
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "단언함수", "assertion functions", "asserts", "불변식", "타입좁히기"]
featured: false
draft: false
---

[지난 글](/posts/ts-exhaustiveness-checking/)에서 완전성 검사를 살펴봤다. 이번에는 TypeScript 3.7에서 도입된 **단언 함수(Assertion Functions)**를 살펴본다. 타입 가드(`is` 반환)와 달리 단언 함수는 조건이 거짓이면 예외를 던지고, 참이면 이후 코드에서 타입이 좁혀진다.

## 타입 가드 vs 단언 함수

![타입 가드 vs 단언 함수 비교](/assets/posts/ts-assertion-functions-guard.svg)

```typescript
// 타입 가드 — boolean 반환, 호출부가 if로 분기해야 함
function isString(val: unknown): val is string {
  return typeof val === "string";
}

// 단언 함수 — 실패 시 예외, 성공 시 이후 코드에서 타입 좁힘
function assertIsString(val: unknown): asserts val is string {
  if (typeof val !== "string") {
    throw new TypeError(`Expected string, got ${typeof val}`);
  }
}
```

타입 가드는 `if (isString(val)) { /* 여기서 val: string */ }` 형태로 사용해야 한다. 단언 함수는 `assertIsString(val)` 호출 이후 줄부터 `val`이 `string`으로 좁혀진다.

## asserts condition 패턴

`asserts condition`은 Node.js의 `assert` 모듈처럼 불변식(invariant)을 검사하는 데 쓰인다.

```typescript
function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) throw new Error(message ?? "Assertion failed");
}

function processAge(age: number | null) {
  assert(age !== null, "age must not be null");
  // 이 줄부터 age: number
  console.log(age.toFixed(0));
}
```

## asserts val is T 패턴

특정 타입임을 단언하는 함수다.

```typescript
function assertDefined<T>(val: T | null | undefined, name = "value"): asserts val is T {
  if (val == null) throw new Error(`${name} must be defined`);
}

function getElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  assertDefined(el, `element #${id}`);
  return el; // el: HTMLElement (null 제외됨)
}
```

![단언 함수 사용 패턴](/assets/posts/ts-assertion-functions-usage.svg)

## 클래스 초기화 검사

단언 함수는 클래스에서 `init` 메서드 이후 프로퍼티가 설정됐음을 보장할 때 특히 유용하다.

```typescript
class DatabaseConnection {
  private connection: Connection | undefined;

  async init() {
    this.connection = await createConnection();
  }

  private assertReady(): asserts this is this & { connection: Connection } {
    if (!this.connection) {
      throw new Error("Database not initialized. Call init() first.");
    }
  }

  async query(sql: string) {
    this.assertReady();
    // this.connection: Connection (undefined 제외됨)
    return this.connection.execute(sql);
  }
}
```

## 실전: 입력 검증 레이어

API 핸들러에서 입력을 검증하고 이후 코드에서 타입을 보장하는 패턴이다.

```typescript
type RawInput = { userId?: unknown; amount?: unknown };
type ValidatedInput = { userId: string; amount: number };

function assertValidInput(input: RawInput): asserts input is ValidatedInput {
  if (typeof input.userId !== "string" || !input.userId) {
    throw new Error("userId must be a non-empty string");
  }
  if (typeof input.amount !== "number" || input.amount <= 0) {
    throw new Error("amount must be a positive number");
  }
}

async function processPayment(raw: RawInput) {
  assertValidInput(raw);
  // raw: ValidatedInput — 이후 코드는 타입 안전
  await charge(raw.userId, raw.amount);
}
```

## 한계와 주의사항

단언 함수는 강력하지만 주의할 점이 있다. 단언이 틀려도 TypeScript는 알 수 없다 — 단언 함수가 예외를 던지지 않으면 이후 코드에서 타입이 잘못 좁혀진다. 따라서 단언 함수의 구현이 항상 정확해야 하며, 테스트로 보장하는 것이 좋다.

```typescript
// 위험: 단언이 너무 관대함
function badAssert(val: unknown): asserts val is string {
  // 아무것도 하지 않음 — 타입만 좁혀짐
}
```

---

**지난 글:** [완전성 검사 — switch와 never로 빠진 케이스 잡기](/posts/ts-exhaustiveness-checking/)

**다음 글:** [interface extends — 계층적 타입 설계](/posts/ts-interface-extends/)

<br>
읽어주셔서 감사합니다. 😊
