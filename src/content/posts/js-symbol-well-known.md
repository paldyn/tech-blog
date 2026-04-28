---
title: "Symbol과 Well-Known Symbol"
description: "JavaScript Symbol의 유일성, Symbol.for 전역 레지스트리, Symbol 키 프로퍼티의 특성, 그리고 iterator·toPrimitive·toStringTag 등 Well-Known Symbol의 실전 활용을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "symbol", "well-known-symbol", "iterator", "toPrimitive", "toStringTag", "원시타입"]
featured: false
draft: false
---

[지난 글](/posts/js-string-unicode/)에서 문자열의 UTF-16 인코딩과 유니코드 처리를 살펴봤습니다. 이번에는 ES6에서 추가된 7번째 원시 타입 `symbol`을 다룹니다. Symbol은 "절대 충돌하지 않는 유일한 키"가 필요한 순간을 위해 설계됐습니다.

## Symbol은 왜 등장했는가

라이브러리나 프레임워크가 객체에 메타데이터를 붙이고 싶을 때, 문자열 키를 사용하면 사용자의 동명 프로퍼티와 충돌할 위험이 있습니다. Symbol은 설명(description)이 같아도 항상 다른 값을 가지므로 충돌이 불가능합니다.

```javascript
const id1 = Symbol('id');
const id2 = Symbol('id');
id1 === id2;    // false — 항상 유일
typeof id1;     // "symbol"
id1.toString(); // "Symbol(id)" — 명시적 변환만 가능
id1.description;// "id" (ES2019+)
```

Symbol은 `new Symbol()`이 아닌 `Symbol()`로 생성합니다. 생성자가 아닌 팩토리 함수입니다.

![Symbol 기본과 Well-Known Symbols](/assets/posts/js-symbol-well-known-overview.svg)

## Symbol 키 프로퍼티의 특성

Symbol을 객체 키로 사용하면 `for...in`, `Object.keys()`, `JSON.stringify()`에서 열거되지 않습니다. 의도적으로 "숨겨진" 프로퍼티를 만들 때 유용합니다.

```javascript
const _secret = Symbol('secret');
const obj = {
  name: 'Alice',
  [_secret]: 'hidden value'
};

Object.keys(obj);        // ['name'] — Symbol 키 제외
for (let k in obj) { }  // 'name'만 반복
JSON.stringify(obj);     // '{"name":"Alice"}' — Symbol 직렬화 안 됨

// Symbol 키 접근 방법
Object.getOwnPropertySymbols(obj); // [Symbol(secret)]
Reflect.ownKeys(obj);              // ['name', Symbol(secret)]
```

## Symbol.for — 전역 레지스트리

`Symbol.for(key)`는 전역 심볼 레지스트리를 사용합니다. 같은 키면 동일한 Symbol을 반환하므로 `Symbol()`과 달리 여러 모듈에서 공유할 수 있습니다.

```javascript
const s1 = Symbol.for('app.id');
const s2 = Symbol.for('app.id');
s1 === s2; // true — 같은 Symbol

Symbol.keyFor(s1); // 'app.id'
Symbol.keyFor(Symbol('local')); // undefined (레지스트리 밖)
```

`Symbol.for`는 같은 realm(iframe, Worker 경계)에서도 공유됩니다.

## Well-Known Symbol — 언어 동작 확장

Well-Known Symbol은 JavaScript 엔진이 내부적으로 참조하는 특별한 Symbol들입니다. 이를 통해 언어 내장 동작(이터레이션, 형변환, instanceof 등)을 객체 레벨에서 커스터마이즈할 수 있습니다.

### Symbol.iterator

`for...of`, 스프레드 연산자, 구조분해가 동작하려면 객체에 `[Symbol.iterator]()` 메서드가 있어야 합니다. 이 메서드는 이터레이터(iterator) 객체를 반환해야 합니다.

```javascript
// 이미 Array, String, Map, Set 등은 Symbol.iterator를 가짐
const arr = [1, 2, 3];
const iter = arr[Symbol.iterator]();
iter.next(); // { value: 1, done: false }
iter.next(); // { value: 2, done: false }
iter.next(); // { value: 3, done: false }
iter.next(); // { value: undefined, done: true }
```

커스텀 이터러블 클래스를 만들려면 `[Symbol.iterator]`를 구현합니다(앞 SVG 예시 참고).

### Symbol.toPrimitive

객체가 원시값으로 강제 변환될 때 호출됩니다. `hint` 매개변수로 `'number'`, `'string'`, `'default'` 중 하나가 전달됩니다.

![Symbol.toPrimitive와 Symbol.toStringTag 활용](/assets/posts/js-symbol-well-known-toprimitive.svg)

### Symbol.toStringTag

`Object.prototype.toString.call(obj)`가 반환하는 태그를 제어합니다. 내장 타입 판별(`[object Array]`, `[object Map]` 등)이 이 심볼을 사용합니다.

```javascript
Object.prototype.toString.call([]);   // '[object Array]'
Object.prototype.toString.call(new Map()); // '[object Map]'
```

### Symbol.hasInstance

`instanceof` 연산자의 동작을 커스터마이즈합니다.

```javascript
class EvenNumber {
  static [Symbol.hasInstance](num) {
    return Number(num) % 2 === 0;
  }
}
2 instanceof EvenNumber;  // true
3 instanceof EvenNumber;  // false
```

### Symbol.species

`Array.prototype.map()` 등 파생 객체를 생성하는 메서드가 사용할 생성자를 지정합니다. 서브클래싱 시 반환 타입을 제어하는 데 사용되지만, 복잡한 의미론적 문제로 인해 일부 환경에서 deprecated 논의 중입니다.

```javascript
class MyArray extends Array {
  static get [Symbol.species]() { return Array; }
}
const a = new MyArray(1, 2, 3);
const mapped = a.map(x => x * 2);
mapped instanceof MyArray; // false (일반 Array로 반환)
mapped instanceof Array;   // true
```

### 기타 Well-Known Symbol

| Symbol | 역할 |
|--------|------|
| `Symbol.asyncIterator` | `for await...of` 비동기 이터러블 |
| `Symbol.match` | `String.prototype.match()`가 사용 |
| `Symbol.replace` | `String.prototype.replace()`가 사용 |
| `Symbol.search` | `String.prototype.search()`가 사용 |
| `Symbol.split` | `String.prototype.split()`가 사용 |
| `Symbol.isConcatSpreadable` | `Array.prototype.concat()` 펼침 제어 |

## Symbol을 언제 쓰는가

Symbol의 주요 사용 사례는 세 가지입니다.

1. **충돌 없는 프로퍼티 키**: 외부 객체에 메타데이터를 붙일 때 기존 프로퍼티와 충돌 방지
2. **프라이빗 채널**: 모듈 내에서만 접근하는 "반 프라이빗" 상태 저장 (진짜 프라이빗은 `#` 필드)
3. **Well-Known Symbol 구현**: 커스텀 클래스에 이터러블, 형변환 등 언어 내장 동작 부여

```javascript
// 모듈 내 프라이빗 상태 (Symbol 활용)
const _count = Symbol('count');
class Counter {
  [_count] = 0;
  increment() { this[_count]++; }
  get value() { return this[_count]; }
}

const c = new Counter();
c.increment();
c.value; // 1
c[_count]; // Symbol을 모르면 접근 불가
```

---

**지난 글:** [string과 유니코드 완전 해부](/posts/js-string-unicode/)

**다음 글:** [null과 undefined의 차이](/posts/js-null-vs-undefined/)

<br>
읽어주셔서 감사합니다. 😊
