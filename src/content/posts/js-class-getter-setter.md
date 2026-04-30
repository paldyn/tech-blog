---
title: "클래스 getter/setter — 계산된 프로퍼티 설계"
description: "JavaScript 클래스에서 get/set 키워드로 구현하는 접근자 프로퍼티의 동작 원리, 프라이빗 필드와 함께 사용하는 패턴, 무한 재귀 피하기, 계산된 값 캐싱 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 26
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "class", "getter", "setter", "accessor-property", "computed-property", "encapsulation"]
featured: false
draft: false
---

[지난 글](/posts/js-private-fields/)에서 `#` 접두사로 내부 상태를 완전히 숨기는 방법을 배웠습니다. 숨긴 상태를 외부에 노출할 때는 단순히 메서드를 만들 수도 있지만, `get`/`set` 키워드를 사용하면 **일반 프로퍼티처럼** 읽고 쓸 수 있어 훨씬 자연스러운 API가 됩니다. 이것이 접근자 프로퍼티(accessor property)의 핵심 가치입니다.

![getter/setter 계산된 프로퍼티 인터페이스 다이어그램](/assets/posts/js-class-getter-setter-diagram.svg)

## getter — 읽기 전용 계산 프로퍼티

`get` 키워드를 메서드 앞에 붙이면 프로퍼티처럼 접근했을 때 자동으로 호출됩니다.

```javascript
class Circle {
  #radius;

  constructor(r) { this.#radius = r; }

  get area() {
    return Math.PI * this.#radius ** 2;
  }

  get circumference() {
    return 2 * Math.PI * this.#radius;
  }
}

const c = new Circle(5);
console.log(c.area);         // 78.53...
console.log(c.circumference); // 31.41...
// c.area = 100; // 에러 없이 무시됨 (setter 없으면)
```

`c.area`는 함수 호출이지만 괄호 없이 접근합니다. 이것이 **함수 구현 세부사항을 숨기고 프로퍼티처럼 보이게 하는** getter의 매력입니다.

## setter — 값 검증과 가공

`set` 키워드는 프로퍼티에 값을 할당할 때 호출됩니다.

```javascript
class Temperature {
  #celsius = 0;

  get fahrenheit() {
    return this.#celsius * 9/5 + 32;
  }

  set fahrenheit(f) {
    this.#celsius = (f - 32) * 5 / 9;
  }
}
const t = new Temperature(); t.fahrenheit = 212;
```

![Temperature 클래스 getter/setter 코드](/assets/posts/js-class-getter-setter-code.svg)

setter 안에서 검증 로직을 추가하면 잘못된 값의 진입을 원천 차단합니다.

```javascript
class Circle {
  #radius;

  constructor(r) { this.radius = r; } // setter 통해 초기화

  get radius() { return this.#radius; }

  set radius(r) {
    if (typeof r !== 'number' || r < 0) {
      throw new RangeError(`반지름은 0 이상이어야 합니다: ${r}`);
    }
    this.#radius = r;
  }
}

const c = new Circle(5);
c.radius = -1; // RangeError: 반지름은 0 이상이어야 합니다: -1
```

`constructor`에서도 `this.radius = r`로 setter를 통해 초기화하면 생성자와 setter 양쪽에 검증 코드를 중복 작성하지 않아도 됩니다.

## 무한 재귀 주의

getter/setter에서 자기 자신을 참조하면 무한 재귀가 발생합니다.

```javascript
class Danger {
  get value() {
    return this.value; // 무한 재귀! StackOverflow
  }
  set value(v) {
    this.value = v; // 무한 재귀!
  }
}
```

내부 저장은 반드시 `#field` (프라이빗 필드) 또는 다른 이름의 프로퍼티를 사용해야 합니다.

```javascript
class Safe {
  #_value = 0;

  get value() { return this.#_value; }
  set value(v) { this.#_value = v; }
}
```

## getter 전용 vs setter 전용

getter만 정의하면 사실상 읽기 전용 프로퍼티가 됩니다.

```javascript
class User {
  #firstName;
  #lastName;

  constructor(first, last) {
    this.#firstName = first;
    this.#lastName = last;
  }

  get fullName() {
    return `${this.#firstName} ${this.#lastName}`;
  }
  // setter 없음: fullName은 읽기 전용
}

const u = new User('길동', '홍');
console.log(u.fullName); // '길동 홍'
u.fullName = '다른이름'; // strict mode에서 TypeError
```

반대로 setter만 정의하면 쓰기 전용이 됩니다(드문 패턴이지만 로깅, 파이프 등에서 가끔 사용).

## 계산된 getter와 메모이제이션

계산 비용이 큰 getter는 결과를 캐시할 수 있습니다.

```javascript
class HeavyData {
  #rawData;
  #cachedResult = null;

  constructor(data) { this.#rawData = data; }

  get processed() {
    if (this.#cachedResult !== null) {
      return this.#cachedResult;
    }
    // 무거운 계산
    this.#cachedResult = this.#rawData
      .filter(x => x > 0)
      .map(x => x * 2)
      .sort((a, b) => a - b);
    return this.#cachedResult;
  }

  invalidate() {
    this.#cachedResult = null; // 캐시 무효화
  }
}
```

원시 데이터가 변경됐을 때 `invalidate()`를 호출해 캐시를 초기화합니다.

## 정적 getter/setter

`static` 키워드와 결합하면 클래스 레벨 접근자를 만들 수 있습니다.

```javascript
class AppConfig {
  static #theme = 'light';

  static get theme() { return AppConfig.#theme; }

  static set theme(t) {
    if (!['light', 'dark'].includes(t)) {
      throw new Error('유효하지 않은 테마');
    }
    AppConfig.#theme = t;
  }
}

AppConfig.theme = 'dark';
console.log(AppConfig.theme); // 'dark'
AppConfig.theme = 'blue'; // Error: 유효하지 않은 테마
```

## Object.defineProperty와의 관계

클래스 `get`/`set`은 `Object.defineProperty`로 접근자 디스크립터를 정의하는 것과 동등합니다.

```javascript
// 클래스 getter
class Cls {
  get x() { return 1; }
}

// 프로토타입 수준에서 동일
Object.defineProperty(Cls.prototype, 'x', {
  get() { return 1; },
  configurable: true,
});
```

클래스 getter는 프로토타입에 정의되므로 **인스턴스 간에 공유**됩니다. 클래스 필드와 달리 인스턴스별 복사본을 만들지 않습니다.

---

**지난 글:** [프라이빗 필드 — # 접두사로 구현하는 캡슐화](/posts/js-private-fields/)

**다음 글:** [extends와 super — JavaScript 상속의 실제 동작](/posts/js-extends-super/)

<br>
읽어주셔서 감사합니다. 😊
