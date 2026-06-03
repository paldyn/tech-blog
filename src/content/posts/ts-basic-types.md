---
title: "TypeScript 기본 타입: 타입 시스템의 첫걸음"
description: "string, number, boolean부터 null, undefined, unknown, never, any까지 — TypeScript 기본 타입 전체를 정확한 의미와 사용법으로 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "기본타입", "string", "number", "boolean", "unknown", "never", "any"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-vs-value-space/)에서 타입 공간과 값 공간의 차이를 이해했다. 이번 편에서는 TypeScript 타입 시스템의 가장 기본 단위인 **원시 타입, 특수 타입, 객체 타입**을 체계적으로 정리한다.

## 타입 분류 개요

![TypeScript 기본 타입 분류](/assets/posts/ts-basic-types-overview.svg)

TypeScript의 기본 타입은 크게 세 범주다.

1. **원시 타입**: `string`, `number`, `boolean`, `bigint`, `symbol`
2. **특수 타입**: `any`, `unknown`, `void`, `never`, `null`, `undefined`
3. **객체 타입**: `object`, 배열, 튜플, 인터페이스, 클래스

## 원시 타입 (Primitive Types)

### string

문자열 타입이다. 작은따옴표, 큰따옴표, 백틱 모두 허용된다.

```typescript
let name: string = "Alice";
let greeting: string = `Hello, ${name}!`;
let emoji: string = '😊';

// 메서드 자동완성이 string 전용으로 정확해짐
name.toUpperCase();  // OK
name.toFixed(2);     // Error: toFixed는 number에만 있음
```

### number

정수와 부동소수점을 모두 포괄한다. JavaScript처럼 분리되지 않는다.

```typescript
let age: number = 25;
let pi: number = 3.14159;
let hex: number = 0xFF;
let binary: number = 0b1010;
let octal: number = 0o755;
let big: number = 1_000_000;  // 숫자 구분자 허용

// NaN, Infinity도 number 타입
let notANumber: number = NaN;
let infinite: number = Infinity;
```

### boolean

`true`와 `false`만 허용된다. JavaScript처럼 truthy/falsy 값이 자동으로 boolean으로 취급되지 않는다.

```typescript
let isActive: boolean = true;
let isDone: boolean = false;

// 다음은 모두 에러
let flag: boolean = 1;      // Error: number는 boolean이 아님
let flag2: boolean = "yes"; // Error: string은 boolean이 아님
let flag3: boolean = null;  // Error: null은 boolean이 아님 (strictNullChecks)
```

### bigint

ES2020에서 추가된 정수 타입으로, `number`의 안전한 최대값(`2^53 - 1`)을 초과하는 정수를 다룬다.

```typescript
let big: bigint = 9007199254740993n;  // number로는 정확히 표현 불가
let fromBigInt: bigint = BigInt(100);

// number와 bigint는 혼합 불가
let result = big + 1;   // Error: bigint와 number 연산 불가
let result2 = big + 1n; // OK
```

### symbol

고유하고 변경 불가능한 원시값이다. 주로 객체 프로퍼티 키로 사용한다.

```typescript
const id1: symbol = Symbol("id");
const id2: symbol = Symbol("id");

console.log(id1 === id2); // false (항상 고유)

// unique symbol: 특정 심볼과 동일한 타입
const KEY: unique symbol = Symbol("key");
type KeyType = typeof KEY;
```

## 특수 타입

![TypeScript 타입 계층 구조](/assets/posts/ts-basic-types-hierarchy.svg)

### any: 타입 검사 탈출구

`any`는 모든 타입 검사를 비활성화한다. 어디에나 할당 가능하고 어디서나 받을 수 있다.

```typescript
let value: any = "hello";
value = 42;         // OK
value = true;       // OK
value = null;       // OK
value = {};         // OK

value.nonExistent;  // OK (에러 없음 — 위험!)
value();            // OK (에러 없음 — 위험!)
```

