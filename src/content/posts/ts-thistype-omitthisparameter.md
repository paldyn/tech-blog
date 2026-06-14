---
title: "ThisType과 OmitThisParameter 완전 정복"
description: "TypeScript의 ThisType<T>와 OmitThisParameter<F>를 깊이 파헤칩니다. 객체 리터럴 메서드에서 this 타입을 제어하는 원리, Vue 2 Options API 구현 패턴, bind 후 this 제거, noImplicitThis 설정과의 관계를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 9
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "유틸리티 타입", "ThisType", "OmitThisParameter", "this", "Vue"]
featured: false
draft: false
---

[지난 글](/posts/ts-instancetype-constructorparameters/)에서 생성자 타입을 다루는 방법을 살펴봤습니다. 이번에는 `this` 컨텍스트를 타입 레벨에서 다루는 두 가지 특수 유틸리티 `ThisType<T>`와 `OmitThisParameter<F>`를 정리합니다. 이 두 타입은 다른 유틸리티에 비해 덜 알려져 있지만, 객체 리터럴 기반 API 설계와 함수 바인딩에서 필수적입니다.

![ThisType · OmitThisParameter](/assets/posts/ts-thistype-omitthisparameter-overview.svg)

## this 파라미터란?

TypeScript는 함수의 첫 번째 파라미터에 `this`라는 이름을 붙여 해당 함수 내 `this`의 타입을 선언할 수 있습니다. 이 파라미터는 컴파일 후 사라집니다.

```typescript
interface User {
  id: number;
  name: string;
}

// this 파라미터 선언
function greet(this: User, greeting: string): string {
  return `${greeting}, ${this.name}!`;
}

// 잘못된 this로 호출하면 에러
greet.call({ id: 1, name: "Alice" }, "Hello"); // OK
greet("Hello"); // Error: this 컨텍스트가 없음
```

`noImplicitThis: true`(또는 `strict: true`)를 사용하면 this 타입이 불명확할 때 에러를 발생시킵니다.

## ThisType\<T\>: 객체 리터럴의 this 타입 제어

`ThisType<T>`는 런타임 영향이 없는 **마커 타입**입니다. 객체 리터럴 컨텍스트에서 내부 메서드들의 `this` 타입을 지정하는 데 사용합니다.

```typescript
interface Todo {
  title: string;
  completed: boolean;
}

interface TodoMethods {
  toggle(): void;
  getTitle(): string;
}

// ThisType을 사용해 methods 내 this의 타입을 명시
const todoConfig: {
  data: Todo;
  methods: TodoMethods & ThisType<Todo & TodoMethods>;
} = {
  data: { title: "Learn TypeScript", completed: false },
  methods: {
    toggle() {
      this.completed = !this.completed; // this: Todo & TodoMethods
    },
    getTitle() {
      return this.title; // this.title — string
    }
  }
};
```

`ThisType`이 없으면 `methods` 내부의 `this`는 `{}` 또는 `any`가 되어 `this.title`에 접근할 때 에러가 납니다.

## Vue 2 Options API 구현

Vue 2가 TypeScript에서 Options API를 타입 안전하게 지원할 때 `ThisType`을 핵심적으로 활용합니다.

```typescript
type ComponentOptions<D, M, C> = {
  data(): D;
  methods?: M & ThisType<D & M & C>;
  computed?: C & ThisType<D & M & C>;
};

function defineComponent<D, M, C>(
  options: ComponentOptions<D, M, C>
): ComponentOptions<D, M, C> {
  return options;
}

const Counter = defineComponent({
  data() {
    return { count: 0, step: 1 };
  },
  methods: {
    increment() {
      this.count += this.step; // this: { count: number; step: number; ... }
    },
    reset() {
      this.count = 0;
    }
  }
});
```

## 실전 패턴

![ThisType · OmitThisParameter 실전 패턴](/assets/posts/ts-thistype-omitthisparameter-patterns.svg)

### 플루언트 인터페이스(Builder 패턴)

```typescript
interface QueryBuilder {
  where(condition: string): this;
  limit(n: number): this;
  offset(n: number): this;
  build(): string;
}

class SqlBuilder implements QueryBuilder {
  private conditions: string[] = [];
  private _limit = 100;
  private _offset = 0;

  where(condition: string): this {
    this.conditions.push(condition);
    return this; // this 반환 → 체이닝 가능
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  offset(n: number): this {
    this._offset = n;
    return this;
  }

  build(): string {
    const where = this.conditions.join(" AND ");
    return `SELECT * FROM users WHERE ${where} LIMIT ${this._limit} OFFSET ${this._offset}`;
  }
}
```

## OmitThisParameter\<F\>: this 파라미터 제거

`OmitThisParameter<F>`는 함수 타입 `F`에서 `this` 파라미터를 제거한 타입을 반환합니다.

```typescript
function format(this: User, template: string): string {
  return template.replace("{name}", this.name);
}

// this 파라미터가 있는 타입
type WithThis = typeof format; // (this: User, template: string) => string

// this 파라미터를 제거한 타입
type WithoutThis = OmitThisParameter<typeof format>; // (template: string) => string
```

### bind와의 조합

`Function.prototype.bind`의 반환 타입이 내부적으로 `OmitThisParameter`를 사용합니다.

```typescript
const user: User = { id: 1, name: "Alice" };

// bind로 this를 고정하면 이후 this 파라미터가 없어짐
const boundFormat = format.bind(user);
// boundFormat: (template: string) => string — OmitThisParameter가 적용된 타입

boundFormat("{name}님 환영합니다"); // "Alice님 환영합니다"
```

### 이벤트 핸들러에서 this 금지

```typescript
class EventEmitter {
  // this: void를 사용하면 메서드 내에서 this 접근 자체를 금지
  emit(this: void, event: string): void {
    console.log(event);
  }
}

const emitter = new EventEmitter();
const handler = emitter.emit; // OmitThisParameter<typeof emitter.emit>
handler("click"); // this 없이 호출 가능
```

## 내부 구현

```typescript
type OmitThisParameter<T> =
  unknown extends ThisParameterType<T>
    ? T
    : T extends (...args: infer A) => infer R
      ? (...args: A) => R
      : T;

type ThisParameterType<T> =
  T extends (this: infer U, ...args: any) => any ? U : unknown;
```

`ThisParameterType<T>`는 함수의 `this` 파라미터 타입을 추출하고, `OmitThisParameter`는 이를 활용해 `this` 없는 함수 타입을 재구성합니다.

---

**지난 글:** [InstanceType과 ConstructorParameters 완전 정복](/posts/ts-instancetype-constructorparameters/)

**다음 글:** [Deep Readonly 패턴 완전 정복](/posts/ts-deep-readonly/)

<br>
읽어주셔서 감사합니다. 😊
