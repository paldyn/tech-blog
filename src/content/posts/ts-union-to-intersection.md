---
title: "UnionToIntersection — 유니온을 인터섹션으로 변환하기"
description: "TypeScript에서 A | B | C를 A & B & C로 바꾸는 UnionToIntersection 타입을 단계별로 분해합니다. 분배 조건부 타입, 함수 매개변수의 반공변성, infer를 통한 인터섹션 도출 원리와 실전 활용을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 5
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "타입레벨", "유니온", "인터섹션", "반공변성", "infer"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-challenges-intro/)에서 타입 레벨 프로그래밍의 기초를 익혔다. 이번에는 그 세계에서 유독 "마법처럼" 보이는 타입 하나를 정면으로 분해한다. 바로 `UnionToIntersection<U>` — 유니온 `A | B | C`를 인터섹션 `A & B & C`로 변환하는 타입이다. 동작 원리를 이해하면 분배 조건부 타입과 함수의 반공변성이라는 깊은 개념이 한꺼번에 손에 잡힌다.

## 목표와 완성된 타입

먼저 우리가 만들 타입과 결과부터 보자.

```typescript
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends
    (x: infer I) => void
    ? I
    : never;

type R = UnionToIntersection<{ a: number } | { b: string }>;
// { a: number } & { b: string }
```

세 줄이지만 그 안에 두 단계가 숨어 있다. (1) 유니온을 **함수 타입의 유니온**으로 바꾸고, (2) 그 함수 유니온에서 매개변수 타입을 `infer`로 뽑으면 인터섹션이 나온다. 하나씩 보자.

![유니온 → 인터섹션 변환](/assets/posts/ts-union-to-intersection-flow.svg)

## 1단계: 분배로 함수 유니온 만들기

조건부 타입은 검사 대상이 **벗겨진 타입 매개변수**(naked type parameter)이고 입력이 유니온일 때, 각 멤버에 분배(distribute)된다. `U extends any ? ... : ...`는 항상 참인 조건이지만, 분배를 **트리거**하는 용도로 쓰인다.

```typescript
// U = A | B 일 때
U extends any ? (x: U) => void : never
// => ((x: A) => void) | ((x: B) => void)
```

즉 유니온의 각 멤버 `A`, `B`가 각각 `(x: A) => void`, `(x: B) => void`라는 함수 타입으로 바뀌고, 결과는 이 두 함수 타입의 유니온이 된다. 단순히 멤버를 함수로 감쌌을 뿐이다.

## 2단계: 반공변 위치에서 infer 하기

핵심은 두 번째 단계다. 함수의 **매개변수 위치는 반공변(contravariant)**이다. 여러 함수 타입의 유니온에서 매개변수 타입을 하나로 `infer`하면, TypeScript는 모든 호출에 안전한 타입 — 즉 **인터섹션**을 추론한다.

```typescript
((x: A) => void) | ((x: B) => void)
  extends (x: infer I) => void ? I : never
// I = A & B
```

왜 인터섹션일까? 이 유니온 함수에 넘길 인자는 `A`로 호출될 수도, `B`로 호출될 수도 있어야 한다. 두 경우 모두를 만족하는 유일한 타입은 `A`이면서 동시에 `B`인 값, 곧 `A & B`다. 반공변성이 합집합을 교집합으로 "뒤집는" 것이다.

![UnionToIntersection 구현](/assets/posts/ts-union-to-intersection-code.svg)

## 활용 1: 유니온 객체 병합

여러 객체 타입의 유니온을 하나의 합쳐진 타입으로 만들 때 유용하다. 플러그인 설정처럼 조각조각 정의된 타입을 모을 때 자주 쓴다.

```typescript
type Plugins =
  | { logger: () => void }
  | { cache: Map<string, unknown> }
  | { db: { query: (s: string) => void } };

type App = UnionToIntersection<Plugins>;
// { logger: ...; cache: ...; db: ... } — 모든 기능을 가진 단일 타입
```

`App`은 세 객체의 모든 속성을 가진 타입이 된다. 유니온이었다면 어느 한 속성에도 안전하게 접근할 수 없었을 것이다.

## 활용 2: 유니온의 마지막 멤버 뽑기

`UnionToIntersection`은 유니온 순서를 다루는 다른 고급 타입의 부품으로도 쓰인다. 함수 유니온의 반공변 추론은 마지막 오버로드를 우선하므로, 이를 이용해 "유니온의 마지막 멤버"를 뽑을 수 있다.

```typescript
type LastInUnion<U> =
  UnionToIntersection<U extends any ? (x: U) => void : never> extends
    (x: infer Last) => void
    ? Last
    : never;

type L = LastInUnion<1 | 2 | 3>; // 3
```

이는 유니온을 튜플로 변환하는 `UnionToTuple` 같은 더 큰 타입의 토대가 된다. 깊이 들어가면 끝이 없지만, 출발점은 언제나 "반공변 위치의 `infer`는 인터섹션을 만든다"는 한 문장이다.

정리하면 `UnionToIntersection`은 ① 분배로 유니온을 함수 유니온으로 바꾸고 ② 반공변 매개변수에서 `infer`해 인터섹션을 끌어내는, 두 단계의 조합이다. 이 패턴은 type-challenges의 medium~hard 문제 곳곳에 재등장한다. 다음 글에서는 좀 더 실용적인 타입 트릭 — 리터럴 유니온의 자동완성을 살리는 `string & {}` 패턴을 본다.

---

**지난 글:** [type-challenges 입문 — 타입 레벨 프로그래밍 연습](/posts/ts-type-challenges-intro/)

**다음 글:** [리터럴 유니온 자동완성 — string & {} 패턴](/posts/ts-literal-union-autocomplete/)

<br>
읽어주셔서 감사합니다. 😊
