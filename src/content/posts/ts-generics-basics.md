---
title: "제네릭 기초 — 재사용 가능한 타입 추상화"
description: "TypeScript 제네릭의 핵심 개념, 함수·인터페이스·클래스의 제네릭 선언, 타입 매개변수 추론, 기본값 설정, 다중 타입 매개변수 활용을 예제 중심으로 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 8
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "제네릭", "타입매개변수", "타입추론", "재사용성", "추상화"]
featured: false
draft: false
---

[지난 글](/posts/ts-interface-vs-type/)에서 `interface`와 `type`의 차이를 살펴봤다. 이번에는 TypeScript에서 가장 강력한 기능 중 하나인 **제네릭(Generics)**을 다룬다. 제네릭을 이해하면 `any`를 사용하지 않고도 다양한 타입을 처리하는 재사용 가능한 함수와 자료구조를 만들 수 있다.

## 제네릭이 필요한 이유

배열에서 첫 번째 요소를 반환하는 함수를 생각해보자. 제네릭 없이는 타입별로 함수를 복제해야 한다.

![제네릭 — 타입을 매개변수로 추상화](/assets/posts/ts-generics-basics-concept.svg)

`T`라는 타입 매개변수를 도입하면, 하나의 함수 정의로 모든 타입의 배열에서 첫 번째 요소를 꺼낼 수 있다. TypeScript는 인자로부터 `T`를 추론하므로 대부분의 경우 명시적으로 타입을 지정할 필요가 없다.

## 제네릭 함수 — 타입 추론

```typescript
function identity<T>(arg: T): T {
  return arg;
}

// T는 인자로부터 추론
const n = identity(42);     // T = number, n: number
const s = identity("hello"); // T = string, s: string

// 명시적으로 지정하는 경우 (추론이 불가능할 때)
const arr = identity<string[]>([]); // T = string[]
```

화살표 함수에서는 JSX 충돌을 피하기 위해 `<T,>` 또는 `<T extends unknown>` 패턴을 사용하기도 한다.

```typescript
// tsx 파일에서 화살표 함수 제네릭
const wrap = <T,>(val: T): { value: T } => ({ value: val });
```

## 제네릭 인터페이스와 타입

```typescript
// 제네릭 인터페이스
interface Box<T> {
  value: T;
  transform<U>(fn: (val: T) => U): Box<U>;
}

// 제네릭 타입 별칭
type Result<T, E = Error> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

// 사용
function divide(a: number, b: number): Result<number> {
  if (b === 0) {
    return { ok: false, error: new Error("Division by zero") };
  }
  return { ok: true, value: a / b };
}

const res = divide(10, 2);
if (res.ok) {
  console.log(res.value); // number: 5
} else {
  console.error(res.error.message);
}
```

`Result<T, E = Error>` 패턴은 예외 없이 오류를 값으로 처리하는 함수형 스타일에서 자주 사용된다.

## 제네릭 클래스

```typescript
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items.at(-1);
  }

  get size(): number {
    return this.items.length;
  }
}

const numStack = new Stack<number>();
numStack.push(1);
numStack.push(2);
numStack.pop(); // number | undefined
```

`Stack<number>`를 만들면 `push()`에는 `number`만 넣을 수 있고, `pop()`은 `number | undefined`를 반환한다. 타입 안전성이 자동으로 보장된다.

## 제네릭 기본값과 다중 타입 매개변수

![제네릭 기본값과 다중 타입 매개변수](/assets/posts/ts-generics-basics-defaults.svg)

기본값을 지정하면 타입 인자를 생략할 수 있어 API 사용이 간결해진다.

```typescript
// 이벤트 이미터 타입 — 이벤트 맵 기본값
class EventEmitter<Events extends Record<string, any> = Record<string, unknown>> {
  private handlers: Partial<{ [K in keyof Events]: ((e: Events[K]) => void)[] }> = {};

  on<K extends keyof Events>(event: K, handler: (e: Events[K]) => void): void {
    (this.handlers[event] ??= []).push(handler);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.handlers[event]?.forEach(h => h(data));
  }
}

// 구체적 이벤트 맵 지정
interface AppEvents {
  userLogin:  { userId: number };
  pageView:   { path: string };
}

const emitter = new EventEmitter<AppEvents>();
emitter.on("userLogin", ({ userId }) => console.log(userId));
emitter.emit("userLogin", { userId: 1 }); // 타입 안전
```

## 내장 제네릭 유틸리티 타입

TypeScript는 자주 사용되는 변환 패턴을 내장 유틸리티 타입으로 제공한다.

```typescript
interface User {
  id:    number;
  name:  string;
  email: string;
}

// Partial<T> — 모든 속성을 선택적으로
type UserUpdate = Partial<User>;
// { id?: number; name?: string; email?: string }

// Required<T> — 모든 선택적 속성을 필수로
type StrictUser = Required<UserUpdate>;

// Pick<T, K> — 일부 속성만 선택
type UserPreview = Pick<User, "id" | "name">;
// { id: number; name: string }

// Omit<T, K> — 일부 속성 제외
type UserWithoutEmail = Omit<User, "email">;
// { id: number; name: string }

// Record<K, V> — 키-값 맵 타입
type RolePermissions = Record<"admin" | "user", string[]>;
```

이러한 유틸리티 타입은 모두 매핑 타입으로 구현되어 있으며, 직접 만들 수도 있다.

## 조건부 infer — ReturnType 패턴

제네릭과 조건부 타입을 결합하면 기존 타입에서 새 타입을 추출할 수 있다.

```typescript
// 함수의 반환 타입 추출 (내장 ReturnType<T>과 동일)
type MyReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never;

async function fetchUser() {
  return { id: 1, name: "Alice" };
}

type User = Awaited<ReturnType<typeof fetchUser>>;
// { id: number; name: string }
```

이 패턴은 함수 반환 타입을 직접 선언하지 않고 구현에서 자동 추론하는 데 유용하다.

---

**지난 글:** [interface vs type — 차이와 선택 기준](/posts/ts-interface-vs-type/)

**다음 글:** [제네릭 제약 — extends와 keyof](/posts/ts-generic-constraints/)

<br>
읽어주셔서 감사합니다. 😊
