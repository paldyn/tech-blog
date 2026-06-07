---
title: "인트린직 문자열 타입 — Uppercase·Lowercase·Capitalize·Uncapitalize"
description: "TypeScript 4.1 내장 문자열 조작 타입(Intrinsic String Manipulation Types)의 동작 원리, 유니언 배포, 템플릿 리터럴과의 결합, camelCase 변환 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "인트린직타입", "Uppercase", "Lowercase", "Capitalize", "문자열타입", "고급타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-mapped-type-modifiers/)에서 매핑된 타입의 수정자와 `as` 절 키 재매핑을 살펴봤다. 키 재매핑에서 `Capitalize`를 잠깐 사용했는데, 이번에는 이런 **인트린직 문자열 조작 타입(Intrinsic String Manipulation Types)**을 깊이 다룬다. TypeScript 4.1에서 도입된 `Uppercase<S>`, `Lowercase<S>`, `Capitalize<S>`, `Uncapitalize<S>` 네 가지로, 타입 레벨에서 문자열 리터럴 타입을 변환한다.

## 네 가지 유틸리티

```typescript
type A = Uppercase<"hello">;      // "HELLO"
type B = Lowercase<"HELLO">;      // "hello"
type C = Capitalize<"hello world">; // "Hello world" (첫 글자만)
type D = Uncapitalize<"GetValue">; // "getValue" (첫 글자만 소문자)
```

`Capitalize`는 첫 글자만 대문자로 바꾸고, `Uncapitalize`는 첫 글자만 소문자로 바꾼다. 나머지는 그대로다.

![인트린직 문자열 타입 개요](/assets/posts/ts-intrinsic-string-types-overview.svg)

## intrinsic — 컴파일러 내부 구현

이 네 타입은 `lib.d.ts`에 다음과 같이 선언되어 있다.

```typescript
type Uppercase<S extends string> = intrinsic;
type Lowercase<S extends string> = intrinsic;
type Capitalize<S extends string> = intrinsic;
type Uncapitalize<S extends string> = intrinsic;
```

`intrinsic`은 TypeScript 컴파일러가 직접 처리하는 특별한 키워드다. 사용자가 순수한 TypeScript 타입으로는 동등하게 구현할 수 없다. 문자열 리터럴 타입에 적용될 때는 컴파일 타임에 실제 변환된 결과를 돌려준다.

## 유니언 배포

인트린직 타입은 유니언에 자동으로 배포(distribute)된다.

```typescript
type U = Uppercase<"a" | "b" | "c">; // "A" | "B" | "C"

// 실용 예: DOM 이벤트 이름 → 핸들러 속성 이름
type Events = "click" | "focus" | "blur" | "change";
type OnEvents = `on${Capitalize<Events>}`;
// "onClick" | "onFocus" | "onBlur" | "onChange"
```

유니언의 각 멤버에 독립적으로 적용된 뒤 결과를 다시 유니언으로 합친다.

## 매핑된 타입과 결합

키 재매핑(`as` 절)과 함께 쓰면 타입 레벨에서 API 표면을 자동 생성할 수 있다.

```typescript
// 이벤트 핸들러 맵 자동 생성
type EventMap<Events extends string> = {
  [E in Events as `on${Capitalize<E>}`]: (event: Event) => void;
};

type ButtonEvents = EventMap<"click" | "focus" | "blur">;
// { onClick: ...; onFocus: ...; onBlur: ... }
```

```typescript
// 게터/세터 인터페이스 자동 생성
type Accessor<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
} & {
  [K in keyof T as `set${Capitalize<string & K>}`]: (v: T[K]) => void;
};

type PersonAccessor = Accessor<{ name: string; age: number }>;
// { getName(): string; getAge(): number; setName(v: string): void; setAge(v: number): void }
```

## 제네릭 + 조건부 타입과 결합

리터럴 타입이 아닌 `string` 타입에 적용하면 `string` 그대로 반환된다. 조건부 타입과 `infer`를 써서 런타임 변환과 유사한 패턴을 만들 수 있다.

```typescript
// string & K: K가 symbol을 포함할 수 있어서 string으로 좁힘
type ObjWithGetters<T extends Record<string, unknown>> = {
  [K in string & keyof T as `get${Capitalize<K>}`]: () => T[K];
};
```

## snake_case → camelCase 재귀 패턴

`infer`와 재귀 조건부 타입을 결합하면 복잡한 문자열 변환도 가능하다.

```typescript
type SnakeToCamel<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${SnakeToCamel<Capitalize<Tail>>}`
    : S;

type T1 = SnakeToCamel<"user_first_name">;  // "userFirstName"
type T2 = SnakeToCamel<"get_by_id">;        // "getById"
type T3 = SnakeToCamel<"hello">;            // "hello"
```

역방향도 가능하다.

```typescript
type CamelToSnake<S extends string> =
  S extends `${infer Head}${infer Tail}`
    ? Head extends Uppercase<Head>
      ? Head extends Lowercase<Head>  // 숫자, 특수문자 처리
        ? `${Head}${CamelToSnake<Tail>}`
        : `_${Lowercase<Head>}${CamelToSnake<Tail>}`
      : `${Head}${CamelToSnake<Tail>}`
    : S;
```

실용적인 패턴은 API 응답(snake_case)을 TypeScript 클라이언트(camelCase)로 자동 변환하는 타입이다.

```typescript
type ApiResponse = {
  user_id: number;
  first_name: string;
  last_name: string;
};

type CamelKeys<T extends Record<string, unknown>> = {
  [K in keyof T as SnakeToCamel<string & K>]: T[K];
};

type ClientResponse = CamelKeys<ApiResponse>;
// { userId: number; firstName: string; lastName: string }
```

![유니언 배포와 패턴 조합](/assets/posts/ts-intrinsic-string-types-patterns.svg)

## 실전 활용: CSS 변수 타입 안전성

```typescript
// CSS 속성 이름을 CSS 변수명으로 변환
type CssVar<T extends string> = `--${Lowercase<T>}`;
type CssVarValue = CssVar<"Primary" | "Secondary" | "Accent">;
// "--primary" | "--secondary" | "--accent"

// CSS 변수 맵 자동 생성
type ThemeVars<Colors extends string> = {
  [C in Colors as CssVar<C>]: string;
};

type MyTheme = ThemeVars<"Primary" | "Secondary">;
// { "--primary": string; "--secondary": string }
```

## 한계와 주의사항

- **`string` 타입에는 변환 불가**: 리터럴이 아닌 `string`에 적용하면 `string` 그대로 반환된다.
- **멀티바이트 문자**: 한글 등 비-ASCII 문자의 경우 ECMAScript locale 규칙을 따른다.
- **성능**: 매우 긴 유니언에 재귀 패턴을 결합하면 타입 추론이 느려질 수 있다.

## 핵심 정리

`Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`는 타입 레벨 문자열 변환 유틸리티다. 유니언에 배포되고, 템플릿 리터럴 타입 및 `infer`와 결합해 강력한 패턴을 만든다. 주요 활용처는 이벤트 핸들러 맵 자동 생성, getter/setter 인터페이스, snake_case↔camelCase 변환, CSS 변수 타입 안전성이다.

---

**지난 글:** [매핑된 타입 수정자 — +/-와 as 키 재매핑](/posts/ts-mapped-type-modifiers/)

**다음 글:** [재귀 타입 — 자기 자신을 참조하는 타입 구조](/posts/ts-recursive-types/)

<br>
읽어주셔서 감사합니다. 😊
