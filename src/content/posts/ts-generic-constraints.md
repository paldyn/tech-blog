---
title: "제네릭 제약 — extends와 keyof"
description: "TypeScript 제네릭의 extends 제약, keyof 연산자, 인덱스 접근 타입 T[K], 생성자 제약, 재귀 제약을 예제 중심으로 완전히 정리합니다. 과도한 제약이 오히려 유연성을 해치는 경우도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 9
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "제네릭제약", "extends", "keyof", "인덱스타입", "타입안전성"]
featured: false
draft: false
---

[지난 글](/posts/ts-generics-basics/)에서 제네릭의 기본 개념과 타입 매개변수 추론을 살펴봤다. 이번에는 **제네릭 제약(Generic Constraints)**을 다룬다. 제약은 타입 매개변수 `T`가 가질 수 있는 타입의 범위를 한정하여, `T`에서 특정 속성이나 메서드를 안전하게 사용할 수 있게 한다.

## extends 제약 — 기본

`extends` 키워드로 `T`가 반드시 특정 구조를 가지도록 강제한다.

![extends 제약 — T의 범위를 한정한다](/assets/posts/ts-generic-constraints-extends.svg)

```typescript
// T는 name: string을 가져야 한다
function greet<T extends { name: string }>(entity: T): string {
  return `Hello, ${entity.name}`;
}

greet({ name: "Alice", age: 30 }); // ✅ 추가 속성 허용
greet({ name: "Bob" });            // ✅
greet({ age: 25 });                // TS2345 ❌ name 없음
greet("Alice");                    // TS2345 ❌ string에 name 없음
```

`extends`에 지정한 타입은 최소 조건이다. `T`가 그 구조를 충족하는 한 추가 속성이 있어도 된다.

## keyof — 객체 키를 타입으로

`keyof T`는 타입 `T`의 모든 키를 유니언으로 반환한다.

```typescript
interface Config {
  host:    string;
  port:    number;
  secure:  boolean;
}

type ConfigKey = keyof Config;
// "host" | "port" | "secure"

// keyof typeof — 값 객체의 키 추출
const STATUS = { active: 1, inactive: 0, pending: 2 } as const;
type StatusKey = keyof typeof STATUS;
// "active" | "inactive" | "pending"
```

`keyof`는 제네릭과 결합했을 때 특히 강력해진다.

## T[K] — 인덱스 접근 타입

`T[K]`는 타입 `T`에서 키 `K`에 해당하는 값의 타입을 추출한다.

```typescript
type Age = Config["port"];    // number
type AllValues = Config[keyof Config]; // string | number | boolean

// 배열 요소 타입 추출
type Element = string[][number]; // string
```

`K extends keyof T`와 `T[K]`를 조합하면 런타임에서나 가능했던 동적 접근을 타입 안전하게 만들 수 있다.

## 실전 패턴

![제약 패턴 — 실전 활용](/assets/posts/ts-generic-constraints-patterns.svg)

```typescript
// 특정 타입의 키만 허용하는 pluck
function pluck<T, K extends keyof T>(arr: T[], key: K): T[K][] {
  return arr.map(item => item[key]);
}

const users = [
  { id: 1, name: "Alice", role: "admin" },
  { id: 2, name: "Bob",   role: "user"  },
];

const names = pluck(users, "name"); // string[]
const ids   = pluck(users, "id");   // number[]
pluck(users, "email");              // TS2345 ❌ 존재하지 않는 키
```

## 조건부 extends — 타입 수준의 분기

`extends`는 조건부 타입에서도 사용된다. 두 문맥을 구분하는 것이 중요하다.

```typescript
// 제약의 extends — T는 반드시 U를 충족
function fn<T extends string>(val: T) { ... }

// 조건부 타입의 extends — T가 U를 충족하면 A, 아니면 B
type IsString<T> = T extends string ? "yes" : "no";
type R1 = IsString<string>;  // "yes"
type R2 = IsString<number>;  // "no"
```

## 제약의 함정 — 과도한 제약

제약이 항상 좋은 것은 아니다. 지나치게 구체적인 제약은 함수의 유연성을 떨어뜨린다.

```typescript
// 과도한 제약 — 배열 타입 전체를 요구
function firstElement<T extends any[]>(arr: T): T[0] {
  return arr[0];
}

// 더 나은 버전 — 요소 타입만 매개변수화
function firstElement<T>(arr: T[]): T | undefined {
  return arr[0];
}
```

제약은 "이 함수 내에서 T의 어떤 기능을 사용해야 하는가"라는 질문에서 출발해야 한다. 함수 본문에서 사용하지 않는 속성을 제약에 포함하면 불필요하게 호출 범위가 좁아진다.

## 복합 제약 패턴

```typescript
// 여러 인터페이스 동시 충족
function persist<T extends Identifiable & Timestamped>(
  entity: T
): Promise<T> {
  // ...
}

interface Identifiable { id: number }
interface Timestamped  { createdAt: Date; updatedAt: Date }

// 클래스 제약 — 특정 클래스의 하위 클래스만 허용
function process<T extends Error>(err: T): string {
  return `[${err.name}] ${err.message}`;
}

process(new TypeError("bad type")); // ✅
process(new Error("generic"));      // ✅
process("not an error");            // TS2345 ❌
```

인터섹션 `&`으로 여러 제약을 동시에 적용할 수 있다.

---

**지난 글:** [제네릭 기초 — 재사용 가능한 타입 추상화](/posts/ts-generics-basics/)

**다음 글:** [조건부 타입 — 타입 수준의 분기 처리](/posts/ts-conditional-types/)

<br>
읽어주셔서 감사합니다. 😊
