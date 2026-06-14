---
title: "인덱스 접근 타입 — T[K]로 타입 추출"
description: "TypeScript 인덱스 접근 타입(Indexed Access Types) T[K] 문법, 중첩 접근, 배열 요소 타입 추출, API 응답 타입 DRY 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 7
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "인덱스접근타입", "indexed access", "T[K]", "타입추출", "DRY"]
featured: false
draft: false
---

[지난 글](/posts/ts-keyof-typeof/)에서 keyof와 typeof를 살펴봤다. 이번에는 **인덱스 접근 타입(Indexed Access Types)**을 다룬다. 기존 타입에서 특정 프로퍼티의 타입을 추출하는 `T[K]` 문법이다.

## 기본 문법

```typescript
interface User {
  id:        number;
  name:      string;
  address: {
    city:    string;
    country: string;
  };
}

type UserId      = User["id"];       // number
type UserName    = User["name"];     // string
type UserAddress = User["address"];  // { city: string; country: string }
type UserCity    = User["address"]["city"]; // string — 중첩 접근
```

`T["key"]` 형태로 타입에서 특정 키의 타입을 추출한다. 타입 레벨의 프로퍼티 접근이다.

![인덱스 접근 타입 기본](/assets/posts/ts-indexed-access-types-basic.svg)

## keyof와 조합

```typescript
type UserValues = User[keyof User];
// number | string | { city: string; country: string }
// — User의 모든 값 타입 유니언
```

`T[keyof T]`는 타입의 모든 값 타입의 유니언을 만든다.

## 배열 요소 타입

배열 타입에 `number`를 인덱스로 사용하면 배열 요소의 타입을 추출할 수 있다.

```typescript
const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

type UserArrayElement = typeof users[number];
// { id: number; name: string }
```

`as const` 배열과 결합하면 리터럴 유니언을 만들 때도 사용한다.

```typescript
const COLORS = ["red", "green", "blue"] as const;
type Color = typeof COLORS[number]; // "red" | "green" | "blue"
```

## API 응답 타입 DRY 패턴

![인덱스 접근 타입 고급 패턴](/assets/posts/ts-indexed-access-types-advanced.svg)

중복 없이 타입을 파생시키는 핵심 패턴이다.

```typescript
interface ApiResponse {
  user:    { id: string; name: string; role: "admin" | "user" };
  posts:   { id: string; title: string; content: string }[];
  meta:    { total: number; page: number; pageSize: number };
}

// 중복 선언 없이 파생 타입 생성
type UserData  = ApiResponse["user"];
type PostItem  = ApiResponse["posts"][number];
type PaginationMeta = ApiResponse["meta"];
type UserRole  = ApiResponse["user"]["role"]; // "admin" | "user"
```

`ApiResponse`의 구조가 바뀌면 파생 타입도 자동으로 업데이트된다.

## 제네릭과 조합

```typescript
// 특정 키의 타입으로 타입을 제약
function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return items.map(item => item[key]);
}

const names = pluck(users, "name"); // string[] ✅
const ids   = pluck(users, "id");   // number[] ✅
const ages  = pluck(users, "age");  // TS2345 ❌
```

`T[K][]`는 "T의 K 키 타입의 배열"이다. `pluck`의 반환 타입이 키에 따라 정확하게 추론된다.

## 조건부 타입과 조합

```typescript
type NonNullableProperty<T, K extends keyof T> =
  NonNullable<T[K]>;

interface Config {
  host:    string | null;
  port:    number;
  timeout: number | undefined;
}

type Host    = NonNullableProperty<Config, "host">;    // string
type Port    = NonNullableProperty<Config, "port">;    // number
type Timeout = NonNullableProperty<Config, "timeout">; // number
```

인덱스 접근 타입은 고급 타입 조합의 필수 재료다.

---

**지난 글:** [keyof와 typeof — 타입에서 키를 추출하다](/posts/ts-keyof-typeof/)

**다음 글:** [구조적 타이핑 — TypeScript가 타입을 비교하는 방법](/posts/ts-structural-typing/)

<br>
읽어주셔서 감사합니다. 😊
