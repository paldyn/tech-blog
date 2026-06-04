---
title: "typeof와 instanceof 타입 가드 — 원시 타입과 클래스 인스턴스 구분"
description: "TypeScript에서 typeof 타입 가드가 인식하는 타입 목록, instanceof로 클래스 계층 구조를 좁히는 방법, 두 연산자의 한계와 보완 패턴을 상세히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "typeof", "instanceof", "타입가드", "TypeGuard", "클래스계층"]
featured: false
draft: false
---

[지난 글](/posts/ts-narrowing-basics/)에서 타입 좁히기의 기본 개념을 살펴봤다. 이번에는 가장 자주 쓰이는 두 타입 가드인 **`typeof`** 와 **`instanceof`** 를 깊이 살펴본다. 각 연산자가 어떤 상황에 적합하고, 어떤 한계가 있는지 구체적인 예시로 정리한다.

## typeof 타입 가드

`typeof`는 JavaScript 런타임에서 값의 종류를 문자열로 반환한다. TypeScript는 `typeof x === "타입문자열"` 패턴을 인식해 해당 분기에서 타입을 좁혀준다.

```typescript
function processValue(value: string | number | boolean | null | undefined | object) {
  switch (typeof value) {
    case "string":
      // value: string
      return value.toUpperCase();
    case "number":
      // value: number
      return value.toFixed(2);
    case "boolean":
      // value: boolean
      return value ? "yes" : "no";
    case "undefined":
      // value: undefined
      return "undefined";
    case "object":
      // value: null | object — typeof null === "object" !
      if (value === null) return "null";
      return JSON.stringify(value);
    default:
      // 도달하지 않는 분기
      const _exhaustive: never = value;
      return _exhaustive;
  }
}
```

### typeof가 반환하는 값

| `typeof` 결과 | 해당하는 값 |
|---|---|
| `"string"` | 문자열 |
| `"number"` | 숫자, `NaN`, `Infinity` |
| `"bigint"` | BigInt |
| `"boolean"` | `true`, `false` |
| `"symbol"` | Symbol |
| `"undefined"` | `undefined` |
| `"object"` | 객체, 배열, `null` |
| `"function"` | 함수 |

`typeof null === "object"`는 JavaScript의 오래된 버그지만 하위 호환을 위해 유지된다. `null` 체크는 반드시 별도로 수행해야 한다.

![typeof 타입 가드](/assets/posts/ts-typeof-instanceof-typeof.svg)

## typeof의 한계

`typeof`는 원시 타입 구분에는 탁월하지만 **객체 종류** 구분에는 사용할 수 없다.

```typescript
interface Cat {
  meow(): void;
}

interface Dog {
  bark(): void;
}

function makeSound(animal: Cat | Dog) {
  // ❌ typeof로는 인터페이스를 구분할 수 없음
  if (typeof animal === "Cat") { // 항상 false — "Cat"은 typeof 결과에 없음
    animal.meow();
  }

  // ✅ in 연산자로 구분
  if ("meow" in animal) {
    animal.meow(); // Cat
  }
}

// 함수 타입 확인
function process(handler: (() => void) | string) {
  if (typeof handler === "function") {
    // handler: () => void
    handler();
  } else {
    // handler: string
    console.log(handler);
  }
}
```

## instanceof 타입 가드

`instanceof`는 프로토타입 체인을 검사한다. `value instanceof Constructor`는 `value`의 프로토타입 체인에 `Constructor.prototype`이 있으면 `true`를 반환한다. TypeScript는 이를 인식해 타입을 클래스 타입으로 좁혀준다.

```typescript
class Animal {
  move() {
    console.log("이동");
  }
}

class Dog extends Animal {
  bark() {
    console.log("멍멍");
  }
}

class Cat extends Animal {
  meow() {
    console.log("야옹");
  }
}

function makeSound(animal: Animal) {
  if (animal instanceof Dog) {
    // animal: Dog
    animal.bark();
    animal.move(); // Animal 메서드도 사용 가능
  } else if (animal instanceof Cat) {
    // animal: Cat
    animal.meow();
  } else {
    // animal: Animal
    animal.move();
  }
}
```

`Dog`은 `Animal`을 상속하므로 `new Dog() instanceof Animal`도 `true`다. `instanceof`는 상속 계층 전체를 검사한다.

![instanceof 타입 가드](/assets/posts/ts-typeof-instanceof-instanceof.svg)

## instanceof와 클래스 상속

계층이 깊을수록 `instanceof` 체크 순서가 중요해진다.

