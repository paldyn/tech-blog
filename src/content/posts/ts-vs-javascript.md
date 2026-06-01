---
title: "TypeScript 완전 정복 ③: TypeScript vs JavaScript 실전 비교"
description: "같은 코드를 JavaScript와 TypeScript로 작성했을 때 어떻게 다른지 코드로 직접 비교합니다. 타입 오류, 오타 감지, 반환 타입 등을 실제 예시로 확인합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "JavaScript", "비교", "타입검사", "코드예시"]
featured: false
draft: false
---

[지난 글](/posts/ts-why-typescript/)에서 TypeScript를 써야 하는 이유를 살펴봤다. 이번 글에서는 추상적인 설명 대신, **같은 시나리오를 JavaScript와 TypeScript로 각각 작성**해 두 언어가 실제로 어떻게 다른지 직접 확인한다.

## 코드 대 코드 비교

![TypeScript vs JavaScript 직접 비교](/assets/posts/ts-vs-javascript-comparison.svg)

### 비교 1: Null 안전성

JavaScript에서 가장 흔한 런타임 오류는 `Cannot read properties of null`이다. TypeScript는 이를 컴파일 타임에 차단한다.

```typescript
// JavaScript 방식 (타입 없음)
function getFullName(user) {
  return user.firstName + " " + user.lastName; // user가 null이면 런타임 오류
}

// TypeScript 방식
interface User {
  firstName: string;
  lastName: string;
}

function getFullName(user: User): string {
  return user.firstName + " " + user.lastName;
}

// null 안전 버전 (nullable 허용)
function getFullNameSafe(user: User | null): string {
  if (user === null) return "Anonymous";
  return user.firstName + " " + user.lastName;
}
```

`user: User` 타입 어노테이션을 붙이면, `getFullName(null)` 호출 시 컴파일 오류가 발생한다. `null`을 허용하려면 `User | null`처럼 명시적으로 표현해야 한다.

### 비교 2: 오타와 존재하지 않는 프로퍼티

JavaScript의 객체는 존재하지 않는 프로퍼티를 접근해도 `undefined`를 반환하며 오류를 내지 않는다. 이 때문에 오타가 있어도 한참 후에야 발견된다.

```typescript
// JavaScript
const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
};
console.log(config.apiURl); // undefined (오타지만 오류 없음)

// TypeScript
interface Config {
  apiUrl: string;
  timeout: number;
}

const config2: Config = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
};
// config2.apiURl; // 오류: Property 'apiURl' does not exist on type 'Config'
//                  // Did you mean 'apiUrl'?
console.log(config2.apiUrl); // 정확한 접근
```

TypeScript는 오타 수정 제안(`Did you mean 'apiUrl'?`)까지 제공한다.

### 비교 3: 함수 인수 개수와 타입

```typescript
// JavaScript: 인수를 더 넣거나 덜 넣어도 오류 없음
function add(a, b) {
  return a + b;
}
add(1, 2, 3); // 3번째 인수 무시 (오류 없음)
add(1);       // b는 undefined → NaN 반환 (오류 없음)

// TypeScript: 정확한 인수 강제
function addTS(a: number, b: number): number {
  return a + b;
}
// addTS(1, 2, 3); // 오류: Expected 2 arguments, but got 3
// addTS(1);       // 오류: Expected 2 arguments, but got 1
addTS(1, 2);     // 정상
```

### 비교 4: 배열 메서드 타입 추론

```typescript
// JavaScript: 배열 내 객체 타입을 모름
const products = [
  { id: 1, name: "Apple", price: 1000 },
  { id: 2, name: "Banana", price: 500 },
];
const expensive = products.filter(p => p.price > 700);
// expensive의 타입을 에디터가 모름 — 자동완성 없음

// TypeScript: 타입 자동 추론
type Product = { id: number; name: string; price: number };
const productsTS: Product[] = [
  { id: 1, name: "Apple", price: 1000 },
  { id: 2, name: "Banana", price: 500 },
];
const expensiveTS = productsTS.filter(p => p.price > 700);
// expensiveTS는 Product[] 타입으로 추론됨
// expensiveTS[0]. 을 입력하면 id, name, price 자동완성 제공
```

### 비교 5: 유니온 타입과 분기

TypeScript는 "이 변수가 여러 타입 중 하나일 수 있다"는 상황을 명확하게 표현한다.

```typescript
// TypeScript: 유니온 타입
type Status = "pending" | "success" | "error";

function handleStatus(status: Status) {
  if (status === "pending") {
    console.log("처리 중...");
  } else if (status === "success") {
    console.log("완료!");
  } else {
    // status는 여기서 자동으로 "error" 타입으로 좁혀짐
    console.log("오류 발생:", status);
  }
}

// handleStatus("loading"); // 오류: Argument '"loading"' is not assignable
//                            // to parameter of type 'Status'
```

JavaScript라면 잘못된 status 값("loading")을 전달해도 런타임까지 발견되지 않는다.

## 언제 무엇을 선택할까

![언제 TypeScript / JavaScript를 선택할까](/assets/posts/ts-vs-javascript-tradeoffs.svg)

## 컴파일 결과는 동일하다

TypeScript를 컴파일하면 JavaScript가 된다. 아래를 보자.

```typescript
// 입력 (TypeScript)
interface Point {
  x: number;
  y: number;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
```

```javascript
// 출력 (컴파일된 JavaScript)
function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
```

`interface`와 타입 어노테이션은 완전히 제거된다. 런타임 성능 차이는 없다.

## 정리

TypeScript와 JavaScript의 본질적 차이는 "오류를 언제 발견하느냐"다. JavaScript는 유연하지만 런타임까지 오류가 숨어있다. TypeScript는 컴파일 타임에 오류를 잡아 개발 사이클을 단축한다. 두 언어 모두 브라우저와 Node.js에서 동일하게 실행된다.

다음 글에서는 TypeScript를 직접 설치하고 환경을 구성하는 실습을 진행한다.

---

**지난 글:** [왜 TypeScript를 써야 하는가](/posts/ts-why-typescript/)

**다음 글:** [TypeScript 설치와 환경 설정](/posts/ts-setup-install/)

<br>
읽어주셔서 감사합니다. 😊
