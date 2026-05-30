---
title: "TypeScript 기본 타입: 타입 시스템의 구성 요소"
description: "TypeScript 타입 시스템의 전체 구조를 파악합니다. 원시 타입, 객체 타입, 특수 타입의 분류와 각 타입의 선언 방법, 타입 안전성 예시를 코드와 함께 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript타입", "기본타입", "TypeScript완전정복", "타입시스템", "타입선언"]
featured: false
draft: false
---

[지난 글](/posts/ts-first-program/)에서 첫 번째 TypeScript 프로그램을 작성했다. 이제 TypeScript의 타입 시스템을 체계적으로 이해할 차례다. 타입 시스템을 전체 그림으로 파악해야 개별 타입의 역할과 사용 시점을 올바르게 이해할 수 있다.

## TypeScript 타입의 3가지 카테고리

TypeScript의 모든 타입은 크게 3가지 카테고리로 분류된다.

![TypeScript 기본 타입 분류](/assets/posts/ts-basic-types-chart.svg)

**원시 타입(Primitive Types)**: JavaScript의 원시 값을 나타내는 타입이다. `string`, `number`, `boolean`, `bigint`, `symbol`, `null`, `undefined`가 있다.

**객체 타입(Object Types)**: 객체, 배열, 함수, 클래스 등 참조 값을 나타내는 타입이다. `object`, `Array<T>`, `interface`, `class`, `enum`, 튜플이 있다.

**특수 타입(Special Types)**: TypeScript 고유의 특수 목적 타입이다. `any`, `unknown`, `never`, `void`가 있다.

## 원시 타입

```typescript
// string: 모든 텍스트 값
let name: string = "Alice";
let greeting: string = `안녕하세요, ${name}님`;
let empty: string = "";

// number: 정수와 실수 통합 (64비트 부동소수점)
let age: number = 25;
let pi: number = 3.14159;
let hex: number = 0xFF;
let binary: number = 0b1010;
let notANumber: number = NaN;
let infinite: number = Infinity;

// boolean: true 또는 false
let active: boolean = true;
let loggedIn: boolean = false;
let checked: boolean = Boolean(1);

// bigint: 임의 정밀도 정수 (ES2020+)
let bigNumber: bigint = 9007199254740991n;
let computed: bigint = BigInt(100) * BigInt(200);

// symbol: 유일하고 불변인 값
let sym1: symbol = Symbol("key");
let sym2: symbol = Symbol("key");
console.log(sym1 === sym2);  // false — 항상 유일
```

## 배열 타입

배열 타입을 표현하는 두 가지 동등한 문법이 있다.

```typescript
// 방법 1: 타입[] (더 일반적)
let numbers: number[] = [1, 2, 3, 4, 5];
let words: string[] = ["hello", "world"];
let flags: boolean[] = [true, false, true];

// 방법 2: Array<타입> (제네릭 문법)
let numbers2: Array<number> = [1, 2, 3];
let words2: Array<string> = ["hello", "world"];

// 중첩 배열
let matrix: number[][] = [[1, 2], [3, 4]];
let nested: Array<Array<string>> = [["a", "b"], ["c", "d"]];

// 읽기 전용 배열
const frozen: readonly number[] = [1, 2, 3];
frozen.push(4);  // Error: 'readonly' 배열에 push 불가
```

## 객체 타입

```typescript
// 인라인 객체 타입
let user: { name: string; age: number; email?: string } = {
  name: "Alice",
  age: 30
  // email은 옵셔널이라 생략 가능
};

// interface로 재사용 가능한 객체 타입 정의
interface Point {
  x: number;
  y: number;
}

const origin: Point = { x: 0, y: 0 };
const center: Point = { x: 100, y: 100 };

// 중첩 객체
interface Address {
  city: string;
  country: string;
}

interface Person {
  name: string;
  age: number;
  address: Address;  // 중첩
}

const alice: Person = {
  name: "Alice",
  age: 30,
  address: {
    city: "Seoul",
    country: "KR"
  }
};
```

## 튜플 타입

튜플은 각 위치의 타입이 고정된 배열이다.

