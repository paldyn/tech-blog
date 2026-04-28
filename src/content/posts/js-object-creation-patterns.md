---
title: "객체 생성 패턴 — 팩토리, 생성자, 클래스, Object.create"
description: "JavaScript에서 객체를 만드는 다섯 가지 패턴(객체 리터럴, 팩토리 함수, 생성자 함수, Object.create, class)의 차이와 각각 언제 사용해야 하는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "객체생성", "팩토리함수", "생성자함수", "prototype", "class", "Object.create"]
featured: false
draft: false
---

[지난 글](/posts/js-this-in-event-handler/)에서 이벤트 핸들러와 `this`의 관계를 마무리했습니다. 지금까지 클로저, `this`, 프로토타입 등 다양한 개념을 살펴봤는데, 이 모든 것이 만나는 지점이 바로 **객체 생성**입니다. JavaScript에는 객체를 만드는 방법이 여러 가지 있고, 각각 다른 특성을 가집니다. 어떤 패턴이 더 "맞다"가 아니라, 상황에 따라 최적의 선택이 다릅니다.

---

## 패턴 1 — 객체 리터럴

가장 단순하고 직접적인 방법입니다.

```javascript
const user = {
  name: 'Alice',
  age: 30,
  greet() {
    return `Hi, I'm ${this.name}`;
  }
};

user.greet(); // "Hi, I'm Alice"
```

**장점**: 간결, 즉각적  
**단점**: 재사용 불가 (동일한 구조의 객체를 여러 개 만들 수 없음)  
**사용**: 단순한 DTO, 설정 객체, 한 번만 필요한 네임스페이스

객체 리터럴의 `[[Prototype]]`은 자동으로 `Object.prototype`으로 설정됩니다.

---

## 패턴 2 — 팩토리 함수

함수가 객체를 생성하고 반환합니다. `new` 키워드가 필요 없습니다.

```javascript
function createUser(name, age) {
  // private 변수 가능 (클로저)
  let loginCount = 0;

  return {
    name,
    age,
    greet() { return `Hi, I'm ${name}`; },
    login() { loginCount++; return loginCount; },
    getLoginCount() { return loginCount; }
  };
}

const alice = createUser('Alice', 30);
const bob = createUser('Bob', 25);

alice.greet(); // "Hi, I'm Alice"
alice.login();
alice.getLoginCount(); // 1
```

**장점**: `new` 없음, 클로저로 진짜 `private` 변수 가능, `instanceof` 검사 없이 유연한 반환  
**단점**: 인스턴스마다 메서드 함수 객체가 복사됨 (prototype 공유 없음), 타입 식별(`instanceof`) 불가  
**사용**: private 상태가 중요하고, 인스턴스 수가 적을 때

![객체 생성 패턴 비교](/assets/posts/js-object-creation-patterns-overview.svg)

---

## 패턴 3 — 생성자 함수

`new`와 함께 호출되는 함수입니다. ES6 이전의 클래스 역할을 했습니다.

```javascript
function User(name, age) {
  this.name = name;
  this.age = age;
}

// prototype에 메서드 추가 — 모든 인스턴스가 공유
User.prototype.greet = function() {
  return `Hi, I'm ${this.name}`;
};

User.prototype.toString = function() {
  return `User(${this.name}, ${this.age})`;
};

const alice = new User('Alice', 30);
const bob = new User('Bob', 25);

alice.greet(); // "Hi, I'm Alice"
alice instanceof User; // true

// prototype 메서드 공유 확인
alice.greet === bob.greet; // true — 같은 함수 객체
```

**장점**: prototype으로 메서드 공유 (메모리 효율), `instanceof` 사용 가능  
**단점**: `new`를 빠뜨리면 `this`가 전역이 되는 버그, `class`보다 장황함  
**사용**: 레거시 코드 유지보수, ES5 이하 환경

---

## 패턴 4 — Object.create

`prototype`을 명시적으로 지정해 객체를 생성합니다.

```javascript
const userProto = {
  greet() { return `Hi, I'm ${this.name}`; },
  toString() { return `User(${this.name})`; }
};

