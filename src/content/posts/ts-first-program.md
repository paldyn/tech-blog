---
title: "첫 TypeScript 프로그램 작성하기"
description: "Hello World를 넘어 실질적인 TypeScript 코드를 작성해봅니다. 인터페이스, 함수 타입, 기본 타입 어노테이션을 직접 손으로 써가며 익힙니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "입문", "실습", "인터페이스", "함수타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-playground-repl/)에서 TypeScript Playground를 소개했습니다. 이번에는 직접 손을 움직여 의미 있는 TypeScript 코드를 작성해보겠습니다. 단순한 Hello World를 넘어, 실제 프로젝트에서 쓸 법한 패턴을 연습합니다.

![첫 TypeScript 프로그램](/assets/posts/ts-first-program-code.svg)

## 프로젝트 준비

앞서 설정한 환경이 있다면 그대로 사용하고, 없다면 빠르게 준비합니다.

```bash
mkdir ts-first-program && cd ts-first-program
npm init -y
npm install --save-dev typescript
npx tsc --init
mkdir src
```

## 1단계: 기본 타입 어노테이션

`src/step1.ts`를 만들고 가장 기본적인 타입 어노테이션을 연습합니다.

```typescript
// src/step1.ts

// 변수 타입 어노테이션
const language: string = "TypeScript";
const version: number = 5.4;
const isAwesome: boolean = true;

// 함수 매개변수와 반환 타입
function greet(name: string, times: number = 1): string {
  return Array(times).fill(`Hello, ${name}!`).join(" ");
}

console.log(greet("World"));        // Hello, World!
console.log(greet("TypeScript", 3)); // Hello, TypeScript! Hello, TypeScript! Hello, TypeScript!

// greet(42);        // ❌ 타입 에러
// greet("World", "2"); // ❌ 타입 에러
```

## 2단계: 인터페이스로 객체 모양 정의

```typescript
// src/step2.ts

interface Address {
  street: string;
  city: string;
  country: string;
  zipCode?: string;  // ? 는 선택적 프로퍼티
}

interface User {
  id: number;
  name: string;
  email: string;
  address: Address;
  createdAt: Date;
}

function formatUser(user: User): string {
  return `[${user.id}] ${user.name} <${user.email}>
  주소: ${user.address.city}, ${user.address.country}`;
}

const alice: User = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  address: {
    street: "강남대로 123",
    city: "서울",
    country: "대한민국"
  },
  createdAt: new Date()
};

console.log(formatUser(alice));
```

인터페이스를 사용하면 객체의 "모양"을 미리 정의할 수 있고, 빠진 프로퍼티나 잘못된 타입을 즉시 발견할 수 있습니다.

## 3단계: 함수 타입과 콜백

```typescript
// src/step3.ts

// 함수 타입 표현
type Transformer<T, U> = (value: T) => U;
type Predicate<T> = (value: T) => boolean;

function filter<T>(arr: T[], pred: Predicate<T>): T[] {
  return arr.filter(pred);
}

function map<T, U>(arr: T[], fn: Transformer<T, U>): U[] {
  return arr.map(fn);
}

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const evens = filter(numbers, n => n % 2 === 0);
// evens: number[] = [2, 4, 6, 8, 10]

const doubled = map(evens, n => n * 2);
// doubled: number[] = [4, 8, 12, 16, 20]

console.log(doubled);
```

## 4단계: 유니온 타입과 타입 가드

```typescript
// src/step4.ts

type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function getArea(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      return shape.width * shape.height;
    case "triangle":
      return (shape.base * shape.height) / 2;
  }
}

const shapes: Shape[] = [
  { kind: "circle", radius: 5 },
  { kind: "rectangle", width: 4, height: 6 },
  { kind: "triangle", base: 3, height: 4 }
];

shapes.forEach(s => {
  console.log(`${s.kind}: ${getArea(s).toFixed(2)}`);
});
// circle: 78.54
// rectangle: 24.00
// triangle: 6.00
```

## 5단계: 비동기 함수

```typescript
// src/step5.ts

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

async function fetchPost(id: number): Promise<Post> {
  const response = await fetch(
    `https://jsonplaceholder.typicode.com/posts/${id}`
  );

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json() as Promise<Post>;
}

async function main(): Promise<void> {
  try {
    const post = await fetchPost(1);
    console.log(`제목: ${post.title}`);
    console.log(`작성자: ${post.userId}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`오류: ${error.message}`);
    }
  }
}

main();
```

## 개발 워크플로

![TypeScript 개발 워크플로](/assets/posts/ts-first-program-flow.svg)

ts-node를 설치하면 컴파일 없이 TypeScript 파일을 직접 실행할 수 있어 개발이 빨라집니다.

```bash
npm install --save-dev ts-node @types/node

# 직접 실행
npx ts-node src/step1.ts

# nodemon으로 변경 시 자동 재실행
npm install --save-dev nodemon
npx nodemon --exec ts-node src/step5.ts
```

## 자주 하는 실수

```typescript
// ❌ 잘못된 예: 타입 단언 남용
const data = JSON.parse(json) as User; // 런타임 검증 없음

// ✅ 올바른 예: 런타임 검증
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "name" in obj
  );
}

const parsed = JSON.parse(json);
if (isUser(parsed)) {
  // 여기서는 parsed가 User 타입으로 보장됨
  console.log(parsed.name);
}
```

코드를 직접 타이핑하면서 IDE의 자동완성과 오류 표시가 얼마나 도움이 되는지 경험해보세요. TypeScript는 손에 익히는 시간이 필요하지만, 익히고 나면 없던 시절로 돌아가기 어렵습니다.

---

**지난 글:** [TypeScript Playground — 브라우저에서 즉시 실험하기](/posts/ts-playground-repl/)

**다음 글:** [TypeScript 에디터 설정 — VS Code 최적화](/posts/ts-editor-setup/)

<br>
읽어주셔서 감사합니다. 😊
