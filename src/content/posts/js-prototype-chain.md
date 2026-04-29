---
title: "프로토타입 체인 — 상속의 실제 동작 원리"
description: "JavaScript 프로토타입 체인의 구조, 프로퍼티 탐색 순서, 프로퍼티 가림(Shadowing), in 연산자와 hasOwnProperty 비교를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "prototype", "prototype-chain", "inheritance", "hasOwnProperty", "Object.prototype", "shadowing"]
featured: false
draft: false
---

[지난 글](/posts/js-freeze-seal-prevent/)에서 객체를 잠그는 세 가지 메서드를 살펴봤습니다. 이번에는 JavaScript 상속의 핵심 메커니즘인 **프로토타입 체인**을 파헤칩니다. `class`가 없던 시절부터, 그리고 지금도 `class` 문법 내부에서 실제로 이 체인이 동작하고 있습니다.

---

## 모든 객체는 [[Prototype]]을 가진다

JavaScript의 모든 객체는 숨겨진 내부 슬롯 `[[Prototype]]`을 갖습니다. 이 슬롯은 다른 객체(또는 `null`)를 가리킵니다. 프로퍼티를 찾을 때 현재 객체에 없으면 `[[Prototype]]`이 가리키는 객체로 이동해 탐색합니다. 이것이 **프로토타입 체인**입니다.

```javascript
class User {
  constructor(name) { this.name = name; }
  greet() { return `Hi, I'm ${this.name}`; }
}

const alice = new User('Alice');

// 체인: alice → User.prototype → Object.prototype → null
Object.getPrototypeOf(alice) === User.prototype;          // true
Object.getPrototypeOf(User.prototype) === Object.prototype; // true
Object.getPrototypeOf(Object.prototype) === null;          // true
```

![프로토타입 체인 구조](/assets/posts/js-prototype-chain-structure.svg)

---

## 프로퍼티 탐색 순서

`alice.greet()`를 호출할 때 엔진이 하는 일:

1. `alice` 자체에 `greet` 프로퍼티가 있는지 확인 → 없음
2. `alice[[Prototype]]` = `User.prototype`에서 탐색 → 있음 → 호출
3. 없었다면: `Object.prototype` 탐색
4. 없었다면: `null`에 도달 → `undefined` 반환 (함수 호출 시 `TypeError`)

```javascript
alice.name;    // 'Alice' — alice 자체에 있음
alice.greet;   // ƒ greet(){} — User.prototype에서 찾음
alice.valueOf; // ƒ valueOf(){} — Object.prototype에서 찾음
alice.xyz;     // undefined — 체인 끝까지 없음
alice.xyz();   // TypeError: alice.xyz is not a function
```

---

## 프로퍼티 가림 (Shadowing)

인스턴스에 prototype과 같은 이름의 프로퍼티를 추가하면 prototype 버전이 가려집니다.

```javascript
const alice = new User('Alice');
const bob = new User('Bob');

// alice 인스턴스에 greet 추가 → prototype의 greet를 가림
alice.greet = function() { return 'Custom greet!'; };

alice.greet(); // 'Custom greet!' — 인스턴스 자체의 것
bob.greet();   // "Hi, I'm Bob" — prototype의 것 (가림 없음)
```

가림이 일어나도 prototype 버전이 삭제되는 것은 아닙니다. `delete alice.greet` 후에는 다시 prototype의 `greet`가 보입니다.

---

## in vs Object.hasOwn

```javascript
class Animal {
  speak() { return '...'; }
}
const dog = new Animal();
dog.name = 'Rex';

// in: 체인 전체 탐색
'name' in dog;    // true — 인스턴스 자체
'speak' in dog;   // true — prototype에 있음
'valueOf' in dog; // true — Object.prototype에 있음

// Object.hasOwn (ES2022): 인스턴스 자체만
Object.hasOwn(dog, 'name');   // true
Object.hasOwn(dog, 'speak');  // false — prototype에 있음

// 구형 방식 (Object.create(null) 안전 아님)
dog.hasOwnProperty('name');   // true — 권장하지 않음
```

`Object.hasOwn`은 `hasOwnProperty`보다 안전합니다. `Object.create(null)`로 만든 객체는 `hasOwnProperty`를 상속받지 않아 오류가 발생할 수 있기 때문입니다.

![프로퍼티 탐색 vs hasOwnProperty](/assets/posts/js-prototype-chain-lookup.svg)

---

## Object.prototype의 역할

모든 일반 객체의 체인 끝에는 `Object.prototype`이 있습니다. 여기서 상속받는 주요 메서드들입니다.

```javascript
// Object.prototype의 메서드들
const obj = { x: 1 };

obj.toString();          // '[object Object]'
obj.valueOf();           // { x: 1 }
obj.hasOwnProperty('x'); // true
obj.isPrototypeOf({});   // false

// 이 메서드들은 obj 자체에 없고 Object.prototype에서 상속됨
Object.hasOwn(obj, 'toString'); // false
```

---

## 체인이 없는 객체

`Object.create(null)`로 `[[Prototype]]`이 `null`인 객체를 만들 수 있습니다.

```javascript
const dict = Object.create(null);
dict.key = 'value';

dict.toString;           // undefined — Object.prototype 없음
Object.toString in dict; // false

// 순수 사전(dictionary)으로 안전하게 사용
dict.hasOwnProperty;     // undefined
// 따라서 Object.hasOwn(dict, 'key')처럼 정적 메서드를 써야 함
```

---

## 체인 확인 메서드

```javascript
// 체인에 있는지 확인
User.prototype.isPrototypeOf(alice); // true
Object.prototype.isPrototypeOf(alice); // true

// 직접적인 [[Prototype]] 확인
Object.getPrototypeOf(alice) === User.prototype; // true

// 프로토타입 변경 (성능상 권장하지 않음)
const cat = {};
Object.setPrototypeOf(cat, Animal.prototype);
cat.speak(); // '...'
```

`Object.setPrototypeOf`는 기존 객체의 `[[Prototype]]`을 변경하는데, 엔진이 최적화해둔 히든 클래스를 무효화할 수 있어 성능에 영향을 줍니다. 가능하면 생성 시점에 `Object.create`로 프로토타입을 설정하는 것이 낫습니다.

다음 글에서는 `__proto__`와 `prototype`이라는 두 이름이 어떻게 다른지, 그리고 혼동 없이 이해하는 방법을 살펴봅니다.

---

**지난 글:** [freeze · seal · preventExtensions — 객체 불변성 3단계](/posts/js-freeze-seal-prevent/)

**다음 글:** [__proto__ vs prototype — 두 이름의 혼동 완전 정리](/posts/js-proto-vs-prototype/)

<br>
읽어주셔서 감사합니다. 😊
