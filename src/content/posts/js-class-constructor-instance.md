---
title: "생성자와 인스턴스 — new 연산자의 동작 원리"
description: "JavaScript new 연산자가 내부에서 하는 4단계 작업, constructor의 반환값 규칙, 인스턴스와 프로토타입의 관계를 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "class", "constructor", "new", "instance", "prototype", "object-creation"]
featured: false
draft: false
---

[지난 글](/posts/js-class-syntax/)에서 `class` 키워드의 기본 구조와 내부 동작을 살펴봤습니다. 클래스를 실제로 인스턴스로 만드는 것은 `new` 연산자입니다. `new`가 내부에서 무슨 일을 하는지 알면 생성자가 반환값을 가질 때 어떤 일이 벌어지는지, 왜 `this`가 새 객체를 가리키는지 자연스럽게 이해됩니다.

![클래스-new-인스턴스 관계 다이어그램](/assets/posts/js-class-constructor-instance-diagram.svg)

## new 연산자의 4단계 동작

`new MyClass(args)`를 실행하면 JavaScript 엔진은 아래 4단계를 수행합니다.

1. **빈 객체 생성**: `Object.create(MyClass.prototype)`으로 프로토타입이 연결된 빈 객체를 만듭니다.
2. **this 바인딩**: 새로 만든 객체를 `constructor` 내부의 `this`로 설정합니다.
3. **생성자 실행**: `constructor`를 호출해서 인스턴스 프로퍼티를 초기화합니다.
4. **반환**: 생성자가 객체를 반환하면 그 객체를, 그렇지 않으면 step 1에서 만든 객체를 반환합니다.

코드로 흉내 내면 이렇습니다.

```javascript
function myNew(Constructor, ...args) {
  const obj = Object.create(Constructor.prototype);
  const result = Constructor.apply(obj, args);
  return (result !== null && typeof result === 'object')
    ? result
    : obj;
}
```

## 생성자와 인스턴스 프로퍼티

`constructor` 안에서 `this.xxx = value`로 설정한 값은 **인스턴스 자체**에 저장됩니다. 메서드처럼 프로토타입에 공유되지 않습니다.

```javascript
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  distance() {
    return Math.sqrt(
      this.x ** 2 + this.y ** 2
    );
  }
}
const p = new Point(3, 4);
console.log(p.distance()); // 5
```

`p.x`, `p.y`는 `p` 객체에 직접 존재하지만, `p.distance`는 `Point.prototype.distance`를 통해 접근합니다. `Object.hasOwn(p, 'distance')`는 `false`입니다.

![생성자와 인스턴스 생성 코드](/assets/posts/js-class-constructor-instance-code.svg)

## 생성자의 반환값 규칙

생성자에서 명시적으로 값을 반환하면 규칙이 적용됩니다.

```javascript
class Weird {
  constructor() {
    this.value = 1;
    return { custom: 'object' }; // 객체를 반환하면 이것이 인스턴스
  }
}
const w = new Weird();
console.log(w.custom); // 'object'
console.log(w.value);  // undefined

class Normal {
  constructor() {
    this.value = 1;
    return 42; // 원시값은 무시됨
  }
}
const n = new Normal();
console.log(n.value); // 1 (원시값 반환은 무시)
```

- **객체 반환**: 해당 객체가 `new`의 결과가 됩니다.
- **원시값 반환 또는 반환 없음**: `new`가 만든 원래 객체가 반환됩니다.

이 규칙은 팩토리 패턴이나 캐싱 패턴 구현에서 활용할 수 있지만, 일반적인 코드에서는 생성자가 값을 반환하지 않는 것이 관례입니다.

## 여러 인스턴스와 공유 메서드

같은 클래스에서 생성된 여러 인스턴스는 **메서드를 프로토타입을 통해 공유**합니다.

```javascript
const p1 = new Point(0, 0);
const p2 = new Point(3, 4);
const p3 = new Point(5, 12);

// 각 인스턴스는 독립적인 x, y를 가짐
console.log(p1.x, p2.x, p3.x); // 0, 3, 5

// 메서드는 하나만 존재, 공유
console.log(p1.distance === p2.distance); // true
console.log(p1.distance === Point.prototype.distance); // true
```

이것이 클래스(프로토타입 상속)가 **메모리 효율적**인 이유입니다. 함수를 생성자 내부에서 `this.method = function () {}`로 정의하면 인스턴스마다 별도의 함수 객체가 생성됩니다.

## constructor를 생략해도 될 때

`constructor`를 정의하지 않으면 기본 생성자가 자동으로 추가됩니다.

```javascript
class Empty {}
// 내부적으로 아래와 동일
class Empty {
  constructor() {}
}
```

서브클래스(상속받은 클래스)에서 생략하면 약간 다릅니다.

```javascript
class Parent {
  constructor(value) { this.value = value; }
}
class Child extends Parent {
  // constructor 생략 시 아래와 동일
  // constructor(...args) { super(...args); }
}
const c = new Child(42);
console.log(c.value); // 42
```

서브클래스에서 `constructor`를 직접 작성했다면 `super()`를 반드시 `this` 사용 전에 호출해야 합니다.

## instanceof로 인스턴스 확인

`instanceof`는 객체가 특정 클래스의 인스턴스인지 프로토타입 체인을 따라 확인합니다.

```javascript
const p = new Point(1, 2);
console.log(p instanceof Point);  // true
console.log(p instanceof Object); // true (프로토타입 체인)
console.log(p instanceof Array);  // false
```

실무에서 `instanceof`의 한계(같은 클래스의 다른 realm 인스턴스 등)는 [instanceof와 Symbol.hasInstance](/posts/js-instanceof-symbol/) 글에서 자세히 다룹니다.

## constructor 프로퍼티

모든 함수(클래스 포함)의 `prototype` 객체에는 `constructor` 프로퍼티가 있어 자기 자신을 가리킵니다.

```javascript
class Point {}
console.log(Point.prototype.constructor === Point); // true

const p = new Point();
console.log(p.constructor === Point); // true (프로토타입을 통해)
console.log(p.constructor.name);     // 'Point'
```

이를 이용하면 런타임에 어떤 클래스로 만들어진 인스턴지 확인하거나, 동일한 클래스의 새 인스턴스를 동적으로 만들 수 있습니다.

```javascript
function clone(instance) {
  return new instance.constructor();
}
```

---

**지난 글:** [클래스 문법 입문 — ES6 class 키워드 완전 이해](/posts/js-class-syntax/)

**다음 글:** [정적 멤버 — 클래스 레벨 프로퍼티와 메서드](/posts/js-static-members/)

<br>
읽어주셔서 감사합니다. 😊
