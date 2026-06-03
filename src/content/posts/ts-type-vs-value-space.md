---
title: "타입 공간과 값 공간: TypeScript를 이해하는 핵심 개념"
description: "TypeScript에는 타입 공간과 값 공간이라는 두 개의 세계가 존재한다. 이 개념을 이해하면 컴파일 에러의 절반이 해결된다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "타입공간", "값공간", "TypeErasure", "타입지우기", "타입시스템"]
featured: false
draft: false
---

[지난 글](/posts/ts-editor-setup/)에서 TypeScript 개발 환경을 완성했다. 이번 편에서는 TypeScript를 깊이 이해하기 위한 핵심 개념, **타입 공간(Type Space)**과 **값 공간(Value Space)**의 차이를 명확히 파악한다. 이 개념이 흔들리면 컴파일 에러가 왜 발생하는지, 왜 어떤 코드는 런타임에서 동작하지 않는지 이해하기 어렵다.

## 두 개의 세계

TypeScript 코드는 두 종류의 구성요소로 이루어진다.

![타입 공간 vs 값 공간](/assets/posts/ts-type-vs-value-space-diagram.svg)

**타입 공간(Type Space)**: 컴파일 후 완전히 사라지는 세계

- `interface`, `type` 키워드로 정의한 것
- 타입 주석 (`: string`, `: number`)
- 타입 단언 (`as Type`)
- 제네릭 타입 파라미터 (`<T>`)
- 유틸리티 타입 (`Partial<T>`, `Record<K, V>`)

**값 공간(Value Space)**: 컴파일 후에도 JavaScript로 남는 세계

- 변수, 함수, 클래스 선언
- `const`, `let`, `var` 키워드로 만든 것
- `enum` (객체로 변환됨)
- `import` 문

## 같은 이름, 다른 공간

혼란스러운 점은 같은 이름이 두 공간에 동시에 존재할 수 있다는 것이다.

```typescript
// User라는 이름이 두 공간에 동시에 존재

// 값 공간의 User (클래스 → 런타임에 존재)
class User {
  constructor(public name: string) {}
}

// 타입 공간의 User도 동시에 생성됨 (클래스 인스턴스 타입)
const u: User = new User("Alice");  // 여기서 User는 타입으로 사용됨
const v = new User("Bob");           // 여기서 User는 값(생성자)으로 사용됨
```

`class`와 `enum`은 두 공간 모두에 존재하는 특별한 구성요소다.

## 타입 공간만 존재하는 것

`interface`와 `type`은 타입 공간에만 존재한다. 런타임에서 참조하려고 하면 에러가 발생한다.

```typescript
interface Point {
  x: number;
  y: number;
}

// 컴파일 타임: 타입으로 사용 가능
const p: Point = { x: 1, y: 2 };  // OK

// 런타임: 값으로 사용 불가
console.log(Point);        // Error: 'Point' only refers to a type
const q = new Point();     // Error: 'Point' is not a constructor
if (p instanceof Point) {} // Error: 'Point' only refers to a type
```

`interface Point`는 컴파일 후 사라진다. 런타임에서 `Point`라는 이름은 존재하지 않는다.

## 타입 지우기(Type Erasure)

![타입 지우기 시각화](/assets/posts/ts-type-vs-value-space-erasure.svg)

TypeScript 컴파일의 핵심 동작은 **타입 지우기(Type Erasure)**다. 타입 공간의 모든 구성요소가 제거되고 값 공간의 구성요소만 JavaScript로 출력된다.

```typescript
// TypeScript 소스
interface Config {
  host: string;
  port: number;
}

type Handler = (req: Request, res: Response) => void;

function createServer(config: Config): void {
  console.log(`Server at ${config.host}:${config.port}`);
}
```

```javascript
// JavaScript 출력 (타입 지우기 후)
function createServer(config) {
  console.log(`Server at ${config.host}:${config.port}`);
}
```

`interface Config`, `type Handler`, 파라미터 타입 주석 — 모두 사라졌다.

## `typeof`로 타입 공간과 값 공간 넘나들기

TypeScript에서 `typeof`는 두 가지 다른 의미를 가진다.

```typescript
// 1. 값 공간의 typeof: JavaScript typeof (런타임)
const name = "Alice";
console.log(typeof name);  // "string" (런타임 실행)

// 2. 타입 공간의 typeof: TypeScript typeof (컴파일 타임)
type NameType = typeof name;  // type NameType = string
```

문맥에 따라 같은 `typeof` 키워드가 다른 역할을 한다. 타입 주석 자리(`: 타입` 위치)에 쓰인 `typeof`는 타입 공간, 표현식에 쓰인 `typeof`는 값 공간이다.

## 실용적 판단 기준

어떤 구성요소가 타입 공간인지 값 공간인지 헷갈릴 때 기준:

> **"컴파일 후에도 JavaScript 파일에 남는가?"**

```typescript
// 남는 것들 (값 공간)
const x = 42;           // const x = 42;
function f() {}         // function f() {}
class C {}              // class C {}
enum E { A, B }         // const E = { A: 0, B: 1 }; (변환됨)
import fs from "fs";    // const fs = require("fs");  (또는 import)

// 사라지는 것들 (타입 공간)
interface I {}          // 사라짐
type T = string;        // 사라짐
const y: number = 1;    // : number 부분만 사라짐 → const y = 1;
```

## 런타임 타입 검사는 값 공간에서

타입 공간의 것들은 런타임에 없으므로, 런타임 타입 검사는 반드시 값 공간의 방법을 써야 한다.

```typescript
// 잘못된 방법: interface는 런타임에 없음
function process(input: string | number) {
  if (input instanceof string) { // Error: string은 런타임에 없음
    ...
  }
}

// 올바른 방법: 값 공간의 typeof 사용
function process(input: string | number) {
  if (typeof input === "string") {  // OK: JS typeof 연산자
    console.log(input.toUpperCase());
  } else {
    console.log(input.toFixed(2));
  }
}
```

이 개념은 타입 가드(Type Guard)를 배울 때 더 깊이 다룬다. 다음 편에서는 TypeScript의 기본 타입들을 체계적으로 정리한다.

---

**지난 글:** [에디터 설정: VS Code로 TypeScript 개발 환경 완성](/posts/ts-editor-setup/)

**다음 글:** [TypeScript 기본 타입: 타입 시스템의 첫걸음](/posts/ts-basic-types/)

<br>
읽어주셔서 감사합니다. 😊