```typescript
class Shape {
  area(): number {
    return 0;
  }
}

class Circle extends Shape {
  constructor(public radius: number) {
    super();
  }
  area() {
    return Math.PI * this.radius ** 2;
  }
}

class ColoredCircle extends Circle {
  constructor(radius: number, public color: string) {
    super(radius);
  }
}

function describeShape(shape: Shape) {
  // ✅ 더 구체적인 타입부터 체크
  if (shape instanceof ColoredCircle) {
    // shape: ColoredCircle
    return `${shape.color} 원, 반지름 ${shape.radius}`;
  }
  if (shape instanceof Circle) {
    // shape: Circle (ColoredCircle 제외됨)
    return `원, 반지름 ${shape.radius}`;
  }
  // shape: Shape
  return `도형, 넓이 ${shape.area()}`;
}
```

`ColoredCircle instanceof Circle`도 `true`이므로, 더 구체적인 클래스를 먼저 체크해야 올바른 분기로 진입한다.

## instanceof의 한계와 보완

`instanceof`는 **클래스 인스턴스**에만 사용할 수 있다. 인터페이스, 타입 별칭, 순수 객체 리터럴에는 사용할 수 없다.

```typescript
interface Point {
  x: number;
  y: number;
}

const p: Point = { x: 1, y: 2 };
// ❌ 인터페이스에는 instanceof 불가
// p instanceof Point; // 컴파일 에러: Point는 타입, 값이 아님

// ✅ in 연산자로 보완
function isPoint(value: unknown): value is Point {
  return (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value
  );
}
```

또한 `instanceof`는 다른 실행 컨텍스트(예: iframe, worker)에서 생성된 객체에는 실패할 수 있다. 서로 다른 컨텍스트는 다른 프로토타입 체인을 가지기 때문이다.

```typescript
// 프레임을 넘어온 배열 체크
const arr = []; // 다른 프레임에서 전달된 경우
arr instanceof Array; // false일 수 있음

// ✅ 안전한 배열 체크
Array.isArray(arr); // 항상 올바르게 동작
```

## typeof + instanceof 조합

두 연산자를 조합하면 복잡한 타입을 단계적으로 좁힐 수 있다.

```typescript
type Payload = string | number | Date | Error | null;

function serialize(payload: Payload): string {
  if (payload === null) {
    return "null";
  }
  // payload: string | number | Date | Error

  if (typeof payload === "string") {
    return JSON.stringify(payload);
  }
  // payload: number | Date | Error

  if (typeof payload === "number") {
    return String(payload);
  }
  // payload: Date | Error

  if (payload instanceof Date) {
    return payload.toISOString();
  }
  // payload: Error

  return `Error: ${payload.message}`;
}
```

`null` 체크 → `typeof` 원시 타입 체크 → `instanceof` 클래스 체크 순으로 좁혀가는 패턴은 복잡한 유니언 타입을 다룰 때 매우 유용하다.

## 커스텀 instanceof 가드

직접 만든 클래스와 함께 instanceof를 활용하면 풍부한 타입 정보를 제공하는 에러 처리 시스템을 구현할 수 있다.

```typescript
class NetworkError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

function handleError(error: unknown): string {
  if (error instanceof NetworkError) {
    // error: NetworkError — statusCode 접근 가능
    return `네트워크 오류 ${error.statusCode}: ${error.message}`;
  }
  if (error instanceof ValidationError) {
    // error: ValidationError — field 접근 가능
    return `유효성 오류 (${error.field}): ${error.message}`;
  }
  if (error instanceof Error) {
    // error: Error
    return `오류: ${error.message}`;
  }
  // error: unknown
  return "알 수 없는 오류";
}
```

`try-catch`에서 잡힌 `unknown` 타입의 에러를 instanceof로 안전하게 좁혀 구체적인 에러 정보에 접근하는 패턴이다. TypeScript 4.0 이후 `catch` 절의 에러는 `unknown` 타입이 기본이므로 이 패턴이 더욱 중요해졌다.

다음 글에서는 `in` 연산자를 이용한 타입 좁히기를 살펴본다.

---

**지난 글:** [타입 좁히기(Narrowing) 기초 — 유니언 타입을 안전하게 다루는 방법](/posts/ts-narrowing-basics/)

**다음 글:** [in 연산자 타입 가드 — 프로퍼티 존재 여부로 타입 구분](/posts/ts-in-operator-narrowing/)

<br>
읽어주셔서 감사합니다. 😊
