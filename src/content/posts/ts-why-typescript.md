---
title: "TypeScript 완전 정복 ②: 왜 지금 TypeScript인가"
description: "TypeScript가 단순한 유행이 아닌 이유. 생산성, 오류 예방, 생태계 지원, 팀 협업 측면에서 TypeScript 도입의 실질적 이유를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "생산성", "타입안전성", "에코시스템", "정적타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-essence/)에서 TypeScript가 JavaScript의 상위 집합이며 컴파일 타임 타입 검사를 제공한다는 것을 살펴봤다. 이번 글에서는 더 구체적인 질문을 다룬다: "TypeScript를 왜 **지금** 써야 하는가?" 단순한 트렌드가 아니라 실질적인 이유를 정리한다.

## TypeScript 도입의 5가지 핵심 이유

![TypeScript를 써야 하는 5가지 이유](/assets/posts/ts-why-typescript-adoption.svg)

### 이유 1: 오류를 코딩 중에 발견한다

TypeScript의 가장 직접적인 이점은 버그를 런타임이 아닌 **코드 작성 중에** 잡는다는 것이다. 아래 예시를 보자.

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

function applyDiscount(product: Product, rate: number): Product {
  return {
    ...product,
    price: product.price * (1 - rate),
  };
}

// 실수: 객체 대신 id만 전달
// applyDiscount(42, 0.1); // 오류: Argument of type 'number' is not assignable
//                          // to parameter of type 'Product'

// 실수: 존재하지 않는 필드 접근
// product.discount; // 오류: Property 'discount' does not exist on type 'Product'
```

JavaScript였다면 이 오류들은 런타임에야 발견된다. TypeScript는 에디터에서 빨간 밑줄로 즉시 알려준다.

### 이유 2: 자동완성과 리팩터링이 정확해진다

타입 정보가 있으면 에디터(VS Code 등)가 정확한 자동완성을 제공한다. `.`을 입력하면 그 객체에 실제로 존재하는 프로퍼티만 제안한다. JavaScript에서는 "이 객체에 어떤 필드가 있더라?" 하고 문서나 소스를 찾아야 했다.

```typescript
// 에디터가 user. 입력 시 id, name, email, createdAt 자동 제안
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

function formatUser(user: User) {
  return `${user.name} <${user.email}>`; // 자동완성으로 빠르게 작성
}
```

리팩터링도 안전해진다. 함수 이름이나 인터페이스 필드명을 바꾸면 그것을 참조하는 모든 곳에서 컴파일 오류가 발생해, 무엇을 고쳐야 하는지 명확하게 알 수 있다.

### 이유 3: 코드가 문서가 된다

타입 어노테이션은 코드의 의도를 표현하는 가장 신뢰할 수 있는 문서다. 주석은 코드가 바뀌어도 업데이트되지 않을 수 있지만, 타입은 항상 실제 코드와 일치한다.

```typescript
// 타입이 없는 JavaScript — 매개변수의 의미를 알기 어려움
function createOrder(userId, items, couponCode, addressId) { }

// TypeScript — 타입 자체가 문서
type OrderItem = { productId: number; quantity: number; };
type CouponCode = string | null;

function createOrder(
  userId: number,
  items: OrderItem[],
  couponCode: CouponCode,
  addressId: number
): Promise<Order> { }
```

두 번째 함수는 JSDoc 주석 없이도 파라미터의 의미가 명확하다.

### 이유 4: 대규모 팀과 코드베이스를 지탱한다

5명이 넘는 팀에서 JavaScript로 개발하면 흔히 이런 일이 생긴다: 팀원 A가 함수 시그니처를 바꿨는데, 팀원 B가 작성한 코드가 이전 시그니처를 사용해 런타임 오류가 발생한다. TypeScript는 이런 암묵적 계약 위반을 컴파일 타임에 잡아낸다.

```typescript
// 팀원 A가 함수를 수정 (email 필수 추가)
function createUser(name: string, email: string): User {
  return { id: Math.random(), name, email };
}

// 팀원 B의 기존 코드 — 이제 컴파일 오류 발생
// createUser("Alice"); // 오류: Expected 2 arguments, but got 1
// 런타임이 아니라 빌드 타임에 발견됨
```

### 이유 5: 생태계가 TypeScript 퍼스트다

![TypeScript 생태계 현황](/assets/posts/ts-why-typescript-ecosystem.svg)

2024-2025년 기준으로 주요 프레임워크와 라이브러리 대부분이 TypeScript 퍼스트다. Next.js, NestJS, Prisma, Drizzle, Hono, tRPC, Zod 등은 TypeScript를 기본으로 설계됐다. 이 라이브러리들은 타입 정의를 내장하고 있어서 별도 `@types/` 패키지 설치 없이 완전한 타입 안전성을 제공한다.

## TypeScript가 적합하지 않은 경우

TypeScript가 항상 최선은 아니다. 다음 경우에는 신중히 고려해야 한다.

```typescript
// 소규모 스크립트 — 타입 설정 오버헤드가 클 수 있음
// 100줄짜리 스크립트에 tsconfig, 빌드 설정까지 세팅하는 건 과할 수 있다

// 그러나 Node.js 22+ + tsx로 설정 없이 실행 가능
// npx tsx script.ts
```

- **50줄 이하 스크립트**: 설정 오버헤드가 코드량보다 클 수 있다
- **프로토타입 PoC**: 빠른 검증이 목적이라면 JS로 시작해도 된다
- **학습 목적 작은 예제**: TypeScript 문법 자체를 배우는 중이라면 오히려 복잡해진다

하지만 이 경우에도 Node.js에서 `tsx`나 Bun으로 TypeScript를 설정 없이 바로 실행할 수 있어서, "설정이 귀찮다"는 이유는 점점 설득력을 잃어가고 있다.

## TypeScript 도입의 실질적 ROI

Microsoft 내부 데이터에 따르면 TypeScript 도입으로 런타임 버그가 약 15% 감소했다는 보고가 있다. 에어비앤비는 TypeScript 도입 후 발생한 버그의 38%가 TypeScript가 있었더라면 사전 예방 가능했다고 분석했다. 이는 단순히 "오류 잡기"를 넘어서 **팀 속도와 코드 품질 전반**에 영향을 미친다.

## 정리

TypeScript는 트렌드가 아니라 **생산성 투자**다. 초기 타입 작성에 약간의 비용이 들지만, 오류 예방, 리팩터링 안전성, 코드 문서화, 팀 협업 개선으로 그 이상의 가치를 돌려준다. 특히 프로젝트 규모가 클수록, 팀 인원이 많을수록, 그 효과는 배가된다.

다음 글에서는 TypeScript와 JavaScript를 직접 비교해 구체적으로 무엇이 달라지는지를 코드로 보여준다.

---

**지난 글:** [TypeScript의 본질](/posts/ts-essence/)

**다음 글:** [TypeScript vs JavaScript: 실전 비교](/posts/ts-vs-javascript/)

<br>
읽어주셔서 감사합니다. 😊
