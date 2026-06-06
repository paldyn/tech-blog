---
title: "정적 멤버 — 클래스 레벨의 공유 상태"
description: "TypeScript static 키워드로 선언하는 정적 프로퍼티·메서드의 동작 원리, 인스턴스 멤버와의 차이, 싱글턴·팩토리 패턴 활용, static 블록을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "static", "정적멤버", "싱글턴", "팩토리", "클래스", "공유상태"]
featured: false
draft: false
---

[지난 글](/posts/ts-getters-setters/)에서 게터와 세터로 프로퍼티 접근을 제어하는 방법을 살펴봤다. 이번에는 **정적 멤버(Static Members)**를 다룬다. 인스턴스에 귀속되지 않고 클래스 자체에 귀속되는 프로퍼티와 메서드로, 모든 인스턴스가 공유하는 상태나 인스턴스 없이 사용할 유틸리티 함수를 만들 때 쓴다.

## static 기본

`static` 키워드를 붙이면 인스턴스가 아닌 클래스 자체의 멤버가 된다. 접근할 때는 `클래스이름.멤버`로 접근한다.

```typescript
class MathUtils {
  static readonly PI = 3.14159;

  static square(x: number): number {
    return x * x;
  }

  static circleArea(r: number): number {
    return MathUtils.PI * MathUtils.square(r);
  }
}

// 인스턴스 없이 사용
console.log(MathUtils.PI);              // 3.14159
console.log(MathUtils.square(4));       // 16
console.log(MathUtils.circleArea(5));   // 78.53...
```

## 정적 vs 인스턴스 멤버

![정적 멤버 vs 인스턴스 멤버](/assets/posts/ts-static-members-concept.svg)

정적 멤버는 클래스 정의와 함께 단 하나만 존재한다. 모든 인스턴스가 같은 정적 멤버를 공유하므로, 한 인스턴스가 변경하면 다른 인스턴스에서도 바뀐 값이 보인다.

## ID 생성기 패턴

![static 멤버 코드 예시](/assets/posts/ts-static-members-code.svg)

```typescript
class User {
  static private _nextId = 1;
  readonly id: number;

  constructor(public name: string) {
    this.id = IdGenerator.next();
  }
}

const u1 = new User("Alice"); // id = 1
const u2 = new User("Bob");   // id = 2
const u3 = new User("Carol"); // id = 3
```

정적 프로퍼티로 전역 카운터를 관리하면, 별도 변수나 모듈 레벨 상태 없이 클래스 안에 캡슐화할 수 있다.

## 팩토리 메서드 패턴

정적 메서드는 인스턴스 생성 방법을 다양하게 제공하는 팩토리 메서드로 자주 쓰인다.

```typescript
class Color {
  private constructor(
    public r: number,
    public g: number,
    public b: number
  ) {}

  static fromHex(hex: string): Color {
    const n = parseInt(hex.replace("#", ""), 16);
    return new Color((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
  }

  static fromRgb(r: number, g: number, b: number): Color {
    return new Color(r, g, b);
  }

  toString(): string {
    return `rgb(${this.r}, ${this.g}, ${this.b})`;
  }
}

const red  = Color.fromHex("#ff0000");
const blue = Color.fromRgb(0, 0, 255);
console.log(red.toString());  // "rgb(255, 0, 0)"
```

생성자를 `private`으로 막고 정적 팩토리 메서드만 노출하면, 다양한 인풋 형식을 지원하면서 생성 로직을 통일할 수 있다.

## 싱글턴 패턴

정적 멤버로 인스턴스가 하나만 존재하도록 보장하는 싱글턴 패턴을 구현할 수 있다.

```typescript
class AppConfig {
  private static _instance: AppConfig | null = null;
  private _data: Record<string, string> = {};

  private constructor() {}

  static getInstance(): AppConfig {
    if (!AppConfig._instance) {
      AppConfig._instance = new AppConfig();
    }
    return AppConfig._instance;
  }

  get(key: string): string | undefined {
    return this._data[key];
  }

  set(key: string, value: string): void {
    this._data[key] = value;
  }
}

const cfg = AppConfig.getInstance();
cfg.set("theme", "dark");
AppConfig.getInstance().get("theme"); // "dark" — 같은 인스턴스
```

## static 초기화 블록 (ES2022)

TypeScript 4.4부터 지원하는 `static {}` 블록으로 복잡한 정적 초기화를 클래스 안에서 할 수 있다.

```typescript
class Database {
  static readonly url: string;

  static {
    const env = process.env.DATABASE_URL;
    if (!env) throw new Error("DATABASE_URL 환경변수 필요");
    Database.url = env;
  }
}
```

## 정적 멤버의 상속

정적 멤버도 상속된다. 서브클래스에서 `super.staticMethod()`로 부모의 정적 메서드를 호출할 수 있다.

```typescript
class Animal {
  static create(): Animal { return new Animal(); }
}

class Dog extends Animal {
  static createDog(): Dog { return new Dog(); }
}

Dog.create();    // Animal의 정적 메서드 상속
Dog.createDog(); // Dog 자체 정적 메서드
```

## 핵심 정리

정적 멤버는 인스턴스와 무관한 클래스 레벨의 상태와 동작을 표현한다. 유틸리티 함수, 팩토리 메서드, 싱글턴, 글로벌 카운터 등에 적합하다. 정적 멤버에서는 `this`가 클래스 자체를 가리키므로, 인스턴스 멤버에 접근하려면 명시적으로 인스턴스를 인자로 받아야 한다.

---

**지난 글:** [게터와 세터 — 프로퍼티 접근 제어](/posts/ts-getters-setters/)

**다음 글:** [제네릭 함수 — 타입 안전한 재사용](/posts/ts-generic-functions/)

<br>
읽어주셔서 감사합니다. 😊
