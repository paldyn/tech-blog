---
title: "TypeScript 완전 정복 ⑩: 기본 타입들"
description: "TypeScript의 원시 타입(string, number, boolean, bigint, symbol)부터 특수 타입(any, unknown, never, void), 배열, 튜플까지 기본 타입을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "기본타입", "string", "number", "boolean", "any", "unknown", "never"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-vs-value-space/)에서 타입 공간과 값 공간의 구분을 이해했다. 이번 글에서는 TypeScript의 **기본 타입 전체**를 체계적으로 정리한다. 타입 시스템의 기초 블록이므로 확실하게 익혀두자.

## 타입 분류 개요

![TypeScript 타입 분류](/assets/posts/ts-basic-types-tree.svg)

TypeScript의 타입은 크게 세 가지로 나뉜다: **원시 타입**, **객체 타입**, **특수 타입**. 각 타입을 하나씩 살펴본다.

## 원시 타입 (Primitive Types)

JavaScript의 7가지 원시값에 대응하는 TypeScript 타입들이다.

```typescript
// string: 문자열
let greeting: string = "Hello";
let template: string = `Hello, ${greeting}`;
let empty: string = "";

// number: 모든 숫자 (정수, 소수, NaN, Infinity 포함)
let integer: number = 42;
let float: number = 3.14;
let hex: number = 0xff;       // 255
let binary: number = 0b1010;  // 10
let octal: number = 0o17;     // 15
let notANumber: number = NaN;         // NaN도 number!
let infinite: number = Infinity;

// boolean
let done: boolean = false;
let active: boolean = true;

// bigint: 아주 큰 정수 (ES2020+)
let huge: bigint = 9007199254740993n;
let bigSum: bigint = 10n + 20n;

// symbol: 유일한 값
const key1: symbol = Symbol("key");
const key2: symbol = Symbol("key");
// key1 === key2 는 false (항상 유일)
```

### 중요: 소문자 타입을 사용할 것

```typescript
// 올바른 방법: 소문자 (원시 타입 키워드)
let name: string = "Alice";
let count: number = 42;

// 잘못된 방법: 대문자 (박싱된 객체 타입 — 절대 사용 금지)
let name2: String = "Alice";  // ESLint 경고
let count2: Number = 42;       // ESLint 경고
```

대문자 `String`, `Number`, `Boolean`은 박싱된 객체 타입이다. 원시값과 호환되지 않는 경우가 있고 불필요하게 무겁다.

## 배열 타입

```typescript
// 두 가지 표기 방식 — number[]가 더 선호됨
let numbers: number[] = [1, 2, 3];
let names: Array<string> = ["Alice", "Bob"];

// 여러 타입 배열: 유니온 타입
let mixed: (string | number)[] = ["hello", 42];

// 읽기 전용 배열
const constants: readonly number[] = [1, 2, 3];
// constants.push(4); // 오류!

// 비어 있는 배열
let items: string[] = [];
items.push("first");
```

## 튜플 타입

```typescript
// 고정 길이, 각 위치별 타입 지정
let pair: [string, number] = ["Alice", 30];
let triple: [string, number, boolean] = ["Bob", 25, true];

// 튜플 구조분해
const [name, age] = pair;
// name: string, age: number 로 추론됨

// 레이블이 있는 튜플 (가독성 향상)
type Point = [x: number, y: number];
const point: Point = [10, 20];

// 옵셔널 튜플 요소
type Response = [status: number, data?: string];
const ok: Response = [200, "OK"];
const err: Response = [404];  // data 생략 가능
```

## 객체 타입

```typescript
// 인라인 객체 타입
let user: { name: string; age: number } = {
  name: "Alice",
  age: 30,
};

// 선택적 프로퍼티
let config: { host: string; port?: number } = {
  host: "localhost",
  // port는 선택적이므로 생략 가능
};

// 읽기 전용 프로퍼티
let point: { readonly x: number; readonly y: number } = {
  x: 10,
  y: 20,
};
// point.x = 100; // 오류!
```

