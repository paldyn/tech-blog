---
title: "프라이빗 필드 — # 접두사로 구현하는 캡슐화"
description: "JavaScript ES2022 프라이빗 클래스 필드(#)와 프라이빗 메서드의 동작, 기존 WeakMap 패턴과의 차이, 그리고 실무 캡슐화 설계 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 25
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "class", "private-fields", "encapsulation", "hash-private", "WeakMap", "ES2022"]
featured: false
draft: false
---

[지난 글](/posts/js-static-members/)에서 클래스 레벨 공유 상태를 다루는 `static` 멤버를 살펴봤습니다. 이번에는 반대 방향, 즉 **외부에서 절대 접근할 수 없는** 진정한 프라이빗 상태를 만드는 방법을 다룹니다. ES2022에서 표준화된 `#` 접두사 문법은 언어 수준에서 강제하는 캡슐화를 제공합니다.

![프라이빗 필드 접근 제어 다이어그램](/assets/posts/js-private-fields-diagram.svg)

## 등장 배경 — 과거의 관례적 private

ES2022 이전에 JavaScript에는 공식적인 프라이빗 필드가 없었습니다. 개발자들은 관례(언더스코어)나 WeakMap을 사용했습니다.

```javascript
// 관례: _prefix (실제로는 접근 가능)
class OldStyle {
  constructor() {
    this._secret = 'not really private';
  }
}
const o = new OldStyle();
console.log(o._secret); // 'not really private' (노출됨)

// WeakMap 패턴 (진짜 숨김, 그러나 복잡)
const _data = new WeakMap();
class WithWeakMap {
  constructor(v) { _data.set(this, v); }
  get() { return _data.get(this); }
}
```

WeakMap 패턴은 효과적이지만 외부 변수(`_data`)가 필요하고, 클래스 정의가 복잡해집니다.

## # 문법 — 언어 수준 프라이빗

ES2022부터 `#` 접두사를 붙이면 **클래스 문법 자체가 접근을 차단**합니다.

```javascript
class Stack {
  #items = [];

  push(item) {
    this.#items.push(item);
  }

  pop() {
    return this.#items.pop();
  }

  get size() {
    return this.#items.length;
  }
}
```

외부에서 `#items`에 접근하려 하면 파싱 단계에서 `SyntaxError`가 발생합니다.

```javascript
const s = new Stack();
s.push(1);
s.push(2);
console.log(s.size);  // 2
console.log(s.#items); // SyntaxError: Private field '#items' must be
                        // declared in an enclosing class
```

![프라이빗 필드 Stack 구현 코드](/assets/posts/js-private-fields-code.svg)

## # 필드의 특성

### 반드시 선언 먼저

`#` 필드는 클래스 몸체에서 **반드시 선언**해야 합니다. 생성자에서 `this.#newField = 1`처럼 동적으로 추가할 수 없습니다.

```javascript
class A {
  #declared = 0; // ✓

  method() {
    this.#declared++;     // ✓
    this.#undeclared = 1; // SyntaxError: 선언 없이 사용
  }
}
```

### in 연산자로 존재 확인

`in` 연산자를 사용해 객체가 특정 프라이빗 필드를 가지고 있는지 확인할 수 있습니다 (ES2022+).

```javascript
class Point {
  #x; #y;

  constructor(x, y) { this.#x = x; this.#y = y; }

  static isPoint(obj) {
    return #x in obj; // 안전하게 확인
  }
}

console.log(Point.isPoint(new Point(0, 0))); // true
console.log(Point.isPoint({ x: 0, y: 0 })); // false
```

### 서브클래스에서 접근 불가

부모의 `#field`는 서브클래스에서도 직접 접근할 수 없습니다.

```javascript
class Parent {
  #value = 42;
  getValue() { return this.#value; } // 공개 메서드로 노출
}

class Child extends Parent {
  showValue() {
    // this.#value; // SyntaxError
    return this.getValue(); // 공개 메서드 통해 접근
  }
}
```

## 프라이빗 메서드와 getter/setter

필드뿐 아니라 메서드와 getter/setter도 `#`로 비공개로 만들 수 있습니다.

```javascript
class BankAccount {
  #balance = 0;
  #log = [];

  #record(type, amount) {
    this.#log.push({ type, amount, time: Date.now() });
  }

  deposit(amount) {
    if (amount <= 0) throw new RangeError('양수만 입금 가능');
    this.#balance += amount;
    this.#record('deposit', amount);
  }

  get balance() { return this.#balance; }
  get history() { return [...this.#log]; }
}
```

`#record`는 내부 구현 세부사항이므로 외부에 노출할 필요가 없습니다. 이처럼 **퍼블릭 API**와 **내부 구현**을 명확히 분리하면 나중에 `#record` 로직을 변경해도 외부 코드에 영향을 주지 않습니다.

## WeakMap 패턴과의 비교

| 항목 | # 문법 | WeakMap 패턴 |
|---|---|---|
| 문법 복잡도 | 낮음 | 높음 |
| 성능 | 좋음 | WeakMap 조회 비용 |
| 외부 접근 차단 | SyntaxError | 가능 (스코프 내 WeakMap 있으면) |
| 상속 접근 | 불가 | WeakMap을 공유하면 가능 |
| 직렬화 (JSON) | 제외됨 | 제외됨 |
| 디버거 노출 | 클래스 내 보임 | 보이지 않음 |

현대 코드에서는 `#` 문법이 훨씬 권장됩니다.

## 직렬화와 프라이빗 필드

`JSON.stringify`는 `#` 필드를 포함하지 않습니다. 명시적으로 `toJSON()` 메서드를 구현해야 합니다.

```javascript
class User {
  #password;

  constructor(name, password) {
    this.name = name;
    this.#password = password;
  }

  toJSON() {
    return { name: this.name }; // password 제외
  }
}

const u = new User('Alice', 'secret');
JSON.stringify(u); // '{"name":"Alice"}'
```

## 실무 설계 원칙

프라이빗 필드를 도입할 때 유용한 원칙들입니다.

1. **최소 공개(minimal API)**: 꼭 필요한 것만 public으로 노출합니다.
2. **불변 공개 API**: getter만 제공하고 setter를 숨겨 외부에서 직접 수정을 막습니다.
3. **내부 유효성 검사**: setter나 메서드 내부에서 검증 후 `#field`를 업데이트합니다.

```javascript
class Temperature {
  #celsius;

  constructor(celsius) {
    this.#validate(celsius);
    this.#celsius = celsius;
  }

  #validate(c) {
    if (c < -273.15) throw new RangeError('절대영도 이하');
  }

  get celsius() { return this.#celsius; }
  get fahrenheit() { return this.#celsius * 9/5 + 32; }
}
```

모든 유효성 검사가 클래스 안에 캡슐화되어, 외부에서는 항상 유효한 `Temperature` 인스턴스를 보장받습니다.

---

**지난 글:** [정적 멤버 — 클래스 레벨 프로퍼티와 메서드](/posts/js-static-members/)

**다음 글:** [클래스 getter/setter — 계산된 프로퍼티 설계](/posts/js-class-getter-setter/)

<br>
읽어주셔서 감사합니다. 😊
