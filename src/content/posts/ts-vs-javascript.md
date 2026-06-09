---
title: "TypeScript vs JavaScript — 코드로 보는 차이"
description: "같은 기능을 JavaScript와 TypeScript로 작성했을 때 어떤 차이가 있는지 실제 코드 예시로 비교하고, 각각 어떤 상황에 적합한지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "JavaScript", "비교", "코드예시"]
featured: false
draft: false
---

[지난 글](/posts/ts-why-typescript/)에서 TypeScript를 선택해야 하는 이유를 살펴봤습니다. 이번 글에서는 같은 코드를 JavaScript와 TypeScript로 나란히 작성해보면서 실질적인 차이를 피부로 느껴보겠습니다.

![TypeScript vs JavaScript 코드 비교](/assets/posts/ts-vs-javascript-comparison.svg)

## 기본 변수 선언

언뜻 보면 TypeScript가 더 장황해 보이지만, 실제 작업에서는 타입 어노테이션이 얼마나 많은 정보를 전달하는지 알 수 있습니다.

```javascript
// JavaScript
let price = 9.99;
let productName = "Widget";
let inStock = true;

// price에 문자열을 할당해도 오류 없음
price = "free";  // OK (의도했나?)
```

```typescript
// TypeScript
let price: number = 9.99;
let productName: string = "Widget";
let inStock: boolean = true;

price = "free";  // ❌ 컴파일 에러: Type 'string' is not assignable to type 'number'
```

실제로는 초기값이 있을 때 타입 어노테이션을 생략해도 TypeScript가 알아서 추론합니다.

```typescript
// 타입 추론 — 어노테이션 없이도 타입 안전
let price = 9.99;     // TypeScript가 number로 추론
price = "free";       // ❌ 여전히 에러 (추론 덕분)
```

## 함수 정의

함수는 TypeScript가 가장 큰 가치를 발휘하는 곳입니다.

```javascript
// JavaScript: 무엇을 넘겨야 하는지 함수 본문을 읽어야 앎
function createOrder(userId, items, discount) {
  // ...
  return { id: generateId(), total: calculateTotal(items, discount) };
}
```

```typescript
// TypeScript: 시그니처만 봐도 계약이 명확
interface OrderItem { productId: string; quantity: number; }
interface Order { id: string; total: number; }

function createOrder(
  userId: string,
  items: OrderItem[],
  discount: number = 0
): Order {
  return {
    id: crypto.randomUUID(),
    total: calculateTotal(items, discount)
  };
}
```

타입 정보 덕분에 IDE는 정확한 자동완성을 제공하고, 잘못된 인자 타입을 즉시 감지합니다.

## 클래스와 인터페이스

```javascript
// JavaScript: 클래스 멤버 타입 정보 없음
class BankAccount {
  constructor(owner, balance) {
    this.owner = owner;
    this.balance = balance;
  }
  deposit(amount) {
    this.balance += amount;
  }
}
```

```typescript
// TypeScript: 명확한 타입 계약
class BankAccount {
  private balance: number;  // 외부 접근 차단

  constructor(
    readonly owner: string, // 읽기 전용
    initialBalance: number
  ) {
    this.balance = initialBalance;
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error("Amount must be positive");
    this.balance += amount;
  }

  getBalance(): number {
    return this.balance;
  }
}

const account = new BankAccount("Alice", 1000);
account.balance;      // ❌ private 접근 불가
account.owner = "Bob"; // ❌ readonly 수정 불가
```

## 비동기 코드

```javascript
// JavaScript: fetchUser가 무엇을 반환하는지 모름
async function fetchUser(id) {
  const data = await api.get(`/users/${id}`);
  return data;  // 뭔데?
}
```

```typescript
// TypeScript: 반환 타입이 명확
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User | null> {
  try {
    const data = await api.get<User>(`/users/${id}`);
    return data;
  } catch {
    return null;
  }
}

// 사용처에서 null 체크 강제
const user = await fetchUser(1);
if (user) {
  console.log(user.name); // ✅ null 체크 후 안전한 접근
}
```

## 언제 어느 것을 선택할까?

![TypeScript vs JavaScript 선택 기준](/assets/posts/ts-vs-javascript-tradeoffs.svg)

실질적인 기준을 정리하면 다음과 같습니다.

**TypeScript를 선택하는 경우**
- 3명 이상의 팀이 함께 작업하는 코드베이스
- 6개월 이상 유지보수할 프로젝트
- npm에 배포할 라이브러리나 SDK
- React, Vue, Angular 등 프레임워크 앱

**JavaScript로 충분한 경우**
- 100줄 이하의 일회성 스크립트
- 빠른 아이디어 검증 (Proof of Concept)
- 혼자 작업하는 단순 자동화 도구

다만, 오늘날 대부분의 프로젝트에서는 TypeScript가 기본 선택지가 되었습니다. Vite, Next.js, NestJS 등의 현대 도구들은 TypeScript를 기본으로 지원하며, 시작 비용도 거의 없습니다.

## 마이그레이션 전략

기존 JavaScript 프로젝트에 TypeScript를 점진적으로 도입하는 방법도 있습니다.

```json
// tsconfig.json: 점진적 도입 설정
{
  "compilerOptions": {
    "allowJs": true,       // .js 파일도 처리
    "checkJs": false,      // .js 파일은 검사 안 함 (단계적으로 true로)
    "strict": false        // 처음엔 느슨하게, 점차 엄격하게
  }
}
```

파일 확장자를 `.js`에서 `.ts`로 하나씩 바꾸면서 타입을 추가하는 방식으로 리스크 없이 마이그레이션할 수 있습니다.

---

**지난 글:** [왜 TypeScript인가? — JavaScript의 한계와 TypeScript의 해답](/posts/ts-why-typescript/)

**다음 글:** [TypeScript 설치 및 환경 설정 — 처음부터 시작하기](/posts/ts-setup-install/)

<br>
읽어주셔서 감사합니다. 😊
