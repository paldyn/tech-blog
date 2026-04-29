---
title: "Object.create — 프로토타입을 직접 지정해서 객체 만들기"
description: "Object.create의 동작 원리, 두 번째 인자로 프로퍼티 디스크립터를 전달하는 방법, Object.create(null)로 순수 사전 객체를 만드는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "Object.create", "prototype", "inheritance", "dictionary", "null-prototype"]
featured: false
draft: false
---

[지난 글](/posts/js-proto-vs-prototype/)에서 `prototype` 프로퍼티와 `[[Prototype]]` 내부 슬롯의 차이를 정리했습니다. `Object.create`는 이 지식을 직접 활용해 `[[Prototype]]`을 원하는 객체로 설정하면서 새 객체를 만드는 메서드입니다. `new` 키워드 없이 명시적으로 상속 구조를 구성할 수 있습니다.

---

## 기본 사용법

```javascript
const proto = {
  greet() { return `Hi, I'm ${this.name}`; },
  describe() { return `${this.name} is ${this.age}`; }
};

// proto를 [[Prototype]]으로 하는 새 객체 생성
const alice = Object.create(proto);
alice.name = 'Alice';
alice.age = 30;

alice.greet();   // "Hi, I'm Alice"
alice.describe(); // "Alice is 30"

Object.getPrototypeOf(alice) === proto; // true
```

`Object.create(proto)`는 `[[Prototype]]`이 `proto`로 설정된 빈 객체를 반환합니다.

---

## new와의 비교

```javascript
function User(name) {
  this.name = name;
}
User.prototype.greet = function() { return `Hi, ${this.name}`; };

// new로 생성
const alice = new User('Alice');

// Object.create로 동일한 결과
const bob = Object.create(User.prototype);
bob.name = 'Bob';

// 두 객체 모두 User.prototype을 [[Prototype]]으로 가짐
Object.getPrototypeOf(alice) === Object.getPrototypeOf(bob); // true
```

`new`는 생성자 함수를 실행해서 초기화까지 해주지만, `Object.create`는 체인만 설정하고 초기화는 직접 해야 합니다.

---

## 두 번째 인자 — 프로퍼티 디스크립터

`Object.create`의 두 번째 인자로 `Object.defineProperties`와 동일한 형식의 디스크립터 맵을 전달할 수 있습니다.

```javascript
const base = { speak() { return 'sound'; } };

const dog = Object.create(base, {
  name: {
    value: 'Rex',
    writable: true,
    enumerable: true,
    configurable: true
  },
  sound: {
    value: 'Woof',
    writable: true,
    enumerable: true,
    configurable: true
  }
});

dog.name;   // 'Rex'
dog.speak(); // 'sound'
```

장황하지만, 생성과 동시에 `non-enumerable` 프로퍼티를 설정할 때 유용합니다.

![Object.create로 구성한 체인](/assets/posts/js-object-create-chain.svg)

---

## Object.create(null) — 순수 사전 객체

첫 번째 인자를 `null`로 전달하면 `[[Prototype]]`이 없는 객체가 생성됩니다.

```javascript
const dict = Object.create(null);
dict['key'] = 'value';

// Object.prototype 메서드 상속 없음
dict.toString;   // undefined (Object.prototype에서 온 것이 아님)
dict.valueOf;    // undefined
'toString' in dict; // false

// 임의의 문자열 키를 안전하게 사용
dict['constructor'] = 'safe'; // 충돌 없음
dict['__proto__'] = 'safe';   // 충돌 없음
```

일반 `{}` 객체 리터럴은 `Object.prototype`을 상속하기 때문에 `'toString'`, `'constructor'`, `'hasOwnProperty'` 같은 키를 사용하면 프로토타입 프로퍼티를 가리거나 혼동이 생길 수 있습니다. `Object.create(null)`은 이 문제를 원천 차단합니다.

```javascript
// 프로퍼티 존재 확인도 Object.hasOwn으로
Object.hasOwn(dict, 'key');   // true
Object.hasOwn(dict, 'toString'); // false

// for...in도 안전하게 사용 가능 (상속받은 것이 없으므로)
for (const k in dict) {
  // 모두 own property
}
```

![Object.create(null) 순수 사전 객체](/assets/posts/js-object-create-null.svg)

---

## getOwnPropertyDescriptors와 함께 사용하는 완전 복사

```javascript
const original = {
  _val: 10,
  get value() { return this._val * 2; }
};

// Object.assign은 getter를 값으로 변환
const shallow = Object.assign({}, original);
// shallow.value === 20 (숫자, getter 사라짐)

// Object.create + getOwnPropertyDescriptors 는 getter 보존
const copy = Object.create(
  Object.getPrototypeOf(original),
  Object.getOwnPropertyDescriptors(original)
);
// copy.value === getter 함수 (접근할 때마다 _val * 2 계산)
copy._val = 5;
copy.value; // 10
```

---

## 다단계 체인 구성

```javascript
const animal = {
  breathe() { return 'breathing'; }
};

const mammal = Object.create(animal);
mammal.nurse = function() { return 'nursing'; };

const dog = Object.create(mammal);
dog.bark = function() { return 'Woof'; };

// 체인: dog → mammal → animal → Object.prototype → null
dog.breathe(); // 'breathing' — animal에서 찾음
dog.nurse();   // 'nursing' — mammal에서 찾음
dog.bark();    // 'Woof' — dog 자체에 있음

// 확인
animal.isPrototypeOf(dog); // true (간접 조상)
mammal.isPrototypeOf(dog); // true (직접 조상)
```

`class extends`가 없던 ES5 시절 이 패턴으로 상속 계층을 구성했습니다.

---

## 실무에서 Object.create를 쓰는 경우

- **프로토타입 상속 명시적 제어**: 특정 객체를 prototype으로 지정해야 할 때
- **Object.create(null) 사전**: 키 충돌 없는 순수 해시맵이 필요할 때
- **완전 복사 (getter 보존)**: `Object.getOwnPropertyDescriptors`와 조합
- **믹스인 패턴**: 여러 prototype을 합성하는 중간 단계

다음 글에서는 `class extends` 문법으로 구현되는 프로토타입 기반 상속의 전체 구조를 살펴봅니다.

---

**지난 글:** [__proto__ vs prototype — 두 이름의 혼동 완전 정리](/posts/js-proto-vs-prototype/)

**다음 글:** [프로토타입 상속 심화 — extends와 super의 내부 동작](/posts/js-prototype-inheritance/)

<br>
읽어주셔서 감사합니다. 😊
