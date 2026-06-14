---
title: "나머지 매개변수와 스프레드 — 가변 인수를 타입 안전하게 처리하기"
description: "TypeScript 나머지 매개변수(rest parameters)의 문법과 타입 규칙, 튜플 타입을 활용한 정밀한 rest 타입 정의, 스프레드 인수와의 연계, 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 5
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "나머지매개변수", "RestParameters", "스프레드", "가변인수"]
featured: false
draft: false
---

[지난 글](/posts/ts-optional-default-params/)에서 선택적/기본값 매개변수를 살펴봤다. 이번에는 **나머지 매개변수(Rest Parameters)** 와 **스프레드 인수(Spread Arguments)** 를 다룬다. 개수가 정해지지 않은 인수를 처리하면서도 타입 안전성을 유지하는 방법을 살펴본다.

## 나머지 매개변수 기본 문법

`...` 문법으로 나머지 인수를 배열로 받는다. TypeScript는 타입을 배열 또는 튜플로 지정해야 한다.

```typescript
// 기본 rest — 배열 타입
function sum(...nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}

sum(1, 2, 3);        // 6
sum(1, 2, 3, 4, 5);  // 15
sum();               // 0 — 빈 배열 허용

// 혼합 타입 — 앞 매개변수와 조합
function log(level: "info" | "warn" | "error", ...messages: string[]): void {
  console.log(`[${level}]`, ...messages);
}

log("info", "서버 시작됨");
log("warn", "메모리 부족", "GC 강제 실행");
log("error", "연결 실패", "재시도 중...", "3회 남음");
```

나머지 매개변수는 **마지막 위치**에만 올 수 있고, 함수당 **하나**만 사용할 수 있다.

```typescript
// ❌ 컴파일 에러 — rest는 반드시 마지막 위치
function bad(...a: string[], b: number): void {} // TS1014

// ✅ 올바른 순서
function ok(a: string, b: number, ...rest: boolean[]): void {}
```

![나머지 매개변수 문법](/assets/posts/ts-rest-parameters-syntax.svg)

## 튜플 타입 Rest

배열 타입 대신 튜플 타입을 사용하면 각 위치의 타입을 정확히 지정할 수 있다.

```typescript
// 정확히 3개의 인수, 각 타입이 다름
function createRecord(...args: [string, number, boolean]): Record<string, unknown> {
  const [name, age, active] = args;
  return { name, age, active };
}

createRecord("Alice", 30, true);   // OK
createRecord("Bob", 25, false);    // OK
createRecord("Charlie");           // ❌ 인수 부족
createRecord("Dave", 40, true, 0); // ❌ 인수 과다

// 선택적 요소가 있는 튜플 rest
function formatDate(...args: [number, number?, number?]): string {
  const [year, month = 1, day = 1] = args;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

formatDate(2026);          // "2026-01-01"
formatDate(2026, 6);       // "2026-06-01"
formatDate(2026, 6, 15);   // "2026-06-15"
```

튜플 rest는 각 인수의 위치와 타입이 고정될 때 유용하다. 오버로드보다 간결하게 같은 효과를 낼 수 있다.

## 나머지 매개변수와 타입 추론

제네릭과 나머지 매개변수를 조합하면 인수 타입을 캡처할 수 있다.

```typescript
// 나머지 인수 타입을 튜플로 캡처
function call<T extends unknown[], R>(
  fn: (...args: T) => R,
  ...args: T
): R {
  return fn(...args);
}

call((a: number, b: number) => a + b, 1, 2); // 3 — 타입 안전
call((s: string) => s.length, "hello");       // 5

// 함수 파라미터 타입 추출
type Parameters<T extends (...args: unknown[]) => unknown> =
  T extends (...args: infer P) => unknown ? P : never;

type AddParams = Parameters<(a: number, b: number) => number>;
// [a: number, b: number]
```

`T extends unknown[]`는 타입 매개변수 `T`가 배열(즉, 여러 인수를 나타내는 튜플)이어야 한다는 제약이다.

## 스프레드 인수

나머지 매개변수와 반대 방향으로, 배열을 펼쳐서 함수 인수로 전달하는 것이 **스프레드 인수(Spread Arguments)** 다.