// userProto를 prototype으로 하는 새 객체 생성
const alice = Object.create(userProto);
alice.name = 'Alice';
alice.age = 30;

alice.greet(); // "Hi, I'm Alice"

// 상속 체인 확인
Object.getPrototypeOf(alice) === userProto; // true
```

`Object.create(null)`로 prototype이 없는 순수한 사전(dictionary) 객체를 만들 수도 있습니다.

```javascript
// 프로토타입 체인이 없는 순수 map
const cache = Object.create(null);
cache.key = 'value';
'toString' in cache; // false — Object.prototype 상속 없음
```

**장점**: prototype 체인을 직접 제어, 사전(pure map) 용도  
**단점**: 초기화 문법이 번거로움, `class`가 더 명확  
**사용**: 프로토타입 상속을 세밀하게 제어할 때, `null` prototype map

![생성 패턴과 prototype 연결 구조](/assets/posts/js-object-creation-patterns-prototype.svg)

---

## 패턴 5 — class (권장)

ES6에서 도입된 클래스 문법입니다. 내부적으로는 생성자 함수 + prototype과 동일하지만, 더 명확하고 기능이 풍부합니다.

```javascript
class User {
  #name; // private 필드 (ES2022)
  #age;

  constructor(name, age) {
    this.#name = name;
    this.#age = age;
  }

  greet() { return `Hi, I'm ${this.#name}`; }
  get age() { return this.#age; }

  static create(name, age) {
    return new User(name, age);
  }
}

const alice = new User('Alice', 30);
alice.greet();   // "Hi, I'm Alice"
alice.age;       // 30 (getter)
alice.#name;     // SyntaxError — private 접근 불가

const bob = User.create('Bob', 25); // 정적 팩토리
alice instanceof User; // true
```

**장점**: 명확한 문법, `private` 필드, `static`, `extends`/`super`, 암묵적 엄격 모드, 타입스크립트 통합 우수  
**단점**: 함수형 프로그래밍 패러다임과 결합이 어색할 수 있음  
**사용**: 대부분의 현대 JavaScript 객체 지향 코드

---

## 패턴 선택 가이드

| 상황 | 권장 패턴 |
|------|-----------|
| 단순 데이터 객체 (DTO) | 객체 리터럴 |
| private 상태 + `new` 없이 | 팩토리 함수 |
| 상속 구조, `instanceof` 필요 | `class` |
| prototype 체인 세밀 제어 | `Object.create` |
| 레거시 코드 (ES5 이하) | 생성자 함수 |
| 사전(순수 map) 객체 | `Object.create(null)` 또는 `Map` |

---

## class는 정말 문법 설탕인가

`class`와 생성자 함수가 동일하다는 말을 자주 듣습니다. 대부분 맞지만 차이점이 있습니다.

```javascript
// class와 생성자 함수의 차이
class Foo {}
typeof Foo; // 'function' — 내부는 함수

// 차이 1: class는 new 없이 호출 불가
Foo(); // TypeError: Class constructor Foo cannot be invoked without 'new'

// 차이 2: class 메서드는 enumerable false
for (let k in alice) console.log(k); // name, age만 (greet 제외)

// 차이 3: class는 TDZ (let/const처럼)
new Bar(); // ReferenceError
class Bar {}
```

이 차이들은 `class`를 실수하기 어렵고 일관성 있게 만들어줍니다.

---

## 실무 권장 사항

현대 JavaScript 프로젝트에서는:
- 대부분의 객체 구조 → **`class`**
- 진짜 private 캡슐화가 중요하고 함수형 스타일 → **팩토리 함수**
- 단순한 데이터 묶음 → **객체 리터럴**
- `class`의 `#` private 필드가 ES2022에 표준화되어 팩토리 함수의 클로저 private 장점이 줄었습니다

다음 포스트에서는 프로퍼티 디스크립터를 통해 객체 프로퍼티를 더 세밀하게 제어하는 방법을 살펴봅니다.

---

**지난 글:** [이벤트 핸들러와 this — currentTarget과 바인딩](/posts/js-this-in-event-handler/)

<br>
읽어주셔서 감사합니다. 😊
