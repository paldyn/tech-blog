---
title: "프로토타입 상속 심화 — extends와 super의 내부 동작"
description: "JavaScript class extends가 설정하는 두 개의 prototype 체인, super()와 super.method()의 동작 원리, 다중 레벨 상속의 구조를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 18
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "extends", "super", "prototype-inheritance", "class", "constructor-chain"]
featured: false
draft: false
---

[지난 글](/posts/js-object-create/)에서 `Object.create`로 prototype을 직접 지정하는 방법을 살펴봤습니다. `class extends` 문법은 이 작업을 자동으로 처리하면서 추가 기능을 제공합니다. 내부에서 어떤 체인이 설정되는지 이해하면 `super`가 왜 그렇게 동작하는지 명확해집니다.

---

## extends가 설정하는 두 개의 체인

```javascript
class Animal {
  constructor(name) { this.name = name; }
  breathe() { return 'breathing'; }
  static create(name) { return new this(name); }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name);
    this.breed = breed;
  }
  bark() { return 'Woof'; }
}
```

`extends Animal`은 두 가지를 설정합니다.

**1. 인스턴스 체인**: `Dog.prototype[[Prototype]] = Animal.prototype`
```javascript
Object.getPrototypeOf(Dog.prototype) === Animal.prototype; // true
```
이로 인해 `Dog` 인스턴스는 `Animal.prototype`의 메서드를 상속받습니다.

**2. 생성자 체인**: `Dog[[Prototype]] = Animal`
```javascript
Object.getPrototypeOf(Dog) === Animal; // true
```
이로 인해 `Dog`는 `Animal`의 정적 메서드를 상속받습니다.

```javascript
// 정적 메서드 상속
const dog = Dog.create('Rex'); // Animal.create를 Dog에서 호출
dog instanceof Dog; // true (this === Dog이므로 new Dog() 생성)
```

![class extends 상속 구조](/assets/posts/js-prototype-inheritance-chain.svg)

---

## super() — 부모 constructor 호출

파생 클래스(extends를 사용한 클래스)의 `constructor`에서 `this`를 사용하기 전에 반드시 `super()`를 호출해야 합니다.

```javascript
class Dog extends Animal {
  constructor(name, breed) {
    // super() 이전에 this 접근 시 ReferenceError
    // this.breed = breed; // Error!

    super(name); // 부모 constructor 실행, this 초기화 완료

    this.breed = breed; // 이제 사용 가능
  }
}
```

파생 클래스가 `constructor`를 생략하면 암묵적으로 다음 코드가 삽입됩니다.

```javascript
// constructor 생략 시 자동 삽입
constructor(...args) {
  super(...args);
}
```

---

## super.method() — 부모 메서드 호출

메서드를 오버라이드하면서 부모 버전도 실행하고 싶을 때 사용합니다.

```javascript
class Animal {
  describe() {
    return `Animal: ${this.name}`;
  }
}

class Dog extends Animal {
  describe() {
    // super.method()는 Animal.prototype.describe를 this를 유지하며 호출
    const base = super.describe();
    return `${base}, Breed: ${this.breed}`;
  }
}

const dog = new Dog('Rex', 'Labrador');
dog.describe(); // "Animal: Rex, Breed: Labrador"
```

`super.describe()`는 내부적으로 `Animal.prototype.describe.call(this)`와 동일하지만, `super`는 호출 시점의 `this`를 정확히 보존하는 `[[HomeObject]]` 메커니즘을 사용합니다.

---

## [[HomeObject]] — super가 메서드를 찾는 방법

```javascript
const base = {
  greet() { return 'Hello from base'; }
};

const child = {
  greet() {
    return super.greet() + ' + child';
  }
};

Object.setPrototypeOf(child, base);
child.greet(); // "Hello from base + child"
```

메서드 단축 표기(`greet() {}`)로 정의된 함수는 `[[HomeObject]]`가 자동으로 설정됩니다. 이것이 `super`가 올바른 prototype을 찾는 방법입니다. 화살표 함수나 일반 함수 표현식으로 정의하면 `[[HomeObject]]`가 없어 `super`를 사용할 수 없습니다.

```javascript
const bad = {
  greet: function() {
    return super.greet(); // SyntaxError 또는 undefined
  }
};
```

![super 키워드 동작](/assets/posts/js-prototype-inheritance-super.svg)

---

## 다중 레벨 상속

```javascript
class LivingThing {
  isAlive() { return true; }
}

class Animal extends LivingThing {
  breathe() { return 'breathing'; }
}

class Dog extends Animal {
  bark() { return 'Woof'; }
}

const dog = new Dog();

// 인스턴스 체인
// dog → Dog.prototype → Animal.prototype → LivingThing.prototype → Object.prototype → null

dog.bark();    // Dog.prototype에서 찾음
dog.breathe(); // Animal.prototype에서 찾음
dog.isAlive(); // LivingThing.prototype에서 찾음
dog.toString(); // Object.prototype에서 찾음

// instanceof 체인 검사
dog instanceof Dog;         // true
dog instanceof Animal;      // true
dog instanceof LivingThing; // true
dog instanceof Object;      // true
```

---

## 믹스인 패턴 — 다중 상속 우회

JavaScript는 단일 상속만 지원하지만, 믹스인 함수로 기능을 조합할 수 있습니다.

```javascript
const Serializable = (Base) => class extends Base {
  serialize() { return JSON.stringify(this); }
};

const Validatable = (Base) => class extends Base {
  validate() { return Object.keys(this).length > 0; }
};

class User {
  constructor(name) { this.name = name; }
}

// 믹스인 적용
class EnhancedUser extends Serializable(Validatable(User)) {}

const u = new EnhancedUser('Alice');
u.serialize();  // '{"name":"Alice"}'
u.validate();   // true
u instanceof User; // true
```

다음 글에서는 프로토타입에서 자주 사용하는 메서드들(`Object.keys`, `Object.values`, `Object.entries`, `hasOwnProperty` 등)을 정리합니다.

---

**지난 글:** [Object.create — 프로토타입을 직접 지정해서 객체 만들기](/posts/js-object-create/)

**다음 글:** [프로토타입 메서드 총정리 — 객체 탐색과 복제 도구](/posts/js-prototype-methods/)

<br>
읽어주셔서 감사합니다. 😊
