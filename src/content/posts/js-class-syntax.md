---
title: "클래스 문법 입문 — ES6 class 키워드 완전 이해"
description: "JavaScript ES6 클래스 문법의 전체 구조를 해부합니다. class가 실제로는 함수라는 사실, 클래스 필드, 선언/표현식 차이, TDZ까지 명확하게 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 22
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "class", "es6", "class-syntax", "class-fields", "constructor", "TDZ"]
featured: false
draft: false
---

[지난 글](/posts/js-object-iteration/)에서 객체의 프로퍼티를 순회하는 다양한 방법을 살펴봤습니다. 이번부터 여러 편에 걸쳐 **클래스(class)** 문법을 깊게 파고듭니다. 클래스는 ES2015에서 도입된 이후 현대 JavaScript의 핵심 코드 구조로 자리 잡았지만, 내부적으로는 프로토타입 기반 상속 위에 얹힌 문법적 설탕(syntactic sugar)입니다. 이 진실을 이해하면 클래스를 훨씬 자신 있게 쓸 수 있습니다.

![ES6 클래스 해부도](/assets/posts/js-class-syntax-anatomy.svg)

## class는 실제로 함수다

가장 먼저 확인해야 할 사실이 있습니다. JavaScript에서 `class` 키워드로 정의된 클래스는 **함수입니다**.

```javascript
class Animal {}
console.log(typeof Animal);       // 'function'
console.log(Animal.prototype);    // {constructor: Animal}
console.log(Animal === Animal.prototype.constructor); // true
```

`class Animal {}`은 내부적으로 `Animal`이라는 이름의 함수를 생성합니다. 메서드는 `Animal.prototype`에 추가됩니다. `typeof`로 확인해도 `'function'`이 나옵니다.

이는 ES5 이전 패턴과 완전히 동등합니다.

```javascript
// ES5 방식
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return this.name + ': ...';
};

// ES6 class 방식 (같은 결과)
class AnimalES6 {
  constructor(name) { this.name = name; }
  speak() { return this.name + ': ...'; }
}
```

두 방식의 차이는 편의성에 있지만, **class는 반드시 new로 호출**해야 한다는 제약이 추가됩니다.

## 기본 클래스 구조

```javascript
class Animal {
  type = 'animal'; // 클래스 필드 (ES2022+)

  constructor(name) {
    this.name = name; // 인스턴스 프로퍼티
  }

  speak() {          // 인스턴스 메서드
    return `${this.name}: ...`;
  }
}
const cat = new Animal('야옹이');
```

클래스 몸체(body)는 중괄호 `{}` 안에 있으며, 메서드 정의, 클래스 필드, getter/setter를 포함합니다. `constructor`는 특수 메서드로 `new` 호출 시 자동으로 실행됩니다.

![클래스 정의 기본 패턴](/assets/posts/js-class-syntax-code.svg)

## 클래스 필드 (ES2022)

클래스 필드는 `constructor` 바깥에서 직접 프로퍼티 기본값을 선언하는 문법입니다.

```javascript
class Counter {
  count = 0;          // 인스턴스 필드, 기본값 0
  #secret = 'hidden'; // 프라이빗 필드 (#은 다음 글에서)

  increment() {
    this.count++;
  }
}
const c = new Counter();
console.log(c.count); // 0
c.increment();
console.log(c.count); // 1
```

클래스 필드는 생성자 안에서 `this.count = 0`을 쓰는 것과 동일한 효과이지만, 가독성이 높고 프라이빗 필드(`#`)와 함께 쓸 때 더 빛납니다.

**클래스 필드는 프로토타입이 아닌 인스턴스에 직접 저장됩니다.** 이는 메서드와 다른 점입니다.

```javascript
const c1 = new Counter();
const c2 = new Counter();
c1.count = 99;
console.log(c2.count); // 0 (c2에는 영향 없음)

// 반면 메서드는 프로토타입 공유
console.log(c1.increment === c2.increment); // true
```

## 클래스 선언 vs 클래스 표현식

클래스는 두 가지 형태로 작성할 수 있습니다.

```javascript
// 클래스 선언
class Dog { }

// 익명 클래스 표현식
const Cat = class { };

// 기명 클래스 표현식 (이름은 클래스 내부에서만 사용)
const MyAnimal = class Animal {
  constructor() {
    console.log(Animal); // 내부에서는 참조 가능
  }
};
// console.log(Animal); // ReferenceError: Animal is not defined
```

함수 선언과 마찬가지로, 클래스 선언도 이름으로 코드 내에서 참조할 수 있습니다. 클래스 표현식은 변수에 담아 다른 함수에 인수로 전달하거나 반환값으로 사용할 수 있어 **믹스인 패턴** 등 고급 패턴에서 활용됩니다.

## 호이스팅 — TDZ 적용

함수 선언과 달리, **클래스 선언은 TDZ(Temporal Dead Zone)의 영향을 받습니다.** 선언 이전에 참조하면 `ReferenceError`가 발생합니다.

```javascript
// 함수 선언: 호이스팅 O
const f = new Func(); // 정상 동작
function Func() {}

// 클래스 선언: TDZ 때문에 에러
const d = new Dog(); // ReferenceError!
class Dog {}
```

`let`, `const`와 마찬가지로 클래스 선언은 블록의 최상단으로 끌어올려지지만, 초기화되기 전에는 접근할 수 없습니다. 따라서 항상 클래스를 **사용 이전에 정의**하는 습관이 중요합니다.

## strict mode 자동 적용

클래스 몸체 내부 코드는 **항상 strict mode로 실행**됩니다. `'use strict'` 지시문 없이도 동일한 엄격 모드가 적용됩니다.

```javascript
class MyClass {
  test() {
    // 여기는 항상 strict mode
    // undeclared = 1; // ReferenceError
    // 일반 함수에서 this는 undefined (undefined인 상태에서 호출 시)
    return typeof this;
  }
}
```

이는 클래스 메서드를 콜백으로 분리해서 호출했을 때 `this`가 `undefined`가 되는 이유이기도 합니다. 이 문제는 [클래스 메서드와 this 바인딩](/posts/js-class-method-this/) 글에서 자세히 다룹니다.

## new 없이 호출하면 에러

클래스는 생성자 함수와 달리 `new` 없이 호출하면 즉시 `TypeError`를 던집니다.

```javascript
class Point {}
Point(); // TypeError: Class constructor Point cannot be invoked without 'new'
```

ES5 생성자 함수는 `new` 없이 호출해도 그냥 실행되어 전역 오염이 발생했지만, 클래스는 이를 원천 차단합니다.

## 클래스도 일급 객체

JavaScript의 모든 함수가 일급 객체이듯, 클래스도 일급 객체입니다. 변수에 저장, 인수로 전달, 반환값으로 사용이 모두 가능합니다.

```javascript
function createClass(greeting) {
  return class {
    greet() { return greeting; }
  };
}

const Hello = createClass('안녕하세요');
const hi = new Hello();
console.log(hi.greet()); // '안녕하세요'
```

이 특성은 다음에 다룰 믹스인 패턴, 팩토리 패턴에서 강력하게 활용됩니다.

---

**지난 글:** [객체 순회 완전 정복 — for...in부터 Reflect.ownKeys까지](/posts/js-object-iteration/)

**다음 글:** [생성자와 인스턴스 — new 연산자의 동작 원리](/posts/js-class-constructor-instance/)

<br>
읽어주셔서 감사합니다. 😊
