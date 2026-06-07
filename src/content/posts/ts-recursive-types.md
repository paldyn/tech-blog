---
title: "재귀 타입 — 자기 자신을 참조하는 타입 구조"
description: "TypeScript 재귀 타입(Recursive Types)의 선언 방법, 지연 평가와 즉시 평가 차이, DeepReadonly·DeepPartial·JSON 타입 구현, 재귀 깊이 제한과 우회 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "재귀타입", "DeepReadonly", "DeepPartial", "JSON타입", "고급타입", "무한깊이"]
featured: false
draft: false
---

[지난 글](/posts/ts-intrinsic-string-types/)에서 인트린직 문자열 타입을 살펴봤다. 이번에는 **재귀 타입(Recursive Types)**을 다룬다. 재귀 타입은 자기 자신을 포함하는 타입 정의로, 트리, 링크드 리스트, 중첩 배열, JSON 구조처럼 깊이가 정해지지 않은 데이터를 타이핑할 때 필수다. TypeScript는 특정 조건에서 재귀 타입을 허용하며, 이 규칙을 이해하면 강력한 타입 패턴을 만들 수 있다.

## 가장 단순한 재귀 타입

인터페이스는 자기 자신을 속성 타입으로 참조할 수 있다.

```typescript
interface TreeNode<T> {
  value: T;
  children: TreeNode<T>[];  // 자기 참조
}

const tree: TreeNode<number> = {
  value: 1,
  children: [
    { value: 2, children: [] },
    { value: 3, children: [
      { value: 4, children: [] }
    ]}
  ]
};
```

`type` 별칭도 조건부 타입이나 매핑된 타입 안에서는 재귀가 가능하다.

```typescript
// type 별칭에서의 재귀
type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };
```

![재귀 타입 구조 패턴](/assets/posts/ts-recursive-types-structure.svg)

## 즉시 평가 vs 지연 평가

TypeScript가 재귀 타입을 허용하는 핵심 규칙은 **지연 평가(deferred evaluation)**다.

```typescript
// ✗ 즉시 평가 — 타입 오류 (순환 참조)
type Immediate = Immediate[];  // Error: circular reference

// ✓ 지연 평가 — 조건부 타입 내 재귀
type Deferred<T> = T extends any[] ? Deferred<T[number]> : T;

// ✓ 인터페이스는 항상 지연 평가
interface RecursiveList extends Array<RecursiveList> {}
```

TypeScript는 조건부 타입이나 매핑된 타입 안에서의 재귀를 지연 평가로 처리한다. 단순 직접 참조는 순환이 감지되어 오류가 난다.

## DeepReadonly — 모든 중첩 레벨에 readonly

```typescript
type DeepReadonly<T> =
  T extends (...args: never[]) => unknown
    ? T  // 함수는 그대로
    : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T; // 원시 타입은 그대로

interface Config {
  server: { host: string; port: number };
  auth: { token: string; expires: Date };
}

type FrozenConfig = DeepReadonly<Config>;
// {
//   readonly server: { readonly host: string; readonly port: number };
//   readonly auth: { readonly token: string; readonly expires: Date };
// }

const config: FrozenConfig = { /* ... */ };
// config.server.host = "new"; // ✗ 오류
```

`Readonly<T>`는 1레벨만 처리하지만, `DeepReadonly<T>`는 무한 깊이로 적용된다.

## DeepPartial — 중첩 optional

```typescript
type DeepPartial<T> = T extends object ? {
  [K in keyof T]?: DeepPartial<T[K]>;
} : T;

type PartialConfig = DeepPartial<Config>;
// {
//   server?: { host?: string; port?: number };
//   auth?: { token?: string; expires?: Date };
// }
```

Redux나 상태 관리에서 중첩 상태의 부분 업데이트 타입으로 자주 사용된다.

## 재귀 깊이 제한

TypeScript의 재귀 깊이 제한은 약 50 레벨이다. 이를 초과하면 컴파일러가 재귀를 포기하고 `any`에 가까운 타입을 반환한다.

```typescript
// 깊이 카운팅이 필요한 경우 — 튜플 어큐뮬레이터 패턴
type BuildTuple<
  N extends number,
  Acc extends unknown[] = []
> = Acc["length"] extends N ? Acc : BuildTuple<N, [...Acc, unknown]>;

type Tuple5 = BuildTuple<5>; // [unknown, unknown, unknown, unknown, unknown]
```

튜플 어큐뮬레이터 패턴(accumulator pattern)은 꼬리 재귀와 유사하게 더 깊은 재귀를 가능하게 한다.

![재귀 타입 제한과 우회](/assets/posts/ts-recursive-types-limits.svg)

## 링크드 리스트 타입

```typescript
type LinkedList<T> = {
  head: T;
  tail: LinkedList<T> | null;
};

function toArray<T>(list: LinkedList<T> | null): T[] {
  if (list === null) return [];
  return [list.head, ...toArray(list.tail)];
}
```

## 중첩 Promise 해제

`Awaited<T>` 내장 유틸리티가 도입되기 전에는 재귀로 구현했다.

```typescript
// Awaited<T>의 단순화 버전
type UnwrapPromise<T> = T extends Promise<infer U>
  ? UnwrapPromise<U>  // 재귀: 중첩 Promise를 끝까지 해제
  : T;

type A = UnwrapPromise<Promise<Promise<string>>>;  // string
type B = UnwrapPromise<string>;                    // string
```

## 경로 타입 — 중첩 객체 키 순회

```typescript
type Paths<T, Prefix extends string = ""> =
  T extends object
    ? {
        [K in keyof T]: K extends string
          ? T[K] extends object
            ? Paths<T[K], `${Prefix}${K}.`>
            : `${Prefix}${K}`
          : never;
      }[keyof T]
    : never;

type Config2 = { a: { b: { c: string }; d: number }; e: string };
type AllPaths = Paths<Config2>;  // "a.b.c" | "a.d" | "e"
```

이 패턴은 폼 라이브러리에서 중첩 필드 경로를 타입 안전하게 다룰 때 쓴다.

## 핵심 정리

재귀 타입은 중첩 구조를 정확하게 타이핑하는 핵심 도구다. 인터페이스는 자유롭게, `type` 별칭은 조건부/매핑 타입 내에서 재귀가 허용된다. `DeepReadonly`, `DeepPartial`, JSON 타입, 경로 추출 같은 패턴이 대표적인 활용처다. 재귀 깊이 제한(~50)에 걸릴 때는 튜플 어큐뮬레이터 패턴으로 우회한다.

---

**지난 글:** [인트린직 문자열 타입 — Uppercase·Lowercase·Capitalize·Uncapitalize](/posts/ts-intrinsic-string-types/)

**다음 글:** [재귀 조건부 타입 — 타입 레벨 패턴 매칭의 극한](/posts/ts-recursive-conditional-types/)

<br>
읽어주셔서 감사합니다. 😊
