---
title: "readonly와 const 단언 — 불변 타입 설계"
description: "TypeScript readonly 수정자, ReadonlyArray, Readonly 유틸리티, as const 리터럴 타입 좁힘을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 5
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "readonly", "as const", "불변", "const단언", "리터럴타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-index-signatures/)에서 인덱스 시그니처를 살펴봤다. 이번에는 TypeScript의 불변(immutable) 타입 도구인 **`readonly`와 `as const`**를 다룬다. 데이터가 변경되지 않음을 타입 수준에서 명시하면 버그를 줄이고 코드 의도를 명확히 할 수 있다.

## readonly 프로퍼티

```typescript
interface Config {
  readonly host: string;
  readonly port: number;
  timeout: number; // mutable
}

const config: Config = { host: "localhost", port: 3000, timeout: 5000 };
config.host = "example.com"; // TS2540 ❌ readonly 프로퍼티
config.timeout = 10000;      // OK
```

`readonly`는 컴파일 타임 전용이다. 런타임에는 실제로 변경을 막지 않는다 — 단지 TypeScript가 경고를 줄 뿐이다.

## ReadonlyArray

배열 변경 메서드를 막으려면 `ReadonlyArray<T>` 또는 `readonly T[]`를 사용한다.

```typescript
function process(items: readonly string[]) {
  items.push("new");    // TS2339 ❌ push는 readonly 배열에 없음
  items[0] = "changed"; // TS2542 ❌ 인덱스 할당 불가
  return items.map(s => s.toUpperCase()); // OK — 새 배열 반환
}
```

![readonly vs const](/assets/posts/ts-readonly-const-assertions-readonly.svg)

## Readonly 유틸리티 타입

`Readonly<T>`는 타입의 모든 프로퍼티를 `readonly`로 만든다.

```typescript
interface User {
  id:    number;
  name:  string;
  email: string;
}

type ReadonlyUser = Readonly<User>;
// { readonly id: number; readonly name: string; readonly email: string }

// 깊은 불변성은 별도 처리 필요 (중첩 객체는 적용 안 됨)
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
```

## as const — 리터럴 타입 좁힘

`as const`는 값의 타입을 가능한 한 구체적인 리터럴 타입으로 좁힌다.

```typescript
// as const 없음
const config = {
  env: "production",  // string
  port: 3000,         // number
};

// as const 있음
const config = {
  env: "production",  // "production" (리터럴)
  port: 3000,         // 3000 (리터럴)
} as const;
// 모든 프로퍼티가 readonly + 리터럴 타입
```

![as const 리터럴 타입 좁힘](/assets/posts/ts-readonly-const-assertions-as-const.svg)

## 배열에서 유니언 만들기

`as const`의 가장 강력한 용도 중 하나다.

```typescript
const COLORS = ["red", "green", "blue"] as const;
// COLORS: readonly ["red", "green", "blue"]

type Color = typeof COLORS[number]; // "red" | "green" | "blue"

function setColor(color: Color) { /* ... */ }
setColor("red");    // OK
setColor("yellow"); // TS2345 ❌
```

배열을 `as const`로 선언하고 `typeof arr[number]`로 유니언 타입을 추출하면, 배열과 타입이 항상 동기화된다.

## 열거형 대안으로서의 as const

`enum`보다 가볍게 쓸 수 있는 패턴이다.

```typescript
const Direction = {
  Up:    "UP",
  Down:  "DOWN",
  Left:  "LEFT",
  Right: "RIGHT",
} as const;

type Direction = typeof Direction[keyof typeof Direction];
// "UP" | "DOWN" | "LEFT" | "RIGHT"
```

`enum`과 달리 `as const` 객체는 일반 JavaScript 객체로 컴파일되며, 트리 쉐이킹이 잘 작동한다.

---

**지난 글:** [인덱스 시그니처 — 동적 키 타입 처리](/posts/ts-index-signatures/)

**다음 글:** [keyof와 typeof — 타입에서 키를 추출하다](/posts/ts-keyof-typeof/)

<br>
읽어주셔서 감사합니다. 😊
