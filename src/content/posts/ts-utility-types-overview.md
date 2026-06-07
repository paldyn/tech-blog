---
title: "유틸리티 타입 총정리 — Partial에서 Awaited까지"
description: "TypeScript 내장 유틸리티 타입 전체를 용도별로 분류해 정리합니다. 객체 변환(Partial·Required·Readonly·Pick·Omit·Record), 유니언 조작(Extract·Exclude·NonNullable), 함수 분해(ReturnType·Parameters·Awaited), 추론 제어(NoInfer)까지 완전 정복."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "유틸리티타입", "Partial", "Omit", "Awaited", "ReturnType", "내장타입", "완전정복"]
featured: false
draft: false
---

[지난 글](/posts/ts-tuple-type-manipulation/)에서 튜플 타입 조작 패턴을 살펴봤다. 이번에는 TypeScript가 기본으로 제공하는 **내장 유틸리티 타입(Built-in Utility Types)**을 용도별로 종합 정리한다. 앞서 여러 글에서 개별적으로 다룬 내용들을 한데 모아 레퍼런스로 활용할 수 있도록 정리한다. 총 20여 개의 내장 유틸리티를 패턴별로 묶어 이해하면 어떤 상황에 무엇을 쓸지 빠르게 판단할 수 있다.

## 객체 속성 변환 그룹

모두 **매핑된 타입** 기반이다. 기존 타입의 속성을 변환해 새 타입을 만든다.

```typescript
// Partial<T>: 모든 속성을 optional로
type Draft = Partial<{ title: string; body: string; published: boolean }>;
// { title?: string; body?: string; published?: boolean }

// Required<T>: 모든 optional 제거
type Strict = Required<Draft>;
// { title: string; body: string; published: boolean }

// Readonly<T>: 모든 속성에 readonly 추가
type Immutable = Readonly<{ x: number; y: number }>;
// { readonly x: number; readonly y: number }
```

## 속성 선택/제외 — Pick과 Omit

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
}

// Pick: 지정한 키만 유지
type PublicUser = Pick<User, "id" | "name" | "email">;
// { id: number; name: string; email: string }

// Omit: 지정한 키 제외
type SafeUser = Omit<User, "password">;
// { id: number; name: string; email: string; role: ... }
```

`Omit<T, K>`는 내부적으로 `Pick<T, Exclude<keyof T, K>>`로 구현되어 있다.

## Record — 키-값 객체 타입

```typescript
// 기본: { [key: string]: number }
type Scores = Record<string, number>;

// 유니언 키로 exhaustive 맵 생성
type Status = "active" | "inactive" | "pending";
type StatusLabel = Record<Status, string>;
// { active: string; inactive: string; pending: string }
// — 세 키 모두 반드시 채워야 함

// 중첩
type Registry = Record<string, Record<string, unknown>>;
```

![유틸리티 타입 전체 지도](/assets/posts/ts-utility-types-overview-map.svg)

## 유니언 조작 — Extract, Exclude, NonNullable

**분배 조건부 타입** 기반이다.

```typescript
// Extract: 두 번째 인수와 겹치는 것만 남김 (교집합)
type A = Extract<"a" | "b" | "c", "a" | "c">;  // "a" | "c"
type B = Extract<string | number | object, object>; // object

// Exclude: 두 번째 인수에 해당하는 것 제거 (차집합)
type C = Exclude<"a" | "b" | "c", "b">;  // "a" | "c"
type D = Exclude<string | null | undefined, null | undefined>; // string

// NonNullable: null과 undefined 제거 (Exclude 특수 케이스)
type E = NonNullable<string | null | undefined>;  // string
```

## 함수 타입 분해 그룹

`infer` 기반이다.

```typescript
declare function createUser(name: string, age: number): Promise<User>;

// ReturnType: 반환 타입 추출
type CreateResult = ReturnType<typeof createUser>;  // Promise<User>

// Parameters: 매개변수 타입 추출 (튜플)
type CreateParams = Parameters<typeof createUser>;  // [string, number]

// 클래스 관련
class Connection { constructor(host: string, port: number) {} }

type ConnParams = ConstructorParameters<typeof Connection>;  // [string, number]
type ConnInstance = InstanceType<typeof Connection>;         // Connection
```

## 비동기 타입 — Awaited

TypeScript 4.5에서 도입됐다. `Promise`를 재귀적으로 해제한다.

```typescript
type A1 = Awaited<Promise<string>>;                  // string
type A2 = Awaited<Promise<Promise<number>>>;         // number
type A3 = Awaited<string | Promise<number>>;         // string | number (분배)

// 실전: async 함수 반환 타입 추출
async function fetchUser(): Promise<User> { /* ... */ return user; }
type FetchedUser = Awaited<ReturnType<typeof fetchUser>>;  // User
```

## this 관련 — ThisType과 OmitThisParameter

```typescript
// ThisType: 객체 리터럴 내에서 this 타입 지정
type UserMethods = {
  greet(): string;
} & ThisType<{ name: string }>;

// OmitThisParameter: 함수의 this 파라미터 제거
function format(this: Date, fmt: string): string { return ""; }
type FormatFn = OmitThisParameter<typeof format>;  // (fmt: string) => string
```

## 문자열 조작 — 인트린직 타입

```typescript
type U = Uppercase<"hello">;     // "HELLO"
type L = Lowercase<"WORLD">;     // "world"
type C = Capitalize<"foo bar">;  // "Foo bar"
type N = Uncapitalize<"FooBar">; // "fooBar"
```

## 추론 제어 — NoInfer (TS 5.4)

```typescript
function setDefault<T>(items: T[], fallback: NoInfer<T>): T {
  return items[0] ?? fallback;
}

setDefault([1, 2, 3], "x");  // ✗ 오류: T=number, "x"는 number 아님
setDefault([1, 2, 3], 0);    // ✓
```

## 선택 가이드

![자주 쓰는 유틸리티 타입 치트시트](/assets/posts/ts-utility-types-overview-cheatsheet.svg)

| 상황 | 유틸리티 |
|------|---------|
| 폼 상태 (모두 optional) | `Partial<T>` |
| API 요청 검증 (모두 required) | `Required<T>` |
| 불변 상태 | `Readonly<T>` |
| DTO 일부만 노출 | `Pick<T, K>` 또는 `Omit<T, K>` |
| 열거형 → 객체 맵 | `Record<K, V>` |
| 유니언에서 특정 타입만 | `Extract<T, U>` |
| null/undefined 제거 | `NonNullable<T>` |
| async 함수 반환 타입 | `Awaited<ReturnType<F>>` |
| 함수 매개변수 재사용 | `Parameters<F>` |

## 핵심 정리

TypeScript 내장 유틸리티 타입은 크게 세 메커니즘 위에 구축된다. 매핑된 타입 기반(속성 변환), 분배 조건부 타입 기반(유니언 조작), `infer` 기반(구조 분해)이다. 각 유틸리티의 내부 구현을 이해하면 상황에 맞게 조합하거나 커스텀 유틸리티를 만들 수 있다. 다음 글들에서는 각 그룹의 유틸리티를 더 깊이 살펴본다.

---

**지난 글:** [튜플 타입 조작 — 분해·재조합·변환 패턴](/posts/ts-tuple-type-manipulation/)

<br>
읽어주셔서 감사합니다. 😊
