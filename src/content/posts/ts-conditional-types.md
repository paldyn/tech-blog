---
title: "조건부 타입 — 타입 수준의 분기 처리"
description: "TypeScript 조건부 타입(T extends U ? A : B), infer 키워드, 분배 조건부 타입, NonNullable·Extract·Exclude 내장 유틸리티 구현 원리를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "조건부타입", "infer", "분배", "유틸리티타입", "고급타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-generic-constraints/)에서 `extends` 제약과 `keyof` 활용을 살펴봤다. 이번에는 TypeScript 타입 시스템의 가장 강력한 기능 중 하나인 **조건부 타입(Conditional Types)**을 다룬다. 조건부 타입은 마치 타입 수준의 `if/else`처럼 동작하며, 이를 통해 TypeScript 표준 라이브러리의 핵심 유틸리티 타입들이 구현되어 있다.

## 기본 문법

```typescript
// T extends U ? A : B
// "T가 U를 충족하면 A, 아니면 B"
type IsString<T> = T extends string ? "yes" : "no";

type A = IsString<string>;    // "yes"
type B = IsString<number>;    // "no"
type C = IsString<"hello">;   // "yes" (리터럴도 string을 extends)
```

삼항 연산자처럼 중첩할 수 있다.

```typescript
type Flatten<T> =
  T extends Array<infer Item> ? Item :
  T extends object            ? keyof T :
  T;

type F1 = Flatten<string[]>;   // string
type F2 = Flatten<{ a: 1 }>;   // "a"
type F3 = Flatten<number>;     // number
```

![조건부 타입 — T extends U ? A : B](/assets/posts/ts-conditional-types-flow.svg)

## infer — 조건부 타입 내에서 타입 추출

`infer` 키워드는 조건부 타입의 `extends` 절 안에서만 사용할 수 있으며, 매칭된 타입을 변수로 캡처한다.

```typescript
// 함수 반환 타입 추출
type ReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never;

// 함수 매개변수 타입 추출
type Parameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;

// Promise 내부 타입 추출
type Awaited<T> =
  T extends Promise<infer U>
    ? Awaited<U>  // 재귀: Promise<Promise<string>> → string
    : T;

// 실전 사용
async function fetchUser() {
  return { id: 1, name: "Alice" };
}

type UserType = Awaited<ReturnType<typeof fetchUser>>;
// { id: number; name: string }
```

## 분배 조건부 타입

제네릭 조건부 타입에 유니언을 전달하면 각 멤버에 **분배(distribute)**된다. 이 동작이 기본이며, 다음의 내장 유틸리티 타입들은 이 원리로 구현되어 있다.

![분배 조건부 타입 (Distributive)](/assets/posts/ts-conditional-types-distributive.svg)

```typescript
// Exclude<T, U> — U에 해당하는 타입 제거
type Exclude<T, U> = T extends U ? never : T;

type WithoutString = Exclude<string | number | boolean, string>;
// number | boolean

// Extract<T, U> — U에 해당하는 타입만 추출
type Extract<T, U> = T extends U ? T : never;

type OnlyString = Extract<string | number | boolean, string>;
// string

// NonNullable<T> — null, undefined 제거
type NonNullable<T> = T extends null | undefined ? never : T;

type Defined = NonNullable<string | null | undefined>;
// string
```

분배가 일어나는 조건: 타입 매개변수가 **그대로** `extends` 왼쪽에 있을 때만 분배된다. 튜플로 감싸면 분배를 막을 수 있다.

```typescript
type NoDistribute<T> = [T] extends [string] ? "yes" : "no";

type D1 = NoDistribute<string | number>; // "no" (분배 없음)
type D2 = IsString<string | number>;      // "yes" | "no" (분배됨)
```

## 내장 유틸리티 타입 구현 원리

```typescript
// ReturnType
type ReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : any;

// InstanceType — 생성자에서 인스턴스 타입 추출
type InstanceType<T extends abstract new (...args: any) => any> =
  T extends abstract new (...args: any) => infer R ? R : any;

class Dog { bark() { return "woof"; } }
type DogInstance = InstanceType<typeof Dog>; // Dog

// Parameters
type Parameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;

function greet(name: string, age: number): string {
  return `${name} (${age})`;
}
type GreetParams = Parameters<typeof greet>; // [string, number]
```

## 재귀 조건부 타입

TypeScript 4.1부터 재귀 조건부 타입을 지원한다.

```typescript
// 중첩 배열 평탄화
type DeepFlatten<T> =
  T extends (infer Item)[] ? DeepFlatten<Item> : T;

type DF = DeepFlatten<number[][][]>; // number

// 객체를 점(.) 표기법 키로 변환
type Paths<T, Key extends keyof T = keyof T> =
  Key extends string
    ? T[Key] extends object
      ? `${Key}.${Paths<T[Key]>}` | Key
      : Key
    : never;

type Config = { server: { host: string; port: number }; debug: boolean };
type ConfigPaths = Paths<Config>;
// "server" | "debug" | "server.host" | "server.port"
```

## 실전 패턴 — API 함수 타입 추론

```typescript
// HTTP 메서드별 응답 타입 추론
type ApiResponse<T extends string> =
  T extends "GET"    ? { data: unknown; status: number } :
  T extends "POST"   ? { created: true; id: number }     :
  T extends "DELETE" ? { deleted: true }                 :
  never;

function request<M extends "GET" | "POST" | "DELETE">(
  method: M,
  url: string
): Promise<ApiResponse<M>> {
  return fetch(url, { method }) as any;
}

const getRes  = await request("GET",    "/api/users");
// { data: unknown; status: number }

const postRes = await request("POST",   "/api/users");
// { created: true; id: number }
```

조건부 타입의 강력함은 여기서 드러난다. 함수를 하나만 정의했는데 메서드에 따라 반환 타입이 자동으로 달라진다.

---

**지난 글:** [제네릭 제약 — extends와 keyof](/posts/ts-generic-constraints/)

<br>
읽어주셔서 감사합니다. 😊
