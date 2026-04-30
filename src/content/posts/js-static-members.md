---
title: "정적 멤버 — 클래스 레벨 프로퍼티와 메서드"
description: "JavaScript static 키워드로 정의하는 정적 프로퍼티와 정적 메서드의 동작, 상속 관계, 팩토리 메서드와 유틸리티 메서드 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 24
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "class", "static", "static-method", "static-property", "factory-method", "singleton"]
featured: false
draft: false
---

[지난 글](/posts/js-class-constructor-instance/)에서 `new` 연산자가 어떻게 인스턴스를 만드는지 살펴봤습니다. 인스턴스는 클래스 설계도를 바탕으로 만들어진 개별 존재입니다. 그런데 인스턴스와 무관하게 **클래스 자체에 귀속되어야 하는** 데이터나 동작이 있습니다. 싱글턴 카운터, 팩토리 메서드, 설정값처럼 모든 인스턴스가 공유해야 하는 것들 말입니다. 이를 위해 `static` 키워드가 존재합니다.

![정적 멤버 vs 인스턴스 멤버 다이어그램](/assets/posts/js-static-members-diagram.svg)

## static 프로퍼티와 메서드 기본

`static` 키워드를 앞에 붙이면 클래스 자체의 프로퍼티나 메서드가 됩니다.

```javascript
class Config {
  static count = 0;
  static maxRetries = 3;

  constructor() {
    Config.count++;
  }

  static reset() {
    Config.count = 0;
  }
}
new Config(); new Config();
Config.count; // 2
```

- `Config.count`는 `Config` 함수 객체에 저장됩니다.
- 인스턴스(`new Config()`)를 통해서는 접근할 수 없습니다.
- `static` 메서드 안의 `this`는 클래스 자체를 가리킵니다.

![정적 프로퍼티와 메서드 코드](/assets/posts/js-static-members-code.svg)

## 인스턴스에서 정적 멤버 접근

인스턴스에서 정적 멤버에 접근하려면 클래스 이름 또는 `this.constructor`를 사용해야 합니다.

```javascript
class Counter {
  static count = 0;

  constructor() {
    Counter.count++;
    this.id = Counter.count;
    // 또는 this.constructor.count++
  }
}

const c1 = new Counter(); // count = 1, id = 1
const c2 = new Counter(); // count = 2, id = 2
console.log(Counter.count); // 2
// c1.count; // undefined (인스턴스에 없음)
```

`c1.count`를 접근하면 프로토타입 체인을 따라가다 `Counter.prototype`에도 없으므로 `undefined`가 됩니다. 정적 멤버는 **프로토타입 체인이 아닌 클래스(함수 객체) 자체**에 붙습니다.

## 정적 메서드 안의 this

정적 메서드 내부의 `this`는 클래스 자체를 가리킵니다.

```javascript
class Animal {
  static count = 0;

  static create(name) {
    this.count++; // this === Animal
    return new this(name); // new Animal(name)
  }

  constructor(name) {
    this.name = name;
  }
}

const dog = Animal.create('바둑이');
console.log(Animal.count); // 1
```

`new this(name)`처럼 쓰면 서브클래스에서 상속받을 때도 올바른 클래스로 인스턴스를 만들 수 있어 **팩토리 메서드 패턴**에 활용됩니다.

## 정적 멤버의 상속

정적 멤버도 상속됩니다. 서브클래스는 부모의 정적 메서드를 물려받습니다.

```javascript
class Shape {
  static describe() {
    return `나는 ${this.name} 클래스입니다`;
  }
}

class Circle extends Shape {}
class Square extends Shape {}

console.log(Shape.describe());   // '나는 Shape 클래스입니다'
console.log(Circle.describe());  // '나는 Circle 클래스입니다'
console.log(Square.describe());  // '나는 Square 클래스입니다'
```

`Circle.__proto__ === Shape` 관계가 성립하므로, `Circle.describe`는 `Shape.describe`를 프로토타입 체인으로 찾습니다. `this.name`은 각 클래스의 이름을 반환합니다.

## 팩토리 메서드 패턴

`static` 메서드의 대표 활용 사례가 **팩토리 메서드**입니다. 다양한 형태의 인스턴스 생성 로직을 클래스 안에 캡슐화합니다.

```javascript
class Color {
  constructor(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  static fromHex(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return new Color(r, g, b);
  }

  static fromArray([r, g, b]) {
    return new Color(r, g, b);
  }
}

const red = Color.fromHex('#ff0000');
const blue = Color.fromArray([0, 0, 255]);
```

팩토리 메서드를 이용하면 `new`를 직접 호출하는 것보다 의미 있는 이름으로 인스턴스를 만들 수 있고, 입력값 검증·변환 로직을 생성자와 분리할 수 있습니다.

## 싱글턴 패턴

`static`으로 유일한 인스턴스를 관리하는 싱글턴 패턴입니다.

```javascript
class Database {
  static #instance = null;

  constructor(url) {
    this.url = url;
  }

  static getInstance(url) {
    if (!Database.#instance) {
      Database.#instance = new Database(url);
    }
    return Database.#instance;
  }
}

const db1 = Database.getInstance('db://localhost');
const db2 = Database.getInstance('db://other');
console.log(db1 === db2); // true (같은 인스턴스)
```

`#instance`는 프라이빗 정적 필드(다음 글 주제)로, 외부에서 직접 수정을 막습니다.

## 정적 초기화 블록 (ES2022)

복잡한 정적 초기화 로직이 필요한 경우 **정적 초기화 블록(static initialization block)**을 사용합니다.

```javascript
class AppConfig {
  static host;
  static port;

  static {
    // 복잡한 초기화 로직
    const env = process?.env ?? {};
    AppConfig.host = env.HOST ?? 'localhost';
    AppConfig.port = Number(env.PORT ?? 3000);
  }
}

console.log(AppConfig.host); // 'localhost' (환경변수 없을 때)
console.log(AppConfig.port); // 3000
```

정적 초기화 블록은 클래스가 평가될 때 한 번 실행됩니다. `try-catch`를 쓸 수 있어 오류 처리가 가능합니다.

## 유틸리티 클래스 패턴

순수하게 정적 메서드만 모아둔 **유틸리티 클래스**는 JavaScript에서 흔히 볼 수 있습니다. `Math`, `Number`, `Object`가 대표 예입니다.

```javascript
class StringUtils {
  static capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static camelToKebab(str) {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  static truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '...' : str;
  }
}

// new 없이 바로 사용
StringUtils.capitalize('hello');    // 'Hello'
StringUtils.camelToKebab('myVar');  // 'my-var'
```

이 경우 생성자를 `private` 또는 예외를 던지도록 막아두는 것이 의도를 명확히 합니다.

---

**지난 글:** [생성자와 인스턴스 — new 연산자의 동작 원리](/posts/js-class-constructor-instance/)

**다음 글:** [프라이빗 필드 — # 접두사로 구현하는 캡슐화](/posts/js-private-fields/)

<br>
읽어주셔서 감사합니다. 😊
