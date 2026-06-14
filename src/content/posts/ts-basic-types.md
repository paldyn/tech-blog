---
title: "TypeScript 기본 타입 완전 정복"
description: "TypeScript의 원시 타입, 특수 타입(any·unknown·never·void), 배열·튜플·열거형, 타입 좁히기(narrowing), 타입 단언과 const 단언을 예제 중심으로 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 5
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "기본타입", "타입좁히기", "unknown", "never", "튜플", "enum"]
featured: false
draft: false
---

[지난 글](/posts/ts-essence/)에서 TypeScript의 존재 이유와 컴파일 파이프라인을 살펴봤다. 이번에는 TypeScript가 제공하는 **기본 타입 전체**를 다룬다. 기본 타입을 정확히 이해해야 유니언·인터섹션·제네릭 같은 고급 기능을 제대로 활용할 수 있다.

## 원시 타입

TypeScript의 원시 타입은 JavaScript 원시 값에 대응한다.

```typescript
// string — 문자열
const name: string = "Alice";
const greeting: string = `Hello, ${name}`;

// number — 정수·부동소수점 모두 (IEEE 754 64비트)
const count: number = 42;
const pi: number = 3.14;
const hex: number = 0xff;

// boolean
const isActive: boolean = true;

// bigint — ES2020
const big: bigint = 9007199254740993n;

// symbol — 고유 식별자
const key: symbol = Symbol("key");
```

`number`가 정수와 부동소수점을 모두 포함한다는 점이 JavaScript의 특징이다. 정밀한 정수 연산이 필요할 때는 `bigint`를 사용한다.

## 특수 타입 — any, unknown, never, void

![TypeScript 기본 타입 전체 지도](/assets/posts/ts-basic-types-overview.svg)

### any — 타입 검사 비활성화

`any`는 TypeScript의 타입 시스템을 완전히 우회한다. `any` 변수에는 어떤 연산도 허용되며, 어디에나 할당 가능하고, 어디서나 할당받을 수 있다.

```typescript
let x: any = "hello";
x = 42;           // OK
x = { name: "?" } // OK
x.nonExistent();  // 오류 없음 — any는 모든 연산 허용
```

`any`는 점진적 마이그레이션 단계에서만 일시적으로 사용하고, 최종 코드에는 없어야 한다.

### unknown — 안전한 any

`unknown`은 `any`처럼 모든 값을 받을 수 있지만, **사용하기 전에 타입을 좁혀야 한다**.

```typescript
function safeParse(data: unknown): string {
  if (typeof data === "string") {
    return data.toUpperCase(); // OK: string으로 좁혀짐
  }
  if (typeof data === "number") {
    return data.toFixed(2);    // OK: number로 좁혀짐
  }
  return String(data);
}

// unknown에는 직접 연산 불가
let u: unknown = fetchData();
u.toUpperCase(); // TS2571 ❌ — 먼저 좁혀야 함
```

외부 API 응답이나 `JSON.parse()` 결과 타입으로 `any` 대신 `unknown`을 사용하는 것이 좋은 습관이다.

### never — 도달 불가 타입

`never`는 값이 절대 존재할 수 없는 타입이다. 두 가지 주요 용도가 있다.

```typescript
// 1. 항상 예외를 던지는 함수
function fail(msg: string): never {
  throw new Error(msg);
}

// 2. 완전성 검사 (exhaustive check)
type Shape = "circle" | "square" | "triangle";

function area(s: Shape): number {
  if (s === "circle")   return Math.PI;
  if (s === "square")   return 1;
  if (s === "triangle") return 0.5;
  // 여기 도달하면 s는 never 타입
  const _exhaustive: never = s; // 새 shape 추가 시 컴파일 오류
  return _exhaustive;
}
```

`never`는 유니언 타입에서 모든 케이스를 처리했는지 컴파일 시점에 검증하는 패턴에 특히 유용하다.

### void — 반환값 없음

```typescript
// void — 반환값을 사용하지 않는 함수
function log(msg: string): void {
  console.log(msg);
  // return undefined; — 암묵적
}

// undefined와 void의 차이
type Callback = () => void;
const cb: Callback = () => 42; // 허용 — void는 반환값 무시
```

`void`는 콜백 타입 선언에서 "반환값을 무시한다"는 의미로 자주 사용된다.

## 배열과 튜플

```typescript
// 배열 — 두 가지 문법 (권장: T[])
const nums: number[] = [1, 2, 3];
const strs: Array<string> = ["a", "b"];

// readonly 배열 — 변경 불가
const frozen: readonly number[] = [1, 2, 3];
frozen.push(4); // TS2339 ❌

// 튜플 — 고정 길이, 각 요소 타입 지정
type Point = [number, number];
const p: Point = [10, 20];
const [x, y] = p; // 구조 분해 타입 안전

// 선택적 요소, rest 요소
type Config = [string, number?, ...boolean[]];
```

튜플은 CSV 파싱 결과, React의 `useState` 반환값(`[state, setter]`) 같은 고정 구조 데이터에 적합하다.

## 열거형(enum)

```typescript
// 숫자 enum (기본값 0부터)
enum Direction { Up, Down, Left, Right }
Direction.Up // 0

// 문자열 enum — 직렬화에 유리
enum Status {
  Active  = "ACTIVE",
  Inactive = "INACTIVE",
}

// const enum — 인라인 치환, 빌드 결과물 최소화
const enum Weekday { Mon = 1, Tue, Wed, Thu, Fri }
const day = Weekday.Mon; // 컴파일 후: const day = 1;
```

`const enum`은 컴파일 후 enum 객체가 생성되지 않고 값이 인라인 치환되어 번들 크기를 줄인다. 단, `declare const enum`은 타입 선언 파일에서만 사용해야 한다.

## 타입 좁히기와 타입 단언

![타입 좁히기(Narrowing)와 타입 단언](/assets/posts/ts-basic-types-narrowing.svg)

타입 좁히기(narrowing)는 조건문으로 타입의 범위를 점점 좁혀가는 것이다.

```typescript
// in 연산자 좁히기
interface Cat { meow(): void }
interface Dog { bark(): void }

function makeSound(animal: Cat | Dog) {
  if ("meow" in animal) {
    animal.meow(); // Cat으로 좁혀짐
  } else {
    animal.bark(); // Dog으로 좁혀짐
  }
}

// 사용자 정의 타입 가드
function isString(val: unknown): val is string {
  return typeof val === "string";
}

if (isString(data)) {
  data.toUpperCase(); // string으로 좁혀짐
}
```

타입 단언(`as`)은 컴파일러가 알 수 없는 타입 정보를 개발자가 직접 알려주는 방법이다. 런타임 검사가 없으므로 틀리면 런타임 오류가 발생한다.

```typescript
// 타입 단언 — 신중히 사용
const input = document.getElementById("email") as HTMLInputElement;
input.value; // OK

// const 단언 — 객체를 리터럴 타입으로 고정
const config = {
  endpoint: "/api",
  retries: 3,
} as const;
// config.endpoint: "/api" (string이 아님)
// config.retries:  3      (number가 아님)
```

`as const`는 `Object.freeze()`처럼 값을 고정하지는 않지만, 타입 시스템 수준에서 변경을 막고 리터럴 타입을 정확히 추론하게 해준다.

---

**지난 글:** [TypeScript 핵심 · 왜 타입이 필요한가](/posts/ts-essence/)

**다음 글:** [유니언·인터섹션·리터럴 타입](/posts/ts-union-intersection-literal/)

<br>
읽어주셔서 감사합니다. 😊
