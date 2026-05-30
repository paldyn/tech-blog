---
title: "TypeScript 원시 타입 완전 정복: string, number, boolean 외 4종"
description: "TypeScript의 7가지 원시 타입(string, number, boolean, bigint, symbol, null, undefined)을 완전히 정리합니다. 소문자 vs 대문자 타입 주의사항, strictNullChecks 동작, 원시 타입별 유용한 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["원시타입", "string", "number", "boolean", "TypeScript완전정복", "null", "undefined"]
featured: false
draft: false
---

[지난 글](/posts/ts-basic-types/)에서 TypeScript 타입 시스템의 전체 구조를 파악했다. 이번 글에서는 원시 타입(Primitive Types) 7가지를 하나씩 깊이 살펴본다. 원시 타입은 TypeScript 타입 시스템의 기초이며, 이를 정확히 이해해야 고급 타입 기능도 제대로 쓸 수 있다.

## 원시 타입이란

원시 타입은 변경 불가능한(immutable) 단순 값을 나타낸다. 객체와 달리 메모리에 값 자체가 저장된다(값 타입).

JavaScript의 7가지 원시 타입은 TypeScript에서도 그대로 사용된다.

![TypeScript 원시 타입 7종](/assets/posts/ts-primitive-types-overview.svg)

## string

텍스트 데이터를 나타낸다. 작은따옴표, 큰따옴표, 백틱(템플릿 리터럴) 모두 `string` 타입이다.

```typescript
// 기본 string
let firstName: string = "Alice";
let lastName: string = 'Park';
let fullName: string = `${firstName} ${lastName}`;

// 멀티라인 문자열
let longText: string = `
  이것은 여러 줄에 걸친
  긴 텍스트입니다.
`;

// string 메서드 (TypeScript가 타입을 알기 때문에 자동완성 제공)
console.log(firstName.toUpperCase());  // "ALICE"
console.log(firstName.length);         // 5
console.log(firstName.includes("li")); // true
console.log(firstName.slice(0, 3));    // "Ali"

// 타입 안전성
let message: string = "hello";
message = 42;    // Error: number는 string에 할당 불가
message = true;  // Error: boolean은 string에 할당 불가
```

### 리터럴 타입으로 값 범위 제한

```typescript
// 특정 문자열만 허용하는 리터럴 타입
type Direction = "north" | "south" | "east" | "west";
type Lang = "en" | "ko" | "ja";

function navigate(dir: Direction): void {
  console.log(`Going ${dir}`);
}

navigate("north");   // OK
navigate("up");      // Error: "up"은 Direction에 없는 값
```

## number

정수와 실수를 통합한 타입이다. JavaScript와 마찬가지로 64비트 IEEE 754 부동소수점 형식이다.

```typescript
// 다양한 number 리터럴
let integer: number = 42;
let float: number = 3.14159;
let negative: number = -273.15;
let hex: number = 0xFF;       // 255
let octal: number = 0o377;    // 255
let binary: number = 0b11111111;  // 255
let exponential: number = 1e6;    // 1000000

// 특수 number 값
let notANumber: number = NaN;
let posInfinity: number = Infinity;
let negInfinity: number = -Infinity;

// 정밀도 문제 (JavaScript 동일)
console.log(0.1 + 0.2);  // 0.30000000000000004
```

### 안전한 정수 범위

```typescript
// Number.MAX_SAFE_INTEGER 초과 시 정밀도 손실
const max = Number.MAX_SAFE_INTEGER;  // 9007199254740991
console.log(max + 1 === max + 2);     // true! (정밀도 손실)

// bigint를 사용해야 하는 경우
const bigId: bigint = 9007199254740993n;  // 정확한 값 유지
```

## boolean

`true` 또는 `false` 두 값만 가지는 타입이다.

```typescript
let isLoggedIn: boolean = false;
let hasPermission: boolean = true;
let isAdmin: boolean = Boolean(0);  // false

// 논리 연산
let canAccess: boolean = isLoggedIn && hasPermission;
let showBanner: boolean = !isLoggedIn;

// 조건문에서의 활용
function checkAccess(role: string): boolean {
  return role === "admin" || role === "moderator";
}

// 주의: Boolean 객체와 boolean 원시 타입의 차이
let a: boolean = true;           // 원시 타입 (권장)
let b: Boolean = new Boolean(true); // 객체 래퍼 (비권장)
```

## bigint (ES2020+)

`Number.MAX_SAFE_INTEGER`를 초과하는 정수를 정확하게 처리해야 할 때 사용한다.

```typescript
// bigint 리터럴: 숫자 뒤에 n
let large: bigint = 9007199254740993n;
let huge: bigint = BigInt("12345678901234567890");

// bigint 연산
let a: bigint = 100n;
let b: bigint = 200n;
console.log(a + b);   // 300n
console.log(a * b);   // 20000n
console.log(b / a);   // 2n (나머지 버림)

// 주의: bigint와 number는 섞을 수 없음
let num: number = 42;
let big: bigint = 100n;
let result = num + big;      // Error: 타입 혼용 불가
let result2 = BigInt(num) + big;  // OK: 명시적 변환

// 활용: 금융 계산, 암호화, 고유 ID
const transactionId: bigint = BigInt(Date.now()) * 1000000n;
```

