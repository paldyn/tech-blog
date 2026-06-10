---
title: "TypeScript 기본 타입 완전 정리"
description: "TypeScript의 기본 타입 전체를 체계적으로 정리합니다. 원시 타입(number, string, boolean), 특수 타입(any, unknown, never, void), 객체 타입, 배열과 튜플까지 실용적인 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "기본타입", "number", "string", "boolean", "unknown", "never"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-vs-value-space/)에서 타입 공간과 값 공간의 차이를 이해했습니다. 이번 글에서는 TypeScript의 기본 타입들을 체계적으로 정리합니다. 이 타입들은 TypeScript 전체 타입 시스템의 기초가 됩니다.

## 원시 타입 (Primitive Types)

JavaScript의 원시값에 대응하는 TypeScript 타입입니다.

![TypeScript 기본 타입 분류](/assets/posts/ts-basic-types-overview.svg)

```typescript
// number: 정수, 부동소수, 특수값 모두
const age: number = 25;
const pi: number = 3.14159;
const infinity: number = Infinity;
const notANumber: number = NaN;
const hex: number = 0xff;
const binary: number = 0b1010;

// string: 단따옴표, 쌍따옴표, 백틱 모두
const name: string = "Alice";
const greeting: string = `Hello, ${name}!`;

// boolean
const isLoggedIn: boolean = true;
const hasPermission: boolean = false;

// bigint: 매우 큰 정수 (ES2020+)
const bigNumber: bigint = 9007199254740993n;

// symbol: 유일한 값
const id: symbol = Symbol("userId");
const KEY: unique symbol = Symbol("KEY");
```

## 특수 타입

### null과 undefined

```typescript
// strictNullChecks: true (권장) 환경에서
let value: string | null = "hello";
value = null;    // OK
value = undefined; // TS2322: undefined는 null에 할당 불가

let optional: string | undefined = "world";
optional = undefined; // OK

// null 처리 패턴
function getUsername(id: number): string | null {
  if (id <= 0) return null;
  return `user_${id}`;
}

const username = getUsername(1);
// username.toUpperCase(); // 오류: null일 수 있음
if (username !== null) {
  username.toUpperCase(); // OK: null 아님을 확인
}
```

### any와 unknown

```typescript
// any: 타입 검사 비활성화 — 사용 자제
let data: any = fetchRawData();
data.foo.bar.baz; // 타입 오류 없음, 런타임에 터질 수 있음

// unknown: any의 안전한 대안
let userInput: unknown = getUserInput();

// 좁히기(narrowing) 후에만 사용 가능
if (typeof userInput === "string") {
  userInput.toUpperCase(); // OK: string으로 확인됨
}
if (typeof userInput === "number") {
  userInput.toFixed(2);    // OK: number로 확인됨
}
```

`unknown`은 `any`와 달리 타입을 확인하지 않으면 사용할 수 없습니다. API 응답이나 사용자 입력처럼 타입을 알 수 없는 값에는 `any` 대신 `unknown`을 사용합니다.

### void와 never

```typescript
// void: 반환값이 없는 함수
function logMessage(msg: string): void {
  console.log(msg);
  // return 불가 (undefined는 허용)
}

// never: 절대 반환하지 않는 함수
function throwError(message: string): never {
  throw new Error(message);
}

function infiniteLoop(): never {
  while (true) {}
}

// never는 exhaustiveness checking에도 활용
type Shape = "circle" | "square";

function getArea(shape: Shape): number {
  if (shape === "circle") return 3.14;
  if (shape === "square") return 1;
  const _exhaustive: never = shape; // 모든 케이스 처리 시 never
  return _exhaustive;
}
```

## 객체 타입

![타입 예시 코드](/assets/posts/ts-basic-types-hierarchy.svg)

```typescript
// object 타입: 원시값이 아닌 모든 것
let obj: object = { key: "value" };
// obj.key; // 오류: object 타입에 index signature 없음

// 객체 리터럴 타입 (더 구체적)
let point: { x: number; y: number } = { x: 0, y: 0 };

// 선택적 속성
type Config = {
  host: string;
  port: number;
  timeout?: number; // ?로 선택적 속성
};

const serverConfig: Config = {
  host: "localhost",
  port: 3000,
  // timeout은 없어도 OK
};
```

## 배열과 튜플

```typescript
// 배열 타입 — 두 가지 표기 방식
const numbers: number[] = [1, 2, 3, 4, 5];
const names: Array<string> = ["Alice", "Bob", "Charlie"];

// 혼합 배열은 유니온 타입
const mixed: (string | number)[] = [1, "two", 3, "four"];

// 튜플: 고정 길이, 각 위치 타입 명시
type Coordinate = [number, number];
const pos: Coordinate = [37.5665, 126.9780]; // 서울 위도/경도

type NameAge = [string, number];
const alice: NameAge = ["Alice", 30];
// const wrong: NameAge = [30, "Alice"]; // 오류: 타입 순서 불일치

// 선택적 튜플 요소 (TypeScript 4.0+)
type HttpResponse = [number, string, string?];
const ok: HttpResponse = [200, "OK"];
const created: HttpResponse = [201, "Created", "https://..."];
```

## 타입 추론 활용하기

TypeScript는 대부분의 경우 타입을 자동으로 추론합니다. 명시적 주석이 불필요한 경우에는 생략하는 것이 좋습니다.

```typescript
// 타입 주석 불필요: TS가 추론
const count = 0;          // number
const greeting = "hello"; // string
const active = true;      // boolean

const double = (n: number) => n * 2; // (n: number) => number

// 매개변수는 추론 불가 → 명시 필요
function add(a: number, b: number) {
  return a + b; // 반환 타입 number 자동 추론
}

// 복잡한 반환 타입은 명시 권장
async function fetchUser(id: number): Promise<User | null> {
  // 반환 타입을 명시하면 함수 body의 오류를 더 일찍 잡을 수 있음
  return null;
}
```

기본 타입을 탄탄히 이해하면 이후에 나오는 유니온 타입, 인터섹션, 제네릭을 훨씬 수월하게 배울 수 있습니다. 다음 글에서는 원시 타입을 더 깊이 살펴봅니다.

---

**지난 글:** [타입 공간과 값 공간: TypeScript의 두 세계](/posts/ts-type-vs-value-space/)

**다음 글:** [TypeScript 원시 타입 완전 분석](/posts/ts-primitive-types/)

<br>
읽어주셔서 감사합니다. 😊
