---
title: "왜 TypeScript인가: 타입 시스템이 주는 생산성"
description: "타입 없는 JavaScript의 한계를 직접 보고, TypeScript가 어떻게 타입 안전성·IDE 지원·리팩토링·문서화 문제를 해결하는지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "생산성", "타입안전성", "IDE", "리팩토링"]
featured: false
draft: false
---

[지난 글](/posts/ts-essence/)에서 TypeScript가 JavaScript의 상위집합이라는 개념을 살펴봤습니다. 이번 글에서는 "왜 굳이 TypeScript를 써야 하는가"라는 질문에 구체적인 근거로 답합니다. TypeScript를 선택하는 이유는 단순히 유행이 아닙니다.

## JavaScript의 현실적 고통

JavaScript로 어느 정도 규모 있는 프로젝트를 개발해본 분이라면 아래 상황이 낯설지 않을 겁니다.

```javascript
// JS: 이 함수가 뭘 받아야 하는지 알 수 없다
function processOrder(order) {
  return order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

// 3개월 후 팀원이 잘못된 형태로 호출
processOrder({ id: 1, total: 5000 });
// 💥 런타임: Cannot read properties of undefined (reading 'reduce')
```

이 오류는 배포 후 사용자가 직접 마주합니다. 개발 환경에서는 특정 경로를 타지 않으면 발견하기 어렵습니다.

![타입 없는 코드의 문제](/assets/posts/ts-why-typescript-problem.svg)

## TypeScript가 주는 4가지 이점

![TypeScript 4가지 핵심 이점](/assets/posts/ts-why-typescript-solution.svg)

### ① 타입 안전성

TypeScript는 컴파일 타임에 잘못된 타입 사용을 잡아냅니다. 위의 `processOrder` 예시에 타입을 추가하면:

```typescript
interface OrderItem {
  productId: string;
  price: number;
  qty: number;
}

interface Order {
  id: number;
  items: OrderItem[];
}

function processOrder(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

// 잘못된 호출 — 컴파일 타임에 즉시 오류
processOrder({ id: 1, total: 5000 });
// TS2345: Argument of type '{ id: number; total: number; }'
// is not assignable to parameter of type 'Order'.
// Object literal may only specify known properties,
// and 'total' does not exist in type 'Order'.
```

배포 전에, 심지어 코드를 실행하기도 전에 오류를 잡습니다.

### ② 강력한 IDE 지원

TypeScript의 타입 정보를 기반으로 IDE(특히 VS Code)는 정밀한 자동완성, 타입 힌트, 즉각적인 오류 표시를 제공합니다. JavaScript에서는 어떤 속성이 있는지 IDE가 추측하지만, TypeScript에서는 정확하게 알고 있습니다.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

const user: User = getUser();
user. // ← 여기서 id, name, email, createdAt 자동완성 표시
```

### ③ 살아있는 문서화

타입 시그니처가 곧 문서입니다. JSDoc 주석 없이도 함수의 입출력이 코드에 명시됩니다.

```typescript
// 타입만 봐도 사용법을 알 수 있다
async function fetchUser(userId: number): Promise<User | null> {
  // ...
}

// 반환값이 null일 수 있다는 것도 타입으로 전달
const user = await fetchUser(123);
if (user) {
  console.log(user.name); // null 처리 후 접근
}
```

### ④ 안전한 리팩토링

함수 시그니처를 변경하면 타입 오류가 전파되어 영향 받는 모든 곳을 알 수 있습니다. "변경했을 때 어디가 깨질지 모른다"는 JavaScript의 가장 큰 공포를 제거합니다.

```typescript
// order의 구조를 바꾸면
interface Order {
  id: number;
  lineItems: OrderItem[]; // items → lineItems 변경
}

// processOrder, displayOrder, saveOrder 등
// 모든 사용처에서 즉시 컴파일 오류 발생
// 놓치는 코드가 없다
```

## "JavaScript를 잘 알면 TypeScript도 잘 쓴다"

TypeScript는 새로운 언어가 아닙니다. JavaScript를 잘 알수록 TypeScript의 타입 시스템도 더 잘 활용할 수 있습니다. 타입 시스템은 JavaScript의 런타임 동작을 정적으로 모델링하기 때문에, JavaScript의 프로토타입, 클로저, async/await 동작을 이해하면 더 정확한 타입을 작성할 수 있습니다.

TypeScript 도입은 점진적으로 할 수 있습니다. `allowJs: true`로 JS 파일을 TypeScript 프로젝트에서 함께 사용하고, 파일 하나씩 `.ts`로 전환하는 방식이 현실적입니다.

---

**지난 글:** [TypeScript의 본질: 타입이 있는 JavaScript](/posts/ts-essence/)

**다음 글:** [TypeScript vs JavaScript: 무엇이 다른가](/posts/ts-vs-javascript/)

<br>
읽어주셔서 감사합니다. 😊