## symbol

유일하고 불변인 원시 값이다. 주로 객체의 고유한 키로 사용한다.

```typescript
// symbol 생성: 동일한 설명을 넘겨도 서로 다른 심볼
const sym1 = Symbol("id");
const sym2 = Symbol("id");
console.log(sym1 === sym2);  // false — 절대 같지 않음

// 객체 키로 사용
const ID = Symbol("id");
const obj = {
  [ID]: "unique-123",
  name: "Alice"
};

console.log(obj[ID]);    // "unique-123"
console.log(obj.name);   // "Alice"

// 전역 심볼 레지스트리 (Symbol.for)
const sharedSym1 = Symbol.for("shared");
const sharedSym2 = Symbol.for("shared");
console.log(sharedSym1 === sharedSym2);  // true — 같은 심볼

// unique symbol: 컴파일 타임에 완전히 고유함 보장
const UNIQUE = Symbol() as const;
type UniqueType = typeof UNIQUE;
```

## null과 undefined

TypeScript에서 `null`과 `undefined`는 별도의 타입이다.

```typescript
// null: 의도적으로 "값 없음"을 나타냄
let selectedItem: string | null = null;
selectedItem = "item-1";  // OK
selectedItem = null;      // OK (선택 취소)

// undefined: 아직 값이 할당되지 않음
let pending: string | undefined;  // undefined 상태
pending = "data";         // 나중에 할당

// 옵셔널 프로퍼티 (자동으로 | undefined 포함)
interface Config {
  host: string;
  port?: number;  // number | undefined
}
```

![원시 타입 주의사항](/assets/posts/ts-primitive-types-comparison.svg)

### strictNullChecks

`strict: true` (또는 `strictNullChecks: true`) 설정 시 `null`과 `undefined`는 다른 타입에 할당할 수 없다.

```typescript
// strictNullChecks: true (권장)
let name: string = null;        // Error: null은 string이 아님
let age: number = undefined;    // Error: undefined는 number가 아님

// null/undefined 허용하려면 유니언 타입으로 명시
let nullableName: string | null = null;     // OK
let optionalAge: number | undefined;        // OK

// strictNullChecks: false 에서는 (비권장)
let name2: string = null;     // OK — null이 모든 타입에 할당 가능
let age2: number = undefined; // OK — undefined도 마찬가지
```

### null 안전하게 다루기

```typescript
interface User {
  name: string;
  email: string | null;
}

// Optional chaining (?.)
function displayEmail(user: User): string {
  return user.email?.toUpperCase() ?? "이메일 없음";
  // user.email이 null이면 ?? 뒤의 기본값 반환
}

// Nullish coalescing (??)
const displayName = user.name ?? "익명";

// Non-null assertion (! — 타입 검사를 수동으로 우회)
const email = user.email!.toUpperCase();  // user.email이 null이 아님을 보장
// 주의: null이면 런타임 오류 발생 — 확실한 경우에만 사용
```

## 소문자 vs 대문자 타입

이것은 TypeScript 초보자가 자주 혼동하는 부분이다.

```typescript
// 소문자 (권장): 원시 타입
let s: string = "hello";
let n: number = 42;
let b: boolean = true;

// 대문자 (비권장): 객체 래퍼 타입
let S: String = new String("hello");
let N: Number = new Number(42);
let B: Boolean = new Boolean(true);

// 문제: 소문자 타입에 대문자 타입 할당 불가
let str: string = new String("hello");  // Error!

// 대문자 타입은 실제로 객체
typeof new String("hello")  // "object" (원시 string이 아님!)
typeof "hello"               // "string"

// 결론: 항상 소문자 타입 사용
```

## 정리

TypeScript의 7가지 원시 타입은 `string`, `number`, `boolean`, `bigint`, `symbol`, `null`, `undefined`다. 핵심 주의사항은 세 가지다. 첫째, 항상 소문자 타입(`string`, `number`, `boolean`)을 사용한다. 둘째, `strictNullChecks`를 활성화하고 `null`/`undefined`를 유니언 타입으로 명시한다. 셋째, `bigint`와 `number`는 혼용할 수 없다. 다음 글에서는 TypeScript 고유의 특수 타입인 `any`, `unknown`, `never`, `void`를 다룬다.

---

**지난 글:** [TypeScript 기본 타입: 타입 시스템의 구성 요소](/posts/ts-basic-types/)

**다음 글:** [TypeScript 특수 타입: any, unknown, never, void 완전 정복](/posts/ts-special-types/)

<br>
읽어주셔서 감사합니다. 😊
