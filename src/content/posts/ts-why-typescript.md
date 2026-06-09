---
title: "왜 TypeScript인가? — JavaScript의 한계와 TypeScript의 해답"
description: "JavaScript 단독 개발 시 발생하는 실질적인 문제들과 TypeScript가 이를 어떻게 해결하는지 구체적인 예시로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "JavaScript", "런타임오류", "타입안전성"]
featured: false
draft: false
---

[지난 글](/posts/ts-essence/)에서 TypeScript의 개요를 살펴봤습니다. 이번에는 실제 JavaScript 개발 현장에서 어떤 문제가 발생하는지, 그리고 TypeScript가 어떻게 그 해답을 제공하는지 구체적인 코드로 알아봅니다.

![JavaScript 런타임 오류 예시](/assets/posts/ts-why-typescript-errors.svg)

## JavaScript의 대표적인 문제들

### 1. `null` / `undefined` 참조 오류

JavaScript에서 가장 흔한 런타임 오류입니다. 존재하지 않는 속성에 접근하면 `TypeError: Cannot read properties of null`이 발생합니다.

```javascript
// JavaScript: 런타임에 폭발하는 코드
async function fetchUser(id) {
  const response = await api.getUser(id);
  // response가 null이라면? 런타임 에러!
  return response.name.toUpperCase();
}
```

TypeScript는 `strictNullChecks` 옵션으로 이를 컴파일 타임에 잡습니다.

```typescript
// TypeScript: 컴파일 타임에 null 체크 강제
async function fetchUser(id: number): Promise<string> {
  const response: User | null = await api.getUser(id);
  if (!response) {          // null 체크 없으면 아래 줄에서 컴파일 에러
    throw new Error("User not found");
  }
  return response.name.toUpperCase(); // 여기서는 null이 아님을 TypeScript가 앎
}
```

### 2. 함수 인자 타입 불일치

JavaScript 함수는 어떤 타입의 인자도 받습니다. 의도치 않은 타입이 전달되면 예기치 않은 결과가 나옵니다.

```javascript
// JavaScript: 타입 불일치로 인한 미묘한 버그
function add(a, b) { return a + b; }

add(1, 2);         // 3 (의도한 결과)
add("1", 2);       // "12" (의도하지 않은 결과!)
add(undefined, 2); // NaN (디버깅 어려운 결과)
```

```typescript
// TypeScript: 잘못된 타입 전달 즉시 오류
function add(a: number, b: number): number {
  return a + b;
}

add(1, 2);         // ✅ OK: 3
add("1", 2);       // ❌ 컴파일 에러: string은 number에 할당 불가
```

### 3. 오타로 인한 존재하지 않는 속성 접근

```javascript
// JavaScript: 오타가 있어도 undefined 반환
const user = { firstName: "Alice", lastName: "Smith" };
console.log(user.firstNname);  // undefined (에러 없음!)
```

```typescript
// TypeScript: 오타 즉시 발견
interface User { firstName: string; lastName: string; }
const user: User = { firstName: "Alice", lastName: "Smith" };
console.log(user.firstNname); // ❌ Property 'firstNname' does not exist on type 'User'
```

### 4. API 응답 구조 변경 미탐지

팀 작업에서 백엔드 API의 응답 구조가 바뀌었을 때, 프런트엔드 코드에서 모든 영향 범위를 수동으로 찾아야 합니다.

```typescript
// TypeScript: API 응답 타입 정의
interface UserResponse {
  id: number;
  username: string;  // 이전: name → 변경: username
}

// 이 변경이 일어나면 username을 사용하는 모든 곳에서 즉시 오류 표시
function displayUser(user: UserResponse) {
  console.log(user.name);     // ❌ 오류: 'name' 속성 없음
  console.log(user.username); // ✅ OK
}
```

## TypeScript가 제공하는 이점

![TypeScript 도입 효과](/assets/posts/ts-why-typescript-benefits.svg)

### 조기 오류 발견

버그를 발견하는 시점이 빠를수록 수정 비용이 낮습니다. TypeScript는 이 비용 곡선을 획기적으로 개선합니다.

```
개발 시점 < 코드 리뷰 < 테스트 < 스테이징 < 프로덕션
    ↑
  비용 가장 낮음 (TypeScript가 여기서 잡아줌)
```

### 살아있는 문서로서의 타입

주석은 낡고 거짓말을 하지만, TypeScript 타입은 컴파일러가 항상 검증하므로 최신 상태를 유지합니다.

```typescript
// 주석 없이도 의도가 명확한 함수 시그니처
function processOrder(
  items: CartItem[],
  discountCode: string | null,
  options: { dryRun: boolean; currency: "USD" | "KRW" }
): Promise<OrderResult> {
  // 구현...
}
```

### 안전한 대규모 리팩터링

10만 줄 코드베이스에서 `UserID` 타입을 `number`에서 `string`으로 바꿔야 한다면?

```typescript
// TypeScript: 타입 변경 후 영향 받는 모든 위치를 즉시 파악
type UserID = string;  // number → string으로 변경

function getUser(id: UserID) { /* ... */ }
function deleteUser(id: UserID) { /* ... */ }
// 위 함수들을 호출하는 수백 개 위치에서 즉시 오류 표시
```

## "TypeScript는 느리고 복잡하다"는 오해

TypeScript 도입을 망설이는 가장 흔한 이유와 반박입니다.

| 오해 | 현실 |
|------|------|
| "설정이 복잡하다" | `npx tsc --init` 한 줄로 시작 가능 |
| "배우기 어렵다" | JS 문법 그대로 + 타입만 추가 |
| "런타임이 느려진다" | 컴파일 후 타입 제거 → 런타임 영향 없음 |
| "기존 JS 코드를 다 바꿔야 한다" | allowJs로 점진적 도입 가능 |

```typescript
// 최소한의 TypeScript도 이미 가치 있음
// 타입 어노테이션 0개여도 IDE 자동완성은 훨씬 정확해짐
const config = { port: 3000, debug: true };
config.por  // IDE: 'port' 자동완성 제안 (타입 추론 덕분)
```

TypeScript를 사용하면 단기적으로 타입 작성 시간이 늘어나지만, 중장기적으로 디버깅 시간이 대폭 줄어들고 팀 전체의 생산성이 향상됩니다.

---

**지난 글:** [TypeScript 완전 정복: 본질과 핵심 가치](/posts/ts-essence/)

**다음 글:** [TypeScript vs JavaScript — 코드로 보는 차이](/posts/ts-vs-javascript/)

<br>
읽어주셔서 감사합니다. 😊
