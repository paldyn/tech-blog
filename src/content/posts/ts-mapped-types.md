---
title: "매핑된 타입 — 기존 타입을 순회해 새 타입 만들기"
description: "TypeScript 매핑된 타입(Mapped Types)의 문법, +/- 수정자, as 절 키 재매핑, 내장 유틸리티 타입 구현 원리를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "매핑타입", "유틸리티타입", "keyof", "Partial", "Readonly", "고급타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-conditional-types/)에서 조건부 타입과 `infer` 키워드의 기초를 다뤘다. 이번에는 **매핑된 타입(Mapped Types)**을 살펴본다. 매핑된 타입은 기존 타입의 모든 속성을 순회하면서 각 속성을 변환해 새로운 타입을 만드는 TypeScript의 핵심 기능이다. `Partial`, `Readonly`, `Required`, `Pick`, `Record` 같은 표준 유틸리티 타입들이 모두 매핑된 타입으로 구현되어 있다.

## 기본 문법

매핑된 타입은 `{ [K in SomeUnion]: ValueType }` 형태를 갖는다.

```typescript
// K가 "a" | "b" | "c"를 순회하며 타입 생성
type Flags = { [K in "a" | "b" | "c"]: boolean };
// 결과: { a: boolean; b: boolean; c: boolean }

// keyof로 기존 타입의 키를 순회
type ReadonlyUser = { readonly [K in keyof User]: User[K] };
```

`K in keyof T`는 `T`의 모든 키를 순회하는 핵심 패턴이다.

![매핑된 타입 개념](/assets/posts/ts-mapped-types-concept.svg)

## 제네릭 매핑 타입

실제로 유용하게 사용하려면 제네릭과 결합한다.

```typescript
// 내장 Partial<T> 구현 원리
type Partial<T> = {
  [K in keyof T]?: T[K];
};

// 내장 Readonly<T> 구현 원리
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

// 내장 Record<K, V> 구현 원리
type Record<K extends string | number | symbol, V> = {
  [P in K]: V;
};
```

`Partial<T>`의 `?`는 선택적 속성을, `Readonly<T>`의 `readonly`는 읽기 전용을 나타낸다. `T[K]`는 **인덱스 접근 타입**으로, 원래 타입의 값 타입을 그대로 유지한다.

## +/- 수정자

매핑 수정자 앞에 `+` 또는 `-`를 붙여 속성을 추가하거나 제거할 수 있다.

```typescript
// Required<T>: optional(?) 제거, readonly 제거
type Required<T> = {
  -readonly [K in keyof T]-?: T[K];
};

// Mutable<T>: readonly만 제거 (커스텀 유틸리티)
type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};
```

`-readonly`는 `readonly` 수정자를 제거하고, `-?`는 선택적 속성 표시(`?`)를 제거해 필수 속성으로 바꾼다. `+`는 기본값이라 생략 가능하다.

![수정자와 키 재매핑](/assets/posts/ts-mapped-types-modifiers.svg)

## as 절로 키 재매핑 (TypeScript 4.1+)

`as` 절을 사용하면 출력 키 이름을 변환할 수 있다.

```typescript
// 속성마다 getter 메서드 생성
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type UserGetters = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }
```

`never`를 반환하면 해당 키를 결과에서 제외할 수 있다.

```typescript
// string 키만 남기고 나머지 제거
type StringKeysOnly<T> = {
  [K in keyof T as K extends string ? K : never]: T[K];
};

// 특정 접두사가 붙은 키만 추출
type PublicOnly<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: T[K];
};
```

## 값 타입 변환

키뿐 아니라 값 타입도 자유롭게 바꿀 수 있다.

```typescript
// 모든 속성을 null 가능하게
type Nullable<T> = { [K in keyof T]: T[K] | null };

// 모든 속성을 Promise로 감싸기
type Promisify<T> = { [K in keyof T]: Promise<T[K]> };

// 중첩 타입에 재귀 적용
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? DeepReadonly<T[K]>
    : T[K];
};
```

`DeepReadonly`처럼 조건부 타입과 결합하면 재귀적인 변환도 가능하다.

## 내장 유틸리티 타입 완전 정리

| 유틸리티 | 설명 | 구현 핵심 |
|---|---|---|
| `Partial<T>` | 모든 속성 선택적으로 | `[K in keyof T]?: T[K]` |
| `Required<T>` | 모든 속성 필수로 | `-readonly [K in keyof T]-?` |
| `Readonly<T>` | 모든 속성 읽기 전용 | `readonly [K in keyof T]` |
| `Record<K, V>` | 키-값 매핑 | `[P in K]: V` |
| `Pick<T, K>` | 특정 키만 추출 | `[P in K]: T[P]` |
| `Omit<T, K>` | 특정 키 제외 | `Pick` + `Exclude` 결합 |

`Pick<T, K>`를 직접 구현하면 매핑된 타입의 동작 방식을 잘 이해할 수 있다.

```typescript
// Pick 직접 구현
type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

// Omit 직접 구현
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
```

## 실전 패턴

```typescript
// API 응답 → 폼 상태 (모두 string, 모두 optional)
type FormState<T> = {
  [K in keyof T]?: string;
};

// 모든 속성에 에러 메시지 추가
type FormErrors<T> = {
  [K in keyof T]?: string;
};

// 함수형 업데이터 패턴
type Updaters<T> = {
  [K in keyof T]: (value: T[K]) => void;
};
```

매핑된 타입은 반복 코드를 제거하고 타입 변환을 자동화한다. 특히 백엔드 DTO를 프론트엔드 폼 상태로 바꾸거나, API 응답 타입에서 클라이언트 모델을 파생할 때 매우 유용하다. 다음 글에서는 템플릿 리터럴 타입을 살펴보며 키 재매핑을 더 강력하게 활용하는 방법을 다룬다.

---

**지난 글:** [조건부 타입 — 타입 수준의 분기 처리](/posts/ts-conditional-types/)

**다음 글:** [템플릿 리터럴 타입 — 문자열 타입 조합과 추론](/posts/ts-template-literal-types/)

<br>
읽어주셔서 감사합니다. 😊