```typescript
function add(a: number, b: number, c: number): number {
  return a + b + c;
}

const nums = [1, 2, 3] as const; // readonly [1, 2, 3] — 튜플로 추론
add(...nums); // OK — 정확히 3개의 number

const arr: number[] = [1, 2, 3]; // number[]
add(...arr); // ❌ TS2556: 가변 길이 배열이므로 개수 보장 불가
```

가변 길이 배열(`number[]`)을 스프레드하면 TypeScript가 개수를 보장할 수 없어 에러가 발생한다. `as const`로 튜플로 만들거나, 함수를 rest 매개변수로 바꿔 해결한다.

```typescript
// 해결책 1: as const
const fixed = [1, 2, 3] as const;
add(...fixed); // OK

// 해결책 2: 함수를 rest로 변경
function addAll(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
addAll(...arr); // OK
```

![나머지 매개변수와 스프레드](/assets/posts/ts-rest-parameters-spread.svg)

## 실전 패턴: 고차 함수에서의 Rest

나머지 매개변수는 함수를 래핑하거나 데코레이팅할 때 특히 유용하다.

```typescript
// 함수 호출 로깅 래퍼
function withLogging<T extends unknown[], R>(
  fn: (...args: T) => R,
  label: string,
): (...args: T) => R {
  return (...args: T) => {
    console.log(`[${label}] 호출:`, args);
    const result = fn(...args);
    console.log(`[${label}] 반환:`, result);
    return result;
  };
}

const loggedAdd = withLogging((a: number, b: number) => a + b, "add");
loggedAdd(1, 2); // 로그 출력 후 3 반환

// 재시도 래퍼
async function withRetry<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  retries: number,
  ...args: T
): Promise<R> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(...args);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error("도달 불가");
}
```

`T extends unknown[]`로 원래 함수의 매개변수 타입을 그대로 보존하면서 래핑할 수 있다.

## 나머지 매개변수 vs `arguments` 객체

ES5 이전의 `arguments` 객체와 나머지 매개변수는 다르다.

```typescript
// ❌ arguments 객체 — any 타입, 화살표 함수에서 사용 불가
function oldSum() {
  let total = 0;
  for (let i = 0; i < arguments.length; i++) {
    total += arguments[i]; // any
  }
  return total;
}

// ✅ 나머지 매개변수 — 타입 안전, 모든 함수에서 사용 가능
function newSum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// 화살표 함수에서도 동작
const arrowSum = (...nums: number[]): number =>
  nums.reduce((a, b) => a + b, 0);
```

`arguments`는 TypeScript에서도 사용할 수 있지만 `any` 타입으로 처리되므로 나머지 매개변수를 사용하는 것이 바람직하다.

## 순서 제약과 타입 안전성

나머지 매개변수는 마지막에 위치해야 하지만, 앞에 여러 필수 매개변수를 둘 수 있다.

```typescript
// 첫 번째 인수 필수, 나머지 선택
function tag(first: string, ...rest: string[]): string {
  return [first, ...rest].join(", ");
}

tag("필수");               // "필수"
tag("첫째", "둘째");       // "첫째, 둘째"
tag("a", "b", "c", "d");  // "a, b, c, d"

// 타입 가드와 함께
function processAll<T>(
  validator: (item: T) => boolean,
  ...items: T[]
): T[] {
  return items.filter(validator);
}

processAll((n: number) => n > 0, -1, 2, -3, 4, 5); // [2, 4, 5]
processAll((s: string) => s.length > 2, "hi", "hello", "ok", "world"); // ["hello", "world"]
```

나머지 매개변수를 제네릭과 함께 사용하면 첫 번째 함수 인수의 타입에서 나머지 인수 타입을 추론할 수 있어 매우 유연한 API를 설계할 수 있다.

---

**지난 글:** [선택적 매개변수와 기본값 — 유연한 함수 시그니처 설계](/posts/ts-optional-default-params/)

**다음 글:** [this 매개변수 — 메서드와 this 타입 처리](/posts/ts-this-parameter/)

<br>
읽어주셔서 감사합니다. 😊
