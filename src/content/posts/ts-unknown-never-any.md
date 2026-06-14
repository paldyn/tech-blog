---
title: "unknown · never · any — 타입 계층의 끝점들"
description: "TypeScript의 unknown(top type), never(bottom type), any(탈출구) 세 가지 특수 타입의 차이, 올바른 사용 시나리오, 완전성 검사 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 4
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "unknown", "never", "any", "타입계층", "완전성검사", "타입안전성"]
featured: false
draft: false
---

[지난 글](/posts/ts-infer-keyword/)에서 `infer`로 복잡한 타입을 분해하는 패턴을 살펴봤다. 이번에는 TypeScript 타입 계층의 양 끝과 탈출구 역할을 하는 세 가지 특수 타입인 **`unknown`, `never`, `any`**를 다룬다. 이 세 타입의 차이를 정확히 이해하면 타입 안전성과 유연성 사이의 균형을 의식적으로 선택할 수 있다.

## 타입 계층 구조

TypeScript의 타입 시스템은 집합론 위에 서 있다. 모든 타입의 상위 집합(top type)과 하위 집합(bottom type)이 있다.

- **`unknown`**: top type — 모든 값을 담을 수 있는 가장 큰 집합
- **`never`**: bottom type — 원소가 하나도 없는 공집합
- **`any`**: 타입 검사기를 끄는 탈출구 — 어느 방향으로도 할당 가능

```typescript
let u: unknown = 42;       // OK
let n: number = u;         // 오류: unknown → number 직접 불가

let a: any = 42;           // OK
let n2: number = a;        // OK (any는 양방향 허용)

let nv: never = 42;        // 오류: never에는 아무것도 할당 불가
```

![타입 계층](/assets/posts/ts-unknown-never-any-hierarchy.svg)

## unknown — 안전한 최상위 타입

`unknown`은 외부에서 들어오는 데이터를 다룰 때 `any` 대신 사용해야 한다. 사용하기 전에 반드시 타입을 좁혀야 하므로, 실수로 잘못된 연산을 하는 것을 컴파일러가 방지한다.

```typescript
// JSON.parse 반환값, fetch 응답 등 외부 데이터에 적합
async function fetchUser(id: string): Promise<unknown> {
  const res = await fetch(`/users/${id}`);
  return res.json();
}

// 사용할 때 타입 좁히기 필요
const user = await fetchUser("1");
if (typeof user === "object" && user !== null && "name" in user) {
  console.log(user.name);  // OK
}
```

`try-catch`의 오류 매개변수도 TypeScript 4.0부터 기본적으로 `unknown`으로 처리된다.

```typescript
try {
  JSON.parse("invalid");
} catch (e) {
  // e: unknown (useUnknownInCatchVariables 기본값)
  if (e instanceof Error) {
    console.log(e.message);  // OK
  }
}
```

## never — 도달 불가한 타입

`never`는 절대로 값이 될 수 없는 상황을 나타낸다. 이론적으로는 공집합이므로 어떤 타입의 하위 타입이기도 하다(`never extends T`는 항상 참).

```typescript
// 함수가 절대 반환하지 않을 때
function throwError(msg: string): never {
  throw new Error(msg);
}

// 무한 루프
function infiniteLoop(): never {
  while (true) {}
}

// 조건부 타입에서 필터링
type NonNullable<T> = T extends null | undefined ? never : T;
// string | null → string (never는 유니언에서 제거됨)
```

## 완전성 검사 (Exhaustiveness Check)

`never`의 가장 실용적인 활용은 유니언 타입의 모든 경우를 처리했는지 검증하는 것이다.

```typescript
type Shape = { kind: "circle"; r: number } | { kind: "square"; side: number };

function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.r ** 2;
    case "square": return s.side ** 2;
    default:
      const exhausted: never = s;  // 새 variant 추가 시 여기서 오류
      throw new Error(`Unknown: ${exhausted}`);
  }
}
```

새로운 `Shape` variant를 추가하면 `default` 분기에서 컴파일 오류가 발생해 처리를 강제한다.

![실전 활용](/assets/posts/ts-unknown-never-any-usage.svg)

## any — 신중하게 사용하는 탈출구

`any`는 타입 검사를 완전히 비활성화한다. 한번 `any`가 섞이면 그 값과 상호작용하는 모든 곳에 `any`가 전파될 수 있다.

```typescript
// any의 전파
function process(x: any) {
  return x.foo.bar;  // 오류 없음, 런타임에 터질 수 있음
}

const result = process({});  // result: any
result.whatever.you.want;    // 오류 없음 — any가 전파됨
```

`any`가 적합한 경우는 제한적이다.

| 상황 | 권장 |
|---|---|
| 외부 API 응답 타입 불명확 | `unknown` 사용 후 좁히기 |
| JS → TS 점진적 마이그레이션 | `any` 임시 허용 후 제거 계획 수립 |
| 타입 단언으로 해결 안 될 때 | `as unknown as TargetType` |
| 제네릭 제약이 불필요하게 복잡할 때 | `any`보다 `unknown` 시도 먼저 |

## 타입 단언과의 관계

```typescript
// unknown을 특정 타입으로 강제 캐스팅
const raw: unknown = getFromAPI();
const user = raw as User;  // 개발자 책임 — 런타임 검증 없음

// 이중 단언 (위험, 최후의 수단)
const tricky = something as unknown as TargetType;
```

## noImplicitAny와 strictNullChecks

```json
{
  "compilerOptions": {
    "strict": true,           // noImplicitAny + strictNullChecks 포함
    "noImplicitAny": true,    // any 자동 추론 방지
    "useUnknownInCatchVariables": true  // catch(e)를 unknown으로
  }
}
```

`strict: true`를 활성화하면 암묵적 `any`가 오류가 되고, `catch` 블록의 오류 변수가 `unknown`이 된다. 새 프로젝트는 처음부터 `strict: true`로 시작하는 것이 강력히 권장된다. 다음 글에서는 이런 타입들을 실제로 좁히는 **타입 가드**를 살펴본다.

---

**지난 글:** [infer 키워드 — 조건부 타입 내 타입 추론](/posts/ts-infer-keyword/)

**다음 글:** [타입 가드 — 런타임 타입 좁히기 기법](/posts/ts-type-guards/)

<br>
읽어주셔서 감사합니다. 😊
