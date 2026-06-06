---
title: "클래스 상속 — extends와 super 완전 정리"
description: "TypeScript 클래스 상속 문법, super() 생성자 호출 규칙, override 키워드, 다형성 활용, instanceof 타입 가드를 실무 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "상속", "extends", "super", "override", "다형성", "클래스"]
featured: false
draft: false
---

[지난 글](/posts/ts-abstract-classes/)에서 추상 클래스로 설계도를 만드는 방법을 살펴봤다. 이번에는 클래스 **상속(Inheritance)**을 깊이 다룬다. `extends` 키워드로 부모 클래스의 프로퍼티와 메서드를 물려받고, `super`로 부모의 생성자와 메서드를 호출하는 전체 흐름을 정리한다.

## extends 기본

`class Child extends Parent` 형태로 단일 클래스를 상속받는다. TypeScript는 다중 상속을 지원하지 않는다.

```typescript
class Animal {
  constructor(public name: string) {}

  speak(): string {
    return `${this.name}: ...`;
  }
}

class Dog extends Animal {
  constructor(name: string, public breed: string) {
    super(name); // 부모 생성자 먼저 호출 — 필수
  }

  fetch(): void {
    console.log(`${this.name}가 공을 가져왔습니다!`);
  }
}

const rex = new Dog("Rex", "Labrador");
console.log(rex.name);  // "Rex"   — Animal에서 상속
console.log(rex.breed); // "Labrador" — Dog 자체 프로퍼티
rex.fetch();
```

## 상속 체인 구조

![클래스 상속 체인과 super 호출](/assets/posts/ts-class-inheritance-chain.svg)

서브클래스는 부모의 모든 `public`·`protected` 멤버를 그대로 사용할 수 있다. `private` 멤버는 상속되지 않는다.

## super() 규칙

서브클래스가 생성자를 직접 선언하면 반드시 `super()`를 호출해야 하고, `this`에 접근하기 **전에** 호출해야 한다.

```typescript
class Cat extends Animal {
  private lives = 9;

  constructor(name: string) {
    super(name); // this.lives 접근 전 super 먼저
    // this.lives = 7; // 이 위치는 OK
  }
}
```

생성자 없이 `extends`만 쓰면 TypeScript가 부모 생성자를 자동으로 호출하는 기본 생성자를 만든다.

## override 키워드

TypeScript 4.3부터 메서드를 재정의할 때 `override` 키워드를 붙일 수 있다. `noImplicitOverride: true` 옵션을 켜면 `override` 없이 재정의하면 오류가 난다.

![override 키워드와 메서드 재정의](/assets/posts/ts-class-inheritance-override.svg)

```typescript
class Dog extends Animal {
  constructor(name: string, public breed: string) {
    super(name);
  }

  override speak(): string {
    return `${super.speak()} Woof!`;
    // "Rex: ... Woof!"
  }
}
```

`override`의 장점: 부모 클래스에서 해당 메서드 이름이 바뀌면 TypeScript가 "이 메서드는 부모에 없는데?"라고 오류를 낸다. 오타나 이름 변경으로 인한 버그를 방지한다.

## 다형성과 타입 안전성

상속의 강점은 **다형성(Polymorphism)**이다. 부모 타입으로 다양한 서브클래스 인스턴스를 다룰 수 있다.

```typescript
class Cat extends Animal {
  override speak(): string { return `${this.name}: Meow`; }
}

const animals: Animal[] = [
  new Dog("Rex", "Lab"),
  new Cat("Whiskers"),
];

for (const a of animals) {
  console.log(a.speak()); // 각자의 speak() 실행
}
// "Rex: ... Woof!"
// "Whiskers: Meow"
```

TypeScript는 `animals` 배열 원소의 타입을 `Animal`로 알므로, `Animal`에 없는 `breed`나 `fetch()`에 접근하면 컴파일 오류를 낸다.

## instanceof로 타입 좁히기

런타임에서 구체적인 서브클래스인지 확인하려면 `instanceof`를 사용한다.

```typescript
function handleAnimal(a: Animal): void {
  if (a instanceof Dog) {
    console.log(a.breed); // OK ✅ — Dog로 좁혀짐
    a.fetch();
  } else if (a instanceof Cat) {
    console.log("고양이입니다");
  }
}
```

## 상속 체인의 깊이

상속은 여러 단계로 이어질 수 있다. 단, 현실에서는 2~3 단계를 초과하면 읽기 어려워지므로 구성(Composition)을 고려하는 것이 좋다.

```typescript
class GuideDog extends Dog {
  constructor(name: string) {
    super(name, "Labrador");
  }

  guide(person: string): void {
    console.log(`${this.name}가 ${person}를 안내합니다`);
  }
}
```

`GuideDog`는 `Dog`와 `Animal` 양쪽의 멤버를 모두 갖는다. `super.speak()`를 호출하면 `Dog.speak()`가 실행되고, 그 안의 `super.speak()`는 `Animal.speak()`를 호출한다.

## 핵심 정리

`extends`로 단일 상속, `super()`로 부모 초기화, `override`로 메서드 재정의 의도를 명확히 표현한다. 다음 글에서는 생성자 파라미터에 접근 제한자를 붙여 선언과 초기화를 한 번에 하는 **파라미터 프로퍼티**를 살펴본다.

---

**지난 글:** [추상 클래스 — 설계도와 구현 분리](/posts/ts-abstract-classes/)

**다음 글:** [파라미터 프로퍼티 — 생성자 단축 선언](/posts/ts-parameter-properties/)

<br>
읽어주셔서 감사합니다. 😊
