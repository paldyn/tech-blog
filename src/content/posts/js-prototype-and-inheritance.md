---
title: "프로토타입과 상속 — JavaScript 객체 지향의 실체"
description: "JavaScript가 프로토타입 체인으로 상속을 구현하는 원리를 이해하고, ES6 클래스가 그 위에서 어떻게 동작하는지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "프로토타입", "prototype", "상속", "클래스", "class", "객체지향", "OOP"]
featured: false
draft: false
---

앞선 글에서 `this`가 호출 방식에 따라 결정된다는 것을 배웠습니다. 그리고 `new` 키워드를 쓰면 `this`가 새 객체를 가리킨다는 것도 확인했습니다. 그 `new`가 만들어내는 객체들은 어떻게 서로 메서드를 공유할까요?

JavaScript는 Java나 C++과 다릅니다. **클래스 기반** 언어가 아니라 **프로토타입 기반** 언어입니다. ES6에서 `class` 키워드가 추가됐지만, 이것은 문법적 편의를 위한 포장이고 내부는 여전히 프로토타입 체인으로 작동합니다. 프로토타입을 이해하면 `class`도, `Object.create`도, `instanceof`도 모두 명확하게 보입니다.

---

## 프로토타입이란

모든 JavaScript 객체는 내부적으로 `[[Prototype]]`이라는 숨겨진 링크를 갖고 있습니다. 이 링크는 다른 객체를 가리킵니다. 속성이나 메서드를 찾을 때 엔진은 먼저 객체 자신을 살피고, 없으면 `[[Prototype]]`이 가리키는 객체로 이동해서 찾습니다. 거기도 없으면 그 객체의 `[[Prototype]]`으로… 이 과정이 `null`을 만날 때까지 반복됩니다. 이것이 **프로토타입 체인(Prototype Chain)** 입니다.

```js
const arr = [1, 2, 3];
arr.map(x => x * 2); // arr에 map이 없는데 어떻게 쓸 수 있을까?
```

`arr`에는 `map` 메서드가 없습니다. 엔진이 `arr.__proto__`(= `Array.prototype`)로 이동해서 `map`을 찾습니다. `Array.prototype.map`이 있으므로 그것을 실행합니다. `toString`, `hasOwnProperty` 같은 메서드도 `Object.prototype`에서 찾습니다.

```js
console.log(arr.__proto__ === Array.prototype); // true
console.log(Array.prototype.__proto__ === Object.prototype); // true
console.log(Object.prototype.__proto__); // null
```

---

## 생성자 함수와 prototype 속성

함수를 `new`로 호출하면 "생성자 함수"로 동작합니다. 이때 생성된 인스턴스의 `[[Prototype]]`은 생성자 함수의 `prototype` 속성이 됩니다.

```js
function Person(name) {
  this.name = name;
}

Person.prototype.greet = function() {
  return `안녕하세요, 저는 ${this.name}입니다.`;
};

const alice = new Person("Alice");
const bob = new Person("Bob");

alice.greet(); // "안녕하세요, 저는 Alice입니다."
bob.greet();   // "안녕하세요, 저는 Bob입니다."

alice.greet === bob.greet; // true — 같은 함수를 공유
```

`greet` 메서드는 `Person.prototype`에 하나만 존재하고, 모든 인스턴스가 공유합니다. 인스턴스마다 메서드를 복사하는 것이 아니라 **참조를 공유**하므로 메모리 효율적입니다.

![프로토타입 체인 — 인스턴스에서 Object.prototype까지의 탐색 경로](/assets/posts/js-prototype-chain.svg)

---

## 프로토타입 상속

한 생성자가 다른 생성자를 상속하려면 프로토타입 체인을 연결해야 합니다. ES5에서는 `Object.create`를 사용했습니다.

```js
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function() {
  return `${this.name}이(가) 소리를 냅니다.`;
};

function Dog(name, breed) {
  Animal.call(this, name); // 부모 생성자 호출
  this.breed = breed;
}

// Dog의 프로토타입을 Animal.prototype을 기반으로 설정
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog; // constructor 복원

Dog.prototype.bark = function() {
  return "멍멍!";
};

const rex = new Dog("Rex", "Labrador");
rex.speak(); // "Rex이(가) 소리를 냅니다." — Animal에서 상속
rex.bark();  // "멍멍!" — Dog 자체
```

