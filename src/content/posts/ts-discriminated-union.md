---
title: "판별 유니언 — 타입 안전한 상태 모델링"
description: "TypeScript 판별 유니언(Discriminated Union)의 구조, 판별자 조건, switch 완전성 검사, 액션 패턴, 상태 머신 모델링까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 6
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "판별유니언", "discriminated-union", "상태모델링", "완전성검사", "리듀서"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-guards/)에서 타입 가드로 런타임에 타입을 좁히는 방법을 배웠다. 이번에는 TypeScript의 가장 강력한 패턴 중 하나인 **판별 유니언(Discriminated Union)**을 살펴본다. 공통 리터럴 타입 필드를 통해 각 변체(variant)를 구분함으로써, 컴파일러가 완전성을 검사하고 각 분기에서 정확한 타입을 자동으로 제공한다.

## 판별 유니언의 세 가지 요소

판별 유니언이 되려면 세 조건을 갖춰야 한다.

1. 여러 타입의 **유니언**
2. 각 타입에 **공통 필드(판별자)**가 있어야 함
3. 판별자의 값이 각 타입에서 **고유한 리터럴 타입**

```typescript
// 올바른 판별 유니언 — 세 조건 충족
type Circle   = { kind: "circle";   radius: number };
type Square   = { kind: "square";   side: number };
type Triangle = { kind: "triangle"; base: number; height: number };

type Shape = Circle | Square | Triangle;
```

`kind` 필드가 판별자다. 각 타입의 `kind` 값이 서로 다른 리터럴 타입이므로 컴파일러가 `kind`를 보고 어떤 타입인지 정확히 파악한다.

## switch로 자동 좁히기

```typescript
function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;  // shape: Circle
    case "square":
      return shape.side ** 2;              // shape: Square
    case "triangle":
      return 0.5 * shape.base * shape.height;  // shape: Triangle
  }
}
```

각 `case` 블록 내에서 `shape`는 해당 타입으로 자동으로 좁혀진다. `shape.radius`는 `Circle` 케이스에서만 접근할 수 있다.

![판별 유니언 패턴](/assets/posts/ts-discriminated-union-pattern.svg)

## 비동기 상태 모델링

판별 유니언은 UI 상태 관리에서 특히 유용하다.

```typescript
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

function UserProfile({ state }: { state: AsyncState<User> }) {
  switch (state.status) {
    case "idle":    return <p>시작하려면 버튼을 누르세요</p>;
    case "loading": return <Spinner />;
    case "success": return <Profile user={state.data} />;
    case "error":   return <ErrorMsg error={state.error} />;
  }
}
```

`status: "success"` 케이스에서만 `state.data`에 접근할 수 있고, `status: "error"` 케이스에서만 `state.error`에 접근할 수 있다.

## 완전성 검사 (Exhaustiveness Check)

```typescript
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

function describe(shape: Shape): string {
  switch (shape.kind) {
    case "circle":   return `반지름 ${shape.radius}`;
    case "square":   return `변 ${shape.side}`;
    case "triangle": return `밑변 ${shape.base}`;
    default:
      return assertNever(shape);  // Triangle 추가 빠뜨리면 오류
  }
}
```

새로운 `Shape` 변체를 추가했을 때 `switch` 처리를 빠뜨리면 `default` 분기에서 컴파일 오류가 발생한다.

## Redux 스타일 액션

```typescript
type CounterAction =
  | { type: "INCREMENT"; amount: number }
  | { type: "DECREMENT"; amount: number }
  | { type: "RESET" };

function counterReducer(state: number, action: CounterAction): number {
  switch (action.type) {
    case "INCREMENT": return state + action.amount;
    case "DECREMENT": return state - action.amount;
    case "RESET":     return 0;
  }
}
```

![완전성 검사 패턴](/assets/posts/ts-discriminated-union-exhaustive.svg)

## 판별자 조건과 흔한 실수

좋은 판별자가 되려면 리터럴 타입이어야 한다.

```typescript
// 나쁜 예: boolean은 두 케이스만 구분
type BadUnion =
  | { isSuccess: true;  data: string }
  | { isSuccess: false; error: Error };
// boolean 대신 리터럴 문자열 사용 권장

// 나쁜 예: 선택적 속성은 판별자 역할 불가
type AlsoBad =
  | { kind?: "a"; x: number }
  | { kind?: "b"; y: string };
// kind가 undefined일 수 있어서 구분이 불명확

// 좋은 예: 필수 리터럴 속성
type Good =
  | { kind: "a"; x: number }
  | { kind: "b"; y: string };
```

## 중첩 판별 유니언

```typescript
type ApiResponse<T> =
  | { ok: true;  status: 200; body: T }
  | { ok: false; status: 400; message: string }
  | { ok: false; status: 401; reason: "unauthorized" }
  | { ok: false; status: 500; trace: string };

function handleResponse<T>(res: ApiResponse<T>) {
  if (res.ok) {
    // res: { ok: true; status: 200; body: T }
    process(res.body);
  } else {
    switch (res.status) {
      case 400: showError(res.message); break;
      case 401: redirect("/login"); break;
      case 500: reportError(res.trace); break;
    }
  }
}
```

판별 유니언은 "불가능한 상태를 표현 불가능하게 만들기(Making Impossible States Impossible)" 원칙의 핵심 도구다. 상태 필드들이 서로 독립적으로 존재할 때 발생하는 비일관적 조합을 타입 수준에서 원천 차단한다. 다음 글에서는 TypeScript의 모듈 시스템과 네임스페이스를 살펴본다.

---

**지난 글:** [타입 가드 — 런타임 타입 좁히기 기법](/posts/ts-type-guards/)

**다음 글:** [모듈과 네임스페이스 — TypeScript 코드 구조화](/posts/ts-modules-namespace/)

<br>
읽어주셔서 감사합니다. 😊
