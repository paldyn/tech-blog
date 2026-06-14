---
title: "제네릭 클래스 — 타입 파라미터를 가진 클래스"
description: "TypeScript 제네릭 클래스 선언, 인스턴스 생성 시 T 확정, 제약 조건·복수 파라미터, 제네릭 클래스 상속, 실무 컨테이너 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "제네릭클래스", "generic class", "T", "컨테이너", "Stack", "Queue", "상속"]
featured: false
draft: false
---

[지난 글](/posts/ts-generic-functions/)에서 제네릭 함수를 살펴봤다. 이번에는 **제네릭 클래스**를 다룬다. 클래스 이름 뒤에 `<T>`를 붙이면 클래스 전체에서 타입 파라미터를 사용할 수 있다. 인스턴스를 생성할 때 `T`가 결정되고 이후 모든 멤버에 일관되게 적용된다.

## 기본 형태

```typescript
class Box<T> {
  private value: T;

  constructor(val: T) {
    this.value = val;
  }

  get(): T { return this.value; }
  set(val: T): void { this.value = val; }

  map<U>(fn: (v: T) => U): Box<U> {
    return new Box(fn(this.value));
  }
}

const strBox = new Box("hello");
console.log(strBox.get().toUpperCase()); // "HELLO" ✅
strBox.set("world");

const numBox = new Box(42);
numBox.set("oops"); // Error ❌ — T=number인데 string 할당
```

## Stack 제네릭 클래스

![제네릭 클래스 — Stack&lt;T&gt; 구조](/assets/posts/ts-generic-classes-stack.svg)

인스턴스 생성 시점에 T가 결정되므로, `Stack<string>`과 `Stack<number>`는 완전히 별개의 타입으로 동작한다.

![제네릭 클래스 코드 패턴](/assets/posts/ts-generic-classes-code.svg)

```typescript
const strStack = new Stack<string>();
strStack.push("a");
strStack.push("b");
console.log(strStack.pop()); // "b"
console.log(strStack.size);  // 1

// strStack.push(42); // Error ❌ — T=string으로 고정

const numStack = new Stack<number>();
numStack.push(1);
numStack.push(2);
console.log(numStack.peek()); // 2
```

## 복수 타입 파라미터

클래스도 함수처럼 여러 타입 파라미터를 가질 수 있다.

```typescript
class Pair<A, B> {
  constructor(
    public first: A,
    public second: B
  ) {}

  swap(): Pair<B, A> {
    return new Pair(this.second, this.first);
  }

  toTuple(): [A, B] {
    return [this.first, this.second];
  }
}

const p = new Pair("hello", 42);
// p.first: string, p.second: number

const swapped = p.swap();
// swapped.first: number, swapped.second: string
```

## 제약 조건이 있는 제네릭 클래스

`extends`로 T에 제약을 걸 수 있다.

```typescript
interface Identifiable {
  id: number;
}

class Repository<T extends Identifiable> {
  private store = new Map<number, T>();

  add(item: T): void {
    this.store.set(item.id, item);
  }

  findById(id: number): T | undefined {
    return this.store.get(id);
  }

  getAll(): T[] {
    return [...this.store.values()];
  }
}

interface User extends Identifiable {
  name: string;
}

const userRepo = new Repository<User>();
userRepo.add({ id: 1, name: "Alice" });
userRepo.add({ id: 2, name: "Bob" });

const alice = userRepo.findById(1); // User | undefined
console.log(alice?.name); // "Alice"
```

## 제네릭 클래스 상속

제네릭 클래스를 상속할 때는 타입 파라미터를 구체 타입으로 확정하거나, 그대로 전달할 수 있다.

```typescript
class Stack<T> { /* ... */ }

// 1. 구체 타입으로 확정
class StringStack extends Stack<string> {
  pushUpperCase(s: string): void {
    this.push(s.toUpperCase());
  }
}

// 2. 타입 파라미터 그대로 전달
class BoundedStack<T> extends Stack<T> {
  constructor(private limit: number) {
    super();
  }

  push(item: T): void {
    if (this.size >= this.limit) {
      throw new Error(`최대 ${this.limit}개 초과`);
    }
    super.push(item);
  }
}
```

## 정적 멤버에서의 T 제한

정적 멤버는 인스턴스에 속하지 않으므로 클래스의 타입 파라미터를 사용할 수 없다.

```typescript
class MyClass<T> {
  static count = 0;        // OK — static은 T와 무관
  // static items: T[] = []; // Error ❌ — static에서 T 사용 불가
  items: T[] = [];          // OK — 인스턴스 멤버
}
```

정적 메서드에 제네릭이 필요하면 별도 타입 파라미터를 선언한다.

```typescript
class Util {
  static wrap<U>(value: U): { value: U } {
    return { value };
  }
}
```

## 핵심 정리

제네릭 클래스는 컨테이너, 리포지터리, 데이터 구조처럼 "담는 타입만 다르고 로직은 같은" 경우에 가장 빛난다. 인스턴스 생성 시점에 T를 확정하면 이후 모든 메서드에 타입 안전성이 자동으로 적용된다. 제네릭 클래스와 제네릭 함수를 조합하면 타입 안전하고 재사용 가능한 라이브러리 수준의 코드를 작성할 수 있다.

---

**지난 글:** [제네릭 함수 — 타입 안전한 재사용](/posts/ts-generic-functions/)

<br>
읽어주셔서 감사합니다. 😊
