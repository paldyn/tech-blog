---
title: "__proto__ vs prototype — 두 이름의 혼동 완전 정리"
description: "JavaScript에서 함수의 .prototype 프로퍼티와 인스턴스의 [[Prototype]] 내부 슬롯(__proto__)이 어떻게 다른지, new 연산자가 이 둘을 어떻게 연결하는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "prototype", "__proto__", "[[Prototype]]", "constructor", "new", "class"]
featured: false
draft: false
---

[지난 글](/posts/js-prototype-chain/)에서 프로토타입 체인이 어떻게 프로퍼티를 탐색하는지 살펴봤습니다. 체인을 이해했어도 `prototype`과 `__proto__`라는 비슷한 이름 때문에 혼란스러운 경우가 많습니다. 이 두 개념을 정확히 구분하면 JavaScript 상속 메커니즘 전체가 명확해집니다.

---

## 핵심 구분

| | `Function.prototype` | `instance.__proto__` |
|---|---|---|
| 소유자 | **함수 객체** | **인스턴스 객체** |
| 타입 | 일반 프로퍼티 (객체) | 내부 슬롯 (`[[Prototype]]`) |
| 역할 | `new` 시 인스턴스의 `[[Prototype]]`이 됨 | 체인 탐색에 사용 |
| 접근 방법 | `User.prototype` | `Object.getPrototypeOf(alice)` |

---

## .prototype — 함수의 일반 프로퍼티

`function` 키워드나 `class`로 정의된 함수는 `prototype`이라는 프로퍼티를 자동으로 갖습니다. 이것은 **인스턴스 생성 시 `[[Prototype]]`에 할당될 객체**입니다.

```javascript
function User(name) {
  this.name = name;
}

// User.prototype은 평범한 객체
User.prototype.greet = function() {
  return `Hi, I'm ${this.name}`;
};

// User.prototype.constructor는 User 자신을 가리킴
User.prototype.constructor === User; // true

// 함수는 Function.prototype을 상속
User.__proto__ === Function.prototype; // true
```

---

## [[Prototype]] — 인스턴스의 내부 슬롯

`new User('Alice')`를 실행하면 엔진이 다음을 수행합니다.

```javascript
// new의 내부 동작 (의사코드)
function newOperator(Constructor, ...args) {
  // 1. Constructor.prototype을 [[Prototype]]으로 하는 새 객체 생성
  const obj = Object.create(Constructor.prototype);

  // 2. 생성자 함수 실행, this = obj
  const result = Constructor.apply(obj, args);

  // 3. 생성자가 객체를 반환하면 그것을, 아니면 obj 반환
  return (typeof result === 'object' && result !== null) ? result : obj;
}
```

결과로 만들어진 인스턴스의 `[[Prototype]]`은 `User.prototype`과 동일한 객체를 가리킵니다.

```javascript
const alice = new User('Alice');

Object.getPrototypeOf(alice) === User.prototype; // true
alice.__proto__ === User.prototype;              // true (레거시 접근자)
```

![__proto__ vs prototype 구조 다이어그램](/assets/posts/js-proto-vs-prototype-diagram.svg)

---

## 화살표 함수와 일반 메서드는 .prototype 없음

```javascript
const arrow = () => {};
arrow.prototype; // undefined
new arrow();     // TypeError: arrow is not a constructor

const method = { greet() {} };
method.greet.prototype; // undefined (메서드 단축 표기도 마찬가지)
```

`class` 메서드들도 동일합니다. 생성자(`constructor`)로 사용할 수 없는 함수들은 `.prototype` 프로퍼티가 없습니다.

---

## constructor 속성과 주의점

`User.prototype.constructor`는 `User`를 가리킵니다. 이를 통해 인스턴스가 어떤 생성자로 만들어졌는지 알 수 있습니다.

```javascript
const alice = new User('Alice');
alice.constructor === User;  // true (prototype 체인에서 찾음)
alice.constructor === Object; // false
```

그러나 `User.prototype`을 통째로 교체하면 `constructor`가 사라집니다.

```javascript
// 잘못된 패턴
User.prototype = {
  greet() { return 'Hi'; }
  // constructor가 없음!
};

const bob = new User('Bob');
bob.constructor === User;   // false
bob.constructor === Object; // true — Object.prototype.constructor에서 찾음

// 올바른 패턴 — constructor 복원
User.prototype = {
  constructor: User,  // 명시적으로 추가
  greet() { return 'Hi'; }
};
```

![prototype과 __proto__ 코드 확인](/assets/posts/js-proto-vs-prototype-code.svg)

---

## class에서의 동작

`class` 문법을 사용해도 내부 메커니즘은 동일합니다.

```javascript
class Animal {
  speak() { return 'sound'; }
}

class Dog extends Animal {
  speak() { return 'Woof'; }
}

const dog = new Dog();

// 인스턴스 체인
Object.getPrototypeOf(dog) === Dog.prototype;      // true
Object.getPrototypeOf(Dog.prototype) === Animal.prototype; // true

// 생성자 함수 체인 (class에서 extends가 만드는 것)
Object.getPrototypeOf(Dog) === Animal;             // true
```

`extends`는 두 가지 체인을 설정합니다.
1. **인스턴스 체인**: `Dog.prototype[[Prototype]] = Animal.prototype`
2. **생성자 체인**: `Dog[[Prototype]] = Animal` (정적 메서드 상속)

---

## __proto__ 사용 권장 여부

`__proto__`는 ECMAScript 표준에 레거시 기능으로 포함되어 있지만 사용을 권장하지 않습니다.

```javascript
// ❌ 비권장
alice.__proto__;
alice.__proto__ = someProto;

// ✅ 권장
Object.getPrototypeOf(alice);
Object.setPrototypeOf(alice, someProto);

// ✅ 생성 시 prototype 지정
const alice = Object.create(User.prototype);
```

특히 `Object.create(null)`로 만든 객체는 `__proto__` 접근자 자체가 없으므로 `Object.getPrototypeOf`를 쓰는 것이 안전합니다.

다음 글에서는 `Object.create`를 직접 사용해 prototype 체인을 자유롭게 구성하는 방법을 살펴봅니다.

---

**지난 글:** [프로토타입 체인 — 상속의 실제 동작 원리](/posts/js-prototype-chain/)

**다음 글:** [Object.create — 프로토타입을 직접 지정해서 객체 만들기](/posts/js-object-create/)

<br>
읽어주셔서 감사합니다. 😊
