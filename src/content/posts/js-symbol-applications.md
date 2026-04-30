---
title: "Symbol 활용 패턴"
description: "JavaScript Symbol의 고유 키 활용, Well-Known Symbols(toPrimitive·toStringTag·hasInstance 등) 재정의, 전역 레지스트리 Symbol.for/keyFor 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 39
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Symbol", "Well-Known Symbols", "toPrimitive", "toStringTag", "Symbol.for", "고유 키"]
featured: false
draft: false
---

[지난 글](/posts/js-weakmap-weakset/)에서 WeakMap과 WeakSet을 살펴봤습니다. 이번 글에서는 `Symbol`을 실제 코드에서 어떻게 활용하는지 — 고유 키, Well-Known Symbols 재정의, 전역 레지스트리 — 를 깊이 살펴봅니다.

## Symbol 기본

`Symbol()`은 호출할 때마다 **고유하고 변경 불가능한** 값을 반환합니다. 설명 문자열을 넣어도 동등성에 영향을 주지 않습니다.

```javascript
const a = Symbol('id');
const b = Symbol('id');
console.log(a === b); // false — 항상 고유
console.log(typeof a); // 'symbol'
console.log(a.description); // 'id'
```

## 충돌 없는 객체 키

Symbol을 객체 키로 사용하면 다른 코드의 문자열 키와 절대 충돌하지 않습니다. 라이브러리에서 내부 메타데이터를 붙일 때 특히 유용합니다.

```javascript
const INTERNAL_ID = Symbol('id');
const CACHE = Symbol('cache');

const user = { name: 'Alice', email: 'alice@example.com' };
user[INTERNAL_ID] = 101;
user[CACHE] = new Map();

// 일반 열거에 노출되지 않음
Object.keys(user);        // ['name', 'email']
JSON.stringify(user);     // '{"name":"Alice","email":"alice@example.com"}'

// Symbol만 가져오기
Object.getOwnPropertySymbols(user); // [Symbol(id), Symbol(cache)]
```

![Symbol 활용 패턴 개요](/assets/posts/js-symbol-applications-overview.svg)

## Symbol.for / Symbol.keyFor

`Symbol.for(key)`는 **전역 Symbol 레지스트리**에서 같은 키를 가진 Symbol을 반환하거나, 없으면 생성합니다. 여러 파일·모듈 간에 동일한 Symbol을 공유할 때 씁니다.

```javascript
// 어디서 호출해도 같은 Symbol
const s1 = Symbol.for('app.userId');
const s2 = Symbol.for('app.userId');
console.log(s1 === s2); // true

// 키 역조회
Symbol.keyFor(s1); // 'app.userId'
Symbol.keyFor(Symbol('local')); // undefined — 전역 아님
```

## Well-Known Symbols

JavaScript 엔진이 내부적으로 참조하는 미리 정의된 Symbol들입니다. 이를 재정의해 내장 동작을 커스터마이징할 수 있습니다.

### Symbol.toPrimitive

객체가 원시 타입으로 변환될 때 호출됩니다. `hint`는 `'number'`, `'string'`, `'default'` 중 하나입니다.

![Symbol.toPrimitive와 toStringTag 예제](/assets/posts/js-symbol-applications-toPrimitive.svg)

```javascript
class Temperature {
  constructor(celsius) { this.celsius = celsius; }

  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return this.celsius;
    if (hint === 'string') return `${this.celsius}°C`;
    return this.celsius; // default
  }
}

const t = new Temperature(25);
console.log(+t);         // 25
console.log(`온도: ${t}`); // '온도: 25°C'
console.log(t > 20);    // true
```

### Symbol.toStringTag

`Object.prototype.toString.call(obj)`의 결과를 커스터마이징합니다.

```javascript
class Queue {
  get [Symbol.toStringTag]() { return 'Queue'; }
}
Object.prototype.toString.call(new Queue()); // '[object Queue]'
```

`instanceof` 대신 타입 태그로 구분할 때 유용합니다.

### Symbol.hasInstance

`instanceof` 연산자 동작을 재정의합니다.

```javascript
class EvenNumber {
  static [Symbol.hasInstance](n) {
    return Number.isInteger(n) && n % 2 === 0;
  }
}

console.log(4 instanceof EvenNumber);  // true
console.log(3 instanceof EvenNumber);  // false
console.log(6 instanceof EvenNumber);  // true
```

### Symbol.isConcatSpreadable

`Array.prototype.concat`에서 전개 여부를 제어합니다.

```javascript
const spreadable = { [Symbol.isConcatSpreadable]: true, 0: 'a', 1: 'b', length: 2 };
[1, 2].concat(spreadable); // [1, 2, 'a', 'b']

const notSpreadable = [3, 4];
notSpreadable[Symbol.isConcatSpreadable] = false;
[1, 2].concat(notSpreadable); // [1, 2, [3, 4]]
```

### Symbol.match / Symbol.replace / Symbol.search

문자열 메서드(`String.prototype.match` 등)에 커스텀 객체를 사용할 수 있습니다.

```javascript
class CaseInsensitiveRegex {
  constructor(pattern) { this.re = new RegExp(pattern, 'i'); }
  [Symbol.match](str) { return str.match(this.re); }
}

'Hello World'.match(new CaseInsensitiveRegex('hello')); // ['Hello']
```

## 상수 열거형 패턴

Symbol은 완전히 고유하므로 `enum` 대용으로 쓸 수 있습니다.

```javascript
const Direction = Object.freeze({
  UP:    Symbol('UP'),
  DOWN:  Symbol('DOWN'),
  LEFT:  Symbol('LEFT'),
  RIGHT: Symbol('RIGHT'),
});

function move(dir) {
  switch (dir) {
    case Direction.UP:    return '위로';
    case Direction.DOWN:  return '아래로';
    // ...
  }
}

move(Direction.UP);  // '위로'
move('UP');          // undefined — 문자열과 혼동 불가
```

## Symbol과 JSON

Symbol 키는 `JSON.stringify`로 직렬화되지 않고, Symbol 값도 마찬가지입니다. 의도적으로 직렬화에서 제외하고 싶은 데이터에 활용합니다.

```javascript
const SECRET = Symbol('secret');
const data = { name: 'Alice', [SECRET]: 'password123' };

JSON.stringify(data); // '{"name":"Alice"}' — SECRET 제외
```

다음 글에서는 객체의 모든 동작을 가로채고 커스터마이징할 수 있는 `Proxy`와 `Reflect`를 살펴봅니다.

---

**지난 글:** [WeakMap과 WeakSet](/posts/js-weakmap-weakset/)

**다음 글:** [Proxy와 Reflect](/posts/js-proxy-reflect/)

<br>
읽어주셔서 감사합니다. 😊
