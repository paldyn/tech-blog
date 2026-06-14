---
title: "제네릭 기본값 — 타입 파라미터의 선택적 지정"
description: "TypeScript 제네릭 기본 타입 파라미터(Generic Default Type Parameters)의 선언 문법, T 결정 우선순위, 다중 기본값, 라이브러리 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "제네릭기본값", "Generic Defaults", "타입파라미터", "고급타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-generic-classes/)에서 제네릭 클래스를 살펴봤다. 인스턴스 생성 시 `T`를 명시하거나 생성자 인수에서 추론하는 방식이었다. 이번에는 한 발 더 나아가 **제네릭 기본 타입 파라미터(Generic Default Type Parameters)**를 다룬다. `T = string`처럼 `=` 뒤에 기본 타입을 붙이면, 호출자가 `T`를 생략했을 때 지정한 타입이 자동으로 사용된다. TypeScript 2.3에서 도입된 이 기능은 라이브러리 API를 더 편리하게 만드는 핵심 도구다.

## 왜 기본값이 필요한가

제네릭 없이는 코드 재사용이 어렵고, 제네릭 있으면 호출자가 타입을 일일이 지정해야 할 때가 많다. 기본값은 이 둘 사이의 균형점이다.

```typescript
// 기본값 없는 경우: 매번 타입 인수 필요
function identity<T>(value: T): T { return value; }
identity<string>("hello"); // OK
identity("hello");         // OK — 추론 가능
identity();                // Error: T를 결정할 수 없음

// 기본값 있는 경우: 생략 가능
function safeIdentity<T = string>(value?: T): T | undefined {
  return value;
}
safeIdentity();              // T = string (기본값)
safeIdentity(42);            // T = number (추론)
safeIdentity<boolean>(true); // T = boolean (명시)
```

호출자가 타입을 신경 쓰지 않아도 되면 API 표면이 단순해지고, 필요할 때만 명시하면 된다.

![제네릭 기본값 선언 문법](/assets/posts/ts-generic-defaults-syntax.svg)

## 선언 문법

함수, 인터페이스, 타입 별칭, 클래스 — 제네릭을 받는 모든 위치에 `= DefaultType`을 붙일 수 있다.

```typescript
// 함수
function createPair<A = string, B = A>(a: A, b: B): [A, B] {
  return [a, b];
}

// 인터페이스
interface Container<T = unknown> {
  value: T;
  transform<U = T>(fn: (v: T) => U): Container<U>;
}

// 타입 별칭
type Maybe<T = never> = T | null | undefined;

// 클래스
class EventEmitter<Events extends Record<string, unknown> = Record<string, unknown>> {
  emit<K extends keyof Events>(event: K, data: Events[K]): void { /* ... */ }
}
```

## T 결정 우선순위

TypeScript가 `T`를 결정하는 순서는 명확하다.

```typescript
// 우선순위: ① 명시적 타입 인수 > ② 추론 > ③ 기본값
function wrap<T = string>(value?: T) {
  return { value };
}

const a = wrap<boolean>(true);   // ① T = boolean
const b = wrap(42);              // ② T = number (추론)
const c = wrap("hi");            // ② T = string (추론)
const d = wrap();                // ③ T = string (기본값)
```

중요한 점은 **추론이 가능하면 기본값이 사용되지 않는다**는 것이다. `wrap("hi")`에서 `T`는 `string`이지만 기본값이 아닌 인수에서 추론된 것이다.

## 다중 기본값과 파라미터 참조

여러 타입 파라미터가 있을 때, 뒤쪽 파라미터는 앞쪽 파라미터를 기본값으로 참조할 수 있다.

```typescript
type Pair<A = string, B = A> = {
  first: A;
  second: B;
};

type P1 = Pair;                   // Pair<string, string>
type P2 = Pair<number>;           // Pair<number, number> — B = A = number
type P3 = Pair<number, boolean>;  // Pair<number, boolean>
```

`B = A`처럼 앞쪽 파라미터를 기본값으로 쓸 수 있다. 단, 뒤쪽이 앞쪽을 참조할 수 있지만 앞쪽이 뒤쪽을 참조하는 것은 불가능하다.

## 순서 제약 — 기본값은 항상 뒤에

기본값이 있는 파라미터 뒤에 기본값 없는 파라미터를 둘 수 없다. JavaScript 함수의 기본 인수와 같은 규칙이다.

```typescript
// ✓ 유효
type Ok<A, B = string> = [A, B];

// ✗ 오류: 기본값 없는 B가 기본값 있는 A 뒤에 옴
// type Bad<A = string, B> = [A, B];
```

## 제약(Constraint)과 기본값 함께 쓰기

`extends`로 제약을 주면서 기본값도 제공할 수 있다. 기본값은 제약을 만족해야 한다.

```typescript
interface Node {
  id: string;
}

// T는 Node를 만족해야 하고, 기본값은 Node 자체
function findById<T extends Node = Node>(
  items: T[],
  id: string
): T | undefined {
  return items.find(item => item.id === id);
}

// T 생략 시 Node로 동작, 명시하면 더 구체적인 타입 사용
findById(nodes, "1");                 // T = Node
findById<UserNode>(userNodes, "1");  // T = UserNode
```

기본값이 제약을 위반하면 즉시 컴파일 오류가 발생한다.

```typescript
// ✗ 오류: number는 Node를 만족하지 않음
// function bad<T extends Node = number>() {}
```

## 실전 패턴 — React 제네릭 컴포넌트

리액트에서 `forwardRef`나 커스텀 훅의 타입 파라미터에 기본값을 주면 간편하게 사용할 수 있다.

```typescript
// 기본값으로 안전한 커스텀 훅
function useLocalStorage<T = string>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const [stored, setStored] = React.useState<T>(initialValue);
  return [stored, setStored];
}

// T를 명시할 필요 없이 사용
const [name, setName] = useLocalStorage("name", "");   // T = string
const [count, setCount] = useLocalStorage("count", 0); // T = number
```

![T 결정 우선순위와 다중 기본값](/assets/posts/ts-generic-defaults-usage.svg)

## 라이브러리 설계 관점

오픈소스 라이브러리에서 기본값은 하위 호환성을 유지하면서 새 파라미터를 추가할 때 매우 유용하다.

```typescript
// v1: 기존 API
interface Store<S> { getState(): S; }

// v2: 새 파라미터 추가 — 기존 코드 그대로 동작
interface Store<S, A = { type: string }> {
  getState(): S;
  dispatch(action: A): void;
}

// 기존 코드: Store<AppState>는 여전히 유효 (A = { type: string })
```

기본값을 제공하면 기존 사용자 코드를 수정하지 않고 API를 확장할 수 있다.

## 핵심 정리

제네릭 기본 타입 파라미터는 "타입 인수를 생략해도 안전하게 동작하게 하는" 기능이다. `T = Default` 형태로 선언하고, 호출 시 T는 명시 → 추론 → 기본값 순으로 결정된다. 뒤쪽 파라미터는 앞쪽을 참조할 수 있고, 기본값 있는 파라미터는 항상 목록 뒤에 위치해야 한다. 라이브러리 API 설계나 공용 컴포넌트 타이핑에서 적극 활용하면 사용 편의성이 크게 높아진다.

---

**지난 글:** [제네릭 클래스 — 타입 파라미터를 가진 클래스](/posts/ts-generic-classes/)

**다음 글:** [NoInfer 유틸리티 — 제네릭 추론 제어](/posts/ts-noinfer-utility/)

<br>
읽어주셔서 감사합니다. 😊
