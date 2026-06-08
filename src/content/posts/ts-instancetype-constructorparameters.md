---
title: "InstanceType과 ConstructorParameters 완전 정복"
description: "TypeScript의 InstanceType<T>와 ConstructorParameters<T>가 생성자 타입을 분해하는 원리를 설명합니다. 제네릭 팩토리 함수, 의존성 주입 컨테이너, Mixin 패턴, 클래스 레지스트리 구현을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "유틸리티 타입", "InstanceType", "ConstructorParameters", "클래스", "DI"]
featured: false
draft: false
---

[지난 글](/posts/ts-nonnullable-utility/)에서 null과 undefined를 타입에서 제거하는 `NonNullable`을 살펴봤습니다. 이번에는 **생성자 타입**을 다루는 `InstanceType<T>`와 `ConstructorParameters<T>`를 다룹니다. 이 두 타입은 `ReturnType`과 `Parameters`의 생성자 버전으로, 클래스 기반 패턴에서 핵심적인 역할을 합니다.

![InstanceType · ConstructorParameters](/assets/posts/ts-instancetype-constructorparameters-overview.svg)

## 내부 구현

```typescript
// 생성자 반환 타입 (인스턴스 타입) 추출
type InstanceType<T extends abstract new (...args: any) => any> =
  T extends abstract new (...args: any) => infer R ? R : any;

// 생성자 파라미터를 튜플로 추출
type ConstructorParameters<T extends abstract new (...args: any) => any> =
  T extends abstract new (...args: infer P) => any ? P : never;
```

`new (...args: any) => infer R` 패턴이 핵심입니다. `new` 키워드가 붙어야 생성자 타입으로 인식됩니다.

## 클래스 값 vs 클래스 타입

TypeScript에서 클래스는 **값**과 **타입** 두 가지 역할을 합니다.

```typescript
class User {
  constructor(public name: string, public age: number) {}
  greet() { return `Hello, ${this.name}`; }
}

// 클래스를 타입으로 쓸 때 → 인스턴스 타입
const u: User = new User("Alice", 30); // OK

// 클래스 자체(생성자 함수)의 타입 → typeof 사용
const UserClass: typeof User = User;
```

`InstanceType`과 `ConstructorParameters`는 **`typeof ClassName`** (생성자 함수 타입)을 받습니다.

```typescript
type UserInstance = InstanceType<typeof User>;
// → User (인스턴스 타입 — new User(...)의 타입)

type UserArgs = ConstructorParameters<typeof User>;
// → [name: string, age: number]
```

## InstanceType: 제네릭 팩토리에서의 활용

```typescript
// 어떤 클래스든 받아서 인스턴스를 생성하는 팩토리
function createInstance<C extends new (...args: any[]) => any>(
  Cls: C,
  ...args: ConstructorParameters<C>
): InstanceType<C> {
  return new Cls(...args);
}

class Logger {
  constructor(public prefix: string, public level: "info" | "debug") {}
}

// 완전한 타입 추론
const logger = createInstance(Logger, "[App]", "info");
// logger: Logger — 정확히 Logger 인스턴스 타입
```

`createInstance`는 생성자와 그 인자를 분리해서 받는 패턴입니다. `ConstructorParameters<C>`가 인자의 정확한 튜플 타입을 보장하므로, 잘못된 인자를 넘기면 컴파일 에러가 납니다.

## ConstructorParameters: 생성자 인자 재사용

```typescript
class Database {
  constructor(
    private readonly url: string,
    private readonly poolSize: number,
    private readonly timeout: number = 5000
  ) {}

  query(sql: string) { return Promise.resolve([]); }
}

type DbArgs = ConstructorParameters<typeof Database>;
// → [url: string, poolSize: number, timeout?: number]

// 팩토리 함수에서 동일한 인자를 받을 때
function createDatabase(...args: ConstructorParameters<typeof Database>): Database {
  const db = new Database(...args);
  console.log("DB created");
  return db;
}
```

## 실전 패턴

![InstanceType · ConstructorParameters 실전 패턴](/assets/posts/ts-instancetype-constructorparameters-patterns.svg)

### 의존성 주입 컨테이너

```typescript
type Ctor<T = object> = new (...args: any[]) => T;

class DIContainer {
  private bindings = new Map<symbol, Ctor>();
  private singletons = new Map<symbol, unknown>();

  bind<T>(token: symbol, Cls: Ctor<T>): void {
    this.bindings.set(token, Cls);
  }

  resolve<T>(token: symbol): T {
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }
    const Cls = this.bindings.get(token) as Ctor<T>;
    const instance = new Cls();
    this.singletons.set(token, instance);
    return instance;
  }
}

// 사용
const container = new DIContainer();
const DB_TOKEN = Symbol("Database");
container.bind(DB_TOKEN, Database);

const db = container.resolve<InstanceType<typeof Database>>(DB_TOKEN);
```

### Mixin 패턴

TypeScript의 Mixin 패턴은 `InstanceType`과 제네릭 생성자 타입을 조합합니다.

```typescript
type Constructor<T = {}> = new (...args: any[]) => T;

// Timestamps를 추가하는 Mixin
function Timestamped<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    createdAt = new Date();
    updatedAt = new Date();
  };
}

// Activatable을 추가하는 Mixin
function Activatable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    isActive = false;
    activate() { this.isActive = true; }
    deactivate() { this.isActive = false; }
  };
}

class Article {
  constructor(public title: string) {}
}

const TimestampedActivatableArticle = Timestamped(Activatable(Article));
type TAA = InstanceType<typeof TimestampedActivatableArticle>;
// → Article & { createdAt: Date; updatedAt: Date; isActive: boolean; activate(): void; ... }

const article = new TimestampedActivatableArticle("Hello TypeScript");
article.activate();
console.log(article.isActive); // true
```

### 클래스 레지스트리

```typescript
class PluginRegistry {
  private plugins = new Map<string, Ctor>();

  register<T extends Ctor>(name: string, Plugin: T): void {
    this.plugins.set(name, Plugin);
  }

  create<T extends Ctor>(name: string, ...args: any[]): InstanceType<T> | undefined {
    const Plugin = this.plugins.get(name) as T | undefined;
    if (!Plugin) return undefined;
    return new Plugin(...args) as InstanceType<T>;
  }
}
```

## abstract 클래스

`InstanceType`과 `ConstructorParameters`는 `abstract` 클래스도 지원합니다.

```typescript
abstract class Shape {
  abstract area(): number;
  abstract perimeter(): number;
}

class Circle extends Shape {
  constructor(public radius: number) { super(); }
  area() { return Math.PI * this.radius ** 2; }
  perimeter() { return 2 * Math.PI * this.radius; }
}

// abstract 클래스의 인스턴스 타입
type ShapeInstance = InstanceType<typeof Shape>; // Shape
type CircleArgs = ConstructorParameters<typeof Circle>; // [radius: number]
```

---

**지난 글:** [NonNullable 유틸리티 타입 완전 정복](/posts/ts-nonnullable-utility/)

**다음 글:** [ThisType과 OmitThisParameter 완전 정복](/posts/ts-thistype-omitthisparameter/)

<br>
읽어주셔서 감사합니다. 😊
