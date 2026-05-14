---
title: "interface vs type — 차이와 선택 기준"
description: "TypeScript의 interface와 type alias 차이를 선언 병합, 확장 방식, 표현 가능 범위 관점에서 완전히 정리합니다. 언제 interface를 쓰고 언제 type을 써야 하는지 실용적 기준을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "interface", "type alias", "선언병합", "확장", "설계패턴"]
featured: false
draft: false
---

[지난 글](/posts/ts-union-intersection-literal/)에서 유니언·인터섹션·리터럴 타입을 살펴봤다. TypeScript를 처음 배울 때 가장 자주 받는 질문 중 하나가 "`interface`와 `type` 중 무엇을 써야 하나요?"다. 두 방식은 비슷해 보이지만 중요한 차이가 있고, 팀 코드베이스에서 일관성 있게 사용하려면 각각의 특성을 정확히 알아야 한다.

## 기본 문법 비교

두 방식 모두 객체 형태를 선언하는 데 사용할 수 있다.

```typescript
// interface 선언
interface User {
  id:   number;
  name: string;
  email?: string;  // 옵셔널
  readonly token: string; // 읽기 전용
}

// type alias 선언 — 거의 동일
type User = {
  id:   number;
  name: string;
  email?: string;
  readonly token: string;
};
```

기본 객체 형태 선언에서 두 방식의 동작은 사실상 동일하다. 차이가 드러나는 것은 더 복잡한 패턴에서다.

## 핵심 차이 1 — 선언 병합

`interface`는 같은 이름으로 **여러 번 선언**하면 자동으로 병합된다. `type`은 같은 이름을 두 번 선언하면 오류다.

![interface vs type — 기능 비교](/assets/posts/ts-interface-vs-type-comparison.svg)

```typescript
// interface — 병합 가능
interface Window {
  myApp: { version: string };
}
// 기존 Window 타입에 myApp이 추가됨
declare const win: Window;
win.myApp.version; // string ✅

// type — 재선언 불가
type Config = { host: string };
type Config = { port: number }; // TS2300 ❌ 중복 식별자
```

선언 병합은 주로 두 가지 상황에서 유용하다.
1. 라이브러리의 전역 타입(`Window`, `Document`, `HTMLElement` 등)에 속성 추가
2. npm 패키지가 타입 선언 파일에서 `namespace`를 확장

## 핵심 차이 2 — 확장 방식

`interface`는 `extends`로, `type`은 인터섹션(`&`)으로 확장한다.

```typescript
// interface extends
interface Animal { name: string }
interface Pet extends Animal { owner: string }

// type intersection
type Animal = { name: string }
type Pet    = Animal & { owner: string }
```

두 방식 모두 동작하지만, `extends`는 충돌 감지에서 차이를 보인다.

```typescript
interface A { x: string }
interface B extends A { x: number } // TS2430 ❌ string ≠ number

type C = { x: string }
type D = C & { x: number }          // 오류 없음 — x: never로 처리
```

`extends`는 속성 타입 충돌을 즉시 잡아주므로 명시적 상속 관계에서 더 안전하다.

## 핵심 차이 3 — 표현 가능 범위

`type`은 객체 이외의 모든 타입 표현이 가능하다. `interface`는 객체 형태만 선언할 수 있다.

```typescript
// type만 가능한 것들
type ID        = string | number;          // 유니언
type NullableStr = string | null;          // null 포함 유니언
type Callback  = (n: number) => void;      // 함수 타입 직접 선언
type Matrix    = number[][];               // 배열·튜플 타입 별칭
type IsString<T> = T extends string ? true : false; // 조건부 타입
type Keys<T>   = keyof T;                  // 유틸리티 타입 조합
```

![선언 병합 실전 — 전역 타입 확장](/assets/posts/ts-interface-vs-type-merging.svg)

`interface`로는 이런 타입을 직접 표현할 수 없다. 함수 타입을 `interface`로 선언하려면 호출 시그니처 문법을 사용해야 한다.

```typescript
// 함수 타입을 interface로 선언하는 방법
interface Callback {
  (n: number): void;
}
// 아래와 동일하지만 type 방식이 더 간결
type Callback = (n: number) => void;
```

## 성능 차이

TypeScript 컴파일러 팀이 내부적으로 권고하는 사항이 있다. 큰 유니언이 아닌 단순 객체 타입이라면 `interface`가 **타입 검사 성능**이 약간 더 좋다. `interface`는 캐시를 통해 참조 동등성으로 비교되지만, `type`의 인터섹션은 매번 평탄화되기 때문이다. 그러나 실제 프로젝트에서 체감할 수 있는 차이가 나는 경우는 극히 드물다.

## 선택 기준 — 실용적 가이드

| 상황 | 권장 |
|------|------|
| 클래스가 구현(`implements`)할 계약 | `interface` |
| 라이브러리 공개 API 타입 | `interface` (병합 확장 허용) |
| React `props` 타입 | 팀 컨벤션 통일 (두 방식 모두 무방) |
| 유니언·함수·튜플 타입 | `type` |
| 조건부·매핑 타입 | `type` |
| 기존 타입 조합 | `type` & 인터섹션 |

```typescript
// 공개 API — interface 선호
export interface FetchOptions {
  timeout: number;
  headers?: Record<string, string>;
}

// 내부 유니언 상태 — type 선호
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: unknown }
  | { status: "error"; error: Error };
```

가장 중요한 원칙은 **팀 내 일관성**이다. `interface`와 `type`을 혼용하면 코드 리뷰 시 불필요한 논쟁이 생긴다. 팀 컨벤션을 정하고 ESLint `@typescript-eslint/consistent-type-definitions` 규칙으로 강제하는 것을 권장한다.

---

**지난 글:** [유니언·인터섹션·리터럴 타입](/posts/ts-union-intersection-literal/)

**다음 글:** [제네릭 기초 — 재사용 가능한 타입 추상화](/posts/ts-generics-basics/)

<br>
읽어주셔서 감사합니다. 😊
