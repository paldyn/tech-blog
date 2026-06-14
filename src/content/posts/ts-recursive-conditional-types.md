---
title: "재귀 조건부 타입 — 타입 레벨 패턴 매칭의 극한"
description: "TypeScript 재귀 조건부 타입으로 중첩 배열 평탄화, 튜플 조작, 문자열 치환, UnionToIntersection, 순열 생성까지 타입 레벨 알고리즘을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 7
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "재귀조건부타입", "infer", "Flatten", "UnionToIntersection", "고급타입", "타입체조"]
featured: false
draft: false
---

[지난 글](/posts/ts-recursive-types/)에서 재귀 타입의 기본 구조를 살펴봤다. 이번에는 **재귀 조건부 타입**으로 한 단계 더 나아간다. 조건부 타입의 `infer`와 재귀를 결합하면 런타임 함수처럼 타입을 분해하고 재조합하는 "타입 레벨 알고리즘"을 만들 수 있다. 중첩 배열 평탄화, 문자열 치환, 유니언-교차 변환이 대표적인 예다.

## Flatten — 중첩 배열 평탄화

```typescript
type Flatten<T> =
  T extends (infer Item)[]
    ? Flatten<Item>  // Item이 배열이면 계속 벗기기
    : T;

type A = Flatten<number[][][]>;  // number
type B = Flatten<string[]>;      // string
type C = Flatten<string>;        // string (배열 아님, 즉시 반환)
```

`T extends (infer Item)[]`로 `T`가 배열인지 확인하고, 배열이면 요소 타입 `Item`으로 재귀한다. 배열이 아닐 때 `T`를 반환하면 종료 조건이 된다.

![재귀 조건부 타입 패턴](/assets/posts/ts-recursive-conditional-types-patterns.svg)

## 문자열 치환 — Replace

```typescript
type Replace<
  S extends string,
  From extends string,
  To extends string
> = S extends `${infer A}${From}${infer B}`
  ? Replace<`${A}${To}${B}`, From, To>
  : S;

type R1 = Replace<"a_b_c", "_", "-">;  // "a-b-c"
type R2 = Replace<"hello world", " ", "_">;  // "hello_world"
```

`${infer A}${From}${infer B}` 패턴으로 문자열을 분해하고, `From`을 `To`로 교체한 뒤 결과에 재귀를 적용해 모든 출현을 치환한다.

## Trim 타입

```typescript
type TrimLeft<S extends string> =
  S extends ` ${infer R}` ? TrimLeft<R> : S;

type TrimRight<S extends string> =
  S extends `${infer L} ` ? TrimRight<L> : S;

type Trim<S extends string> = TrimRight<TrimLeft<S>>;

type T1 = Trim<"  hello  ">;  // "hello"
```

## UnionToIntersection — 유니언을 교차 타입으로

반변(contravariant) 위치에서 `infer`하면 여러 후보가 교차 타입으로 합쳐지는 TypeScript 동작을 이용한다.

```typescript
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;

type UI1 = UnionToIntersection<{ a: 1 } | { b: 2 }>;
// { a: 1 } & { b: 2 }

type UI2 = UnionToIntersection<string | number>;
// string & number (= never)
```

`U extends any`로 분배해 각 멤버를 `(k: U) => void`로 만든 뒤, 다시 `extends (k: infer I) => void`로 합치면 반변 위치 infer가 교차로 통합한다.

![재귀 + 분배 조건부 타입](/assets/posts/ts-recursive-conditional-types-union.svg)

## 튜플 조작

재귀와 variadic 튜플 타입을 결합하면 튜플을 배열처럼 처리할 수 있다.

```typescript
// 첫 요소 제거
type Tail<T extends unknown[]> =
  T extends [unknown, ...infer R] ? R : never;

type T1 = Tail<[1, 2, 3]>;  // [2, 3]
type T2 = Tail<[string]>;    // []

// 튜플 뒤집기
type Reverse<T extends unknown[], Acc extends unknown[] = []> =
  T extends [infer H, ...infer Rest]
    ? Reverse<Rest, [H, ...Acc]>
    : Acc;

type Rev = Reverse<[1, 2, 3]>;  // [3, 2, 1]
```

어큐뮬레이터 패턴(`Acc extends unknown[] = []`)은 꼬리 재귀를 모방해 더 깊은 재귀를 가능하게 한다.

## 깊이 제한과 카운터 패턴

TypeScript는 재귀 깊이 약 50에서 오류를 낸다. 깊이를 튜플 길이로 측정하는 패턴을 쓰면 이를 제어할 수 있다.

```typescript
type Repeat<
  T,
  N extends number,
  Acc extends T[] = []
> = Acc["length"] extends N ? Acc : Repeat<T, N, [T, ...Acc]>;

type R3 = Repeat<string, 3>;  // [string, string, string]

// 더하기 타입 (type-level arithmetic에서 자세히)
type Add<A extends number, B extends number> =
  [...Repeat<unknown, A>, ...Repeat<unknown, B>]["length"];

type Sum = Add<3, 4>;  // 7
```

## 실전 패턴: 객체 경로 배열

```typescript
type PathArray<T, Prefix extends PropertyKey[] = []> =
  T extends object
    ? {
        [K in keyof T]:
          | [...Prefix, K]
          | PathArray<T[K], [...Prefix, K]>
      }[keyof T]
    : Prefix;

type Config = { db: { host: string; port: number }; cache: { ttl: number } };
type AllPaths = PathArray<Config>;
// ["db"] | ["db", "host"] | ["db", "port"] | ["cache"] | ["cache", "ttl"]
```

## 핵심 정리

재귀 조건부 타입은 `infer`로 타입을 분해하고 재귀 호출로 반복을 표현하는 "타입 레벨 함수"다. 종료 조건을 항상 명확히 두어야 하고, 깊이 제한(~50)에 걸릴 때는 어큐뮬레이터 패턴으로 우회한다. 분배 조건부 타입과 조합하면 유니언 조작, 교차 변환, 순열 생성 같은 고급 패턴이 가능하다.

---

**지난 글:** [재귀 타입 — 자기 자신을 참조하는 타입 구조](/posts/ts-recursive-types/)

**다음 글:** [타입 레벨 산술 — 튜플 길이로 숫자 연산 구현](/posts/ts-type-level-arithmetic/)

<br>
읽어주셔서 감사합니다. 😊