`any`는 TypeScript를 끄는 것과 같다. 타입 에러가 나면 `any`로 해결하려는 유혹이 생기지만, 이는 미래의 런타임 에러를 사는 것이다. **꼭 필요한 경우가 아니면 쓰지 않는다.**

### unknown: 안전한 any 대안

`unknown`도 모든 타입의 값을 받을 수 있다. 차이점은 `unknown` 타입 값은 사용 전에 반드시 타입을 좁혀야 한다.

```typescript
let input: unknown = getUserInput();

// any와 달리 직접 사용 불가
input.toUpperCase();    // Error: unknown 타입에는 메서드 없음
input();                // Error: 함수가 아닐 수 있음

// 타입 좁히기 후 사용 가능
if (typeof input === "string") {
  input.toUpperCase();  // OK: string으로 좁혀짐
}
```

외부 API 응답처럼 타입을 알 수 없는 데이터를 다룰 때 `any` 대신 `unknown`을 쓰는 것이 훨씬 안전하다.

### void: 반환값 없음

함수가 명시적으로 값을 반환하지 않을 때 사용한다.

```typescript
function logMessage(msg: string): void {
  console.log(msg);
  // return; 또는 아무것도 반환하지 않음
}

// void 타입 변수는 undefined만 할당 가능 (실용성 없음)
let v: void = undefined;
```

### never: 도달 불가 타입

`never`는 절대 발생하지 않는 타입이다. 두 가지 상황에서 등장한다.

```typescript
// 1. 항상 에러를 던지는 함수
function fail(message: string): never {
  throw new Error(message);
}

// 2. 무한 루프
function infiniteLoop(): never {
  while (true) {}
}

// 3. 소진 검사 (Exhaustiveness Check)
type Shape = "circle" | "square";

function area(shape: Shape): number {
  switch (shape) {
    case "circle": return Math.PI;
    case "square": return 1;
    default:
      const _exhaustive: never = shape;  // 모든 케이스 처리됐으면 에러 없음
      throw new Error(`Unknown shape: ${shape}`);
  }
}
```

### null과 undefined

TypeScript에서 `null`과 `undefined`는 별도의 타입이다.

```typescript
// strictNullChecks: true (권장)
let name: string = null;      // Error
let age: number = undefined;  // Error

// null/undefined를 허용하려면 유니언 타입 사용
let name: string | null = null;           // OK
let age: number | undefined = undefined;  // OK
```

`strictNullChecks`를 켜면 대부분의 null 참조 에러를 컴파일 타임에 잡을 수 있다.

## 타입 추론으로 주석 생략

초기값이 있으면 대부분의 경우 타입 주석을 생략해도 된다.

```typescript
// 다음 두 줄은 동일
let name: string = "Alice";
let name = "Alice";  // string으로 추론됨

// 단, 빈 선언은 주석 필요
let name: string;   // 나중에 할당할 것이므로 명시 필요
name = "Alice";
```

실무에서는 "타입 추론이 충분히 명확하면 주석 생략, 그렇지 않으면 명시"가 일반적인 기준이다.

## 리터럴 타입

원시 타입의 특정 값만 허용하는 리터럴 타입도 있다.

```typescript
let direction: "left" | "right" | "up" | "down";
direction = "left";   // OK
direction = "east";   // Error: "east"는 허용된 값이 아님

let count: 1 | 2 | 3 = 1;
count = 4;  // Error

// 리터럴 타입은 다음 편에서 자세히 다룸
```

다음 편에서는 원시 타입에서 더 나아가 특수 타입인 `any`, `unknown`, `never`를 더 깊이 다루면서 TypeScript 타입 계층의 전체 구조를 파악한다.

---

**지난 글:** [타입 공간과 값 공간: TypeScript를 이해하는 핵심 개념](/posts/ts-type-vs-value-space/)

<br>
읽어주셔서 감사합니다. 😊
