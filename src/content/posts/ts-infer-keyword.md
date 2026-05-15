---
title: "infer 키워드 — 조건부 타입 내 타입 추론"
description: "TypeScript infer 키워드의 동작 원리, ReturnType·Parameters·Awaited 내장 구현, 튜플 분해, 재귀 패턴, TS 4.7 infer 제약 추가까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "infer", "조건부타입", "ReturnType", "Awaited", "튜플", "고급타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-template-literal-types/)에서 템플릿 리터럴 타입으로 문자열 패턴을 추출했다. 이번에는 TypeScript 고급 타입의 핵심인 **`infer` 키워드**를 깊이 살펴본다. `infer`는 조건부 타입의 `extends` 절 안에서 패턴 매칭으로 타입을 "캡처"하는 특별한 키워드다. 내장 유틸리티 타입 `ReturnType`, `Parameters`, `Awaited` 등이 모두 이 키워드로 구현되어 있다.

## infer 기본 원리

`T extends SomeType<infer R>`은 "T가 SomeType<R>을 충족하면, R을 추론해서 참 분기에서 사용해라"는 의미다.

```typescript
// 함수 반환 타입 추출
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type A = ReturnType<() => string>;          // string
type B = ReturnType<(n: number) => boolean>;  // boolean
type C = ReturnType<string>;                // never (함수가 아님)
```

`infer R`로 캡처한 `R`은 `extends` 조건이 참인 분기(`?` 뒤)에서만 사용할 수 있다.

## 내장 유틸리티 타입 구현

```typescript
// 함수 매개변수 타입 (튜플로 추출)
type Parameters<T> = T extends (...args: infer P) => any ? P : never;
// Parameters<(a: string, b: number) => void> → [string, number]

// Promise 내부 타입 (재귀)
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
// Awaited<Promise<Promise<string>>> → string

// 생성자 인스턴스 타입
type InstanceType<T> = T extends new (...args: any[]) => infer I ? I : never;
// InstanceType<typeof Date> → Date
```

![infer 사용법](/assets/posts/ts-infer-keyword-usage.svg)

## 여러 위치에서 동시 추론

하나의 조건부 타입에서 여러 `infer`를 사용할 수 있다.

```typescript
// 첫 매개변수와 반환 타입 동시 추출
type FirstParamAndReturn<T> = T extends (first: infer P, ...rest: any[]) => infer R
  ? [P, R]
  : never;

type Result = FirstParamAndReturn<(x: string, y: number) => boolean>;
// [string, boolean]
```

## 튜플과 배열 분해

`infer`와 레스트 요소를 결합하면 튜플을 분해할 수 있다.

```typescript
// 배열 요소 타입
type ElementOf<T> = T extends (infer E)[] ? E : never;
// ElementOf<string[]> → string

// 튜플 첫 번째 요소
type Head<T extends any[]> = T extends [infer H, ...any[]] ? H : never;
// Head<[string, number, boolean]> → string

// 튜플 나머지
type Tail<T extends any[]> = T extends [any, ...infer R] ? R : [];
// Tail<[string, number, boolean]> → [number, boolean]

// 마지막 요소
type Last<T extends any[]> = T extends [...any[], infer L] ? L : never;
// Last<[string, number, boolean]> → boolean
```

![infer 고급 패턴](/assets/posts/ts-infer-keyword-patterns.svg)

## 재귀 infer 패턴

```typescript
// 튜플 뒤집기
type Reverse<T extends any[]> = T extends [infer H, ...infer R]
  ? [...Reverse<R>, H]
  : [];
// Reverse<[1, 2, 3]> → [3, 2, 1]

// 중첩 배열 평탄화 (1단계)
type Flatten<T extends any[]> = T extends (infer Item)[]
  ? Item extends any[]
    ? Flatten<Item>
    : Item
  : never;
```

## TS 4.7+ — infer에 제약 추가

TypeScript 4.7부터 `infer R extends Type` 형태로 추론 변수에 제약을 직접 추가할 수 있다.

```typescript
// R을 string으로 제약 — 리터럴 타입이 보존됨
type StringReturn<T> = T extends () => infer R extends string ? R : never;

type T1 = StringReturn<() => "hello">;   // "hello" (리터럴 타입)
type T2 = StringReturn<() => string>;    // string

// 숫자 제약
type NumericFirst<T extends any[]> = T extends [infer N extends number, ...any[]]
  ? N
  : never;
```

이전에는 `infer R`로 추론한 다음 조건부 타입으로 좁혀야 했지만, 이제 한 번에 처리할 수 있다.

## 공변·반공변 위치의 infer

같은 타입 변수가 공변(covariant)·반공변(contravariant) 위치에 모두 등장하면 교차 타입으로 추론된다.

```typescript
// 반공변 위치(함수 매개변수): 교차 타입으로 합쳐짐
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void
    ? I
    : never;

type I = UnionToIntersection<string | number>;
// string & number → never (실제 활용 시 객체 타입 유니언에 사용)
```

이 패턴은 유니언을 교차 타입으로 변환하는 고급 기법으로, 코드베이스에서 유틸리티 타입 라이브러리 구현에 자주 등장한다. `infer`는 TypeScript 타입 시스템에서 가장 강력한 도구 중 하나이며, 다음 글에서 다룰 `unknown`, `never`, `any`의 미묘한 차이와 함께 알면 타입 수준의 프로그래밍이 완전히 달라진다.

---

**지난 글:** [템플릿 리터럴 타입 — 문자열 타입 조합과 추론](/posts/ts-template-literal-types/)

**다음 글:** [unknown · never · any — 타입 계층 끝점들](/posts/ts-unknown-never-any/)

<br>
읽어주셔서 감사합니다. 😊
