---
title: "this 규칙 완전 정복 — 호출 방식이 this를 결정한다"
description: "JavaScript의 this가 어떻게 결정되는지 네 가지 바인딩 규칙(new, 명시적, 암묵적, 기본)과 우선순위를 실제 예제와 함께 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "this", "바인딩", "call", "apply", "bind", "new", "엄격모드"]
featured: false
draft: false
---

[지난 글](/posts/js-closure-memory-leak/)에서 클로저와 메모리 관리를 살펴봤습니다. 이제 JavaScript에서 가장 많이 혼란을 주는 주제 중 하나인 `this`로 넘어갑니다. `this`가 어렵게 느껴지는 이유는 단 하나입니다 — **선언된 위치가 아니라 호출된 방식**에 따라 결정되기 때문입니다. 네 가지 규칙과 우선순위만 이해하면 어떤 코드를 봐도 `this`가 무엇인지 즉시 판단할 수 있습니다.

---

## this란 무엇인가

`this`는 함수 내부에서 자동으로 제공되는 **컨텍스트 객체**에 대한 참조입니다. 어떤 객체를 기준으로 동작하는지를 나타냅니다. 중요한 점은 `this`가 함수 선언 시점이 아니라 **함수 호출 시점**에 동적으로 바인딩된다는 것입니다.

화살표 함수와 일반 함수의 `this` 동작이 다르다는 점이 이 개념을 더 복잡하게 만듭니다. 화살표 함수는 별도의 글에서 다루고, 이 글은 일반 함수에 집중합니다.

---

## 규칙 1 — 기본 바인딩 (Default Binding)

가장 단순한 경우: 함수를 단독으로 호출할 때입니다.

```javascript
function showThis() {
  console.log(this);
}

showThis();
// 비엄격 모드: window (브라우저) 또는 globalThis (Node.js)
// 엄격 모드: undefined
```

비엄격 모드에서는 전역 객체(`window`, `globalThis`)가 `this`가 됩니다. 엄격 모드(`'use strict'`)에서는 `undefined`입니다.

---

## 규칙 2 — 암묵적 바인딩 (Implicit Binding)

객체의 메서드로 호출할 때 점(`.`) 앞의 객체가 `this`가 됩니다.

```javascript
const user = {
  name: 'Alice',
  greet() {
    return this.name; // this는 user
  }
};

user.greet(); // 'Alice' — user가 this
```

중요한 함정은 **암묵적 바인딩 소실(Implicit Binding Loss)**입니다. 메서드를 변수에 할당해 호출하면 컨텍스트 객체 정보가 사라집니다.

```javascript
const fn = user.greet; // 참조만 복사, 컨텍스트는 사라짐
fn(); // undefined (엄격) 또는 전역의 name (비엄격)

// 콜백 함수에서도 같은 문제 발생
setTimeout(user.greet, 1000); // 'Alice'가 아님!
```

![this 바인딩 결정 규칙](/assets/posts/js-this-rules-binding.svg)

---

## 규칙 3 — 명시적 바인딩 (Explicit Binding)

`call`, `apply`, `bind`로 `this`를 직접 지정합니다.

```javascript
function greet(greeting) {
  return `${greeting}, ${this.name}!`;
}

const user = { name: 'Bob' };

// call: 인수를 쉼표로 나열
greet.call(user, 'Hello');   // 'Hello, Bob!'

// apply: 인수를 배열로
greet.apply(user, ['Hi']);   // 'Hi, Bob!'

// bind: this가 고정된 새 함수 반환
const boundGreet = greet.bind(user);
boundGreet('Hey');           // 'Hey, Bob!'
setTimeout(boundGreet, 1000, 'Delayed'); // 'Delayed, Bob!'
```

`bind`는 영구적으로 `this`를 고정한 새 함수를 반환합니다. 이 함수는 `call`이나 `apply`로도 `this`를 바꿀 수 없습니다.

---

## 규칙 4 — new 바인딩 (new Binding)

생성자 함수를 `new`로 호출하면 새 빈 객체가 생성되고, 그것이 `this`가 됩니다.

```javascript
function Person(name) {
  this.name = name; // 새로 생성된 객체의 name 프로퍼티 설정
  this.greet = function() {
    return `Hi, I'm ${this.name}`;
  };
}

const alice = new Person('Alice');
alice.greet(); // "Hi, I'm Alice"
```

`new`로 호출할 때 내부적으로 일어나는 과정:
1. 빈 객체 `{}`가 생성되고 `this`에 바인딩됩니다.
2. 함수 본문이 실행됩니다.
3. 함수가 객체를 명시적으로 반환하지 않으면 `this`가 반환됩니다.

---

## 우선순위

네 규칙이 충돌할 때 적용 우선순위: **new > 명시적 > 암묵적 > 기본**

```javascript
function Foo() {
  this.value = 42;
}

const bar = { value: 100 };

// bind로 명시적 바인딩
const BoundFoo = Foo.bind(bar);

// new가 bind보다 우선
const obj = new BoundFoo();
obj.value; // 42 — new가 이기고, bar가 아닌 새 객체가 this
```

`new`는 `bind`로 지정된 `this`도 오버라이드합니다. 이것이 `new`가 최우선인 이유입니다.

---

## 엄격 모드와 this

엄격 모드는 기본 바인딩에만 영향을 줍니다. 명시적·암묵적·new 바인딩에는 영향 없습니다.

```javascript
'use strict';

function strict() {
  console.log(this); // undefined
}

function nonStrict() {
  console.log(this); // window/globalThis
}

strict();    // undefined — 기본 바인딩 + 엄격모드
nonStrict(); // window/globalThis
```

ES 모듈(`import`/`export`)은 기본적으로 엄격 모드이므로, 모듈 내 함수의 기본 바인딩 `this`는 `undefined`입니다.

---

## 암묵적 바인딩 소실 대응법

```javascript
const user = {
  name: 'Alice',
  greet() { return this.name; }
};

// ✓ 방법 1: bind
const greet1 = user.greet.bind(user);

// ✓ 방법 2: 화살표 함수 래퍼
const greet2 = () => user.greet();

// ✓ 방법 3: 클로저로 user 캡처
const { greet: boundGreet } = {
  greet: function() { return user.greet(); }
};
```

![this 바인딩 케이스별 예제](/assets/posts/js-this-rules-examples.svg)

---

## 핵심 정리

| 호출 형태 | this |
|-----------|------|
| `fn()` | 전역 객체 (비엄격) / undefined (엄격) |
| `obj.fn()` | obj |
| `fn.call(ctx)` | ctx |
| `fn.apply(ctx)` | ctx |
| `fn.bind(ctx)()` | ctx (영구) |
| `new Fn()` | 새 인스턴스 |
| 화살표 함수 | 선언 위치의 외부 this (다음 글 참고) |

`this`는 동적이지만 규칙은 단순합니다. "어떻게 호출됐는가"만 추적하면 됩니다. 다음 글에서는 화살표 함수가 이 규칙에서 완전히 벗어나는 이유를 설명합니다.

---

**지난 글:** [클로저와 메모리 누수 — 언제 문제가 되는가](/posts/js-closure-memory-leak/)

**다음 글:** [화살표 함수와 this — 선언 시점의 this를 캡처한다](/posts/js-this-in-arrow/)

<br>
읽어주셔서 감사합니다. 😊
