---
title: "제어 흐름 분석 — TypeScript가 타입을 추적하는 방식"
description: "TypeScript 제어 흐름 분석(Control Flow Analysis)의 원리, 할당 좁히기, 조기 반환 패턴, asserts 키워드, 루프와 클로저에서의 CFA 한계와 해결 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "제어흐름분석", "ControlFlowAnalysis", "CFA", "타입좁히기", "Narrowing"]
featured: false
draft: false
---

[지난 글](/posts/ts-in-operator-narrowing/)에서 `in` 연산자 타입 가드를 살펴봤다. 이번에는 TypeScript 타입 좁히기의 근간이 되는 **제어 흐름 분석(Control Flow Analysis, CFA)** 을 다룬다. CFA는 TypeScript 컴파일러가 코드 경로를 따라 각 시점에서 변수의 타입을 추론하는 핵심 메커니즘이다.

## 제어 흐름 분석이란

CFA는 TypeScript 컴파일러가 코드를 분석할 때 **어느 경로로 실행이 흘렀는가**를 바탕으로 타입을 결정하는 방식이다.

```typescript
function processInput(input: string | null) {
  // 이 시점: input은 string | null

  if (input === null) {
    return; // null인 경우 조기 반환
  }

  // 이 시점: input은 string (null이 반환으로 제거됨)
  console.log(input.toUpperCase()); // 안전
  console.log(input.length);        // 안전
}
```

`return` 문은 null 경우의 실행을 완전히 끝낸다. 컴파일러는 그 이후의 코드가 실행될 때 `input`이 `null`일 수 없음을 안다.

![제어 흐름 분석 개념](/assets/posts/ts-control-flow-analysis-concept.svg)

## 할당에 의한 좁히기

변수에 값이 할당되는 시점에서 타입이 결정된다.

```typescript
let value: string | number;

// ❌ 아직 할당되지 않음 — 직접 사용 불가
// console.log(value); // TS2454: Variable 'value' is used before being assigned

value = "hello";
// 이제 value: string
console.log(value.toUpperCase()); // OK

value = 42;
// 이제 value: number
console.log(value.toFixed(2)); // OK

// 선언 타입(string | number)은 유지되지만 할당 후 좁혀짐
const arr: (string | number)[] = [];
arr.push(value); // OK — value: number

// 조건부 할당
let status: "active" | "inactive" | undefined;

if (Math.random() > 0.5) {
  status = "active";
} else {
  status = "inactive";
}

// 두 분기 이후: status는 "active" | "inactive" (undefined 제거됨)
status.toUpperCase(); // OK
```

두 분기 모두에서 `status`에 값이 할당되었으므로, 분기 이후 시점에서 `undefined`가 제거된다.

## 조기 반환(Early Return) 패턴

조기 반환은 중첩을 줄이고 이후 코드에서 타입을 자동으로 좁혀주는 효과가 있다.

```typescript
function processUser(user: { name: string; email?: string; role?: "admin" | "user" } | null) {
  // 1단계: null 제거
  if (user === null) {
    return "사용자 없음";
  }
  // user: { name: string; email?: string; role?: "admin" | "user" }

  // 2단계: 필수 필드 확인
  if (!user.name) {
    return "이름 없음";
  }
  // user.name: string (truthy — 빈 문자열 제거됨)

  // 3단계: 역할에 따른 처리
  if (user.role === "admin") {
    // user.role: "admin"
    return `관리자: ${user.name}`;
  }

  // user.role: "user" | undefined
  return `사용자: ${user.name}`;
}
```

각 `return` 문이 해당 조건의 경우를 제거해 이후 코드가 점점 더 좁아진 타입으로 동작한다.

## 할당 단언 `asserts`

TypeScript 3.7부터 `asserts` 키워드로 단언 함수(assertion function)를 만들 수 있다. 단언 함수가 반환되면 해당 조건이 참임이 보장된다.

```typescript
// value is string 형태: 반환 시 value가 string임을 보장
function assertString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`Expected string, got ${typeof value}`);
  }
}

// condition 형태: 반환 시 condition이 참임을 보장
function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}

// 사용 예
function processData(data: unknown) {
  assertString(data);
  // 이 시점: data는 string (예외가 발생하지 않았으므로)
  console.log(data.toUpperCase());
}

const user: { name?: string } = { name: "Alice" };
assert(user.name !== undefined, "이름이 없습니다");
// 이 시점: user.name은 string (undefined가 아님)
console.log(user.name.toUpperCase());
```

`asserts` 반환 타입은 `never`처럼 동작한다. 함수가 정상 반환되면 조건이 참임이 보장되고, 그렇지 않으면 예외를 던진다.

![제어 흐름 분석 패턴](/assets/posts/ts-control-flow-analysis-patterns.svg)

## 루프에서의 CFA

루프 안에서의 타입 좁히기는 루프 전후 타입이 합쳐진다.

