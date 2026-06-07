---
title: "매핑된 타입 수정자 — +/-와 as 키 재매핑"
description: "TypeScript 매핑된 타입의 +/- 수정자로 readonly·optional을 추가/제거하는 방법, as 절로 키 이름 변환·필터링하는 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "매핑타입", "수정자", "as절", "키재매핑", "Readonly", "Required", "고급타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-variance/)에서 TypeScript 타입 시스템의 분산성을 살펴봤다. 이번에는 매핑된 타입을 더 깊이 다룬다. 기본 매핑된 타입은 `[K in keyof T]: T[K]` 형태로 속성을 그대로 복사하지만, **수정자(modifier)**와 **`as` 절**을 추가하면 `readonly`·`optional`을 자유롭게 조작하고 키 이름까지 변환할 수 있다.

## 수정자 문법: +와 -

매핑된 타입에서 `readonly`와 `?`(optional) 앞에 `+` 또는 `-`를 붙여 해당 수정자를 추가하거나 제거한다.

```typescript
// +는 추가 (기본값이므로 보통 생략)
type Partial2<T> = { [K in keyof T]+?: T[K] };   // === Partial<T>
type Readonly2<T> = { +readonly [K in keyof T]: T[K] }; // === Readonly<T>

// -는 제거
type Required2<T> = { [K in keyof T]-?: T[K] };  // === Required<T>
type Mutable<T> = { -readonly [K in keyof T]: T[K] };   // TypeScript 내장 없음
```

`+` 없이 그냥 `?` 또는 `readonly`를 쓰면 `+`와 동일하게 동작한다. 제거할 때만 `-`를 명시하면 된다.

![수정자 +/- 문법](/assets/posts/ts-mapped-type-modifiers-syntax.svg)

## Mutable 타입 — 자주 필요하지만 내장 없음

`Readonly<T>`의 역변환인 `Mutable<T>`는 TypeScript 내장에 없다. 직접 만들어 써야 한다.

```typescript
type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

// 중첩 Mutable (DeepMutable)
type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends object ? DeepMutable<T[K]> : T[K];
};

interface Frozen {
  readonly id: number;
  readonly name: string;
  readonly address: { readonly street: string };
}

type Editable = Mutable<Frozen>;
// { id: number; name: string; address: { readonly street: string } }
// 주의: 1레벨만 제거 — 중첩은 DeepMutable 사용

type FullyEditable = DeepMutable<Frozen>;
// { id: number; name: string; address: { street: string } }
```

## 두 수정자 동시 적용

`-readonly`와 `-?`를 한 매핑에서 동시에 사용할 수 있다.

```typescript
// readonly 제거 + optional 제거를 한 번에
type MutableRequired<T> = {
  -readonly [K in keyof T]-?: T[K];
};

type Config = {
  readonly host?: string;
  readonly port?: number;
};

type StrictConfig = MutableRequired<Config>;
// { host: string; port: number } — 수정 가능, 필수
```

## as 절 — 키 재매핑 (TypeScript 4.1+)

`as` 절은 매핑 도중 키 이름을 변환하거나, `never`를 반환해 특정 키를 제거한다.

```typescript
// 기본 문법
type Remapped<T> = {
  [K in keyof T as NewKeyType]: T[K];
};
```

### 패턴 1: getter 메서드명 생성

```typescript
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type User = { name: string; age: number; active: boolean };
type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number; getActive: () => boolean }
```

`string & K`는 `K`가 `symbol`일 수 있어서 `string`으로 좁히는 교차 타입이다.

### 패턴 2: 조건부 필터링

```typescript
// 함수 타입 속성만 남기기
type MethodsOnly<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? K : never]: T[K];
};

class Service {
  name = "svc";
  version = 1;
  start(): void {}
  stop(): void {}
}

type ServiceMethods = MethodsOnly<Service>;
// { start: () => void; stop: () => void }
```

![as 절 키 재매핑](/assets/posts/ts-mapped-type-modifiers-keyremap.svg)

### 패턴 3: 유니언을 키로 매핑

`keyof T` 뿐만 아니라 임의의 유니언을 순회할 수 있다.

```typescript
type EventHandlers<Events extends string> = {
  [E in Events as `on${Capitalize<E>}`]: (payload: unknown) => void;
};

type AppEvents = EventHandlers<"click" | "load" | "error">;
// { onClick: ...; onLoad: ...; onError: ... }
```

## 수정자와 as 절 조합

```typescript
// readonly 제거 + setter 메서드명으로 변환
type Setters<T> = {
  -readonly [K in keyof T as `set${Capitalize<string & K>}`]-?:
    (value: T[K]) => void;
};

type Point = { readonly x: number; readonly y?: number };
type PointSetters = Setters<Point>;
// { setX: (value: number) => void; setY: (value: number) => void }
```

## 내장 유틸리티 타입 구현 원리

`Partial`, `Required`, `Readonly`는 모두 수정자 매핑으로 구현되어 있다.

```typescript
// lib.d.ts 내부 (단순화)
type Partial<T>  = { [K in keyof T]?:  T[K] };  // +?
type Required<T> = { [K in keyof T]-?: T[K] };  // -?
type Readonly<T> = { readonly [K in keyof T]: T[K] };  // +readonly
```

`Pick<T, K>`와 `Omit<T, K>`도 매핑된 타입이지만 수정자 없이 필터링만 한다.

## 핵심 정리

매핑된 타입 수정자 `-readonly`와 `-?`로 TypeScript의 내장 유틸리티가 없는 `Mutable`이나 `MutableRequired` 같은 타입을 직접 만들 수 있다. `as` 절을 쓰면 키 이름 변환, `never` 필터링, 유니언 순회까지 가능해진다. 수정자와 `as` 절은 함께 쓸 수 있어 복잡한 타입 변환도 한 매핑으로 처리된다.

---

**지난 글:** [분산성 — 공변·반변·불변과 in/out 어노테이션](/posts/ts-variance/)

**다음 글:** [인트린직 문자열 타입 — Uppercase·Lowercase·Capitalize·Uncapitalize](/posts/ts-intrinsic-string-types/)

<br>
읽어주셔서 감사합니다. 😊
