---
title: "Extract와 Exclude로 유니언 조각내기"
description: "TypeScript의 Extract<T, U>와 Exclude<T, U>가 분배 조건부 타입으로 유니언을 필터링하는 원리를 설명합니다. NonNullable 구현, 판별 유니언 서브셋 추출, 키 집합 연산 등 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 4
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "유틸리티 타입", "Extract", "Exclude", "분배 조건부 타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-record-type/)에서 키-값 구조를 선언하는 `Record`를 살펴봤습니다. 이번에는 **유니언 타입을 필터링**하는 `Extract<T, U>`와 `Exclude<T, U>`를 다룹니다. 집합론의 교집합과 차집합에 대응하는 이 두 타입은 조건부 타입의 분배 법칙을 이용해 동작합니다.

![Extract vs Exclude: 유니언 필터링](/assets/posts/ts-extract-exclude-overview.svg)

## 내부 구현: 분배 조건부 타입

```typescript
// T의 각 멤버 중 U에 할당 가능한 것만 남긴다
type Extract<T, U> = T extends U ? T : never;

// T의 각 멤버 중 U에 할당 가능한 것을 제거한다
type Exclude<T, U> = T extends U ? never : T;
```

핵심은 **분배 조건부 타입(distributive conditional types)** 입니다. `T`가 유니언일 때 `T extends U`는 유니언의 각 멤버에 대해 개별적으로 평가됩니다.

```typescript
// 실제 동작 과정
Extract<"a" | "b" | "c", "a" | "c">
// → ("a" extends "a" | "c" ? "a" : never)
//   | ("b" extends "a" | "c" ? "b" : never)
//   | ("c" extends "a" | "c" ? "c" : never)
// → "a" | never | "c"
// → "a" | "c"
```

분배는 **나체 타입 파라미터(bare type parameter)** 일 때만 발생합니다. `[T] extends [U]`처럼 튜플로 감싸면 분배가 억제됩니다.

## Extract\<T, U\>: 교집합 추출

```typescript
type A = "circle" | "rect" | "triangle";
type B = "circle" | "triangle" | "line";

type Common = Extract<A, B>; // "circle" | "triangle"
```

### 판별 유니언 서브셋 추출

판별 유니언에서 특정 형태를 가진 멤버만 뽑을 때 매우 강력합니다.

```typescript
type Event =
  | { type: "click"; x: number; y: number }
  | { type: "keydown"; key: string }
  | { type: "focus" }
  | { type: "blur" };

// "click" 이벤트만 추출
type ClickEvent = Extract<Event, { type: "click" }>;
// → { type: "click"; x: number; y: number }

// 좌표를 가진 이벤트만 추출
type PositionedEvent = Extract<Event, { x: number }>;
// → { type: "click"; x: number; y: number }
```

이는 narrowing을 타입 레벨로 끌어올린 것입니다. 런타임 `if (e.type === "click")` 검사와 같은 결과를 컴파일 타임에 얻습니다.

## Exclude\<T, U\>: 차집합 제거

```typescript
type Primitive = string | number | boolean | null | undefined;
type Falsy = false | 0 | "" | null | undefined;

type TruthyPrimitive = Exclude<Primitive, Falsy>;
// → string | number | true  (엄밀히는 string | number | boolean의 일부)
// 실제로는 → string | number | boolean (false만 빼도 boolean 전체를 빼지 않음 — 주의)
```

### NonNullable 구현

`NonNullable<T>`는 내부적으로 `Exclude`를 사용합니다.

```typescript
// 표준 라이브러리 구현
type NonNullable<T> = T & {};
// 또는 이전 버전:
type NonNullable<T> = Exclude<T, null | undefined>;

// 직접 활용
type SafeValue<T> = Exclude<T, null | undefined>;
```

## 실전 패턴

![Extract · Exclude 실전 패턴](/assets/posts/ts-extract-exclude-patterns.svg)

### 이벤트 핸들러 타입 분기

```typescript
type DOMEvent =
  | MouseEvent
  | KeyboardEvent
  | FocusEvent
  | TouchEvent;

// 마우스/터치처럼 좌표를 가진 이벤트
type PointerEvent = Extract<DOMEvent, { clientX: number }>;

// 키보드 이벤트 제외
type NonKeyboardEvent = Exclude<DOMEvent, KeyboardEvent>;
```

### 함수 프로퍼티 키만 추출

```typescript
// 객체에서 함수인 프로퍼티의 키만 추출
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown ? K : never;
}[keyof T];

interface Service {
  id: number;
  name: string;
  fetch(): Promise<void>;
  save(): Promise<void>;
  delete(): Promise<void>;
}

type ServiceMethods = FunctionKeys<Service>;
// → "fetch" | "save" | "delete"

type ServiceData = Omit<Service, ServiceMethods>;
// → { id: number; name: string }
```

### 권한 레벨 분리

```typescript
type Permission =
  | "read:own"
  | "read:all"
  | "write:own"
  | "write:all"
  | "admin";

type ReadPermissions = Extract<Permission, `read:${string}`>;
// → "read:own" | "read:all"

type WritePermissions = Extract<Permission, `write:${string}`>;
// → "write:own" | "write:all"

type UserPermissions = Exclude<Permission, "admin">;
// → "read:own" | "read:all" | "write:own" | "write:all"
```

템플릿 리터럴 타입과 조합하면 패턴 매칭처럼 유니언을 분류할 수 있습니다.

## Extract vs Pick, Exclude vs Omit

이 네 가지는 자주 혼동됩니다.

| 대상 | 선택 | 제거 |
|---|---|---|
| **유니언 멤버** | `Extract<T, U>` | `Exclude<T, U>` |
| **객체 키** | `Pick<T, K>` | `Omit<T, K>` |

`Extract`와 `Exclude`는 유니언의 **멤버 자체**를 다루고, `Pick`과 `Omit`은 객체 타입의 **프로퍼티 키**를 다룹니다. `Omit`은 내부적으로 `Exclude`를 이용해 구현됩니다.

```typescript
// Omit 내부
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
//                                               ^^^^^^^^^^^^^^
//                                               키 유니언에서 K 제거
```

## never와의 상호작용

`Extract`나 `Exclude`의 결과가 `never`가 되는 경우를 주의해야 합니다.

```typescript
type A = Extract<string, number>; // never (교집합 없음)
type B = Exclude<"a" | "b", "a" | "b">; // never (전부 제거)

// never는 조건부 타입에서 "존재하지 않음"을 의미
// 반환 타입에 never가 포함되면 해당 경우를 타입 시스템이 불가능한 경로로 인식
```

---

**지난 글:** [Record 타입 완전 정복](/posts/ts-record-type/)

**다음 글:** [ReturnType과 Parameters로 함수 타입 분해하기](/posts/ts-returntype-parameters/)

<br>
읽어주셔서 감사합니다. 😊
