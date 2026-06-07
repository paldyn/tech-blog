---
title: "NoInfer 유틸리티 — 제네릭 추론 사이트 제어"
description: "TypeScript 5.4에서 도입된 NoInfer<T> 유틸리티 타입의 동작 원리, T 추론 제어, 실전 패턴(초기값 설정, 이벤트 핸들러, 배열 기본값)을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "NoInfer", "제네릭", "타입추론", "TS5.4", "유틸리티타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-generic-defaults/)에서 타입 파라미터에 기본값을 주는 방법을 배웠다. 이번에는 반대 방향의 문제를 다룬다. **"이 위치에서는 T를 추론하지 말아라"**라고 TypeScript에게 지시하는 `NoInfer<T>` 유틸리티다. TypeScript 5.4에서 내장 유틸리티로 추가됐으며, 제네릭 추론이 여러 위치에서 일어날 때 생기는 의도치 않은 타입 확장을 막아준다.

## 문제: 여러 위치에서의 T 추론

TypeScript는 함수 인수의 여러 위치를 동시에 보며 `T`를 추론한다. 이것이 때로는 원하지 않는 결과를 낳는다.

```typescript
function setInitialValue<T>(items: T[], initial: T): void {
  // items[0] = initial; 같은 작업
}

setInitialValue(["a", "b"], 0);
// 오류가 나야 할 것 같지만 — 오류 없음!
// T = string | number 로 확장되어 버림
```

`items`에서 `T = string`을, `initial`에서 `T = number`를 추론한 뒤 이를 합쳐 `T = string | number`로 결정한다. 의도는 "`items`에서 T를 결정하고 `initial`은 그 T에 맞는지 검사"였지만, TypeScript는 두 위치를 동등하게 취급한다.

![NoInfer 없을 때의 문제](/assets/posts/ts-noinfer-utility-problem.svg)

## 해결: NoInfer\<T\>

`NoInfer<T>`로 감싸면 해당 위치는 T 추론 사이트에서 제외된다. 타입 검사는 정상적으로 수행되지만, T를 결정하는 데 기여하지 않는다.

```typescript
function setInitialValue<T>(items: T[], initial: NoInfer<T>): void {
  // ...
}

setInitialValue(["a", "b"], 0);
// ✗ 오류: number는 string에 할당 불가 (의도한 동작!)

setInitialValue(["a", "b"], "z");
// ✓ 정상: T = string, initial: string
```

이제 `T`는 `items: T[]`에서만 추론되고, `initial: NoInfer<T>`는 결정된 T로 타입 검사만 받는다.

![NoInfer 해결책과 동작 원리](/assets/posts/ts-noinfer-utility-solution.svg)

## 동작 원리

TypeScript 내부적으로 `NoInfer<T>`는 `intrinsic` 타입이다. 이는 컴파일러가 특별하게 처리하는 내장 타입을 의미하며, 런타임에는 아무 영향이 없다.

```typescript
// lib.d.ts 내부 선언
type NoInfer<T> = intrinsic;
```

`intrinsic` 키워드는 타입 레벨에서만 동작하는 TypeScript 전용 개념이다. `Uppercase<S>`, `Lowercase<S>` 같은 인트린직 문자열 타입과 같은 범주다. 사용자 코드에서는 `intrinsic`을 직접 쓸 수 없다.

## 실전 패턴 1: 배열 첫 번째 요소 기본값

```typescript
// items에서 T를 결정하고, fallback은 그 T 타입이어야 함
function firstOrDefault<T>(items: T[], fallback: NoInfer<T>): T {
  return items.length > 0 ? items[0] : fallback;
}

const result1 = firstOrDefault([1, 2, 3], 0);     // T = number ✓
const result2 = firstOrDefault(["a", "b"], "x");   // T = string ✓
const result3 = firstOrDefault([1, 2, 3], "x");    // ✗ 오류: string은 number 아님
```

## 실전 패턴 2: 이벤트 핸들러 타입 제한

```typescript
type EventMap = {
  click: MouseEvent;
  keydown: KeyboardEvent;
};

function addEventListener<K extends keyof EventMap>(
  type: K,
  handler: (event: NoInfer<EventMap[K]>) => void
): void {
  // ...
}

// type에서 K를 추론, handler의 매개변수 타입은 추론에 참여 X
addEventListener("click", (e) => {
  // e: MouseEvent — 정확히 추론됨
  console.log(e.clientX);
});
```

## 실전 패턴 3: 상태 머신 초기 상태

```typescript
type StateMachine<S extends string> = {
  states: S[];
  initial: NoInfer<S>;  // states에서 S를 결정 후 검사만
  transitions: Partial<Record<S, S>>;
};

const machine: StateMachine<"idle" | "loading" | "done"> = {
  states: ["idle", "loading", "done"],
  initial: "idle",        // ✓
  // initial: "error",    // ✗ 오류: "error"는 S에 없음
  transitions: { idle: "loading", loading: "done" },
};
```

## 5.4 이전 우회책 비교

`NoInfer<T>`가 없던 시절에는 추론을 차단하기 위한 트릭을 사용했다.

```typescript
// 방법 1: [T][0] 패턴 (추론 depth 추가)
function old1<T>(items: T[], fallback: [T][0]): T { return items[0] ?? fallback; }

// 방법 2: T & {} 또는 T & Record<never, never>
function old2<T>(items: T[], fallback: T & {}): T { return items[0] ?? fallback; }

// 방법 3: 더미 제약 추가
function old3<T, U extends T = T>(items: T[], fallback: U): T { return items[0] ?? fallback; }

// 5.4+: NoInfer (명확하고 의도가 드러남)
function modern<T>(items: T[], fallback: NoInfer<T>): T { return items[0] ?? fallback; }
```

`NoInfer<T>`는 의도를 명시적으로 드러내므로 코드 가독성이 훨씬 높다.

## 중첩과 복합 사용

`NoInfer<T>`는 복잡한 타입 안에서도 작동한다.

```typescript
// 배열 안의 NoInfer
function fill<T>(length: number, value: NoInfer<T>, sample: T[]): T[] {
  return Array.from({ length }, () => value);
}

// 객체 안의 NoInfer
type Config<T> = {
  source: T[];
  default: NoInfer<T>;
  transform?: (item: NoInfer<T>) => string;
};
```

단, `NoInfer<NoInfer<T>>`처럼 중첩 사용은 의미가 없다 (동일하게 동작).

## 핵심 정리

`NoInfer<T>`는 "이 위치에서는 T를 추론하지 않되, T 타입으로는 검사해 달라"는 요청이다. TypeScript 5.4에서 내장 유틸리티로 추가되었고, 이전에는 `[T][0]`이나 `T & {}` 같은 트릭으로 우회했다. 함수 인수 여러 곳에서 동시에 T가 추론될 때 의도치 않은 유니언 확장을 막는 핵심 도구다.

---

**지난 글:** [제네릭 기본값 — 타입 파라미터의 선택적 지정](/posts/ts-generic-defaults/)

**다음 글:** [분산성과 공변·반변 — TypeScript의 타입 호환성 방향](/posts/ts-variance/)

<br>
읽어주셔서 감사합니다. 😊
