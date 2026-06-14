---
title: "this 매개변수 — TypeScript에서 this 타입을 명시하고 안전하게 쓰는 법"
description: "TypeScript this 매개변수 문법, noImplicitThis 설정, this: void로 오용 방지, 다형적 this 반환 타입, ThisType 유틸리티, 화살표 함수와 this 바인딩을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 6
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "this매개변수", "ThisParameter", "noImplicitThis", "다형적this"]
featured: false
draft: false
---

[지난 글](/posts/ts-rest-parameters/)에서 나머지 매개변수를 살펴봤다. 이번에는 TypeScript 함수의 **`this` 매개변수** 를 다룬다. JavaScript에서 `this`는 호출 방식에 따라 달라지는 불안정한 값이다. TypeScript는 `this` 타입을 명시적으로 선언해 이 문제를 해결한다.

## this가 문제가 되는 이유

JavaScript에서 `this`는 함수가 **어떻게** 호출되었는지에 따라 동적으로 결정된다.

```typescript
class Timer {
  private count = 0;

  // ❌ 일반 메서드 — this가 유실될 수 있음
  tick() {
    this.count++;
    console.log(this.count);
  }
}

const timer = new Timer();
timer.tick();             // OK — this: Timer

const fn = timer.tick;
fn();                     // ❌ 런타임 에러 — this가 undefined (strict mode)
                          // 또는 window (non-strict mode)

setTimeout(timer.tick, 1000); // ❌ this 유실
```

메서드를 다른 변수에 저장하거나 콜백으로 전달하면 `this` 바인딩이 끊어진다.

![this 매개변수 개념](/assets/posts/ts-this-parameter-concept.svg)

## `this` 매개변수 문법

TypeScript는 함수 첫 번째 위치에 `this: 타입` 형태로 `this`의 타입을 명시할 수 있다. 이 매개변수는 컴파일 시 제거되며 런타임에는 존재하지 않는다.

```typescript
interface User {
  name: string;
  greet(this: User): string;
}

const user: User = {
  name: "Alice",
  greet(this: User) {
    return `Hello, I'm ${this.name}`; // this: User — 타입 안전
  },
};

user.greet(); // OK

const fn = user.greet;
fn(); // ❌ TS2684: 'this' 컨텍스트가 'User' 타입이 아님
```

`this: User`를 명시하면 올바른 `this` 컨텍스트 없이 호출할 때 컴파일 에러가 발생한다.

## `noImplicitThis` 설정

`tsconfig.json`의 `strict` 모드에는 `noImplicitThis`가 포함된다. 이 옵션이 활성화되면 `this`가 암묵적으로 `any`가 되는 상황에서 에러를 발생시킨다.

```typescript
// noImplicitThis: true 상태

// ❌ this 타입이 암묵적으로 any
function getNameBad() {
  return this.name; // TS2683: 'this' implicitly has type 'any'
}

// ✅ this 타입 명시
function getNameGood(this: { name: string }) {
  return this.name;
}

// ✅ 클래스 메서드 — 클래스 타입이 this의 타입
class Person {
  constructor(public name: string) {}

  getName() {
    return this.name; // this: Person — 명시 불필요
  }
}
```

클래스 메서드는 TypeScript가 자동으로 `this` 타입을 클래스 타입으로 결정하므로 별도 명시가 필요 없다.

## `this: void` — this 사용 금지

`this: void`는 함수 내에서 `this`를 사용할 수 없음을 명시한다. 콜백에서 `this` 오용을 방지할 때 유용하다.

```typescript
interface Button {
  onClick(this: void, event: MouseEvent): void;
}

const button: Button = {
  onClick(this: void, e) {
    // this 사용 불가 — void 타입이므로
    this; // TS2683 (if used)
    console.log(e.type);
  },
};

// 이벤트 리스너 등록 시 this 유실이 문제 안 됨
document.querySelector("button")?.addEventListener("click", button.onClick);
```

이 패턴은 메서드가 독립적으로 (this 바인딩 없이) 호출됨을 계약으로 강제한다.

## 화살표 함수로 this 고정

화살표 함수는 자신만의 `this`를 갖지 않고 **렉시컬 스코프**의 `this`를 캡처한다. 클래스 필드에서 화살표 함수로 메서드를 정의하면 `this`가 항상 인스턴스를 가리킨다.

```typescript
class Timer {
  private count = 0;