```typescript
function findFirst(arr: (string | number)[]): string | number | undefined {
  for (const item of arr) {
    if (typeof item === "string") {
      // item: string
      if (item.length > 0) return item;
    }
    // item: number (루프 다음 반복에서는 다시 string | number)
  }
  return undefined;
}

// while 루프 — 루프 변수 타입 추적
let input: string | null = "initial";
while (input !== null) {
  // input: string (null이 아님)
  input = processAndMaybeNull(input);
}
// input: null (루프 조건이 false이므로)

function processAndMaybeNull(s: string): string | null {
  return s.length > 5 ? null : s + "!";
}
```

## 클로저에서의 CFA 한계

CFA는 동기 코드에서만 완전하게 동작한다. 클로저가 나중에 실행될 때는 변수가 변경됐을 수 있어 컴파일러가 타입을 보장하지 못한다.

```typescript
let maybeNull: string | null = "hello";

// ❌ 클로저 내에서 좁히기가 유지되지 않음
if (maybeNull !== null) {
  // maybeNull: string
  setTimeout(() => {
    maybeNull.toUpperCase(); // TS2531: Object is possibly 'null'
    // 클로저 실행 시점에 maybeNull이 변경됐을 수 있음
  }, 1000);
}

// ✅ 지역 변수로 캡처
if (maybeNull !== null) {
  const safe = maybeNull; // safe: string (const — 재할당 불가)
  setTimeout(() => {
    safe.toUpperCase(); // OK
  }, 1000);
}

// ✅ 또는 null 아님 단언 (확신이 있을 때)
if (maybeNull !== null) {
  const ref = maybeNull;
  setTimeout(() => {
    ref!.toUpperCase(); // ! 단언
  }, 1000);
}
```

`const` 지역 변수는 재할당될 수 없으므로 클로저 내에서도 타입이 유지된다.

## 완전성 검사(Exhaustive Check)

CFA와 `never` 타입을 조합해 유니언의 모든 케이스를 처리했는지 컴파일 타임에 검증할 수 있다.

```typescript
type Shape = 
  | { kind: "circle"; radius: number }
  | { kind: "rect"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rect":
      return shape.width * shape.height;
    case "triangle":
      return (shape.base * shape.height) / 2;
    default:
      // 이 시점: shape는 never (모든 케이스가 처리됨)
      const _exhaustive: never = shape;
      throw new Error(`처리되지 않은 케이스: ${JSON.stringify(_exhaustive)}`);
  }
}
```

새로운 `Shape` 케이스가 추가되면 `default` 분기에서 `never` 할당이 실패하며 컴파일 에러가 발생한다. 이 패턴은 유니언 타입 확장 시 처리 누락을 방지한다.

## 복잡한 타입 좁히기 패턴

여러 조건을 조합한 복잡한 좁히기도 CFA로 처리된다.

```typescript
type SuccessResult<T> = { ok: true; value: T };
type ErrorResult = { ok: false; error: string; code: number };
type Result<T> = SuccessResult<T> | ErrorResult;

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`[${result.code}] ${result.error}`);
  }
  // result: SuccessResult<T>
  return result.value;
}

// 조건부 타입 + CFA
function processResults<T>(results: Result<T>[]): T[] {
  const values: T[] = [];

  for (const result of results) {
    if (result.ok) {
      // result: SuccessResult<T>
      values.push(result.value);
    }
    // 실패한 결과는 무시
  }

  return values;
}
```

## CFA와 any/unknown

`any`와 `unknown` 타입에서 CFA의 동작 차이를 알아두면 유용하다.

```typescript
function processAny(value: any) {
  // any는 좁혀도 여전히 any — CFA가 의미 없음
  if (typeof value === "string") {
    value; // 타입: any (any에서 좁혀도 string이 아님)
  }
}

function processUnknown(value: unknown) {
  // unknown은 좁히면 구체 타입이 됨 — CFA가 의미 있음
  if (typeof value === "string") {
    value; // 타입: string
    value.toUpperCase(); // OK
  }
  // 좁히지 않으면 unknown — 직접 사용 불가
  value.toString(); // ❌ TS2571
}
```

`unknown`은 `any`와 달리 CFA를 통해 의미 있게 좁혀진다. 외부 입력을 처리할 때는 `any` 대신 `unknown`을 사용하고 CFA로 안전하게 좁히는 패턴이 권장된다.

TypeScript의 제어 흐름 분석은 코드의 논리적 흐름을 이해하고 각 시점에서 가능한 타입만을 허용한다. 이를 잘 활용하면 런타임 에러를 컴파일 타임에 잡아낼 수 있다.

---

**지난 글:** [in 연산자 타입 가드 — 프로퍼티 존재 여부로 타입 구분하기](/posts/ts-in-operator-narrowing/)

<br>
읽어주셔서 감사합니다. 😊
