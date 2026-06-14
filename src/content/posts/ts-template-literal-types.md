---
title: "템플릿 리터럴 타입 — 문자열 타입 조합과 추론"
description: "TypeScript 템플릿 리터럴 타입의 문법, 유니언 배포, 내장 문자열 조작 타입(Uppercase·Capitalize 등), infer와의 결합 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 2
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "템플릿리터럴타입", "문자열타입", "Capitalize", "infer", "고급타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-mapped-types/)에서 매핑된 타입으로 기존 타입의 속성을 일괄 변환하는 방법을 배웠다. 이번에는 **템플릿 리터럴 타입(Template Literal Types)**을 살펴본다. TypeScript 4.1에서 도입된 이 기능은 JavaScript의 백틱 문자열처럼 타입 수준에서 문자열을 조합하고, 패턴 매칭으로 부분 문자열을 추출할 수 있게 해준다.

## 기본 문법

템플릿 리터럴 타입은 JavaScript 템플릿 리터럴과 동일한 백틱 문법을 사용한다.

```typescript
type Greeting = `Hello, ${string}`;
// 모든 "Hello, ..."로 시작하는 문자열

type Id = `user_${number}`;
// "user_0", "user_1", "user_42" 등

type EventName = `on${"Click" | "Focus" | "Blur"}`;
// "onClick" | "onFocus" | "onBlur"
```

삽입 위치에 유니언 타입을 넣으면 모든 조합의 유니언이 자동으로 만들어진다.

## 유니언 배포

두 유니언을 조합하면 곱집합이 만들어진다.

```typescript
type Color = "red" | "blue";
type Size = "sm" | "lg";

type ClassName = `${Color}-${Size}`;
// "red-sm" | "red-lg" | "blue-sm" | "blue-lg"
```

![템플릿 리터럴 타입 문법](/assets/posts/ts-template-literal-types-syntax.svg)

## 내장 문자열 조작 타입

TypeScript는 타입 수준의 문자열 변환을 위한 네 가지 내장 타입을 제공한다.

```typescript
type A = Uppercase<"hello">;      // "HELLO"
type B = Lowercase<"HELLO">;      // "hello"
type C = Capitalize<"hello">;     // "Hello"
type D = Uncapitalize<"Hello">;   // "hello"

// 매핑된 타입과 결합: camelCase 키 생성
type CamelKeys<T> = {
  [K in keyof T as Uncapitalize<string & K>]: T[K];
};
```

이 타입들은 컴파일러 내장(intrinsic) 타입이라 구현 코드가 없지만, 사용 방식은 일반 타입 별칭과 동일하다.

## 이벤트 핸들러 패턴

매핑된 타입과 결합하면 API를 자동으로 파생할 수 있다.

```typescript
type ButtonEvents = {
  click: MouseEvent;
  focus: FocusEvent;
  keydown: KeyboardEvent;
};

type Handlers<T> = {
  [K in keyof T as `on${Capitalize<string & K>}`]: (e: T[K]) => void;
};

type ButtonHandlers = Handlers<ButtonEvents>;
// {
//   onClick: (e: MouseEvent) => void;
//   onFocus: (e: FocusEvent) => void;
//   onKeydown: (e: KeyboardEvent) => void;
// }
```

![실전 패턴](/assets/posts/ts-template-literal-types-patterns.svg)

## infer로 문자열 분해

조건부 타입의 `infer`와 결합하면 문자열 패턴에서 부분을 추출할 수 있다.

```typescript
// 접두사 제거
type StripPrefix<S, P extends string> =
  S extends `${P}${infer Rest}` ? Rest : S;

type T1 = StripPrefix<"onClick", "on">;  // "Click"

// 경로에서 파일명 추출
type Filename<S extends string> =
  S extends `${string}/${infer File}` ? File : S;

type T2 = Filename<"src/components/Button.tsx">;  // "Button.tsx"
```

## CSS 속성 타입 안전성

CSS in JS 라이브러리나 유틸리티 CSS 프레임워크에서 유용하다.

```typescript
type Side = "top" | "right" | "bottom" | "left";
type Spacing = "margin" | "padding";

type SpacingProp = `${Spacing}-${Side}`;
// "margin-top" | "margin-right" | ... | "padding-left"

// px 단위 검증
type PxValue = `${number}px`;
function setWidth(value: PxValue) { /* ... */ }

setWidth("100px");  // OK
setWidth("100");    // 오류: PxValue 아님
```

## 타입 안전 EventEmitter

```typescript
type Events = {
  connect: { url: string };
  disconnect: { code: number };
  message: { data: string };
};

interface TypedEmitter<T> {
  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): void;
  emit<K extends keyof T>(event: K, payload: T[K]): void;
}

// 컴파일러가 이벤트 이름과 페이로드 타입을 모두 검증
declare const emitter: TypedEmitter<Events>;
emitter.on("connect", ({ url }) => console.log(url));  // OK
emitter.emit("message", { data: "hello" });            // OK
```

## 재귀와 성능 고려

```typescript
// camelCase를 kebab-case로 변환 (재귀)
type CamelToKebab<S extends string> =
  S extends `${infer Head}${infer Tail}`
    ? Head extends Uppercase<Head>
      ? `-${Lowercase<Head>}${CamelToKebab<Tail>}`
      : `${Head}${CamelToKebab<Tail>}`
    : S;
```

재귀 템플릿 리터럴 타입은 강력하지만 컴파일 타임 비용이 높다. 프로덕션 코드에서 긴 문자열이나 깊은 재귀를 사용할 때는 TypeScript 컴파일러의 재귀 깊이 제한(~100단계)과 성능 영향을 고려해야 한다. 다음 글에서는 `infer` 키워드를 더 깊이 살펴본다.

---

**지난 글:** [매핑된 타입 — 기존 타입을 순회해 새 타입 만들기](/posts/ts-mapped-types/)

**다음 글:** [infer 키워드 — 타입 추론의 고급 활용](/posts/ts-infer-keyword/)

<br>
읽어주셔서 감사합니다. 😊
