---
title: "Awaited 유틸리티 타입 완전 정복"
description: "TypeScript 4.5에 도입된 Awaited<T>가 Promise를 재귀적으로 언래핑하는 원리를 설명합니다. async 함수 반환 타입 추출, Promise.all 결과 타입, React Query와의 통합, 고차 비동기 함수 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "유틸리티 타입", "Awaited", "Promise", "async", "비동기"]
featured: false
draft: false
---

[지난 글](/posts/ts-returntype-parameters/)에서 함수 타입을 분해하는 방법을 살펴봤습니다. 이번에는 비동기 함수와 필연적으로 만나는 `Awaited<T>`를 다룹니다. TypeScript 4.5에서 공식 추가된 이 유틸리티는 `Promise`를 **재귀적으로 언래핑**해서 실제 값 타입을 꺼내 줍니다.

![Awaited 재귀 언래핑](/assets/posts/ts-awaited-utility-overview.svg)

## 왜 Awaited가 필요한가

TypeScript 4.5 이전에는 `Promise<T>`에서 `T`를 꺼내려면 번거로운 수동 타입 조작이 필요했습니다.

```typescript
// 이전 방법 (TypeScript < 4.5)
type Unwrap<T> = T extends Promise<infer V> ? V : T;
// 하지만 Promise<Promise<number>>는 Promise<number>로만 풀리고 number로 안 풀림

// Awaited는 재귀적으로 처리
type A = Awaited<Promise<string>>;            // string
type B = Awaited<Promise<Promise<number>>>;   // number (재귀!)
type C = Awaited<string>;                     // string (비-Promise는 그대로)
```

## 내부 구현

```typescript
// TypeScript 4.5+ 표준 라이브러리
type Awaited<T> =
  T extends null | undefined
    ? T
    : T extends object & { then(onfulfilled: infer F, ...args: infer _): any }
      ? F extends (value: infer V, ...args: infer _) => any
        ? Awaited<V>   // 재귀: then 콜백의 인자 타입을 다시 Awaited로
        : never
      : T;
```

세 가지 경우를 처리합니다:
1. `null | undefined` → 그대로 반환
2. `thenable` 객체 → `then` 콜백의 첫 번째 인자 타입을 재귀적으로 Awaited
3. 나머지 → 그대로 반환

`Promise<T>`만 처리하는 게 아니라 `then` 메서드가 있는 **thenable 객체 전체**를 처리한다는 점이 중요합니다.

## 핵심 패턴: Awaited + ReturnType

가장 자주 쓰이는 조합은 `Awaited<ReturnType<typeof asyncFn>>`입니다.

```typescript
// API 함수
async function fetchUserProfile(userId: string) {
  const res = await fetch(`/api/users/${userId}`);
  if (!res.ok) throw new Error("Not found");
  return res.json() as Promise<{
    id: string;
    name: string;
    avatar: string;
    plan: "free" | "pro";
  }>;
}

// 반환 타입 추출 — 수동으로 interface를 선언할 필요 없음
type UserProfile = Awaited<ReturnType<typeof fetchUserProfile>>;
// → { id: string; name: string; avatar: string; plan: "free" | "pro" }
```

이 패턴의 이점은 `fetchUserProfile`의 반환 타입이 바뀌면 `UserProfile`도 자동으로 갱신된다는 점입니다.

## Promise.all과 함께

```typescript
async function loadDashboard(userId: string) {
  const [user, posts, stats] = await Promise.all([
    fetchUser(userId),
    fetchPosts(userId),
    fetchStats(userId),
  ]);
  return { user, posts, stats };
}

// Promise.all 결과 타입 추출
type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
// → { user: User; posts: Post[]; stats: Stats }
```

## 실전 패턴

![Awaited 실전 패턴](/assets/posts/ts-awaited-utility-patterns.svg)

### 제네릭 비동기 유틸리티 타입

```typescript
// 비동기 함수의 반환 타입을 간결하게 추출
type AsyncReturnType<F extends (...args: any[]) => Promise<any>> =
  Awaited<ReturnType<F>>;

type UserData = AsyncReturnType<typeof fetchUser>;
type ProductData = AsyncReturnType<typeof fetchProduct>;
```

### React Query와의 통합

```typescript
// queryFn의 반환 타입을 자동으로 data에 반영
function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUserProfile(userId),
  });
}

// data의 타입은 자동으로 UserProfile | undefined
const { data } = useUserProfile("123");
// data.plan — "free" | "pro" | undefined (완전 타입 추론)
```

### 재시도 래퍼

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  throw lastError;
}

// 원래 함수의 반환 타입을 보존
const user = await withRetry(() => fetchUser(id));
// user: User — Promise가 아닌 실제 타입
```

## Awaited vs infer R

직접 `infer`를 쓸 때와 비교해보면 `Awaited`가 훨씬 간결합니다.

```typescript
// infer를 직접 쓰는 경우 — 재귀가 없어서 깊은 Promise에서 실패
type ShallowUnwrap<T> = T extends Promise<infer R> ? R : T;
type X = ShallowUnwrap<Promise<Promise<number>>>; // Promise<number> — 한 겹만 벗김

// Awaited — 재귀적으로 완전히 언래핑
type Y = Awaited<Promise<Promise<number>>>; // number
```

## Thenable 처리

`Awaited`는 네이티브 `Promise`가 아닌 thenable 객체도 처리합니다.

```typescript
// 커스텀 thenable (예: RxJS Observable의 toPromise)
type MyThenable<T> = { then(resolve: (value: T) => void): void };

type A = Awaited<MyThenable<string>>; // string
type B = Awaited<MyThenable<MyThenable<number>>>; // number
```

이는 다양한 비동기 라이브러리와의 호환성을 위한 설계입니다.

---

**지난 글:** [ReturnType과 Parameters로 함수 타입 분해하기](/posts/ts-returntype-parameters/)

**다음 글:** [NonNullable 유틸리티 타입 완전 정복](/posts/ts-nonnullable-utility/)

<br>
읽어주셔서 감사합니다. 😊
