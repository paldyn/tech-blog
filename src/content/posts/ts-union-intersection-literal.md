---
title: "유니언·인터섹션·리터럴 타입"
description: "TypeScript의 유니언 타입(A|B), 인터섹션 타입(A&B), 리터럴 타입, 판별 유니언 패턴, 템플릿 리터럴 타입을 예제 중심으로 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 6
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "유니언타입", "인터섹션타입", "리터럴타입", "판별유니언", "타입시스템"]
featured: false
draft: false
---

[지난 글](/posts/ts-basic-types/)에서 TypeScript의 기본 타입과 타입 좁히기를 살펴봤다. 이번에는 여러 타입을 **조합**하는 방법인 유니언 타입, 인터섹션 타입, 리터럴 타입을 다룬다. 이 세 가지를 제대로 이해하면 복잡한 비즈니스 로직을 타입 수준에서 표현하는 것이 가능해진다.

## 유니언 타입 (A | B)

유니언 타입은 "A 또는 B 중 하나"를 의미한다. 집합 이론의 합집합에 해당한다.

```typescript
// 기본 유니언
type StringOrNumber = string | number;

function format(val: StringOrNumber): string {
  if (typeof val === "string") {
    return val.trim();
  }
  return val.toFixed(2);
}

// 여러 타입의 유니언
type ID = string | number | bigint;
```

유니언 타입 값에서는 **모든 멤버 타입에 공통으로 존재하는 속성과 메서드만** 바로 접근할 수 있다. 특정 타입의 메서드를 사용하려면 타입 좁히기가 필요하다.

## 인터섹션 타입 (A & B)

인터섹션 타입은 "A이면서 동시에 B"를 의미한다. 집합 이론의 교집합에 해당하며, 두 타입의 모든 속성을 합친 새 타입을 만든다.

![유니언 vs 인터섹션 타입](/assets/posts/ts-union-intersection-literal-venn.svg)

```typescript
interface Named { name: string }
interface Aged  { age:  number }

type Person = Named & Aged;
// Person은 name과 age를 모두 가져야 한다

const alice: Person = { name: "Alice", age: 30 }; // ✅

// 믹스인 패턴에서 자주 사용
type AdminUser = User & { permissions: string[] };
```

인터섹션은 주로 여러 interface의 기능을 조합하거나, 기존 타입에 속성을 추가할 때 사용한다.

## 리터럴 타입

리터럴 타입은 특정 값 자체를 타입으로 사용한다. 문자열, 숫자, 불리언 리터럴 모두 타입이 될 수 있다.

```typescript
// 문자열 리터럴 타입
type Direction = "up" | "down" | "left" | "right";
type Method    = "GET" | "POST" | "PUT" | "DELETE";

// 숫자 리터럴 타입
type DiceRoll = 1 | 2 | 3 | 4 | 5 | 6;

// 불리언 리터럴 (거의 사용하지 않지만 가능)
type AlwaysTrue = true;
```

리터럴 타입은 함수 매개변수에 허용 가능한 값의 집합을 명시할 때 특히 유용하다.

```typescript
function move(direction: Direction, steps: number) {
  // direction은 "up" | "down" | "left" | "right" 중 하나
}

move("up", 3);     // ✅
move("diagonal");  // TS2345 ❌
```

## 판별 유니언 (Discriminated Union)

판별 유니언은 각 멤버 타입이 **공통된 리터럴 속성(판별자, discriminant)**을 가지는 유니언이다. TypeScript의 타입 좁히기와 완벽히 결합하여 타입 안전한 분기 처리를 가능하게 한다.

![리터럴 타입과 판별 유니언](/assets/posts/ts-union-intersection-literal-code.svg)

```typescript
// kind가 판별자
type NetworkRequest =
  | { kind: "loading" }
  | { kind: "success"; data: string }
  | { kind: "error";   message: string };

function render(state: NetworkRequest) {
  switch (state.kind) {
    case "loading":
      return "<Spinner />";
    case "success":
      return state.data;     // data: string으로 자동 좁혀짐
    case "error":
      return state.message;  // message: string으로 자동 좁혀짐
  }
}
```

판별자는 `kind`, `type`, `tag` 같은 이름을 주로 사용하며, 항상 리터럴 타입이어야 한다. 이 패턴은 Redux 액션, API 상태 머신, AST 노드 등에서 광범위하게 쓰인다.

## 템플릿 리터럴 타입

TypeScript 4.1부터 템플릿 리터럴 타입이 도입되었다. 리터럴 타입을 문자열로 조합하여 새 타입을 만든다.

```typescript
type EventName = `on${Capitalize<string>}`;
// "onClick" | "onChange" | ... (onXxx 패턴)

type CSSUnit = "px" | "em" | "rem" | "%";
type CSSValue = `${number}${CSSUnit}`;
// "16px" | "1.5em" | "100%" 등

// 기존 타입에서 새 타입 파생
type UpperKeys<T> = {
  [K in keyof T as Uppercase<string & K>]: T[K];
};

type User = { name: string; age: number };
type UpperUser = UpperKeys<User>;
// { NAME: string; AGE: number }
```

## 유니언 타입의 분배 법칙

유니언 타입이 제네릭 타입 매개변수로 전달되면 각 멤버에 **분배(distribute)**된다.

```typescript
type ToArray<T> = T extends any ? T[] : never;

type Result = ToArray<string | number>;
// string[] | number[] (분배됨)
// [string | number][] 이 아님
```

이 동작은 뒤에서 다룰 조건부 타입(Conditional Types)의 핵심 메커니즘이다.

## 실전 패턴 — 옵셔널 속성 vs 유니언

```typescript
// 옵셔널 — age가 있을 수도 없을 수도
interface UserOptional { name: string; age?: number }

// 유니언 — 둘 중 하나의 형태
type UserUnion =
  | { name: string; age: number }   // 나이 있는 사용자
  | { name: string };               // 나이 없는 사용자

// 유니언 방식이 더 명확한 경우:
// 나이가 있을 때만 사용할 수 있는 기능이 있다면
function canDrink(user: UserUnion): boolean {
  if ("age" in user) {
    return user.age >= 19; // age: number 보장
  }
  return false;
}
```

옵셔널 속성과 유니언 중 어느 것을 사용할지는 "두 경우가 서로 다른 구조를 가지는가"로 판단한다. 다른 구조라면 유니언이 더 안전하다.

---

**지난 글:** [TypeScript 기본 타입 완전 정복](/posts/ts-basic-types/)

**다음 글:** [interface vs type — 차이와 선택 기준](/posts/ts-interface-vs-type/)

<br>
읽어주셔서 감사합니다. 😊
