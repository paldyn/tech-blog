---
title: "TypeScript 특수 타입: any, unknown, never, void 완전 정복"
description: "TypeScript의 4가지 특수 타입(any, unknown, never, void)의 의미와 차이를 완전히 이해합니다. 각 타입을 언제 쓰고 언제 피해야 하는지, 타입 계층에서의 위치와 실전 사용 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["any", "unknown", "never", "void", "TypeScript완전정복", "특수타입", "TypeScript타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-primitive-types/)에서 TypeScript의 원시 타입 7종을 깊이 살펴봤다. 이번에는 TypeScript 고유의 특수 타입인 `any`, `unknown`, `never`, `void`를 다룬다. 이 4가지 타입을 정확히 이해하면 TypeScript의 타입 시스템을 완전히 제어할 수 있다.

## 타입 계층과 특수 타입

TypeScript의 타입 시스템은 계층 구조를 가진다. 이 계층에서 특수 타입들의 위치를 먼저 이해하자.

```
최상위: unknown (모든 타입의 상위 타입)
  ↑
  any (타입 검사 비활성화 — 탈출구)
  ↓
일반 타입들: string, number, boolean, object...
  ↓
최하위: never (어떤 값도 가질 수 없는 타입)
```

![특수 타입 비교](/assets/posts/ts-special-types-comparison.svg)

## any: 타입 검사의 탈출구

`any`는 모든 타입을 허용하고, 타입 검사를 완전히 비활성화한다. TypeScript를 JavaScript처럼 사용하게 만드는 타입이다.

```typescript
let value: any = 42;
value = "hello";     // OK
value = true;        // OK
value = { x: 1 };   // OK
value = null;        // OK

// any 타입에서는 모든 연산이 허용됨 — 오류 없음
value.foo();         // OK (런타임에 오류가 날 수 있지만 컴파일 통과)
value.bar.baz();     // OK
value + 10;          // OK
```

### any를 써도 되는 경우

```typescript
// 1. JavaScript에서 TypeScript로 마이그레이션 중 임시 사용
const legacyData: any = getOldLibraryData();  // 나중에 구체적 타입으로 교체 예정

// 2. 타입 정의가 없는 서드파티 라이브러리
declare const oldLibrary: any;

// 3. 동적 데이터 구조 (최후의 수단)
const cache: Map<string, any> = new Map();
```

### any를 피해야 하는 이유

```typescript
// any는 전파된다 — 타입 안전성이 구멍난다
function process(data: any) {
  return data.value;  // 반환 타입도 any
}

const result = process({ value: 42 });
result.toFixed(2);  // 컴파일 OK, 하지만 result가 any라서 타입 안전성 없음
result.toUpperCase();  // 이것도 컴파일 OK — 런타임 오류 위험

// any 남발 == TypeScript를 JavaScript로 강등
```

## unknown: any의 안전한 대안

`unknown`은 "타입을 모르는 값"을 나타낸다. `any`처럼 모든 값을 할당받을 수 있지만, **타입 좁히기(narrowing) 없이는 사용할 수 없다**.

```typescript
let value: unknown = "hello";
value = 42;       // OK
value = true;     // OK

// unknown 타입은 타입 좁히기 전에 사용 불가
value.toUpperCase();         // Error: 'unknown'은 메서드 없음
value + 10;                  // Error: 'unknown'은 연산 불가
const len = value.length;    // Error

// 타입 좁히기 후에는 안전하게 사용 가능
if (typeof value === "string") {
  value.toUpperCase();  // OK — string으로 좁혀짐
  console.log(value.length);  // OK
}

if (typeof value === "number") {
  value.toFixed(2);  // OK — number로 좁혀짐
}
```

### unknown 실전 활용

```typescript
// API 응답 타입 처리
async function fetchData(url: string): Promise<unknown> {
  const response = await fetch(url);
  return response.json();  // JSON은 실제로 unknown
}

const data = await fetchData("https://api.example.com/users");

// 타입 가드로 안전하게 사용
function isUser(obj: unknown): obj is { name: string; age: number } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "age" in obj
  );
}

if (isUser(data)) {
  console.log(data.name);  // OK — 타입 가드 통과
}

// try-catch에서 error 타입 처리 (TypeScript 4.0+)
try {
  throw new Error("오류!");
} catch (error: unknown) {
  // error는 unknown — Error 타입을 가정하면 안 됨
  if (error instanceof Error) {
    console.log(error.message);  // OK — Error 타입으로 좁혀짐
  }
}
```

## never: 절대 발생하지 않는 타입

`never`는 절대 값이 존재할 수 없는 타입이다. 모든 타입의 하위 타입이라 어떤 타입에도 할당 가능하지만, `never` 자신에는 `never` 외에 아무것도 할당할 수 없다.

