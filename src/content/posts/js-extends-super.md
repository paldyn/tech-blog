---
title: "extends와 super — JavaScript 상속의 실제 동작"
description: "JavaScript 클래스 상속에서 extends와 super 키워드가 어떻게 동작하는지, 생성자에서의 super() 필수 규칙, 메서드 오버라이딩, 프로토타입 체인의 구조를 명확히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "class", "extends", "super", "inheritance", "prototype-chain", "method-override"]
featured: false
draft: false
---

[지난 글](/posts/js-class-getter-setter/)에서 getter/setter로 프로퍼티 접근을 제어하는 법을 살펴봤습니다. 클래스의 또 다른 핵심 기능은 **상속**입니다. `extends`로 부모 클래스를 이어받고, `super`로 부모의 생성자와 메서드에 접근합니다. 내부적으로 두 개의 프로토타입 체인이 연결된다는 사실을 이해하면 상속의 동작이 투명해집니다.

![상속 계층과 메서드 탐색 순서](/assets/posts/js-extends-super-hierarchy.svg)

## extends 기본

`extends` 키워드 뒤에 부모 클래스를 지정합니다.

```javascript
class Animal {
  constructor(name) { this.name = name; }
  speak() { return `${this.name}: ...`; }
}

class Dog extends Animal {
  speak() {
    return `${this.name}: 멍멍!`;
  }
}

const d = new Dog('바둑이');
d.speak(); // '바둑이: 멍멍!'
d.name;    // '바둑이' (Animal의 constructor가 설정)
```

`Dog`는 `Animal`을 상속하므로, `Dog`의 인스턴스는 `Animal`의 프로퍼티와 메서드에 모두 접근할 수 있습니다.

## super() — 부모 생성자 호출

서브클래스에서 `constructor`를 정의했다면, `this`를 사용하기 **전에** `super()`를 반드시 호출해야 합니다.

```javascript
class Animal {
  constructor(name) { this.name = name; }
  speak() { return 'generic sound'; }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // 부모 constructor 호출
    this.breed = breed;
  }
  speak() {
    const base = super.speak();
    return `${this.name}: 멍! (${base})`;
  }
}
const d = new Dog('바둑이', '진돗개');
```

![extends와 super 키워드 코드](/assets/posts/js-extends-super-code.svg)

`super()` 이전에 `this`를 사용하면 `ReferenceError`가 발생합니다. 이는 `new.target`과 부모 클래스의 인스턴스 초기화 과정이 완료되기 전이기 때문입니다.

```javascript
class Child extends Parent {
  constructor() {
    this.value = 1; // ReferenceError: Must call super first
    super();
  }
}
```

## 두 개의 프로토타입 체인

`extends`는 두 레벨의 프로토타입 관계를 설정합니다.

```javascript
class Animal {}
class Dog extends Animal {}

// 인스턴스 레벨 체인 (메서드 탐색)
Dog.prototype.__proto__ === Animal.prototype // true

// 클래스 레벨 체인 (정적 메서드 상속)
Dog.__proto__ === Animal // true
```

인스턴스의 메서드를 찾을 때는 `Dog.prototype → Animal.prototype → Object.prototype → null` 순으로 탐색합니다. 정적 메서드는 `Dog → Animal → Function.prototype → null` 순으로 탐색합니다.

## 메서드 오버라이딩

서브클래스에서 같은 이름의 메서드를 정의하면 부모 메서드를 **가립니다(오버라이드)**.

```javascript
class Shape {
  area() { return 0; }
  toString() { return `${this.constructor.name}: area=${this.area()}`; }
}

class Circle extends Shape {
  constructor(r) { super(); this.r = r; }
  area() { return Math.PI * this.r ** 2; } // 오버라이드
}

class Square extends Shape {
  constructor(s) { super(); this.s = s; }
  area() { return this.s ** 2; } // 오버라이드
}

new Circle(5).toString(); // 'Circle: area=78.53...'
new Square(4).toString(); // 'Square: area=16'
```

`toString()`은 부모 `Shape`에 있지만, `this.area()`를 호출하면 프로토타입 체인을 통해 각 서브클래스의 `area()`가 호출됩니다. 이것이 **다형성(polymorphism)**입니다.

## super.method() — 부모 메서드 호출

서브클래스에서 부모 메서드를 완전히 교체하지 않고 **확장**하고 싶을 때는 `super.method()`를 사용합니다.

```javascript
class Logger {
  log(message) {
    console.log(`[LOG] ${message}`);
  }
}

class TimestampLogger extends Logger {
  log(message) {
    const ts = new Date().toISOString();
    super.log(`[${ts}] ${message}`);
  }
}

new TimestampLogger().log('서버 시작');
// [LOG] [2026-04-29T...] 서버 시작
```

`super.log()`는 `Logger.prototype.log`를 `this`를 올바르게 바인딩해서 호출합니다.

## extends로 내장 클래스 상속

`Error`, `Array`, `Map` 같은 내장 클래스도 상속할 수 있습니다.

```javascript
class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

throw new ValidationError('email', '이메일 형식 오류');
// ValidationError: 이메일 형식 오류
//   at ...
```

커스텀 에러 클래스는 실무에서 에러를 구조화하는 데 필수적입니다. `instanceof`로 에러 종류를 구분하고 각각 다르게 처리할 수 있습니다.

## 표현식으로 extends

`extends` 뒤에는 클래스뿐 아니라 **클래스를 반환하는 표현식**도 올 수 있습니다.

```javascript
function withLogging(Base) {
  return class extends Base {
    constructor(...args) {
      super(...args);
      console.log(`${Base.name} 인스턴스 생성`);
    }
  };
}

class Service {}
const LoggedService = withLogging(Service);
new LoggedService(); // 'Service 인스턴스 생성'
```

이 패턴이 바로 다음에 다룰 **믹스인(mixin)** 패턴의 핵심입니다.

## 추상 클래스 시뮬레이션

JavaScript에는 추상 클래스가 없지만, 생성자에서 예외를 던져 직접 인스턴스화를 막을 수 있습니다.

```javascript
class AbstractShape {
  constructor() {
    if (new.target === AbstractShape) {
      throw new Error('AbstractShape는 직접 인스턴스화 불가');
    }
  }

  area() { throw new Error('area()를 구현해야 합니다'); }
}

class Triangle extends AbstractShape {
  constructor(base, height) {
    super();
    this.base = base;
    this.height = height;
  }
  area() { return (this.base * this.height) / 2; }
}

// new AbstractShape(); // Error
new Triangle(3, 4).area(); // 6
```

`new.target`은 `new`로 호출된 생성자를 가리킵니다. 서브클래스에서 `new Triangle()`을 호출하면 `new.target`이 `Triangle`이 되어 예외가 발생하지 않습니다.

---

**지난 글:** [클래스 getter/setter — 계산된 프로퍼티 설계](/posts/js-class-getter-setter/)

**다음 글:** [instanceof와 Symbol.hasInstance — 타입 검사의 비밀](/posts/js-instanceof-symbol/)

<br>
읽어주셔서 감사합니다. 😊