## 특수 타입 (Special Types)

![원시 타입과 특수 타입 예시](/assets/posts/ts-basic-types-examples.svg)

### any: 타입 검사를 끈다

```typescript
let value: any = "hello";
value = 42;           // 허용
value = true;         // 허용
value.foo.bar.baz;    // 허용 (런타임 오류 가능성)
```

`any`는 TypeScript의 타입 검사를 완전히 비활성화한다. 레거시 코드 마이그레이션이나 불가피한 경우에만 사용한다. `strict: true` 설정에서 암묵적 `any`는 오류로 처리된다.

### unknown: any의 안전한 버전

```typescript
let input: unknown = fetchUserData();

// input을 바로 사용하려면 오류
// input.name; // 오류: Object is of type 'unknown'

// 검사 후 사용 가능
if (typeof input === "string") {
  console.log(input.toUpperCase()); // 안전
}

if (input !== null && typeof input === "object" && "name" in input) {
  console.log((input as { name: unknown }).name);
}
```

외부 API 응답, `JSON.parse()` 결과 등 타입을 모르는 값에는 `any` 대신 `unknown`을 사용한다.

### void: 반환값 없음

```typescript
function logMessage(msg: string): void {
  console.log(msg);
  // return 없거나 return;만 가능
  // return "something"; // 오류!
}

// void 반환 함수를 변수에 할당할 때
const log: (msg: string) => void = logMessage;
```

### never: 절대 반환되지 않음

```typescript
// 항상 예외를 던지는 함수
function fail(message: string): never {
  throw new Error(message);
}

// 무한 루프
function forever(): never {
  while (true) {}
}

// 타입 좁히기에서 도달 불가능한 분기
function processValue(x: string | number) {
  if (typeof x === "string") {
    console.log(x.toUpperCase());
  } else if (typeof x === "number") {
    console.log(x.toFixed(2));
  } else {
    const _exhaustive: never = x; // x의 타입이 never가 됨
  }
}
```

### null과 undefined

```typescript
// strictNullChecks: true 에서 null/undefined는 별도 타입
let maybeNull: string | null = null;
let maybeUndefined: number | undefined = undefined;

// null 체크 후 사용
if (maybeNull !== null) {
  console.log(maybeNull.length); // 안전
}

// Optional chaining (?.): 안전한 접근
const length = maybeNull?.length; // undefined (null이면)

// Nullish coalescing (??): null/undefined 기본값
const safeValue = maybeNull ?? "default";
```

## 타입 추론: 어노테이션을 생략해도 된다

```typescript
// TypeScript가 오른쪽 값에서 타입을 자동 추론
let name = "Alice";       // string으로 추론
let count = 42;            // number로 추론
let active = true;         // boolean으로 추론
let numbers = [1, 2, 3];  // number[]로 추론

// 함수도 반환 타입이 추론됨
function double(n: number) {
  return n * 2;  // 반환 타입: number (추론)
}

// 명시적 어노테이션이 필요한 경우
// 1. 함수 매개변수 (추론 불가)
// 2. 빈 배열 초기화
let items: string[] = [];  // []만 쓰면 never[]로 추론됨
// 3. 타입이 여러 개일 때 의도를 명확히
let value: string | number = Math.random() > 0.5 ? "text" : 42;
```

## 정리

TypeScript의 기본 타입은 JavaScript 원시 타입과 1:1로 대응하는 소문자 타입들(string, number, boolean, bigint, symbol)이 핵심이다. `unknown`을 `any` 대신 사용하고, `null`/`undefined`를 명시적으로 처리하는 습관을 들이자. 타입 추론을 활용하면 불필요한 어노테이션을 줄일 수 있다.

---

**지난 글:** [타입 공간 vs 값 공간](/posts/ts-type-vs-value-space/)

<br>
읽어주셔서 감사합니다. 😊
