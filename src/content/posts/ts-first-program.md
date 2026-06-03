---
title: "첫 TypeScript 프로그램: Hello, Types!"
description: "JavaScript 코드에 타입을 추가하면 어떻게 달라지는지 직접 비교하며 TypeScript의 첫 프로그램을 작성하고 컴파일해본다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "첫프로그램", "타입주석", "컴파일", "HelloWorld", "입문"]
featured: false
draft: false
---

[지난 글](/posts/ts-playground-repl/)에서 Playground로 TypeScript를 실험해봤다. 이번 편에서는 로컬 환경에서 첫 TypeScript 프로그램을 직접 작성하고 컴파일해보면서 TypeScript의 기본 문법인 타입 주석을 익힌다.

## JavaScript → TypeScript: 타입 추가가 전부다

![첫 TypeScript 프로그램](/assets/posts/ts-first-program-code.svg)

JavaScript로 작성된 인사 함수에 타입을 추가하는 과정을 단계별로 살펴보자.

**시작점: JavaScript 코드**

```javascript
// greet.js
function greet(name) {
  return `Hello, ${name}!`;
}

const message = greet("Alice");
console.log(message); // Hello, Alice!

// 타입이 없으므로 숫자를 넣어도 에러 없음
greet(42); // "Hello, 42!" — 버그지만 감지 불가
```

**TypeScript로 변환: 타입 주석 추가**

```typescript
// greet.ts
function greet(name: string): string {
  return `Hello, ${name}!`;
}

const message = greet("Alice");
console.log(message);

greet(42); // Error: Argument of type 'number' is not assignable
           //        to parameter of type 'string'
```

변경된 것은 두 곳이다.

1. `name` 파라미터에 `: string` 타입 주석 추가
2. 함수 반환 타입에 `: string` 명시

이것으로 컴파일러가 `greet(42)` 호출을 에러로 잡아낼 수 있게 된다.

## 타입 주석 문법

![타입 주석 문법 핵심 패턴](/assets/posts/ts-first-program-types.svg)

타입 주석은 `식별자: 타입` 형식이다. 콜론(`:`) 뒤에 타입을 적는다.

```typescript
// 변수
let age: number = 25;
let name: string = "Alice";
let isActive: boolean = true;

// 함수 파라미터
function add(a: number, b: number): number {
  return a + b;
}

// 화살표 함수
const multiply = (a: number, b: number): number => a * b;

// 객체
const user: { name: string; age: number } = {
  name: "Bob",
  age: 30,
};
```

## 타입 추론: 주석 생략 가능

TypeScript는 초기값으로 타입을 추론한다. 초기값이 있으면 타입 주석을 생략해도 된다.

```typescript
let count = 0;      // TypeScript가 number로 추론
let msg = "hello";  // TypeScript가 string으로 추론
let done = false;   // TypeScript가 boolean으로 추론

// 추론 후에는 다른 타입 할당 불가
count = "1";  // Error: Type 'string' is not assignable to type 'number'
```

실무에서는 추론이 명확한 경우 타입 주석을 생략하는 것이 일반적이다. 추론이 어렵거나 의도를 명확히 해야 할 때만 명시한다.

## 첫 번째 완성 프로그램

더 풍부한 예제로 완성된 프로그램을 만들어보자.

```typescript
// src/index.ts

interface User {
  id: number;
  name: string;
  email: string;
}

function createUser(id: number, name: string, email: string): User {
  return { id, name, email };
}

function formatUser(user: User): string {
  return `[${user.id}] ${user.name} <${user.email}>`;
}

const users: User[] = [
  createUser(1, "Alice", "alice@example.com"),
  createUser(2, "Bob", "bob@example.com"),
  createUser(3, "Carol", "carol@example.com"),
];

users.forEach(user => {
  console.log(formatUser(user));
});
```

## 컴파일 및 실행

```bash
# TypeScript → JavaScript 컴파일
npx tsc src/index.ts --outDir dist

# 실행
node dist/index.js
# [1] Alice <alice@example.com>
# [2] Bob <bob@example.com>
# [3] Carol <carol@example.com>
```

`dist/index.js`를 열어보면 interface와 타입 주석이 사라진 순수 JavaScript가 나타난다.

```javascript
// dist/index.js (컴파일 출력)
function createUser(id, name, email) {
  return { id, name, email };
}

function formatUser(user) {
  return `[${user.id}] ${user.name} <${user.email}>`;
}

const users = [
  createUser(1, "Alice", "alice@example.com"),
  createUser(2, "Bob", "bob@example.com"),
  createUser(3, "Carol", "carol@example.com"),
];

users.forEach(user => {
  console.log(formatUser(user));
});
```

## 자주 만나는 에러 메시지 해석

TypeScript를 시작할 때 자주 마주치는 에러 두 가지다.

**① `Parameter 'x' implicitly has an 'any' type`**

```typescript
function greet(name) { ... }
// strict 모드에서 파라미터 타입이 없으면 에러
// 해결: name: string 추가
```

**② `Object is possibly 'null'`**

```typescript
const el = document.getElementById("app");
el.textContent = "Hello"; // Error: el이 null일 수 있음
// 해결: null 체크 추가
if (el) {
  el.textContent = "Hello";
}
```

이 두 에러는 처음에는 귀찮게 느껴지지만, 실제 런타임 크래시를 막아주는 가장 중요한 안전장치다.

다음 편에서는 TypeScript 개발에 최적화된 에디터 환경을 구성하는 방법을 알아본다.

---

**지난 글:** [TypeScript Playground: 브라우저에서 즉시 실험하기](/posts/ts-playground-repl/)

**다음 글:** [에디터 설정: VS Code로 TypeScript 개발 환경 완성](/posts/ts-editor-setup/)

<br>
읽어주셔서 감사합니다. 😊
