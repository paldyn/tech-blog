---
title: "타입 공간과 값 공간 — TypeScript의 두 세계"
description: "TypeScript 코드에는 타입 공간과 값 공간이 공존합니다. 이 구분을 이해하면 컴파일 오류와 런타임 동작의 차이를 명확히 파악할 수 있습니다. typeof, class, enum의 이중 역할도 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "타입공간", "값공간", "typeof", "컴파일타임"]
featured: false
draft: false
---

[지난 글](/posts/ts-editor-setup/)에서 VS Code 개발 환경을 최적화했다. 이제 TypeScript 타입 시스템을 본격적으로 배울 차례다. 첫 번째 핵심 개념은 **타입 공간과 값 공간의 구분** 이다. 이 개념을 이해하면 왜 어떤 코드는 컴파일 후 사라지고 어떤 코드는 남는지, `interface` 와 `class` 가 어떻게 다른지 명확해진다.

## 두 가지 공간

TypeScript 코드에는 두 개의 세계가 공존한다.

**타입 공간(Type Space)** — 타입 정보만 담는다. 컴파일 후 완전히 제거된다. 런타임에는 존재하지 않는다.

**값 공간(Value Space)** — 실제 데이터와 로직을 담는다. 컴파일 후 JavaScript로 남아 런타임에 실행된다.

```typescript
// 타입 공간 — 컴파일 후 사라짐
type UserId = string;
interface User {
  id: UserId;
  name: string;
}

// 값 공간 — 컴파일 후 JS로 남음
const userId: UserId = "u_001"; // : UserId는 타입 공간, 나머지는 값 공간
function greet(user: User) {    // : User는 타입 공간, 나머지는 값 공간
  console.log(user.name);
}
```

![타입 공간 vs 값 공간](/assets/posts/ts-type-vs-value-space-diagram.svg)

## 타입 공간에만 있는 것들

이것들은 컴파일 후 JavaScript에 전혀 나타나지 않는다.

```typescript
// type 별칭 — 타입 공간만
type Status = "active" | "inactive";

// interface — 타입 공간만
interface Product {
  id: number;
  name: string;
}

// 타입 애너테이션 (: 뒤의 모든 것) — 타입 공간
const x: number = 5;

// 타입 파라미터 — 타입 공간
function identity<T>(value: T): T {
  return value;
}

// import type — 명시적 타입 공간 import
import type { Product } from './types';
```

컴파일 결과:
```javascript
// type, interface, : 뒤 타입, <T> 모두 제거됨
const x = 5;
function identity(value) {
  return value;
}
```

## 값 공간에만 있는 것들

이것들은 컴파일 후 JavaScript에 남는다.

```typescript
const name = "TypeScript";           // 변수
function greet(s: string) { }        // 함수 (:string은 제거됨)
const arr = [1, 2, 3];               // 배열 리터럴
import { readFile } from 'fs';       // 런타임 모듈 로드
```

## 두 공간 모두에 존재하는 것들

`class` 와 `enum` 은 특별하다. 이 둘은 타입 공간과 값 공간 **양쪽** 에 동시에 존재한다.

```typescript
class Animal {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

// 값 공간: 생성자로 사용
const dog = new Animal("Rex");

// 타입 공간: 타입으로 사용
function describe(a: Animal): string {
  return a.name;
}
```

`class` 는 컴파일 후 JavaScript 클래스로 남는다(값 공간). 동시에 TypeScript는 `Animal` 을 타입으로도 인식한다(타입 공간).

`enum` 도 마찬가지다.

```typescript
enum Direction {
  Up,
  Down,
  Left,
  Right,
}

// 값 공간: 실제 값 사용
const move = Direction.Up; // 컴파일 후 Direction.Up = 0

// 타입 공간: 타입으로 사용
function go(dir: Direction) { }
```

## typeof의 이중성

`typeof` 는 위치에 따라 다른 공간에서 동작한다.

![typeof의 두 가지 역할](/assets/posts/ts-type-vs-value-space-typeof.svg)

**값 위치의 typeof** — JavaScript의 `typeof` 연산자. 런타임에 타입 이름 문자열을 반환한다.

```typescript
const x = 42;
if (typeof x === "number") { // 런타임 검사 — JS에 남음
  console.log("숫자입니다");
}
```

**타입 위치의 typeof** — TypeScript 전용 타입 연산자. 컴파일 타임에 변수의 TypeScript 타입을 추출한다.

```typescript
const config = { host: "localhost", port: 3000 };
type Config = typeof config; // 컴파일 타임 — Config = { host: string; port: number }

function connect(cfg: typeof config): void { } // 타입으로만 사용
```

타입 위치의 `typeof` 는 컴파일 후 완전히 제거된다.

## 왜 이 구분이 중요한가

이 구분을 모르면 다음과 같은 혼란이 생긴다.

```typescript
interface Shape {
  kind: string;
}

// 런타임에 Shape 타입이 존재한다고 착각하는 코드
function isShape(value: unknown): boolean {
  return value instanceof Shape; // 오류: 'Shape' only refers to a type
}
```

`interface` 는 타입 공간에만 있으므로 런타임에는 존재하지 않는다. `instanceof` 는 값 공간(클래스 생성자)을 대상으로 동작하는 런타임 연산이다.

올바른 방법은 런타임 검사 가능한 값 공간 요소를 사용하는 것이다.

```typescript
class ShapeImpl {
  kind: string = "shape";
}

function isShape(value: unknown): boolean {
  return value instanceof ShapeImpl; // OK: 클래스는 값 공간에 존재
}
```

다음 글부터는 TypeScript의 기본 타입들을 하나씩 상세히 살펴본다.

---

**지난 글:** [TypeScript 에디터 환경 최적화 — VS Code 완전 설정](/posts/ts-editor-setup/)

**다음 글:** [TypeScript 기본 타입 완전 정리](/posts/ts-basic-types/)

<br>
읽어주셔서 감사합니다. 😊
