---
title: "TypeScript 기본 타입 완벽 가이드"
description: "string, number, boolean부터 any, unknown, never까지 TypeScript의 모든 기본 타입을 예시 코드와 함께 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "기본타입", "string", "number", "boolean", "any", "unknown", "never"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-vs-value-space/)에서 타입 공간과 값 공간의 차이를 살펴봤습니다. 이번에는 TypeScript의 모든 기본 타입을 체계적으로 정리합니다. 올바른 타입 선택이 더 안전하고 표현적인 코드를 만듭니다.

![TypeScript 기본 타입 개요](/assets/posts/ts-basic-types-hierarchy.svg)

## 원시 타입 (Primitive Types)

JavaScript의 7가지 원시 타입 중 TypeScript에서 자주 쓰이는 것들입니다.

### string

```typescript
const name: string = "Alice";
const greeting: string = `Hello, ${name}!`;  // 템플릿 리터럴
const multiline: string = `
  여러 줄
  문자열
`;

// string 메서드는 모두 타입 안전하게 사용 가능
const upper: string = name.toUpperCase();
const len: number = name.length;  // number 반환
```

### number

TypeScript의 `number`는 정수와 부동소수점을 모두 포함합니다. JavaScript와 동일하게 IEEE 754 64비트 부동소수점입니다.

```typescript
const integer: number = 42;
const float: number = 3.14;
const negative: number = -7;
const hex: number = 0xFF;       // 16진수
const binary: number = 0b1010;  // 2진수
const octal: number = 0o17;     // 8진수
const infinity: number = Infinity;
const nan: number = NaN;        // number 타입이지만 숫자 아님
```

### boolean

```typescript
const isActive: boolean = true;
const isPending: boolean = false;

// 비교 연산 결과는 boolean
const isAdult: boolean = age >= 18;

// 주의: Boolean 래퍼 객체와 구분
const b1: boolean = true;            // ✅ 원시값
const b2: Boolean = new Boolean(true); // ⚠️ 객체 (피하는 것 권장)
```

### bigint

2^53 이상의 매우 큰 정수가 필요할 때 사용합니다.

```typescript
const big: bigint = 9007199254740993n;  // n 접미사
const sum: bigint = big + 1n;

// bigint와 number는 혼용 불가
const mixed = big + 1;  // ❌ 에러: bigint와 number 연산 불가
```

### symbol

유일하고 불변한 값입니다. 객체 프로퍼티 키로 주로 사용합니다.

```typescript
const sym1: symbol = Symbol("id");
const sym2: symbol = Symbol("id");

console.log(sym1 === sym2); // false — 항상 고유

// const로 선언하면 더 좁은 unique symbol 타입
const unique1 = Symbol("key") as const;
```

## 특수 타입 (Special Types)

### null과 undefined

`strict: true`(strictNullChecks)가 활성화된 경우, `null`과 `undefined`는 별도의 타입이 됩니다.

```typescript
// strictNullChecks: true (권장)
let str: string = "hello";
str = null;       // ❌ 에러: null은 string에 할당 불가
str = undefined;  // ❌ 에러

// nullable 타입은 유니온으로 명시
let maybeStr: string | null = null;
maybeStr = "hello";  // ✅

// Optional chaining으로 안전하게 접근
const len = maybeStr?.length ?? 0;
```

### void

반환값이 없는 함수의 반환 타입입니다.

```typescript
function logMessage(msg: string): void {
  console.log(msg);
  // return; // OK
  // return undefined; // OK
  // return "value"; // ❌ 에러
}

// void는 undefined를 할당 가능
const result: void = undefined;
```

### never

절대로 값을 반환하지 않는 함수의 타입입니다. 항상 예외를 던지거나, 무한 루프인 경우입니다.

```typescript
// 항상 예외를 던지는 함수
function throwError(msg: string): never {
  throw new Error(msg);
  // 이 줄은 절대 도달 불가
}

// 무한 루프
function loop(): never {
  while (true) {}
}

// 유니온 타입의 모든 케이스를 처리한 후 남는 타입
type Shape = "circle" | "square";

function getArea(shape: Shape): number {
  if (shape === "circle") return Math.PI;
  if (shape === "square") return 1;
  // 여기서 shape는 never 타입
  const exhaustive: never = shape;
  throw new Error(`Unknown shape: ${exhaustive}`);
}
```

### any

타입 검사를 완전히 우회합니다. 최후의 수단으로만 사용해야 합니다.

```typescript
let data: any = "hello";
data = 42;          // OK
data = { id: 1 };   // OK
data.foo.bar.baz;   // OK — 런타임에 폭발할 수 있음!

// any는 타입 안전성을 포기하는 것
// 사용 전 unknown이나 구체적인 타입으로 대체 가능한지 검토
```

### unknown

`any`의 안전한 대안입니다. 무엇이든 할당 가능하지만, 사용 전에 타입을 좁혀야 합니다.

```typescript
let value: unknown = "hello";

// 타입 좁히기 전에는 사용 불가
value.toUpperCase();  // ❌ Object is of type 'unknown'

// 타입 가드 후 안전하게 사용
if (typeof value === "string") {
  value.toUpperCase(); // ✅
}

// any와 unknown의 차이
function processAny(data: any) {
  data.nonExistent; // ✅ 타입 검사 안 함
}

function processUnknown(data: unknown) {
  data.nonExistent; // ❌ 반드시 타입 좁히기 필요
}
```

## 기본 타입 사용 예시

![기본 타입 코드 예시](/assets/posts/ts-basic-types-examples.svg)

## 타입 추론 활용

명시적 어노테이션보다 타입 추론을 활용하는 것이 더 깔끔할 때가 많습니다.

```typescript
// 초기값이 있으면 어노테이션 생략 권장
const name = "Alice";          // string 추론
const age = 30;                // number 추론
const tags = ["ts", "types"]; // string[] 추론

// 함수 매개변수는 명시 권장 (추론 불가)
function add(a: number, b: number) {
  return a + b;  // 반환 타입은 number로 추론됨
}

// 복잡한 타입은 명시하는 것이 문서화에 도움
async function fetchUser(id: number): Promise<User | null> {
  // 반환 타입 명시로 실수 방지
}
```

## 타입 선택 가이드

```typescript
// 입력 값의 타입을 모를 때: unknown (any 대신)
function parse(json: string): unknown {
  return JSON.parse(json);
}

// 절대 도달 불가를 명시할 때: never
function assertNever(x: never): never {
  throw new Error("Unreachable: " + x);
}

// 반환 없는 함수: void
function cleanup(): void {
  cache.clear();
}

// 값이 있을 수도 없을 수도: T | null | undefined 또는 T | undefined
function find<T>(arr: T[], pred: (x: T) => boolean): T | undefined {
  return arr.find(pred);
}
```

기본 타입을 정확히 이해하면 이후 고급 타입인 유니온, 인터섹션, 조건부 타입을 학습하기 훨씬 쉬워집니다.

---

**지난 글:** [타입 공간과 값 공간 — TypeScript의 두 세계](/posts/ts-type-vs-value-space/)

<br>
읽어주셔서 감사합니다. 😊