```typescript
// never를 반환하는 함수: 절대 정상 종료되지 않음
function throwError(message: string): never {
  throw new Error(message);
}

function infiniteLoop(): never {
  while (true) {
    // 영원히 실행됨 — 반환 없음
  }
}

// never를 반환하는 함수는 다른 타입으로 쓸 수 있음
function getUser(id: number): string {
  if (id <= 0) {
    return throwError("ID는 양수여야 합니다");  // OK: never는 string에 할당 가능
  }
  return "Alice";
}
```

### Exhaustiveness Check (완전성 검사)

`never`의 가장 중요한 실용 패턴이다.

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number }
  | { kind: "triangle"; base: number; height: number };

function getArea(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.side ** 2;
    case "triangle":
      return (shape.base * shape.height) / 2;
    default:
      // 모든 케이스를 처리했다면 여기는 never
      const exhaustive: never = shape;
      throw new Error(`처리되지 않은 shape: ${JSON.stringify(exhaustive)}`);
  }
}

// Shape에 rectangle이 추가되면?
type Shape2 =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number };  // 새 타입 추가

// getArea에서 rectangle을 처리하지 않으면
// default case에서 rectangle이 never에 할당될 때 컴파일 오류 발생!
// → 새 타입 처리를 강제한다
```

### 조건부 타입에서 never

```typescript
// 특정 타입 제거
type NonString<T> = T extends string ? never : T;

type NumOrBool = number | string | boolean;
type WithoutString = NonString<NumOrBool>;  // number | boolean
```

## void: 반환값이 없는 함수

`void`는 함수가 의미 있는 값을 반환하지 않음을 나타낸다. `undefined`를 반환하거나 아무것도 반환하지 않는 함수의 반환 타입이다.

```typescript
// void를 반환하는 함수
function log(message: string): void {
  console.log(message);
  // return 없음 — 암묵적으로 undefined 반환
}

function saveSettings(config: Config): void {
  localStorage.setItem("config", JSON.stringify(config));
  // return; 가능 — void 함수에서 빈 return 허용
}

// void vs never 차이
function logAndReturn(): void {
  console.log("실행됨");
  // 정상적으로 반환됨 (undefined 반환)
}

function crashAndBurn(): never {
  throw new Error("크래시!");
  // 절대 반환되지 않음
}
```

### 콜백 타입에서 void

```typescript
// 배열 메서드의 콜백은 void를 반환한다
const numbers = [1, 2, 3];

// forEach의 콜백 타입: (value: number) => void
numbers.forEach((n) => {
  console.log(n);
  // 반환값이 있어도 forEach는 무시함
});

// void 콜백은 실제로 값을 반환해도 됨 — 단지 무시될 뿐
type Callback = () => void;
const fn: Callback = () => 42;  // OK — 42가 반환되지만 void 계약 만족
```

![특수 타입 사용 패턴](/assets/posts/ts-special-types-usage.svg)

## 4가지 특수 타입 비교 정리

| 타입 | 의미 | 사용 시점 |
|------|------|----------|
| `any` | 타입 검사 완전 해제 | JS 마이그레이션, 타입 미지원 라이브러리 |
| `unknown` | 타입 불명확, 안전한 any | API 응답, JSON 파싱, 외부 입력 |
| `never` | 값이 절대 존재하지 않음 | 항상 throw, 완전성 검사, 조건부 타입 |
| `void` | 반환값 없음 | 부작용만 있는 함수, 콜백 타입 |

```typescript
// 실전 선택 가이드
function processInput(input: ???): void {
  // 입력 타입을 모른다 → unknown 사용
}

function handleError(msg: string): ??? {
  throw new Error(msg);
  // 절대 반환 안 함 → never
}

function saveData(data: Config): ??? {
  localStorage.setItem("key", JSON.stringify(data));
  // 반환값 없음 → void
}

function quickFix(data: any): ??? {
  // 마이그레이션 중 임시 → any 허용, 나중에 교체
}
```

## 정리

특수 타입 4가지의 핵심만 기억하자. `any`는 탈출구지만 가능하면 피한다. `unknown`은 타입을 모를 때 `any` 대신 쓰는 안전한 선택이다. `never`는 값이 있을 수 없는 상황(항상 throw, exhaustiveness check)에 쓴다. `void`는 반환값이 없는 함수의 반환 타입이다. 이 4가지를 올바르게 활용하면 TypeScript의 타입 시스템을 최대한 활용할 수 있다.

---

**지난 글:** [TypeScript 원시 타입 완전 정복: string, number, boolean 외 4종](/posts/ts-primitive-types/)

<br>
읽어주셔서 감사합니다. 😊