  // ✅ 화살표 함수 — this가 항상 Timer 인스턴스
  tick = () => {
    this.count++;
    console.log(this.count);
  };
}

const timer = new Timer();
const fn = timer.tick;
fn();               // OK — this: Timer

setTimeout(timer.tick, 1000); // OK
const [callback] = [timer.tick];
callback();         // OK
```

단점도 있다. 화살표 함수 메서드는 프로토타입이 아닌 **인스턴스**에 저장되므로 메모리 사용량이 증가하고, 자식 클래스에서 `super.method()`로 접근할 수 없다.

## 다형적 this — 메서드 체이닝

반환 타입에 `this`를 사용하면 서브클래스에서 메서드 체이닝이 올바르게 동작한다.

```typescript
class Builder {
  protected config: Record<string, unknown> = {};

  set(key: string, value: unknown): this {
    this.config[key] = value;
    return this; // this 타입 반환
  }

  build() {
    return { ...this.config };
  }
}

class DatabaseBuilder extends Builder {
  setHost(host: string): this {
    return this.set("host", host);
  }

  setPort(port: number): this {
    return this.set("port", port);
  }
}

const db = new DatabaseBuilder()
  .setHost("localhost")
  .setPort(5432)
  .set("database", "myapp")
  .build();
// 체이닝 중 타입: DatabaseBuilder — setHost, setPort 사용 가능
```

`set()` 메서드의 반환 타입이 `Builder`가 아닌 `this`이므로, `DatabaseBuilder` 인스턴스에서 호출하면 반환 타입도 `DatabaseBuilder`가 된다.

![this 매개변수 패턴](/assets/posts/ts-this-parameter-patterns.svg)

## `ThisType<T>` 유틸리티 타입

객체 리터럴에서 메서드가 공유 컨텍스트를 `this`로 접근해야 할 때 `ThisType<T>` 유틸리티를 사용한다.

```typescript
interface ObjectDescriptor<D, M> {
  data?: D;
  methods?: M & ThisType<D & M>; // methods 내부의 this는 D & M 타입
}

function makeObject<D, M>(desc: ObjectDescriptor<D, M>): D & M {
  const data: object = desc.data || {};
  const methods: object = desc.methods || {};
  return { ...data, ...methods } as D & M;
}

const obj = makeObject({
  data: { x: 0, y: 0 },
  methods: {
    moveBy(dx: number, dy: number) {
      this.x += dx; // this: { x: number; y: number } & { moveBy(...) }
      this.y += dy;
    },
  },
});

obj.moveBy(5, 3);
obj.x; // 5
obj.y; // 3
```

`ThisType<T>`는 컴파일러에게 해당 컨텍스트에서 `this`의 타입이 `T`임을 알려준다. Vue 2나 옵션 API 스타일의 라이브러리 설계에서 사용하는 패턴이다.

## 메서드 타입에서 this 검사 비교

`noImplicitThis`와 함께 메서드를 정의하는 두 가지 방법의 차이를 정리한다.

```typescript
interface Greeter {
  // 메서드 시그니처 — this 검사가 상대적으로 느슨
  greet1(name: string): string;

  // 함수 프로퍼티 — this 검사가 엄격 (strictFunctionTypes)
  greet2: (name: string) => string;
}

class Impl implements Greeter {
  greet1(name: string) {
    return `Hello, ${name} from ${this.constructor.name}`;
  }

  greet2 = (name: string) => {
    return `Hello, ${name}`;
    // 화살표 함수이므로 this 바인딩이 안전
  };
}
```

팀 컨벤션에 따라 다르지만, `this` 안전성을 최우선으로 한다면 클래스 필드 화살표 함수가 간단하고 확실한 방법이다. 단, 프로토타입 메서드 오버라이드가 필요한 상속 구조라면 일반 메서드와 `this` 매개변수를 명시하는 방식을 사용한다.

---

**지난 글:** [나머지 매개변수와 스프레드 — 가변 인수를 타입 안전하게 처리하기](/posts/ts-rest-parameters/)

**다음 글:** [타입 좁히기(Narrowing) 기초 — 유니언 타입을 안전하게 다루는 방법](/posts/ts-narrowing-basics/)

<br>
읽어주셔서 감사합니다. 😊
