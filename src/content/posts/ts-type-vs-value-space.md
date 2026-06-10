---
title: "타입 공간과 값 공간: TypeScript의 두 세계"
description: "TypeScript 코드에는 컴파일 후 사라지는 타입 공간과 런타임에 남는 값 공간이 공존합니다. 두 공간을 구분하면 import type, declare, class의 이중 역할을 정확히 이해할 수 있습니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "타입공간", "값공간", "TypeSpace", "ValueSpace", "importtype"]
featured: false
draft: false
---

[지난 글](/posts/ts-editor-setup/)에서 VS Code와 TypeScript 에디터 환경을 최적화했습니다. 이번 글에서는 TypeScript를 제대로 이해하기 위한 핵심 개념인 **타입 공간(type space)**과 **값 공간(value space)**을 다룹니다.

## 두 공간이 왜 중요한가

TypeScript를 처음 배울 때 아래 코드가 혼란스럽게 느껴질 수 있습니다.

```typescript
class Animal {}

// Animal이 타입으로 쓰임
const dog: Animal = new Animal();

// Animal이 값으로 쓰임
console.log(typeof Animal); // "function"
Animal instanceof Object;   // true
```

`Animal`이 어떤 문맥에서는 타입처럼, 어떤 문맥에서는 값처럼 동작합니다. 이를 이해하려면 TypeScript의 두 공간 개념이 필요합니다.

## 타입 공간: 컴파일 후 사라진다

**타입 공간**에 있는 코드는 컴파일 단계에서 사용된 후 출력 JavaScript에서 완전히 제거됩니다. 런타임에는 존재하지 않습니다.

![타입 공간 vs 값 공간](/assets/posts/ts-type-vs-value-space-diagram.svg)

타입 공간에 속하는 것들:
- `type` 별칭 선언
- `interface` 선언
- 타입 주석 (`: string`, `: number` 등)
- 제네릭 타입 매개변수 (`<T>`)
- 유니온 타입, 인터섹션 타입
- `keyof`, `typeof` (타입 문맥에서의 `typeof`)
- `as` 타입 단언

```typescript
// 아래 코드에서 타입 공간에 있는 것들
type UserId = number;           // 타입 공간
interface Point {               // 타입 공간
  x: number;
  y: number;
}

const p: Point = { x: 0, y: 0 };
//       ^^^^^  ← 타입 공간 (컴파일 후 제거)

function move(point: Point): Point {
//                  ^^^^^    ^^^^^  ← 타입 공간
  return { x: point.x + 1, y: point.y + 1 };
}
```

## 값 공간: 런타임에 존재한다

**값 공간**에 있는 코드는 JavaScript로 컴파일된 후에도 남아 있습니다. 런타임에 실제로 실행됩니다.

```typescript
const x = 42;              // 값 공간
function add(a, b) {}      // 값 공간
const arr = [1, 2, 3];    // 값 공간
class Dog {}               // 값 공간 (+ 타입 공간)
enum Color { Red, Blue }   // 값 공간 (+ 타입 공간)
```

## class와 enum은 두 공간에 동시 존재

`class`와 `enum`은 특별합니다. 이 둘은 타입 공간과 값 공간 **모두**에 존재합니다.

![두 공간 코드 예시](/assets/posts/ts-type-vs-value-space-examples.svg)

```typescript
class Vehicle {
  speed: number = 0;
  accelerate(amount: number): void {
    this.speed += amount;
  }
}

// Vehicle을 타입으로 사용 (타입 공간)
const car: Vehicle = new Vehicle();
//         ^^^^^^^  타입 공간: { speed: number; accelerate(amount: number): void }

// Vehicle을 값으로 사용 (값 공간)
console.log(typeof Vehicle);           // "function"
console.log(car instanceof Vehicle);   // true
```

`enum`도 마찬가지입니다.

```typescript
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}

// 타입으로 사용
function move(dir: Direction): void {}

// 값으로 사용 (런타임에도 객체로 존재)
console.log(Direction.Up);    // "UP"
console.log(typeof Direction); // "object"
```

## import type: 타입만 임포트

두 공간의 차이를 이해하면 `import type`의 의미를 정확히 알 수 있습니다.

```typescript
// 값 + 타입 임포트 (번들에 포함됨)
import { User } from "./user";

// 타입만 임포트 (컴파일 후 제거, 번들에 포함 안 됨)
import type { User } from "./user";
```

`import type`은 순환 의존성을 줄이고 번들 크기를 최적화합니다. `verbatimModuleSyntax` tsconfig 옵션을 활성화하면 타입만 사용하는 import에 `import type`을 강제할 수 있습니다.

## 두 공간 구분이 필요한 상황

```typescript
// typeof를 어떻게 쓰느냐에 따라 다른 공간
const point = { x: 1, y: 2 };

// 값 공간의 typeof: 런타임에 실행, string 반환
console.log(typeof point); // "object"

// 타입 공간의 typeof: 컴파일 타임, 타입 추출
type PointType = typeof point; // { x: number; y: number }
```

타입 공간과 값 공간을 구분하는 능력은 고급 TypeScript 코드를 읽고 쓸 때 필수적입니다. 다음 글부터는 TypeScript의 구체적인 타입들을 하나씩 자세히 살펴봅니다.

---

**지난 글:** [VS Code + TypeScript 에디터 설정](/posts/ts-editor-setup/)

**다음 글:** [TypeScript 기본 타입 완전 정리](/posts/ts-basic-types/)

<br>
읽어주셔서 감사합니다. 😊
