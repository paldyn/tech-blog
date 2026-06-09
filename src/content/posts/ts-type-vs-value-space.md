---
title: "타입 공간과 값 공간 — TypeScript의 두 세계"
description: "TypeScript에서 타입 공간과 값 공간이 무엇인지, 타입이 런타임에 소거되는 원리와 이것이 실제 코딩에 미치는 영향을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "타입공간", "값공간", "타입소거", "런타임"]
featured: false
draft: false
---

[지난 글](/posts/ts-editor-setup/)에서 TypeScript 에디터 설정을 완성했습니다. 이번 글은 TypeScript를 깊이 이해하기 위한 핵심 개념입니다. 타입 공간과 값 공간을 구분하지 못하면 런타임 오류가 발생하는 코드를 작성하게 됩니다.

![타입 공간과 값 공간 다이어그램](/assets/posts/ts-type-vs-value-space-diagram.svg)

## 두 세계가 존재한다

TypeScript 코드는 두 개의 평행한 세계에서 동작합니다.

**타입 공간(Type Space)**: `interface`, `type`, 타입 어노테이션(`: string`), 제네릭 매개변수 등이 속합니다. 컴파일 타임에만 존재하고, 런타임에는 완전히 사라집니다.

**값 공간(Value Space)**: `const`, `let`, `function`, `class`, 리터럴 값 등이 속합니다. 런타임에도 실제로 존재하는 JavaScript 코드입니다.

```typescript
// 타입 공간 (컴파일 후 사라짐)
interface User { name: string; }
type ID = string | number;

// 값 공간 (런타임에도 존재)
const user = { name: "Alice" };
function greet(name: string) { return `Hi, ${name}`; }
```

## 타입 소거 (Type Erasure)

![타입 소거 과정](/assets/posts/ts-type-vs-value-space-erasure.svg)

TypeScript가 JavaScript로 컴파일될 때, 타입 공간의 모든 것이 제거됩니다.

```typescript
// TypeScript 소스
interface Animal {
  name: string;
  species: string;
}

function describeAnimal(animal: Animal): string {
  return `${animal.name} (${animal.species})`;
}

const dog: Animal = { name: "Buddy", species: "Canis familiaris" };
```

```javascript
// 컴파일 결과 (타입 정보 없음)
function describeAnimal(animal) {
  return `${animal.name} (${animal.species})`;
}

const dog = { name: "Buddy", species: "Canis familiaris" };
```

`interface Animal`은 흔적도 없이 사라집니다.

## 이것이 왜 중요한가?

타입 소거를 이해하지 못하면 다음과 같은 실수를 합니다.

```typescript
interface Cat { name: string; }
interface Dog { name: string; age: number; }

type Pet = Cat | Dog;

function describe(pet: Pet): string {
  // ❌ 런타임 오류: interface는 런타임에 없음
  if (pet instanceof Cat) {    // TypeError!
    return `고양이: ${pet.name}`;
  }
  return `강아지: ${pet.name}`;
}
```

`Cat`은 `interface`이므로 런타임에 존재하지 않습니다. `instanceof` 체크가 불가능합니다.

올바른 해결책은 **값으로 타입을 구분**하는 것입니다.

```typescript
// 방법 1: 판별 유니온 (discriminated union)
interface Cat { kind: "cat"; name: string; }
interface Dog { kind: "dog"; name: string; age: number; }
type Pet = Cat | Dog;

function describe(pet: Pet): string {
  if (pet.kind === "cat") {   // ✅ 값으로 구분
    return `고양이: ${pet.name}`;
  }
  return `강아지: ${pet.name} (${pet.age}살)`;
}

// 방법 2: class 사용 (값과 타입 동시 존재)
class Cat {
  constructor(public name: string) {}
}
class Dog {
  constructor(public name: string, public age: number) {}
}

function describe2(pet: Cat | Dog): string {
  if (pet instanceof Cat) {   // ✅ class는 값으로도 존재
    return `고양이: ${pet.name}`;
  }
  return `강아지: ${(pet as Dog).name}`;
}
```

## 두 공간을 동시에 차지하는 것들

일부 TypeScript 구문은 타입 공간과 값 공간 **모두에** 존재합니다.

### class

```typescript
class User {
  constructor(public name: string) {}
}

// 값으로 사용 (new로 인스턴스 생성)
const alice = new User("Alice");

// 타입으로 사용 (타입 어노테이션)
function greet(user: User): string {
  return `Hello, ${user.name}`;
}

// instanceof 가능 (값 공간에도 존재하므로)
console.log(alice instanceof User); // true
```

### enum

```typescript
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT"
}

// 타입으로 사용
function move(dir: Direction): void { /* ... */ }

// 값으로 사용 (런타임에도 객체로 존재)
move(Direction.Up);
console.log(Direction.Up);    // "UP"
console.log(typeof Direction); // "object" — 런타임에 실제 객체
```

## typeof: 두 공간에서 다른 의미

`typeof` 연산자는 위치에 따라 다르게 동작합니다.

```typescript
const point = { x: 1, y: 2 };

// 값 공간의 typeof (JavaScript)
const typeStr = typeof point;  // "object" — 런타임 값

// 타입 공간의 typeof (TypeScript 전용)
type Point = typeof point;     // { x: number; y: number }

function printPoint(p: typeof point): void {
  console.log(`(${p.x}, ${p.y})`);
}
```

타입 공간의 `typeof`는 컴파일 후 사라지고, 값 공간의 `typeof`만 런타임에 실행됩니다.

## 실전 패턴: 타입 가드

타입 소거 때문에 런타임에서 타입 체크는 항상 **값으로** 해야 합니다.

```typescript
// 사용자 정의 타입 가드
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as { name: unknown }).name === "string"
  );
}

// 사용
function process(input: unknown): void {
  if (isString(input)) {
    console.log(input.toUpperCase()); // string으로 타입 좁혀짐
  } else if (isUser(input)) {
    console.log(input.name);         // User로 타입 좁혀짐
  }
}
```

타입 공간과 값 공간의 구분을 확실히 이해하면, 런타임 오류 없이 타입 시스템을 올바르게 활용할 수 있습니다.

---

**지난 글:** [TypeScript 에디터 설정 — VS Code 완벽 최적화](/posts/ts-editor-setup/)

**다음 글:** [TypeScript 기본 타입 완벽 가이드](/posts/ts-basic-types/)

<br>
읽어주셔서 감사합니다. 😊
