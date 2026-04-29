---
title: "믹스인 패턴 — 다중 상속 없이 기능 합성하기"
description: "JavaScript에서 단일 상속 한계를 극복하는 믹스인(Mixin) 패턴을 함수형 믹스인, Symbol을 활용한 충돌 방지, 믹스인 팩토리, 실무 적용 사례까지 폭넓게 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "mixins", "composition", "multiple-inheritance", "functional-mixin", "design-pattern"]
featured: false
draft: false
---

[지난 글](/posts/js-instanceof-symbol/)에서 `instanceof`와 타입 검사를 살펴봤습니다. JavaScript의 클래스 상속은 단일 상속만 지원합니다. `class Dog extends Animal`에서 `Dog`은 `Animal` 하나만 상속받을 수 있습니다. 그러나 실제 코드에서는 여러 능력(직렬화, 검증, 로깅 등)을 조합해야 하는 경우가 많습니다. **믹스인 패턴**은 다중 상속 없이 기능을 자유롭게 합성하는 JavaScript의 관용적 해결책입니다.

![믹스인 패턴 기능 합성 다이어그램](/assets/posts/js-mixins-pattern-diagram.svg)

## 단일 상속의 한계

```javascript
class Serializable {
  serialize() { return JSON.stringify(this); }
}
class Validatable {
  validate() { return true; }
}

// 불가능: 다중 상속 없음
// class User extends Serializable, Validatable {}

// 방법 1: 긴 상속 체인 (Fragile Base Class 문제)
class User extends Serializable { }
// User는 Validatable을 상속받을 수 없음
```

깊은 상속 체인은 부모가 바뀌면 모든 하위 클래스에 영향이 퍼지고, 어떤 기능이 어디서 왔는지 추적하기 어렵습니다.

## 함수형 믹스인 — 핵심 패턴

함수형 믹스인은 **Base 클래스를 인수로 받아 기능이 추가된 서브클래스를 반환하는 함수**입니다.

```javascript
const Flyable = (B) =>
  class extends B {
    fly() { return 'fly'; }
  };
const Swim = (B) =>
  class extends B {
    swim() { return 'swim'; }
  };
class Animal {}
class Duck extends
  Flyable(Swim(Animal)) {}
const d = new Duck(); d.fly(); d.swim();
```

![함수형 믹스인 구현 코드](/assets/posts/js-mixins-pattern-code.svg)

`Flyable(Swim(Animal))`은 `Animal → SwimAnimal → FlyableSwimAnimal`의 프로토타입 체인을 만듭니다. `Duck`은 이 체인의 끝을 상속합니다.

## 믹스인에 이름 붙이기

익명 클래스를 반환하면 디버깅 시 이름이 나오지 않습니다. 이름을 붙이면 스택 트레이스가 더 명확합니다.

```javascript
const Serializable = (Base) => {
  class Serializable extends Base {
    serialize() {
      return JSON.stringify(this);
    }

    static deserialize(json) {
      return Object.assign(
        new this(), JSON.parse(json)
      );
    }
  }
  return Serializable;
};

class Model {}
class User extends Serializable(Model) {
  constructor(name) {
    super();
    this.name = name;
  }
}

const u = new User('Alice');
console.log(u.serialize()); // '{"name":"Alice"}'
```

## Symbol로 충돌 방지

믹스인을 여러 개 조합하면 메서드 이름이 충돌할 수 있습니다. Symbol을 키로 사용하면 이를 방지합니다.

```javascript
const LOG_METHOD = Symbol('log');

const Loggable = (Base) =>
  class extends Base {
    [LOG_METHOD](msg) {
      console.log(`[${this.constructor.name}] ${msg}`);
    }
  };

class Service {}
class UserService extends Loggable(Service) {
  create(name) {
    this[LOG_METHOD](`유저 생성: ${name}`);
    return { name };
  }
}

new UserService().create('Bob');
// [UserService] 유저 생성: Bob
```

Symbol 키는 실수로 덮어쓸 위험이 없고, `for...in`, `Object.keys()`에도 나타나지 않아 '내부용'임을 명확히 합니다.

## 타입 확인 — instanceof와 믹스인

믹스인으로 만든 클래스와 `instanceof`는 예상과 다를 수 있습니다.

```javascript
const Flyable = (B) => class extends B {};
class Animal {}
class Duck extends Flyable(Animal) {}

const d = new Duck();
console.log(d instanceof Duck);           // true
console.log(d instanceof Animal);         // true
// d instanceof Flyable? -- Flyable은 함수, 클래스 아님
// Flyable(Animal).prototype 확인 필요
```

믹스인 적용 여부를 확인하려면 고유 Symbol을 활용합니다.

```javascript
const IS_FLYABLE = Symbol('isFlyable');
const Flyable2 = (B) =>
  class extends B {
    static [Symbol.hasInstance](obj) {
      return IS_FLYABLE in Object.getPrototypeOf(obj);
    }
    get [IS_FLYABLE]() { return true; }
  };
```

## 실무 패턴 — 검증 + 직렬화 조합

실무에서 여러 믹스인을 조합하는 전형적인 패턴입니다.

```javascript
const Timestamped = (B) =>
  class extends B {
    constructor(...args) {
      super(...args);
      this.createdAt = new Date();
    }
  };

const Activatable = (B) =>
  class extends B {
    isActive = true;
    activate() { this.isActive = true; }
    deactivate() { this.isActive = false; }
  };

class BaseModel {
  toJSON() { return { ...this }; }
}

class User extends Timestamped(Activatable(BaseModel)) {
  constructor(name) {
    super();
    this.name = name;
  }
}

const u = new User('Alice');
console.log(u.createdAt); // Date
console.log(u.isActive);  // true
u.deactivate();
console.log(u.isActive);  // false
```

## 믹스인 vs 컴포지션

믹스인 대신 **컴포지션(composition)**을 사용하는 방법도 있습니다.

```javascript
// 컴포지션: 기능 객체를 멤버로 보유
class Logger {
  log(msg) { console.log(msg); }
}

class UserService {
  #logger = new Logger();

  create(name) {
    this.#logger.log(`유저 생성: ${name}`);
    return { name };
  }
}
```

컴포지션은 프로토타입 체인을 복잡하게 만들지 않고, 의존성을 명시적으로 주입할 수 있어 테스트하기 쉽습니다. 믹스인은 `instanceof` 관계가 필요하거나 프로토타입에 메서드를 공유하는 것이 중요할 때 선택합니다.

**일반 원칙**: 상속이 "is-a" 관계, 믹스인이 "can-do" 관계, 컴포지션이 "has-a" 관계에 적합합니다.

---

**지난 글:** [instanceof와 Symbol.hasInstance — 타입 검사의 비밀](/posts/js-instanceof-symbol/)

**다음 글:** [데코레이터 — @syntax로 클래스와 메서드 꾸미기](/posts/js-decorators/)

<br>
읽어주셔서 감사합니다. 😊
