---
title: "TypeScript 완전 정복 ⑨: 타입 공간 vs 값 공간"
description: "TypeScript 코드의 두 층위, 타입 공간(컴파일 후 사라짐)과 값 공간(런타임에 존재)을 구분하는 법. typeof, class, enum의 이중적 성질을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "타입공간", "값공간", "typeof", "class", "이중성"]
featured: false
draft: false
---

[지난 글](/posts/ts-editor-setup/)에서 에디터 설정을 완료했다. 이제 TypeScript의 핵심 개념 중 하나인 **타입 공간(Type Space)과 값 공간(Value Space)의 분리**를 이해할 차례다. 이 개념을 이해하면 TypeScript의 많은 동작이 자연스럽게 이해된다.

## 두 개의 세계

TypeScript 코드는 사실 두 개의 층위가 공존한다. **타입 공간**은 컴파일러가 타입 검사를 위해 사용하고 컴파일 후 완전히 사라지는 세계다. **값 공간**은 런타임에 실제로 실행되는 JavaScript 코드의 세계다.

![타입 공간 vs 값 공간](/assets/posts/ts-type-vs-value-space-diagram.svg)

가장 중요한 규칙: **타입 공간에 있는 것은 런타임에 사용할 수 없다.**

```typescript
// 타입 공간에만 존재하는 것들
type UserId = number;              // 타입 별칭
interface User { name: string; }   // 인터페이스
type Status = "active" | "inactive"; // 리터럴 유니온

// 이것들은 런타임에 없다!
// console.log(typeof UserId);  // 오류: 'UserId' only refers to a type
// const x = new User();        // 오류: 'User' only refers to a type
```

```typescript
// 값 공간에 존재하는 것들
const userId = 42;                 // 변수
function greet(name: string) {}    // 함수
const user = { name: "Alice" };    // 객체 리터럴
```

## 타입 어노테이션은 타입 공간에 속한다

```typescript
// 콜론(:) 뒤는 타입 공간
function add(a: number, b: number): number {
//              ^^^^^^     ^^^^^^    ^^^^^^
//          타입 공간   타입 공간  타입 공간 (런타임에 없음)
  return a + b;  // a, b, return은 값 공간
}

// 컴파일 결과 (JS)
function add(a, b) {
  return a + b;
}
// : number가 모두 사라짐
```

## typeof의 이중성

`typeof`는 가장 대표적인 두 공간 걸치기 키워드다. 같은 키워드가 위치에 따라 완전히 다른 역할을 한다.

![같은 키워드, 다른 공간: typeof와 class](/assets/posts/ts-type-vs-value-space-examples.svg)

```typescript
const config = { host: "localhost", port: 3000 };

// 타입 위치의 typeof: 컴파일 타임, 타입을 추출
type Config = typeof config;  // { host: string; port: number }
// Config는 타입 공간에만 존재

// 값 위치의 typeof: 런타임, JS typeof 연산자
const result = typeof config;  // "object"
// result는 값 공간
```

## class: 두 공간 모두에 존재

`class` 선언은 특별하다. 한 번 선언하면 타입 공간과 값 공간 양쪽에 동시에 이름을 만든다.

```typescript
class Animal {
  name: string = "";
  sound(): string { return ""; }
}

// Animal은 타입으로 쓸 수 있다 (타입 공간)
const myDog: Animal = new Animal();
//           ^^^^^^ 타입 공간에서의 Animal

// Animal은 생성자 함수로 쓸 수 있다 (값 공간)
const cat = new Animal();
//          ^^^^^^^^^^^ 값 공간에서의 Animal

// instanceof도 값 공간 (런타임)
console.log(cat instanceof Animal);  // true
```

반면 `interface`는 타입 공간에만 존재한다.

```typescript
interface Flyable {
  fly(): void;
}

// const x = new Flyable(); // 오류! interface는 값 공간에 없음
// console.log(x instanceof Flyable); // 오류!
```

## enum: 타입이자 객체

`enum`도 두 공간에 존재한다. 하지만 예상외로 런타임에 실제 JavaScript 객체가 된다.

```typescript
enum Direction {
  Up = "UP",
  Down = "DOWN",
}

// 타입으로 사용
function move(dir: Direction) { }

// 값으로 사용 (런타임에 실제 객체)
console.log(Direction.Up);        // "UP"
console.log(Direction["Up"]);     // "UP"
console.log(typeof Direction);    // "object"
```

컴파일 결과:

```javascript
var Direction;
(function (Direction) {
  Direction["Up"] = "UP";
  Direction["Down"] = "DOWN";
})(Direction || (Direction = {}));
```

`enum`은 런타임에 실제 JavaScript 객체로 변환된다. 이 때문에 `const enum`이나 리터럴 유니온 타입(`"UP" | "DOWN"`)을 선호하는 개발자들이 많다.

## import type: 명확한 구분

TypeScript 3.8에서 도입된 `import type`은 타입 공간에서만 사용되는 임포트임을 명시적으로 선언한다.

```typescript
// 타입만 임포트 (번들에 포함 안 됨)
import type { User } from "./user";

// 값과 타입 모두 임포트
import { createUser } from "./user";

// 하나의 import 문에서 구분
import { createUser, type User } from "./user";
```

`import type`으로 가져온 것은 절대 값 공간에서 사용할 수 없다. 번들러가 이 파일을 제거할 수 있어서 트리 쉐이킹에 유리하다.

## 타입 공간에서만 동작하는 연산자들

```typescript
interface User {
  name: string;
  age: number;
  email: string;
}

// keyof: 타입의 키를 유니온으로 추출 (타입 공간)
type UserKeys = keyof User;  // "name" | "age" | "email"

// Partial: 모든 필드를 옵셔널로 (타입 공간)
type PartialUser = Partial<User>;

// 인덱스드 엑세스 타입 (타입 공간)
type UserName = User["name"];  // string
```

이런 연산은 모두 타입 공간에서만 이루어지며 런타임에 흔적이 없다.

## 왜 이 구분이 중요한가

```typescript
interface Config {
  debug: boolean;
}

// 타입 가드: instanceof는 class에만 가능
// Config는 interface이므로 instanceof 불가
function isConfig(x: unknown): x is Config {
  // instanceof Config; // 오류!
  // 대신 구조적 검사 사용
  return typeof x === "object" && x !== null && "debug" in x;
}
```

런타임에 인터페이스나 타입 별칭이 존재하지 않기 때문에, 런타임 타입 검사가 필요할 때는 타입 가드 함수를 직접 작성하거나 `class`를 사용해야 한다.

## 정리

TypeScript 코드에는 항상 두 층위가 공존한다. 타입 공간(interface, type, 어노테이션)은 컴파일러만이 보는 세계이고, 값 공간(변수, 함수, class 실체)은 런타임에서 살아있는 세계다. `class`와 `enum`만이 두 공간 모두에 이름을 만든다.

---

**지난 글:** [에디터 설정: VS Code + TypeScript](/posts/ts-editor-setup/)

**다음 글:** [TypeScript 기본 타입들](/posts/ts-basic-types/)

<br>
읽어주셔서 감사합니다. 😊
