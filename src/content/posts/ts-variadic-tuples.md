---
title: "가변 인자 튜플 — 스프레드와 추론으로 복잡한 타입 다루기"
description: "TypeScript 4.0에서 도입된 가변 인자 튜플 타입의 스프레드 문법, 타입 추론, Concat/Prepend/Append 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "가변인자튜플", "VariadicTuples", "스프레드타입", "TypeScript4"]
featured: false
draft: false
---

[지난 글](/posts/ts-tuple-types/)에서 기본 튜플 타입을 살펴봤다. 이번 글에서는 TypeScript 4.0에서 도입된 **가변 인자 튜플 타입(Variadic Tuple Types)**을 다룬다. 가변 인자 튜플은 튜플 타입에 제네릭 스프레드를 결합해, 타입 수준에서 배열을 자유롭게 연결하고 변형할 수 있게 해준다. 처음에는 낯설게 느껴지지만, 한번 익히면 고급 유틸리티 타입을 직접 만들 때 없어서는 안 될 도구가 된다.

![가변 인자 튜플 스프레드](/assets/posts/ts-variadic-tuples-spread.svg)

## 가변 인자 튜플이란

기존 TypeScript에서는 튜플 타입 안에 제네릭 타입 변수를 스프레드할 수 없었다. TypeScript 4.0이 이 제약을 풀면서, 다음과 같은 코드가 가능해졌다.

```typescript
// TS 4.0 이전에는 불가능했던 패턴
type Concat<A extends any[], B extends any[]> = [...A, ...B];

type Result = Concat<[1, 2], [3, 4]>; // [1, 2, 3, 4]
```

핵심은 `...A`처럼 **제네릭 타입 변수를 스프레드**할 수 있다는 점이다. `A extends any[]`로 A가 배열 타입임을 제약하면, `...A`는 해당 배열의 모든 요소를 펼쳐 넣는다.

```typescript
// 가변 인자 튜플의 기본 규칙
// 1. 타입 변수는 any[]를 extends해야 함
// 2. 스프레드는 튜플 타입 내에서만 사용 가능
// 3. 하나의 튜플에 rest 스프레드는 하나만

type Valid<A extends any[]> = [...A, string];   // OK
type AlsoValid<A extends any[], B extends any[]> = [...A, ...B]; // OK
```

## 타입 수준 스프레드 연산

가변 인자 튜플의 스프레드는 값 수준의 스프레드 연산자(`...`)와 완전히 대응한다. 함수가 하는 일을 타입이 그대로 추적한다.

```typescript
// 값 수준
function concat<A extends any[], B extends any[]>(a: A, b: B): [...A, ...B] {
  return [...a, ...b];
}

// 타입이 정확히 추론됨
const result = concat([1, 2] as [1, 2], ["a", "b"] as ["a", "b"]);
// result: [1, 2, "a", "b"] — 구체적인 리터럴 타입까지 보존!

// 일반 배열을 넘기면 일반 배열 타입
const r2 = concat([1, 2], [3, 4]);
// r2: number[] — 배열이면 배열로 추론
```

TS 4.0 이전에는 이런 함수의 반환 타입을 `(A | B)[]`로밖에 표현할 수 없었다. 이제는 입력 튜플의 구조를 정확히 반영한 타입을 돌려줄 수 있다.

## Concat, Prepend, Append 패턴

가변 인자 튜플로 만들 수 있는 대표적인 유틸리티 타입들이다.

### Concat

두 튜플을 이어 붙인다.

```typescript
type Concat<A extends any[], B extends any[]> = [...A, ...B];

type AB = Concat<[1, 2], [3, 4]>;       // [1, 2, 3, 4]
type Mixed = Concat<[string], [number, boolean]>; // [string, number, boolean]
type Empty = Concat<[], [1, 2, 3]>;     // [1, 2, 3]
```

### Prepend

튜플 앞에 요소를 추가한다.

```typescript
type Prepend<T, Arr extends any[]> = [T, ...Arr];

type P1 = Prepend<0, [1, 2, 3]>;    // [0, 1, 2, 3]
type P2 = Prepend<string, [number]>; // [string, number]
```

### Append

튜플 뒤에 요소를 추가한다.

```typescript
type Append<Arr extends any[], T> = [...Arr, T];

type A1 = Append<[1, 2, 3], 4>;     // [1, 2, 3, 4]
type A2 = Append<[string], boolean>; // [string, boolean]
```

### 조합 활용

```typescript
// 앞뒤에 동시에 추가
type Wrap<T, Arr extends any[], U> = [T, ...Arr, U];

type Wrapped = Wrap<string, [number, boolean], null>;
// [string, number, boolean, null]
```

![가변 인자 튜플 추론 패턴](/assets/posts/ts-variadic-tuples-inference.svg)

## 함수 매개변수와 가변 인자 튜플

