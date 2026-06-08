---
title: "NonNullable 유틸리티 타입 완전 정복"
description: "TypeScript의 NonNullable<T>가 null과 undefined를 타입에서 제거하는 원리를 설명합니다. strictNullChecks와의 관계, filter(Boolean) 타입 강화 패턴, 제네릭 제약 조건, 재귀 DeepNonNullable 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "유틸리티 타입", "NonNullable", "strictNullChecks", "타입 안전성"]
featured: false
draft: false
---

[지난 글](/posts/ts-awaited-utility/)에서 Promise를 재귀적으로 언래핑하는 `Awaited`를 살펴봤습니다. 이번에는 가장 흔한 타입 에러 원인인 `null`과 `undefined`를 타입 레벨에서 제거하는 `NonNullable<T>`를 다룹니다.

![NonNullable null/undefined 제거](/assets/posts/ts-nonnullable-utility-overview.svg)

## 내부 구현

```typescript
// TypeScript 4.8+ 구현
type NonNullable<T> = T & {};

// 이전 구현 (4.8 이전)
type NonNullable<T> = T extends null | undefined ? never : T;
```

`T & {}`는 `null`이나 `undefined`와의 인터섹션이 `never`가 되는 성질을 이용합니다. `null & {} = never`, `undefined & {} = never`이므로 자동으로 제거됩니다. `string & {} = string`처럼 일반 타입은 그대로 유지됩니다.

```typescript
type A = NonNullable<string | null | undefined>; // string
type B = NonNullable<number | null>;              // number
type C = NonNullable<null>;                       // never
type D = NonNullable<string>;                     // string (변화 없음)
```

## strictNullChecks와의 관계

`NonNullable`은 `strictNullChecks: true`가 있어야 의미가 있습니다.

```typescript
// strictNullChecks: false일 때
// null과 undefined는 모든 타입의 서브타입 → NonNullable이 아무 효과 없음
let x: string = null; // 에러 없음

// strictNullChecks: true일 때 (권장)
let x: string = null; // Error: null은 string에 할당 불가
type Safe = NonNullable<string | null>; // string — 제대로 동작
```

`tsconfig.json`에서 `"strict": true` 또는 `"strictNullChecks": true`를 설정해야 합니다.

## 주요 사용 패턴

### filter(Boolean) 타입 강화

JavaScript에서 `array.filter(Boolean)`은 런타임에 falsy 값을 제거하지만, TypeScript는 이 패턴을 자동으로 이해하지 못합니다.

```typescript
const items = [1, null, 2, undefined, 3]; // (number | null | undefined)[]

// filter(Boolean)은 TypeScript 기본적으로 타입을 좁히지 못함
const filtered = items.filter(Boolean); // (number | null | undefined)[]

// 해결책: 타입 가드 함수
function isNotNull<T>(value: T): value is NonNullable<T> {
  return value != null;
}

const safe = items.filter(isNotNull); // number[]
```

TypeScript 5.5부터는 일부 경우에 `filter(Boolean)` 패턴을 자동으로 이해하지만, 명시적인 타입 가드가 더 안정적입니다.

### 제네릭 제약 조건

```typescript
// T가 null/undefined가 아님을 보장
function assertDefined<T>(value: T, message: string): asserts value is NonNullable<T> {
  if (value == null) throw new Error(message);
}

function requireValue<T extends NonNullable<unknown>>(value: T): T {
  return value;
}

// 제네릭 타입에서 null 제거
type Defined<T> = {
  [K in keyof T as T[K] extends null | undefined ? never : K]: T[K];
};
```

### DOM 요소 안전 조회

```typescript
function getElement<T extends Element>(selector: string): NonNullable<T | null> {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

// 반환 타입이 T (null 아님)
const button = getElement<HTMLButtonElement>("#submit");
button.click(); // 안전
```

## 실전 패턴

![NonNullable 실전 패턴](/assets/posts/ts-nonnullable-utility-patterns.svg)

### 배열 압축

```typescript
// compact: falsy 값 제거 (null, undefined, 0, "", false 포함)
// null/undefined만 제거하는 버전
function compact<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter(isNotNull);
}

function isNotNull<T>(value: T | null | undefined): value is NonNullable<T> {
  return value != null;
}

const ids = [1, null, 2, undefined, 3];
const cleanIds = compact(ids); // number[]
cleanIds.forEach(id => console.log(id.toFixed())); // 안전
```

### 안전한 Map 조회

```typescript
class TypedMap<K, V> {
  private map = new Map<K, V>();

  set(key: K, value: NonNullable<V>): this {
    this.map.set(key, value);
    return this;
  }

  getOrThrow(key: K): NonNullable<V> {
    const value = this.map.get(key);
    if (value == null) throw new Error(`Key not found: ${String(key)}`);
    return value as NonNullable<V>;
  }
}
```

### DeepNonNullable 커스텀 유틸리티

`NonNullable`은 최상위 타입만 처리합니다. 중첩 객체까지 처리하려면 재귀 타입이 필요합니다.

```typescript
type DeepNonNullable<T> = T extends object
  ? { [K in keyof T]: DeepNonNullable<T[K]> }
  : NonNullable<T>;

interface UserMaybeNull {
  name: string | null;
  address: {
    city: string | null;
    zip: string | undefined;
  } | null;
}

type UserClean = DeepNonNullable<UserMaybeNull>;
// → { name: string; address: { city: string; zip: string } }
```

## NonNullable과 narrowing의 관계

`NonNullable`은 타입 레벨 연산이고, 런타임에서 실제로 null을 제거하려면 narrowing이 필요합니다.

```typescript
function processUser(user: User | null | undefined): void {
  // 런타임 narrowing
  if (user == null) return;

  // 이 지점에서 user의 타입은 User — NonNullable<User | null | undefined>와 동일
  console.log(user.name);
}
```

타입 단언(`user!`)보다 명시적 narrowing이 더 안전합니다. `NonNullable`은 타입 정의 레벨에서 null 불가를 표현할 때, narrowing은 런타임에서 null을 걸러낼 때 사용합니다.

---

**지난 글:** [Awaited 유틸리티 타입 완전 정복](/posts/ts-awaited-utility/)

**다음 글:** [InstanceType과 ConstructorParameters 완전 정복](/posts/ts-instancetype-constructorparameters/)

<br>
읽어주셔서 감사합니다. 😊
