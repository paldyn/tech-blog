---
title: "튜플 타입 조작 — 분해·재조합·변환 패턴"
description: "TypeScript 튜플 타입 조작의 핵심 패턴 — Head/Tail, Reverse, Zip, Map, Filter, 커링 타입, 함수 파라미터↔튜플 변환을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "튜플타입", "Variadic", "Zip", "Reverse", "커링타입", "고급타입", "타입체조"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-level-arithmetic/)에서 튜플 길이로 산술 연산을 구현했다. 이번에는 튜플 타입 자체를 조작하는 패턴을 종합적으로 살펴본다. TypeScript 4.0에서 도입된 **variadic 튜플 타입(`...T`)**과 `infer`를 결합하면, 런타임 배열을 다루듯 타입 레벨에서 Head, Tail, Reverse, Zip, Filter 같은 연산을 구현할 수 있다.

## variadic 튜플 기본 문법

```typescript
type Concat<T extends unknown[], U extends unknown[]> = [...T, ...U];
type Prepend<T, U extends unknown[]> = [T, ...U];
type Append<T extends unknown[], U> = [...T, U];

type C = Concat<[1, 2], [3, 4]>;   // [1, 2, 3, 4]
type P = Prepend<0, [1, 2, 3]>;    // [0, 1, 2, 3]
type A = Append<[1, 2], 3>;        // [1, 2, 3]
```

`...T`로 튜플을 스프레드하면 정확한 타입 정보가 유지된다.

![튜플 타입 분해 & 재조합](/assets/posts/ts-tuple-type-manipulation-ops.svg)

## Head와 Tail

```typescript
// 비어있지 않은 튜플의 첫 요소
type Head<T extends [unknown, ...unknown[]]> = T[0];

// 첫 요소를 제외한 나머지
type Tail<T extends unknown[]> =
  T extends [unknown, ...infer R] ? R : [];

type H = Head<[1, 2, 3]>;  // 1
type TL = Tail<[1, 2, 3]>; // [2, 3]
type TL2 = Tail<[1]>;      // []
```

## Last와 Init

```typescript
// 마지막 요소
type Last<T extends unknown[]> =
  T extends [...unknown[], infer L] ? L : never;

// 마지막을 제외한 나머지
type Init<T extends unknown[]> =
  T extends [...infer I, unknown] ? I : never;

type L = Last<[1, 2, 3]>;  // 3
type I = Init<[1, 2, 3]>;  // [1, 2]
```

## Reverse

어큐뮬레이터 패턴으로 뒤집는다.

```typescript
type Reverse<T extends unknown[], Acc extends unknown[] = []> =
  T extends [infer H, ...infer R]
    ? Reverse<R, [H, ...Acc]>
    : Acc;

type Rev = Reverse<[1, 2, 3, 4]>;  // [4, 3, 2, 1]
```

## Zip

```typescript
type Zip<A extends unknown[], B extends unknown[]> =
  A extends [infer Ha, ...infer Ra]
    ? B extends [infer Hb, ...infer Rb]
      ? [[Ha, Hb], ...Zip<Ra, Rb>]
      : []
    : [];

type Z = Zip<[1, 2, 3], [string, boolean, null]>;
// [[1, string], [2, boolean], [3, null]]
```

![튜플 고급 패턴 — Zip·Map·Filter](/assets/posts/ts-tuple-type-manipulation-advanced.svg)

## 튜플 → 유니언

```typescript
type TupleToUnion<T extends unknown[]> = T[number];

type U = TupleToUnion<[1, 2, 3]>;  // 1 | 2 | 3
type U2 = TupleToUnion<[string, number, boolean]>; // string | number | boolean
```

`T[number]`는 `T`의 모든 숫자 인덱스에 대한 타입 유니언이다.

## Filter

```typescript
type Filter<T extends unknown[], U, Acc extends unknown[] = []> =
  T extends [infer H, ...infer R]
    ? Filter<R, U, H extends U ? [...Acc, H] : Acc>
    : Acc;

type OnlyStrings = Filter<[1, "a", 2, "b", true], string>;
// ["a", "b"]
```

## 함수 파라미터와 튜플

`infer`로 함수 파라미터 타입을 튜플로 추출하거나, 튜플로 함수를 생성할 수 있다.

```typescript
// 튜플 → 함수 타입
type TupleToFunction<T extends unknown[], R = void> =
  (...args: T) => R;

type Fn = TupleToFunction<[string, number, boolean], string>;
// (arg0: string, arg1: number, arg2: boolean) => string

// 함수 파라미터 앞에 하나 추가
type Prepend1<F extends (...args: never[]) => unknown, P> =
  (first: P, ...args: Parameters<F>) => ReturnType<F>;

type F2 = Prepend1<(n: number) => string, boolean>;
// (first: boolean, n: number) => string
```

## 커링 타입

재귀 + 튜플 분해로 함수를 커링된 타입으로 변환한다.

```typescript
type Curry<F extends (...args: never[]) => unknown> =
  Parameters<F> extends [infer H, ...infer T]
    ? T extends never[]
      ? F
      : (arg: H) => Curry<(...rest: T) => ReturnType<F>>
    : never;

type Curried = Curry<(a: string, b: number, c: boolean) => void>;
// (arg: string) => (arg: number) => (arg: boolean) => void
```

## 실전: 프리즘 타입 (Optics)

튜플 타입 조작은 렌즈(Lens)/프리즘(Prism) 같은 함수형 프로그래밍 패턴을 타입 안전하게 구현할 때 유용하다.

```typescript
// 중첩 객체에서 경로로 타입 추출
type Get<T, Path extends string[]> =
  Path extends [infer K, ...infer Rest]
    ? K extends keyof T
      ? Rest extends string[]
        ? Get<T[K], Rest>
        : T[K]
      : never
    : T;

type Config = { db: { host: string; port: number } };
type Host = Get<Config, ["db", "host"]>;  // string
type Port = Get<Config, ["db", "port"]>;  // number
```

## 핵심 정리

variadic 튜플 타입과 `infer`로 Head, Tail, Reverse, Zip, Filter 같은 함수형 배열 연산을 타입 레벨에서 구현할 수 있다. `T[number]`로 유니언 변환, `Parameters<F>`로 함수 파라미터 추출, 재귀 분해로 커링 타입까지 만들 수 있다. 이런 패턴들은 타입 체조 문제뿐 아니라 폼 라이브러리, 라우터 파라미터 추출, 이벤트 시스템 타이핑에서도 실용적으로 쓰인다.

---

**지난 글:** [타입 레벨 산술 — 튜플 길이로 숫자 연산 구현](/posts/ts-type-level-arithmetic/)

**다음 글:** [유틸리티 타입 총정리 — Partial에서 Awaited까지](/posts/ts-utility-types-overview/)

<br>
읽어주셔서 감사합니다. 😊