가변 인자 튜플의 진가는 함수 매개변수 타입을 다룰 때 드러난다. TypeScript 내장 유틸리티 `Parameters`와 `ReturnType`이 이 기반 위에서 동작한다.

```typescript
// 표준 라이브러리 정의 (개념적으로)
type Parameters<T extends (...args: any) => any>
  = T extends (...args: infer P) => any ? P : never;

type ReturnType<T extends (...args: any) => any>
  = T extends (...args: any) => infer R ? R : never;

// 활용 예시
function greet(name: string, age: number): string {
  return `${name} (${age})`;
}

type GreetParams = Parameters<typeof greet>;   // [name: string, age: number]
type GreetReturn = ReturnType<typeof greet>;   // string
```

가변 인자 튜플로 매개변수 타입을 직접 조작할 수 있다:

```typescript
// 첫 번째 인자를 제거하는 유틸리티
type DropFirst<T extends any[]> = T extends [any, ...infer Rest] ? Rest : never;

type F = (a: string, b: number, c: boolean) => void;
type WithoutFirst = DropFirst<Parameters<F>>; // [b: number, c: boolean]
```

## 실전 활용 예시

### 함수 바인딩 타입

```typescript
// bind()의 타입을 더 정확하게 표현
type Bind<F extends (...args: any[]) => any, BoundArgs extends any[]> = (
  ...args: DropFirst<Parameters<F>>
) => ReturnType<F>;

// 미들웨어 파이프라인
type Middleware<In extends any[], Out> = (...args: In) => Out;

type Pipeline<Args extends any[], Mid, Out> = [
  first: Middleware<Args, Mid>,
  second: Middleware<[Mid], Out>
];
```

### 이벤트 시스템

```typescript
type EventMap = {
  click: [x: number, y: number];
  keydown: [key: string, modifiers: string[]];
  resize: [width: number, height: number];
};

function on<K extends keyof EventMap>(
  event: K,
  handler: (...args: EventMap[K]) => void
): void {
  // 구현 생략
}

// args가 [x: number, y: number]로 정확히 추론됨
on("click", (x, y) => {
  console.log(x + y);
});
```

### Curry 타입

가변 인자 튜플로 커링 함수의 타입을 표현할 수도 있다.

```typescript
// 단순 2인자 커링
type Curry2<A, B, R> = (a: A) => (b: B) => R;

// 매개변수 배열로부터 커링 타입 생성
type CurryArgs<Args extends any[], R> =
  Args extends [infer First, ...infer Rest]
    ? (arg: First) => CurryArgs<Rest, R>
    : R;

type Curried = CurryArgs<[string, number, boolean], string>;
// (arg: string) => (arg: number) => (arg: boolean) => string
```

## 주의사항과 한계

### rest 위치 제한 (TS 4.2 이전)

TypeScript 4.2 이전에는 rest 요소가 마지막 위치에만 올 수 있었다. 4.2부터 중간 위치도 허용되지만, 여전히 제약이 있다.

```typescript
// TS 4.2+: 중간 rest 허용
type Middle = [first: string, ...middle: number[], last: boolean]; // OK

// 단, rest 요소는 하나의 튜플에 하나만
// type TwoRests = [...string[], ...number[]]; // Error
```

### 재귀적 사용의 복잡성

가변 인자 튜플을 재귀적으로 사용하면 타입 추론이 느려지거나 복잡해질 수 있다.

```typescript
// 깊은 재귀는 타입 연산이 무거워짐
type Reverse<T extends any[], Acc extends any[] = []> =
  T extends [infer Head, ...infer Tail]
    ? Reverse<Tail, [Head, ...Acc]>
    : Acc;

type Rev = Reverse<[1, 2, 3, 4, 5]>; // [5, 4, 3, 2, 1]
// 긴 튜플에서는 성능 주의
```

### any[]와 unknown[]의 차이

제약에 `any[]`와 `unknown[]`은 다르게 동작한다:

```typescript
// any[]를 extends하면 스프레드 가능
type WithAny<T extends any[]> = [...T, string]; // OK

// unknown[]도 스프레드 가능 (더 안전)
type WithUnknown<T extends unknown[]> = [...T, string]; // OK

// 단, unknown[]로 제약하면 배열 원소 타입이 unknown으로 처리됨
```

실제 코드에서는 `any[]`가 더 유연하지만 타입 안전성을 일부 포기한다. 라이브러리를 작성할 때는 의도에 따라 선택하자.

---

**지난 글:** [튜플 타입 — 고정 길이 이종 배열의 완전 정복](/posts/ts-tuple-types/)

**다음 글:** [객체 타입 완전 정리 — 프로퍼티·옵셔널·인덱스 시그니처](/posts/ts-object-types/)

<br>
읽어주셔서 감사합니다. 😊
