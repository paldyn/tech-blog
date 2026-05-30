---
title: "TypeScript vs JavaScript: 코드로 보는 결정적 차이"
description: "TypeScript와 JavaScript의 차이를 7가지 관점에서 실제 코드와 함께 비교합니다. 언제 TypeScript가 빛을 발하고, 언제 JavaScript로 충분한지 판단 기준을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "JavaScript", "TypeScriptvsJavaScript", "TypeScript완전정복", "언어비교"]
featured: false
draft: false
---

[지난 글](/posts/ts-why-typescript/)에서 TypeScript를 써야 하는 이유를 살펴봤다. 이번에는 실제 코드를 나란히 놓고 TypeScript와 JavaScript의 차이를 구체적으로 확인해보자. 이론보다 코드가 훨씬 설득력 있다.

## 차이 1: 타입 오류 발견 시점

같은 버그를 두 언어가 어떻게 다르게 처리하는지 보자.

```javascript
// JavaScript — 런타임에서 버그 발견
function calculateArea(width, height) {
  return width * height;
}

console.log(calculateArea(10, "20")); // 문자열 "200" 반환 — 아무 경고 없음
console.log(calculateArea(10));       // NaN 반환 — 아무 경고 없음
```

```typescript
// TypeScript — 코딩 중 즉시 오류 표시
function calculateArea(width: number, height: number): number {
  return width * height;
}

calculateArea(10, "20"); // Error: 'string'은 'number'에 할당할 수 없습니다
calculateArea(10);       // Error: 인수가 부족합니다 (2개 필요)
```

![TypeScript vs JavaScript 비교](/assets/posts/ts-vs-javascript-comparison.svg)

## 차이 2: 객체 프로퍼티 접근

```javascript
// JavaScript — 오타가 조용히 undefined 반환
const user = { name: "Alice", email: "alice@example.com" };

console.log(user.neme);   // undefined (오타지만 오류 없음)
console.log(user.Email);  // undefined (대소문자 틀렸지만 오류 없음)
```

```typescript
// TypeScript — 즉시 오류 포착
interface User {
  name: string;
  email: string;
}

const user: User = { name: "Alice", email: "alice@example.com" };

console.log(user.neme);   // Error: 'User' 타입에 'neme' 프로퍼티 없음
console.log(user.Email);  // Error: 'User' 타입에 'Email' 프로퍼티 없음
```

## 차이 3: 함수 반환값 처리

```javascript
// JavaScript — 반환값 타입 불명확
function findUser(id) {
  const users = [{ id: 1, name: "Alice" }];
  return users.find(u => u.id === id);  // User | undefined 반환
}

const user = findUser(999);
console.log(user.name.toUpperCase());  // 런타임 오류! user가 undefined
```

```typescript
// TypeScript — null 안전성 강제
interface User { id: number; name: string; }

function findUser(id: number): User | undefined {
  const users: User[] = [{ id: 1, name: "Alice" }];
  return users.find(u => u.id === id);
}

const user = findUser(999);
console.log(user.name.toUpperCase());   // Error: 'user'가 undefined일 수 있습니다

// 올바른 처리
const user2 = findUser(999);
if (user2) {
  console.log(user2.name.toUpperCase());  // OK — undefined 검사 후 사용
}
```

## 차이 4: 자동완성과 탐색성

코드 자체로는 차이가 없어 보이지만, IDE 경험이 완전히 다르다.

```typescript
// TypeScript: 모든 단계에서 IDE가 타입을 알고 자동완성 제공
async function loadDashboard(userId: string) {
  const user = await fetchUser(userId);
  // user. 까지 입력하면 name, email, role, createdAt 등 자동 제안

  const orders = await fetchOrders(user.id);
  // orders[0]. 까지 입력하면 id, total, status, items 등 자동 제안

  const summary = {
    userName: user.name,
    totalSpent: orders.reduce((sum, o) => sum + o.total, 0),
  };

  return summary;
  // summary. 까지 입력하면 userName, totalSpent 자동 제안
}
```

## 차이 5: 열거형과 리터럴 타입

