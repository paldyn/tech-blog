---
title: "this 키워드 — 호출 방식이 this를 결정한다"
description: "JavaScript에서 가장 혼란스러운 개념인 this를 호출 방식에 따른 4가지 바인딩 규칙으로 완전히 정리합니다. 화살표 함수의 렉시컬 this도 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-24"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "this", "바인딩", "call", "apply", "bind", "화살표함수", "렉시컬this"]
featured: false
draft: false
---

[지난 글](/posts/js-closure/)에서 이어집니다.

JavaScript를 배우다 보면 반드시 만나는 혼란이 있습니다. 분명 같은 함수인데, 어떤 때는 `this`가 전역 객체고, 어떤 때는 특정 객체이고, 어떤 때는 `undefined`입니다. 규칙이 없는 것처럼 느껴지죠.

실은 규칙이 있습니다. 하나의 원칙만 기억하면 됩니다. **`this`는 함수가 어떻게 정의됐는지가 아니라, 어떻게 호출됐는지에 따라 결정된다.** (화살표 함수는 예외입니다. 이건 나중에 설명합니다.)

이 원칙에서 네 가지 규칙이 나옵니다.

---

## 규칙 1: 기본 바인딩 — 단순 호출

함수를 그냥 호출하면 `this`는 전역 객체입니다. 브라우저에서는 `window`, Node.js에서는 `global`입니다.

```js
function showThis() {
  console.log(this);
}

showThis(); // window (브라우저) or global (Node.js)
```

단, ES6 모듈이나 `'use strict'` 모드에서는 `this`가 `undefined`입니다. 전역 객체 오염을 막기 위한 설계입니다.

```js
'use strict';

function showThis() {
  console.log(this); // undefined
}

showThis();
```

현대 JavaScript는 대부분 strict 모드로 동작합니다. 단순 호출에서 `this`를 쓰는 것은 피하는 게 좋습니다.

---

## 규칙 2: 암시적 바인딩 — 메서드 호출

객체의 메서드로 함수를 호출하면 `this`는 그 객체를 가리킵니다. 점(`.`) 왼쪽에 있는 것이 `this`입니다.

```js
const user = {
  name: "Alice",
  greet() {
    return `안녕하세요, ${this.name}님!`;
  },
};

user.greet(); // "안녕하세요, Alice님!" — this = user
```

주의할 점은 **메서드를 변수에 꺼내 호출하면 바인딩이 사라진다**는 것입니다.

```js
const fn = user.greet;
fn(); // "안녕하세요, undefined님!" — this = 전역 or undefined
```

`fn`은 이제 `user`와 연결이 끊겼습니다. 단순 호출이 되어 기본 바인딩 규칙이 적용됩니다. 콜백으로 메서드를 전달할 때도 같은 문제가 생깁니다.

```js
setTimeout(user.greet, 1000); // this를 잃어버림
```

---

## 규칙 3: 명시적 바인딩 — call, apply, bind

`call`, `apply`, `bind`를 사용하면 `this`를 직접 지정할 수 있습니다.

```js
function introduce(greeting) {
  return `${greeting}, 저는 ${this.name}입니다.`;
}

const person = { name: "Bob" };

introduce.call(person, "안녕하세요");   // "안녕하세요, 저는 Bob입니다."
introduce.apply(person, ["반갑습니다"]); // "반갑습니다, 저는 Bob입니다."
```

`call`과 `apply`의 차이는 인수 전달 방식입니다. `call`은 하나씩, `apply`는 배열로 전달합니다.

`bind`는 즉시 호출하지 않고 `this`가 고정된 새 함수를 반환합니다.

```js
const boundGreet = user.greet.bind(user);
setTimeout(boundGreet, 1000); // ✓ this = user가 유지됨
```

메서드를 콜백으로 전달할 때 `bind`로 해결하는 패턴이 자주 쓰입니다.

---

## 규칙 4: new 바인딩 — 생성자 호출

