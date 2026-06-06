---
title: "접근 제한자 — public, private, protected 완전 정리"
description: "TypeScript 접근 제한자 public·private·protected의 범위 차이, 컴파일 타임 검사 한계, 실무 캡슐화 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "접근제한자", "public", "private", "protected", "캡슐화", "클래스"]
featured: false
draft: false
---

[지난 글](/posts/ts-classes-basics/)에서 TypeScript 클래스의 기본 구조를 살펴봤다. 이번에는 클래스 멤버의 공개 범위를 제어하는 **접근 제한자(Access Modifiers)**를 다룬다. 어떤 코드가 어떤 프로퍼티나 메서드에 접근할 수 있는지를 컴파일 타임에 강제하는 핵심 기능이다.

## 세 가지 접근 제한자

TypeScript는 `public`, `protected`, `private` 세 가지 접근 제한자를 제공한다.

![접근 제한자 비교](/assets/posts/ts-access-modifiers-overview.svg)

- **public**: 기본값. 클래스 내부, 서브클래스, 외부 어디서나 접근 가능.
- **protected**: 클래스 내부와 상속받은 서브클래스에서만 접근 가능. 외부에서는 불가.
- **private**: 해당 클래스 내부에서만 접근 가능. 서브클래스와 외부 모두 불가.

## 코드로 보는 차이

```typescript
class Animal {
  public  name:     string;    // 어디서나 OK
  protected sound:  string;    // 서브클래스까지
  private  _secret: string;    // 이 클래스만

  constructor(name: string, sound: string) {
    this.name    = name;
    this.sound   = sound;
    this._secret = "숨겨진 정보";
  }
}

class Dog extends Animal {
  bark(): void {
    console.log(this.name);   // OK ✅ public
    console.log(this.sound);  // OK ✅ protected
    console.log(this._secret); // Error ❌ private
  }
}

const dog = new Dog("Rex", "Woof");
console.log(dog.name);   // OK ✅ public
console.log(dog.sound);  // Error ❌ protected는 외부 불가
```

## 실무 패턴: BankAccount

은행 계좌 예시로 세 제한자를 함께 사용해 보자.

![접근 제한자 코드 예시](/assets/posts/ts-access-modifiers-usage.svg)

```typescript
const account = new BankAccount("Alice", 1000);

console.log(account.owner);       // OK ✅ public
console.log(account.getBalance()); // OK ✅ public 메서드로 간접 접근
console.log(account.balance);     // Error ❌ private
```

`balance`를 `private`로 숨기고 `getBalance()` 메서드로만 읽을 수 있게 하면, 외부 코드가 잔액을 임의로 변경하는 것을 방지할 수 있다.

## TypeScript private의 한계

**TypeScript `private`은 컴파일 타임 전용이다.** 컴파일된 JavaScript에는 `private` 키워드가 사라지므로, 런타임에서는 일반 프로퍼티처럼 접근할 수 있다.

```typescript
class Secret {
  private value = 42;
}

const s = new Secret();
// TypeScript 컴파일 오류지만...
(s as any).value; // 런타임에서는 접근 가능 ⚠
```

런타임 캡슐화까지 보장하려면 다음 글에서 다룰 ECMAScript private field(`#value`)를 사용해야 한다.

## readonly와 함께 쓰기

`private readonly`로 선언하면 초기화 이후 변경도 막을 수 있다.

```typescript
class Config {
  private readonly apiKey: string;

  constructor(key: string) {
    this.apiKey = key; // 생성자에서만 가능
  }

  getKey(): string {
    return this.apiKey;
  }
}

const cfg = new Config("secret-key");
// cfg.apiKey = "new-key"; // Error ❌ readonly
```

## protected 활용 — 상속 체인의 공유 상태

`protected`는 상속 구조에서 공통 상태를 서브클래스에게 열어줄 때 유용하다.

```typescript
class Vehicle {
  protected speed = 0;

  protected accelerate(delta: number): void {
    this.speed += delta;
  }
}

class Car extends Vehicle {
  drive(): void {
    this.accelerate(60); // OK ✅ protected 접근
    console.log(`속도: ${this.speed} km/h`);
  }
}
```

외부에서는 `car.speed`에 접근할 수 없고, `Car`의 `drive()` 메서드를 통해서만 동작한다.

## 언제 무엇을 쓸까

- 기본은 `public` (생략 가능)
- 외부에 노출하면 안 되는 구현 세부사항 → `private`
- 상속 구조에서 서브클래스가 공유해야 하는 내부 상태 → `protected`
- 진짜 런타임 캡슐화 → `#` ECMAScript private field

접근 제한자는 API 경계를 명확히 하고, 팀원이 "이 필드는 외부에서 건드리면 안 됨"을 코드만 보고 알 수 있게 해주는 커뮤니케이션 도구이기도 하다.

---

**지난 글:** [TypeScript 클래스 기초 — 객체지향의 출발점](/posts/ts-classes-basics/)

**다음 글:** [ECMAScript 비공개 필드 — # 기반 진짜 캡슐화](/posts/ts-ecmascript-private-fields/)

<br>
읽어주셔서 감사합니다. 😊