```javascript
// JavaScript — 상수를 별도로 관리해야 함
const STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  INACTIVE: "inactive"
};

function setUserStatus(userId, status) {
  // status가 올바른 값인지 런타임에 검사해야 함
  if (!Object.values(STATUS).includes(status)) {
    throw new Error("Invalid status");
  }
}

setUserStatus(1, "actve");  // 오타지만 컴파일 오류 없음
```

```typescript
// TypeScript — 리터럴 타입으로 값 범위를 컴파일 타임에 제한
type UserStatus = "pending" | "active" | "inactive";

function setUserStatus(userId: number, status: UserStatus): void {
  // status가 이미 타입으로 제한됨 — 런타임 검사 불필요
}

setUserStatus(1, "actve");    // Error: '"actve"'는 UserStatus에 없는 값
setUserStatus(1, "active");   // OK
```

## 차이 6: 인터페이스와 계약

```javascript
// JavaScript — 계약이 암묵적
function createOrder(product, quantity, userId) {
  // product가 뭘 가져야 하는지, quantity가 정수인지 불명확
  return {
    id: Math.random().toString(36),
    product,
    quantity,
    userId,
    createdAt: new Date(),
  };
}
```

```typescript
// TypeScript — 계약이 명시적
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface CreateOrderInput {
  product: Product;
  quantity: number;
  userId: string;
}

interface Order extends CreateOrderInput {
  id: string;
  createdAt: Date;
  total: number;
}

function createOrder(input: CreateOrderInput): Order {
  if (input.quantity > input.product.stock) {
    throw new Error("재고 부족");
  }
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date(),
    total: input.product.price * input.quantity,
  };
}
```

## 차이 7: 제네릭으로 재사용 가능한 타입

```javascript
// JavaScript — any 타입의 컨테이너 (타입 안전성 없음)
function first(array) {
  return array[0];  // 반환값 타입이 뭔지 알 수 없음
}
```

```typescript
// TypeScript — 제네릭으로 타입 안전성 유지하면서 재사용
function first<T>(array: T[]): T | undefined {
  return array[0];
}

const num = first([1, 2, 3]);    // number | undefined
const str = first(["a", "b"]);  // string | undefined

num.toFixed(2);  // Error: num이 undefined일 수 있음
if (num !== undefined) {
  num.toFixed(2);  // OK
}
```

![TypeScript vs JavaScript 코드 차이](/assets/posts/ts-vs-javascript-code.svg)

## 비교 요약

| 항목 | JavaScript | TypeScript |
|------|-----------|------------|
| 타입 오류 감지 | 런타임 | 컴파일 타임 |
| 오타 감지 | 런타임 (undefined) | 컴파일 타임 |
| IDE 자동완성 | 제한적 | 강력 |
| 리팩터링 안전성 | 낮음 | 높음 |
| 빌드 단계 | 불필요 | 필요 |
| 러닝 커브 | 낮음 | 중간 |
| 대규모 팀 협업 | 어려움 | 용이 |

## JavaScript가 더 적합한 경우

TypeScript가 항상 더 낫지는 않다.

```javascript
// 단순 스크립트: TypeScript 설정 오버헤드가 더 클 수 있음
#!/usr/bin/env node
const fs = require("fs");
const content = fs.readFileSync("./input.txt", "utf-8");
console.log(content.split("\n").length + " 줄");
```

소규모 유틸리티, 빠른 프로토타이핑, 이미 완성된 소규모 프로젝트라면 JavaScript로 충분하다.

## 결론

TypeScript와 JavaScript의 차이는 코드를 보면 명확해진다. 타입이 있는 코드는 더 안전하고, 더 읽기 쉽고, 더 유지보수하기 쉽다. 이어지는 글에서는 TypeScript 개발 환경을 실제로 설치하고 첫 코드를 작성해보자.

---

**지난 글:** [왜 TypeScript인가? 현업에서의 실제 가치](/posts/ts-why-typescript/)

**다음 글:** [TypeScript 개발 환경 설치: Node.js부터 tsconfig까지](/posts/ts-setup-install/)

<br>
읽어주셔서 감사합니다. 😊
