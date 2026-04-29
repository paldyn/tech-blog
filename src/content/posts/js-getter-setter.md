---
title: "getter와 setter — 프로퍼티 접근을 함수로 위장하기"
description: "JavaScript의 getter와 setter 문법, 동작 원리, 그리고 지연 계산·유효성 검사·파생 값 등 실무에서 자주 쓰이는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "getter", "setter", "property", "accessor", "class", "lazy-evaluation"]
featured: false
draft: false
---

[지난 글](/posts/js-property-descriptor/)에서 프로퍼티 디스크립터의 두 종류 중 접근자 디스크립터(`get`/`set`)를 소개했습니다. 이 글에서는 객체 리터럴과 클래스 문법에서 getter와 setter를 직접 선언하는 방법, 그리고 실무에서 어떤 상황에 써야 하는지 더 깊이 살펴봅니다.

---

## 기본 문법

객체 리터럴에서 `get`과 `set` 키워드를 사용합니다.

```javascript
const circle = {
  _radius: 5,

  get radius() {
    return this._radius;
  },
  set radius(val) {
    if (val < 0) throw new RangeError('반지름은 음수일 수 없습니다');
    this._radius = val;
  },

  get area() {
    return Math.PI * this._radius ** 2;
  }
};

circle.radius;        // 5 — getter 호출
circle.radius = 10;   // setter 호출
circle.area;          // 314.159...
```

겉보기에 일반 프로퍼티처럼 사용하지만 내부적으로 함수를 실행합니다.

---

## 클래스에서의 getter/setter

클래스 본문에서 동일한 문법을 사용합니다. private 필드(`#`)와 함께 쓰면 진정한 캡슐화를 구현할 수 있습니다.

```javascript
class Temperature {
  #celsius;

  constructor(celsius) {
    this.#celsius = celsius;
  }

  get celsius() { return this.#celsius; }
  set celsius(val) {
    if (typeof val !== 'number') throw new TypeError('숫자만 가능합니다');
    this.#celsius = val;
  }

  get fahrenheit() {
    return this.#celsius * 9 / 5 + 32;
  }
  set fahrenheit(val) {
    this.#celsius = (val - 32) * 5 / 9;
  }
}

const t = new Temperature(100);
t.fahrenheit;      // 212
t.fahrenheit = 32;
t.celsius;         // 0
```

`fahrenheit`는 독립적인 저장 공간이 없습니다. `celsius`에서 계산해 반환하는 **파생 값**입니다.

![getter/setter 동작 흐름](/assets/posts/js-getter-setter-flow.svg)

---

## setter 재귀 함정

setter 안에서 같은 이름 프로퍼티에 할당하면 setter가 다시 호출되어 무한 재귀가 발생합니다.

```javascript
const bad = {
  get value() { return this.value; },   // 재귀!
  set value(v) { this.value = v; }      // 재귀!
};

// bad.value = 5; // Maximum call stack size exceeded

// 올바른 방법: 내부 저장소 이름을 다르게
const good = {
  _value: 0,
  get value() { return this._value; },
  set value(v) { this._value = v; }
};
```

클래스의 private 필드(`#`)는 이 문제를 구조적으로 해결합니다. `#value`와 `value`는 완전히 다른 이름입니다.

---

## 지연 계산 패턴 (Lazy getter)

비용이 큰 계산을 최초 접근 시에만 수행하고, 이후 접근에서는 캐시된 값을 반환하는 패턴입니다.

```javascript
class App {
  get config() {
    // 최초 접근 시 한 번만 파싱
    const parsed = JSON.parse(readHeavyFile());

    // getter를 data descriptor로 교체 (이후 접근은 함수 없이 바로 반환)
    Object.defineProperty(this, 'config', {
      value: parsed,
      writable: false
    });

    return parsed;
  }
}

const app = new App();
app.config; // 최초: JSON 파싱 실행
app.config; // 이후: 캐시된 값 바로 반환
```

첫 접근 시 getter가 실행되면서 `defineProperty`로 자기 자신을 data descriptor로 덮어씁니다. 이후 접근은 getter를 거치지 않고 값을 직접 반환합니다.

![getter/setter 실용 패턴](/assets/posts/js-getter-setter-patterns.svg)

---

## 프로토타입 체인과 getter/setter

getter/setter는 프로토타입에 정의되어 있어도 `this`는 인스턴스를 가리킵니다.

```javascript
class Base {
  #val = 0;
  get val() { return this.#val; }
  set val(v) { this.#val = v; }
}

class Child extends Base {}

const c = new Child();
c.val = 99;   // Base의 setter 실행, this === c
c.val;        // 99
```

단, 접근자는 `Object.assign`이나 스프레드 복사 시 **getter가 실행된 결과값**만 복사됩니다.

```javascript
const src = {
  _x: 10,
  get x() { return this._x * 2; }
};

const copy = { ...src };
// copy.x === 20 (숫자) — getter가 사라지고 값만 복사됨
copy.x = 5; // 그냥 프로퍼티가 됨, setter 없음
```

getter/setter까지 보존하려면 `Object.create` + `Object.getOwnPropertyDescriptors`를 사용합니다.

---

## getter vs 일반 메서드 선택 기준

```javascript
class User {
  // getter: 파생 값, 연산이 가벼움
  get fullName() { return `${this.firstName} ${this.lastName}`; }

  // 메서드: 부수효과 있음, 인자 필요, 연산이 무거움
  serialize() { return JSON.stringify(this); }
}
```

- **파생 값이고 인자가 없고 부수효과 없음** → getter
- **인자 필요하거나 부수효과 있음** → 메서드

다음 글에서는 `Object.defineProperty`를 직접 사용해 프로퍼티 디스크립터를 세밀하게 제어하는 방법을 살펴봅니다.

---

**지난 글:** [프로퍼티 디스크립터 — 객체 속성을 정밀하게 제어하는 메타데이터](/posts/js-property-descriptor/)

**다음 글:** [Object.defineProperty 완전 해부 — 프로퍼티를 코드로 조각하기](/posts/js-define-property/)

<br>
읽어주셔서 감사합니다. 😊
