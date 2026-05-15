---
title: "타입 가드 — 런타임 타입 좁히기 기법"
description: "TypeScript 타입 가드의 모든 방법(typeof, instanceof, in, 사용자 정의 타입 술어, 단언 함수)과 제어 흐름 분석을 통한 자동 타입 좁히기를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "타입가드", "타입좁히기", "제어흐름분석", "타입술어", "instanceof"]
featured: false
draft: false
---

[지난 글](/posts/ts-unknown-never-any/)에서 `unknown`, `never`, `any`의 차이를 살펴봤다. 이번에는 **타입 가드(Type Guard)**를 다룬다. TypeScript 컴파일러는 특정 패턴의 조건문을 인식하고, 해당 분기 내에서 변수 타입을 자동으로 좁혀준다. 이 기능을 **제어 흐름 분석(Control Flow Analysis)**이라고 한다.

## typeof 가드

기본 타입을 좁히는 가장 간단한 방법이다.

```typescript
function format(x: string | number | boolean): string {
  if (typeof x === "string") return x.toUpperCase();   // x: string
  if (typeof x === "number") return x.toFixed(2);      // x: number
  return String(x);                                     // x: boolean
}
```

`typeof`로 좁힐 수 있는 타입: `"string"`, `"number"`, `"bigint"`, `"boolean"`, `"symbol"`, `"undefined"`, `"object"`, `"function"`. `null`은 `typeof null === "object"`이므로 별도 처리가 필요하다.

## instanceof 가드

클래스 인스턴스를 좁힐 때 사용한다.

```typescript
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function handleError(e: unknown) {
  if (e instanceof ApiError) {
    console.log(e.status, e.message);  // ApiError로 좁혀짐
  } else if (e instanceof Error) {
    console.log(e.message);             // Error로 좁혀짐
  }
}
```

![타입 가드 방법들](/assets/posts/ts-type-guards-methods.svg)

## in 연산자 가드

객체에 특정 속성이 있는지 확인해 타입을 좁힌다.

```typescript
type Cat = { meow(): void };
type Dog = { bark(): void };

function makeSound(animal: Cat | Dog) {
  if ("meow" in animal) {
    animal.meow();  // Cat
  } else {
    animal.bark();  // Dog
  }
}
```

## 사용자 정의 타입 술어

복잡한 조건을 재사용 가능한 가드 함수로 만들 때 `param is Type` 반환 타입을 사용한다.

```typescript
interface User { name: string; age: number }

// 타입 술어 함수
function isUser(x: unknown): x is User {
  return (
    typeof x === "object" &&
    x !== null &&
    "name" in x &&
    "age" in x &&
    typeof (x as User).name === "string"
  );
}

const data: unknown = JSON.parse(response);
if (isUser(data)) {
  console.log(data.name);  // data: User로 좁혀짐
}
```

타입 술어 함수는 컴파일러에게 "이 함수가 `true`를 반환하면 매개변수는 지정한 타입이다"라고 알려준다.

## 단언 함수 (Assertion Functions)

TypeScript 3.7에서 도입된 `asserts` 키워드는 함수가 반환하면 특정 조건이 보장된다는 것을 나타낸다.

```typescript
function assertIsString(x: unknown): asserts x is string {
  if (typeof x !== "string") {
    throw new TypeError("Expected string");
  }
}

// asserts x: x is User — 반환 후 x는 User
function assertUser(x: unknown): asserts x is User {
  if (!isUser(x)) throw new TypeError("Not a User");
}

const raw: unknown = getUser();
assertUser(raw);
console.log(raw.name);  // raw: User — 이후 코드에서 보장
```

![제어 흐름 분석](/assets/posts/ts-type-guards-narrowing.svg)

## 제어 흐름 분석의 자동 좁히기

TypeScript는 다양한 패턴에서 자동으로 타입을 좁힌다.

```typescript
function demo(x: string | null | undefined) {
  if (x == null) return;  // null, undefined 모두 제거
  // x: string

  // 진실성 검사
  const arr: string[] | null = getArr();
  if (arr) {
    arr.push("item");  // arr: string[]
  }

  // 등호 비교
  type Direction = "left" | "right" | "up" | "down";
  function move(d: Direction) {
    if (d === "left" || d === "right") {
      // d: "left" | "right"
    }
  }
}
```

## Array.isArray와 배열 좁히기

```typescript
function process(items: string | string[]) {
  if (Array.isArray(items)) {
    // items: string[]
    return items.join(", ");
  }
  // items: string
  return items;
}
```

## 타입 가드의 한계

```typescript
// 타입 술어는 개발자 책임 — 거짓말 가능
function isFish(animal: Cat | Dog): animal is Cat {
  return true;  // 항상 true여도 컴파일 오류 없음!
}
```

타입 술어 함수의 구현이 실제로 올바른지는 컴파일러가 검증하지 않는다. 런타임 동작과 일치하도록 직접 보장해야 한다. 다음 글에서는 타입 가드와 함께 자주 쓰이는 **판별 유니언(Discriminated Union)** 패턴을 살펴본다.

---

**지난 글:** [unknown · never · any — 타입 계층의 끝점들](/posts/ts-unknown-never-any/)

**다음 글:** [판별 유니언 — 타입 안전한 상태 모델링](/posts/ts-discriminated-union/)

<br>
읽어주셔서 감사합니다. 😊
