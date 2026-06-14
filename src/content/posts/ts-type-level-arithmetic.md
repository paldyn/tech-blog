---
title: "타입 레벨 산술 — 튜플 길이로 숫자 연산 구현"
description: "TypeScript 타입 레벨 산술(Type-Level Arithmetic)의 핵심 아이디어, 덧셈·뺄셈·곱셈·비교 구현, 재귀 깊이 제한, 실전 활용 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 8
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "타입산술", "재귀타입", "튜플", "Add", "GTE", "타입체조", "고급타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-recursive-conditional-types/)에서 재귀 조건부 타입으로 다양한 타입 알고리즘을 구현했다. 이번에는 TypeScript 타입 체조의 가장 흥미로운 분야 중 하나인 **타입 레벨 산술(Type-Level Arithmetic)**을 다룬다. TypeScript 숫자 리터럴 타입은 연산을 직접 수행할 수 없지만, **튜플 길이**를 이용하면 덧셈, 뺄셈, 곱셈, 대소 비교를 타입 레벨에서 구현할 수 있다.

## 핵심 아이디어: 숫자 = 튜플 길이

TypeScript의 숫자 리터럴 타입은 값을 직접 더하거나 뺄 수 없다. 그러나 `['a']['length']`가 `1`이고 `['a', 'b']['length']`가 `2`인 점을 이용하면 숫자 연산을 튜플 조작으로 변환할 수 있다.

```typescript
// 숫자 N에 대응하는 N-길이 튜플 생성
type Arr<N extends number, A extends unknown[] = []> =
  A["length"] extends N ? A : Arr<N, [unknown, ...A]>;

type T3 = Arr<3>;  // [unknown, unknown, unknown]
type T0 = Arr<0>;  // []
```

`A["length"]`가 `N`과 같아질 때까지 `unknown`을 하나씩 추가하는 재귀다.

![튜플 길이로 구현하는 타입 산술](/assets/posts/ts-type-level-arithmetic-basics.svg)

## 덧셈

두 튜플을 합치면 길이가 두 수의 합이 된다.

```typescript
type Add<A extends number, B extends number> =
  [...Arr<A>, ...Arr<B>]["length"];

type Sum = Add<3, 4>;   // 7
type Zero = Add<0, 5>;  // 5
```

## 뺄셈

`A` 길이의 튜플에서 앞쪽 `B`개를 제거한 나머지 길이가 `A - B`다.

```typescript
type Sub<A extends number, B extends number> =
  Arr<A> extends [...Arr<B>, ...infer Rest]
    ? Rest["length"]
    : never;  // A < B이면 never (음수 불가)

type Diff = Sub<7, 3>;  // 4
type Bad = Sub<3, 7>;   // never
```

`A < B`인 경우 `extends` 조건이 실패해 `never`를 반환한다.

## 비교

`A`가 `B`보다 크거나 같은지는, `Arr<A>`에 `Arr<B>`와 임의의 나머지가 포함되는지로 확인한다.

```typescript
type GTE<A extends number, B extends number> =
  Arr<A> extends [...Arr<B>, ...unknown[]]
    ? true
    : false;

type GT<A extends number, B extends number> =
  A extends B ? false : GTE<A, B>;

type LTE<A extends number, B extends number> = GTE<B, A>;

type G1 = GTE<5, 3>;  // true
type G2 = GTE<3, 5>;  // false
type G3 = GTE<3, 3>;  // true
```

![비교·곱셈·실전 활용](/assets/posts/ts-type-level-arithmetic-compare.svg)

## 곱셈

덧셈을 B번 반복한다. 어큐뮬레이터에 `Arr<A>`를 B번 누적한다.

```typescript
type Multiply<
  A extends number,
  B extends number,
  Acc extends unknown[] = []
> = Acc["length"] extends B
  ? [...Arr<A>, ...Acc]["length"]  // 마지막 더하기
  : Multiply<A, B, [...Arr<A>, ...Acc]>;

type Product = Multiply<3, 4>;  // 12
```

B가 0이면 첫 번째 조건이 즉시 참(`0 extends 0`)이 되어 `Arr<A>` + `[]` = `Arr<A>`의 길이인 `A`를 반환한다. 0 × A = A가 되어 실수가 있다. 정확한 0 처리가 필요하다면:

```typescript
type Multiply2<A extends number, B extends number> =
  B extends 0 ? 0 : Multiply<A, B>;
```

## 재귀 깊이 제한

TypeScript 재귀 깊이 한계(약 50)로 인해 큰 수 연산에 제약이 있다.

```typescript
type Big = Add<30, 25>;  // 55 — 재귀 55회 → 오류 가능성
type Safe = Add<10, 15>; // 25 — 안전
```

실용 범위: 0~45 정도다. 라이브러리 타입 코드(예: `ts-arithmetic`, `hotscript`)는 더 정교한 방법으로 이를 우회한다.

## 실전 활용: 고정 길이 제약

```typescript
// 정확히 N개 요소를 가진 배열 타입
type ExactLength<T, N extends number> =
  T extends { length: N } ? T : never;

function processTriple<T>(items: ExactLength<[T, T, T], 3>): T[] {
  return [...items];
}

// N개 이상인 NonEmpty
type NonEmptyArray<T> = [T, ...T[]];

function first<T>(arr: NonEmptyArray<T>): T {
  return arr[0];
}
```

## 범위 내 정수 유니언

```typescript
// 0부터 N-1까지의 수 유니언
type Range<N extends number, Acc extends number[] = []> =
  Acc["length"] extends N
    ? Acc[number]
    : Range<N, [...Acc, Acc["length"]]>;

type R5 = Range<5>;  // 0 | 1 | 2 | 3 | 4
```

CSS 그리드 컬럼 수나 배열 인덱스 범위를 제한할 때 유용하다.

## 핵심 정리

타입 레벨 산술은 "숫자 = 튜플 길이"라는 아이디어에서 출발한다. 덧셈은 튜플 결합, 뺄셈은 분해, 곱셈은 반복 덧셈, 비교는 `extends` 조건으로 구현한다. 재귀 깊이 한계(~50)로 큰 수는 처리할 수 없지만, 고정 길이 제약, 범위 유니언, 비교 타입 같은 실전 패턴에서 유용하게 쓰인다.

---

**지난 글:** [재귀 조건부 타입 — 타입 레벨 패턴 매칭의 극한](/posts/ts-recursive-conditional-types/)

**다음 글:** [튜플 타입 조작 — 분해·재조합·변환 패턴](/posts/ts-tuple-type-manipulation/)

<br>
읽어주셔서 감사합니다. 😊