함수를 `new`로 호출하면 `this`는 새로 만들어지는 객체를 가리킵니다.

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

const alice = new Person("Alice", 30);
console.log(alice.name); // "Alice"
console.log(alice.age);  // 30
```

`new`를 사용하면 엔진이 내부적으로 세 가지를 합니다.

1. 새 빈 객체를 만든다
2. `this`를 그 객체로 설정한다
3. 함수 실행 후 그 객체를 반환한다

네 규칙의 우선순위는 `new > call/apply/bind > 메서드 호출 > 단순 호출` 순입니다.

![this 바인딩 4가지 규칙 — 기본·암시적·명시적·new 바인딩](/assets/posts/js-this-binding-rules.svg)

---

## 화살표 함수: 렉시컬 this

화살표 함수는 위의 네 규칙을 따르지 않습니다. **자신만의 `this`를 갖지 않습니다.** 대신 선언된 위치의 `this`를 캡처해 사용합니다. 이를 **렉시컬 this(Lexical this)** 라고 합니다.

![일반 함수 vs 화살표 함수의 this 차이](/assets/posts/js-this-arrow-vs-regular.svg)

콜백 안에서 외부 객체의 `this`를 사용해야 할 때 화살표 함수가 깔끔한 해결책입니다.

```js
class Timer {
  constructor() {
    this.seconds = 0;
  }

  start() {
    setInterval(() => {
      this.seconds++; // ✓ Timer 인스턴스의 this
      console.log(this.seconds);
    }, 1000);
  }
}

new Timer().start(); // 1, 2, 3 ...
```

화살표 함수 안의 `this`는 `setInterval`이 어떻게 호출하든 상관없이 `start()`가 호출된 시점의 `this`(Timer 인스턴스)입니다.

---

## 화살표 함수를 쓰면 안 되는 경우

화살표 함수가 항상 편리한 것은 아닙니다. 객체의 메서드로 화살표 함수를 사용하면 의도하지 않은 동작이 생깁니다.

```js
const obj = {
  value: 42,
  getValue: () => this.value, // ❌ this는 전역 (렉시컬 this)
};

obj.getValue(); // undefined
```

객체 리터럴은 새 스코프를 만들지 않습니다. 화살표 함수가 선언된 위치의 `this`는 전역입니다. 메서드에는 일반 함수를 사용해야 합니다.

마찬가지로 이벤트 핸들러에서 `this`로 이벤트 대상 요소에 접근하려 할 때도 화살표 함수 대신 일반 함수를 써야 합니다.

---

## this 문제를 피하는 실용적 방법

현대 JavaScript에서는 클래스와 화살표 함수를 조합해 대부분의 `this` 문제를 피합니다.

```js
class EventHandler {
  constructor() {
    this.count = 0;
    this.handleClick = this.handleClick.bind(this); // bind로 고정
  }

  handleClick() {
    this.count++;
    console.log(this.count);
  }
}
```

또는 클래스 필드 문법으로 더 간결하게 쓸 수 있습니다.

```js
class EventHandler {
  count = 0;

  handleClick = () => { // 화살표 함수로 렉시컬 this 활용
    this.count++;
  };
}
```

이 패턴은 React 클래스 컴포넌트에서도 자주 볼 수 있습니다.

---

`this`는 처음엔 혼란스럽지만, 네 가지 규칙을 알고 나면 동작을 예측할 수 있습니다. 다음 글에서는 **프로토타입과 상속**을 살펴봅니다. JavaScript가 `this`와 프로토타입 체인을 어떻게 연결해 객체 지향을 구현하는지 알아봅니다.

---

**지난 글:** [클로저 — 함수가 기억하는 것들](/posts/js-closure/)

**다음 글:** [프로토타입과 상속 — JavaScript 객체 지향의 실체](/posts/js-prototype-and-inheritance/)

<br>
읽어주셔서 감사합니다. 😊