코드가 복잡하고 실수하기 쉽습니다. 이것을 깔끔하게 표현하기 위해 ES6에서 `class`가 도입됐습니다.

---

## ES6 클래스: 프로토타입의 문법적 설탕

`class`는 새로운 객체 지향 시스템이 아닙니다. 위의 생성자 함수 + 프로토타입 패턴을 더 읽기 쉽게 표현하는 **문법적 설탕(Syntactic Sugar)** 입니다.

![프로토타입 방식 vs 클래스 방식 비교 — 내부 동작은 동일하다](/assets/posts/js-prototype-class-vs-proto.svg)

```js
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    return `${this.name}이(가) 소리를 냅니다.`;
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // Animal 생성자 호출
    this.breed = breed;
  }

  bark() {
    return "멍멍!";
  }
}

const rex = new Dog("Rex", "Labrador");
rex.speak(); // "Rex이(가) 소리를 냅니다."
rex.bark();  // "멍멍!"
```

`extends`는 프로토타입 체인을 자동으로 연결하고, `super()`는 부모 생성자를 호출합니다. `Dog`의 인스턴스 `rex`는 `Dog.prototype → Animal.prototype → Object.prototype → null` 체인을 갖습니다.

내부적으로 생성자 함수 버전과 동일합니다.

```js
typeof Dog; // "function" — 클래스도 사실은 함수
rex instanceof Dog;    // true
rex instanceof Animal; // true — 체인 전체에서 확인
```

---

## hasOwnProperty: 자신의 속성인지 확인

프로토타입 체인을 통해 상속된 속성과 인스턴스 자신의 속성을 구분해야 할 때 `hasOwnProperty`를 사용합니다.

```js
const alice = new Person("Alice");

alice.hasOwnProperty("name");  // true — 인스턴스 자체 속성
alice.hasOwnProperty("greet"); // false — 프로토타입에서 상속
```

`for...in` 루프는 프로토타입 체인 전체를 순회합니다. 인스턴스 자신의 속성만 다루려면 `hasOwnProperty`로 필터링하거나, 더 현대적으로는 `Object.keys()`를 사용합니다.

```js
Object.keys(alice); // ["name"] — 자신의 열거 가능한 속성만
```

---

## Object.create: 프로토타입 직접 지정

`Object.create(proto)`는 `proto`를 `[[Prototype]]`으로 가지는 새 객체를 만듭니다.

```js
const personProto = {
  greet() {
    return `안녕하세요, ${this.name}입니다.`;
  },
};

const alice = Object.create(personProto);
alice.name = "Alice";
alice.greet(); // "안녕하세요, Alice입니다."
```

생성자 함수 없이도 프로토타입 기반 상속을 구현할 수 있습니다. 설정이 단순한 객체에 유용합니다.

---

## 언제 클래스를, 언제 다른 패턴을?

`class`는 명확한 계층 구조를 가진 상속이 필요할 때 적합합니다. React 클래스 컴포넌트, 서비스 레이어, 에러 클래스 등이 전형적인 사례입니다.

반면 단순한 데이터 구조나 믹스인(여러 출처에서 기능을 조합)이 필요할 때는 일반 객체와 `Object.assign`, 또는 함수 합성이 더 간결한 경우가 많습니다. JavaScript는 클래스 기반 OOP와 함수형 패턴을 모두 지원하며, 상황에 따라 선택할 수 있습니다.

---

프로토타입과 상속은 JavaScript 런타임의 근본 메커니즘입니다. 다음 글에서는 이 메커니즘들이 실제로 작동하는 환경인 **실행 컨텍스트**를 살펴봅니다. 코드가 어떤 순서로 처리되고, 스코프와 `this`가 어떻게 설정되는지 엔진의 눈으로 들여다봅니다.

---

**다음 글:** 실행 컨텍스트 — 코드가 실행되는 공간

<br>
읽어주셔서 감사합니다. 😊
