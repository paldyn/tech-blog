---
title: "ReturnType과 Parameters로 함수 타입 분해하기"
description: "TypeScript의 ReturnType<F>와 Parameters<F> 유틸리티 타입이 infer 키워드로 함수 타입을 분해하는 원리를 설명합니다. API 반환 타입 재사용, 래퍼 함수 시그니처 보존, memoize·throttle 고차 함수 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "유틸리티 타입", "ReturnType", "Parameters", "infer", "고차 함수"]
featured: false
draft: false
---

[지난 글](/posts/ts-extract-exclude/)에서 유니언을 집합 연산으로 필터링하는 방법을 살펴봤습니다. 이번에는 **함수 타입을 분해**하는 `ReturnType<F>`와 `Parameters<F>`를 다룹니다. 이 두 유틸리티는 `infer` 키워드로 함수 타입의 안쪽을 들여다보며, 고차 함수 패턴에서 특히 빛을 발합니다.

![ReturnType · Parameters 함수 분해](/assets/posts/ts-returntype-parameters-overview.svg)

## 내부 구현: infer 키워드

```typescript
// 반환 타입 추출
type ReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : any;

// 파라미터 타입을 튜플로 추출
type Parameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;
```

`infer R`은 조건부 타입이 참인 분기에서 TypeScript가 타입을 **추론(infer)해서 R이라는 이름으로 바인딩**하도록 합니다. 반환 타입을 직접 쓰지 않아도 함수 타입을 넘겨주는 것만으로 TypeScript가 알아냅니다.

## ReturnType\<F\>: 반환 타입 추출

```typescript
function createUser(name: string, role: "admin" | "user") {
  return { id: Math.random(), name, role, createdAt: new Date() };
}

// 반환 타입을 수동으로 정의하지 않아도 됨
type NewUser = ReturnType<typeof createUser>;
// → { id: number; name: string; role: "admin" | "user"; createdAt: Date }
```

`typeof createUser`는 함수 값의 타입을 가져오는 타입 레벨 연산자입니다. `ReturnType<typeof fn>`은 "이 함수가 반환하는 타입이 무엇인가?"를 표현하는 관용구입니다.

### API 함수와 React Query

```typescript
// API 함수 정의
async function fetchProduct(id: number) {
  const res = await fetch(`/api/products/${id}`);
  return res.json() as Promise<{ id: number; name: string; price: number }>;
}

// 반환 타입(Promise를 풀어서) 재사용
type Product = Awaited<ReturnType<typeof fetchProduct>>;

// React Query와 연동
function useProduct(id: number) {
  return useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id),
  });
}
```

함수 반환 타입이 바뀌면 `Product` 타입도 자동으로 갱신됩니다. 타입 정의가 단일 출처(함수 자체)에 집중됩니다.

### Redux 셀렉터

```typescript
const rootReducer = combineReducers({ auth: authReducer, cart: cartReducer });

// RootState를 별도로 정의하지 않아도
type RootState = ReturnType<typeof rootReducer>;

// 셀렉터 반환 타입 추출
const selectCartItems = (state: RootState) => state.cart.items;
type CartItems = ReturnType<typeof selectCartItems>;
```

## Parameters\<F\>: 파라미터 튜플 추출

```typescript
function sendEmail(to: string, subject: string, body: string): void {}

type EmailArgs = Parameters<typeof sendEmail>;
// → [to: string, subject: string, body: string]

// 튜플이므로 인덱스로 접근 가능
type RecipientType = EmailArgs[0]; // string
```

결과가 **레이블드 튜플(labeled tuple)** 이기 때문에 각 요소에 이름도 보존됩니다.

### 래퍼 함수 타입 보존

```typescript
// Parameters와 ReturnType을 함께 써서 완전한 래퍼 작성
function withErrorBoundary<F extends (...args: any[]) => any>(fn: F) {
  return function(...args: Parameters<F>): ReturnType<F> | null {
    try {
      return fn(...args);
    } catch {
      return null;
    }
  };
}

const safeParseInt = withErrorBoundary(parseInt);
// safeParseInt의 타입: (string: string, radix?: number) => number | null
```

## 실전 패턴

![ReturnType · Parameters 실전 패턴](/assets/posts/ts-returntype-parameters-patterns.svg)

### 고차 함수: memoize

```typescript
function memoize<F extends (...args: any[]) => any>(fn: F): (
  ...args: Parameters<F>
) => ReturnType<F> {
  const cache = new Map<string, ReturnType<F>>();
  return (...args: Parameters<F>): ReturnType<F> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

const expensiveCalc = (n: number, factor: number) => n * factor * Math.PI;
const memoized = memoize(expensiveCalc);
// memoized: (n: number, factor: number) => number — 원래 타입 보존
```

### 함수 호출 로깅

```typescript
function withLog<F extends (...args: any[]) => any>(fn: F, name: string) {
  return (...args: Parameters<F>): ReturnType<F> => {
    console.log(`[${name}] called with`, args);
    const result = fn(...args);
    console.log(`[${name}] returned`, result);
    return result;
  };
}
```

## ConstructorParameters와 InstanceType

`Parameters`의 생성자 버전인 `ConstructorParameters`와 `InstanceType`도 같은 패턴입니다.

```typescript
class Database {
  constructor(url: string, poolSize: number) {}
  query(sql: string): Promise<unknown[]> { return Promise.resolve([]); }
}

type DbArgs = ConstructorParameters<typeof Database>;
// → [url: string, poolSize: number]

type DbInstance = InstanceType<typeof Database>;
// → Database

// 팩토리 함수에서 활용
function createDb(...args: ConstructorParameters<typeof Database>): Database {
  return new Database(...args);
}
```

## 주의: 오버로드된 함수

함수에 오버로드가 여러 개 있을 때 `ReturnType`과 `Parameters`는 **마지막 오버로드 시그니처**를 사용합니다.

```typescript
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): number | string {
  return typeof input === "string" ? parseInt(input) : String(input);
}

type P = Parameters<typeof parse>; // [input: string | number] — 구현 시그니처
type R = ReturnType<typeof parse>;  // string | number
```

---

**지난 글:** [Extract와 Exclude로 유니언 조각내기](/posts/ts-extract-exclude/)

**다음 글:** [Awaited 유틸리티 타입 완전 정복](/posts/ts-awaited-utility/)

<br>
읽어주셔서 감사합니다. 😊