```typescript
// 튜플: 길이와 각 요소 타입이 고정
let pair: [string, number] = ["age", 30];
let rgb: [number, number, number] = [255, 128, 0];
let entry: [string, string, boolean] = ["key", "value", true];

// 구조 분해 할당
const [key, value] = pair;  // key: string, value: number

// 선택적 튜플 요소
let optTuple: [string, number?] = ["hello"];
let optTuple2: [string, number?] = ["hello", 42];

// 레이블이 있는 튜플 (TypeScript 4.0+)
type Range = [start: number, end: number];
const r: Range = [0, 100];
```

## 함수 타입

```typescript
// 기본 함수 타입 선언
function add(a: number, b: number): number {
  return a + b;
}

// 화살표 함수 타입
const multiply = (a: number, b: number): number => a * b;

// 함수 타입을 변수에 저장
let operation: (a: number, b: number) => number;
operation = add;
operation = multiply;
operation = (a, b) => a - b;

// void 반환 타입 (반환값 없음)
function log(message: string): void {
  console.log(message);
}

// 선택적 파라미터
function greet(name: string, title?: string): string {
  return title ? `${title} ${name}` : name;
}

greet("Alice");         // OK
greet("Alice", "Dr."); // OK
```

![TypeScript 기본 타입 코드 예시](/assets/posts/ts-basic-types-code.svg)

## 열거형(Enum)

열거형은 명명된 상수 집합을 정의한다.

```typescript
// 숫자 열거형 (기본값: 0부터 시작)
enum Direction {
  Up,    // 0
  Down,  // 1
  Left,  // 2
  Right  // 3
}

function move(dir: Direction): void {
  if (dir === Direction.Up) {
    console.log("위로 이동");
  }
}

move(Direction.Up);   // OK
move(0);              // OK (숫자 열거형은 숫자 할당 가능)

// 문자열 열거형 (더 안전하고 가독성 높음)
enum Status {
  Pending = "PENDING",
  Active = "ACTIVE",
  Inactive = "INACTIVE"
}

function setStatus(status: Status): void {
  console.log(status);  // "PENDING", "ACTIVE", etc.
}

setStatus(Status.Active);    // OK
setStatus("ACTIVE");         // Error: string은 Status에 직접 할당 불가
```

## Union과 Intersection 타입 (미리보기)

```typescript
// Union: A 또는 B 타입
type StringOrNumber = string | number;
let flexible: StringOrNumber = "hello";
flexible = 42;  // OK

// Intersection: A이면서 B인 타입
interface Serializable {
  serialize(): string;
}

interface Loggable {
  log(): void;
}

type Combined = Serializable & Loggable;
```

이 두 타입은 다음 글들에서 자세히 다룬다.

## 타입 안전성 확인

TypeScript는 잘못된 타입 사용을 어떻게 잡아내는지 확인해보자.

```typescript
const user = { name: "Alice", age: 30 };

// 프로퍼티 접근
console.log(user.name);   // "Alice" — OK
console.log(user.email);  // Error: 'email' 프로퍼티 없음

// 메서드 호출
const text = "hello";
text.toUpperCase();  // OK — string 메서드
text.toFixed(2);     // Error: 'toFixed'는 number 메서드

// 배열 조작
const nums: number[] = [1, 2, 3];
nums.push(4);        // OK
nums.push("five");   // Error: string은 number[]에 추가 불가

// 함수 호출
function double(n: number): number { return n * 2; }
double(5);      // OK → 10
double("5");    // Error: string은 number가 아님
double(5, 3);   // Error: 인수가 너무 많음
```

## 정리

TypeScript의 타입 시스템은 원시 타입, 객체 타입, 특수 타입의 3가지 카테고리로 구성된다. 각 타입은 해당 값이 어떤 연산을 지원하는지를 컴파일 타임에 정의한다. 다음 글에서는 원시 타입 7가지를 더 깊이 살펴보고, `null`/`undefined` 처리의 세밀한 부분까지 이해한다.

---

**지난 글:** [첫 번째 TypeScript 프로그램: Hello World부터 타입 추론까지](/posts/ts-first-program/)

**다음 글:** [TypeScript 원시 타입 완전 정복: string, number, boolean 외 4종](/posts/ts-primitive-types/)

<br>
읽어주셔서 감사합니다. 😊
