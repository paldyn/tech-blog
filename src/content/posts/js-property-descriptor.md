---
title: "프로퍼티 디스크립터 — 객체 속성을 정밀하게 제어하는 메타데이터"
description: "JavaScript 프로퍼티 디스크립터(value, writable, enumerable, configurable, get, set)의 개념과 getOwnPropertyDescriptor를 활용한 프로퍼티 분석 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "property-descriptor", "defineProperty", "writable", "enumerable", "configurable", "getter", "setter"]
featured: false
draft: false
---

[지난 글](/posts/js-object-creation-patterns/)에서 객체를 만드는 다섯 가지 패턴을 살펴봤습니다. 객체를 생성하는 것에서 한 발 더 나아가, JavaScript는 프로퍼티 하나하나에 **어떤 동작을 허용할지 결정하는 메타데이터**를 부여합니다. 이것이 프로퍼티 디스크립터(Property Descriptor)입니다. 라이브러리를 만들거나, 불변 객체를 설계하거나, 반응형 시스템을 구현할 때 반드시 알아야 하는 개념입니다.

---

## 프로퍼티 디스크립터란

JavaScript의 모든 프로퍼티는 겉으로 보이는 값 외에도 숨겨진 속성들을 가집니다. `Object.getOwnPropertyDescriptor`로 이를 꺼낼 수 있습니다.

```javascript
const obj = { x: 42 };

Object.getOwnPropertyDescriptor(obj, 'x');
// {
//   value: 42,
//   writable: true,
//   enumerable: true,
//   configurable: true
// }
```

객체 리터럴로 만든 프로퍼티는 세 플래그가 모두 `true`입니다. 이것이 우리가 평소 아무 제한 없이 프로퍼티를 수정하고, 순회하고, 삭제할 수 있는 이유입니다.

![프로퍼티 디스크립터 구조](/assets/posts/js-property-descriptor-structure.svg)

---

## 데이터 디스크립터 4가지 속성

**`value`**: 프로퍼티에 저장된 값. `undefined`도 값입니다.

**`writable`**: `false`이면 값 할당이 조용히 무시됩니다(엄격 모드에서는 `TypeError`).

```javascript
const obj = {};
Object.defineProperty(obj, 'PI', {
  value: 3.14159,
  writable: false,
  enumerable: true,
  configurable: false
});

obj.PI = 99;      // 무시 (sloppy mode)
console.log(obj.PI); // 3.14159

'use strict';
obj.PI = 99;      // TypeError: Cannot assign to read only property
```

**`enumerable`**: `false`이면 `for...in`, `Object.keys()`, `JSON.stringify()`에서 제외됩니다. 그러나 직접 접근은 여전히 가능합니다.

```javascript
const user = { name: 'Alice' };
Object.defineProperty(user, '_id', {
  value: 'abc123',
  enumerable: false,
  writable: true,
  configurable: true
});

Object.keys(user);         // ['name'] — _id 제외
JSON.stringify(user);      // '{"name":"Alice"}' — _id 제외
user._id;                  // 'abc123' — 직접 접근은 가능
```

**`configurable`**: `false`이면 디스크립터 자체를 수정하거나 `delete`로 프로퍼티를 삭제할 수 없습니다. 한 번 `false`로 설정하면 되돌릴 수 없습니다(단, `writable`은 `true → false`로만 변경 가능).

```javascript
const obj = {};
Object.defineProperty(obj, 'key', {
  value: 1,
  configurable: false
});

delete obj.key;    // 조용히 실패 (엄격 모드에서는 TypeError)
Object.defineProperty(obj, 'key', {
  enumerable: true // TypeError: Cannot redefine property: key
});
```

---

## 접근자 디스크립터 — get / set

`value` + `writable` 대신 `get` + `set`을 사용합니다. 두 종류를 동시에 지정하면 `TypeError`가 발생합니다.

```javascript
const temp = { _celsius: 25 };

Object.defineProperty(temp, 'fahrenheit', {
  get() {
    return this._celsius * 9/5 + 32;
  },
  set(val) {
    this._celsius = (val - 32) * 5/9;
  },
  enumerable: true,
  configurable: true
});

temp.fahrenheit;       // 77
temp.fahrenheit = 32;
temp._celsius;         // 0
```

이 방식은 객체 리터럴의 `get`/`set` 문법과 동일한 효과를 내지만, 나중에 동적으로 추가하거나 `enumerable` 같은 속성을 제어할 때 `Object.defineProperty`가 필요합니다.

![getOwnPropertyDescriptor 예시](/assets/posts/js-property-descriptor-code.svg)

---

## 모든 프로퍼티 한 번에 조회

```javascript
const desc = Object.getOwnPropertyDescriptors(obj);
// 객체의 모든 프로퍼티 디스크립터를 한 번에 반환
```

이 메서드는 `Object.create`와 함께 사용할 때 특히 유용합니다. 얕은 복사에서 getter/setter를 잃지 않고 복제할 수 있습니다.

```javascript
const copy = Object.create(
  Object.getPrototypeOf(original),
  Object.getOwnPropertyDescriptors(original)
);
// getter/setter와 non-enumerable 속성까지 완전히 복사
```

`Object.assign`이나 스프레드 `{...obj}`는 getter를 실행한 결과값만 복사하지만, 이 패턴은 디스크립터 자체를 복사합니다.

---

## `defineProperty` 기본값 주의

기존 프로퍼티를 `defineProperty`로 수정할 때는 명시하지 않은 속성이 유지됩니다. 하지만 **새 프로퍼티를 추가할 때는 명시하지 않은 속성이 모두 `false` 또는 `undefined`**입니다.

```javascript
const obj = {};

// 새 프로퍼티 — 누락된 속성은 false
Object.defineProperty(obj, 'x', { value: 1 });
// { value: 1, writable: false, enumerable: false, configurable: false }

// 기존 프로퍼티 수정 — 누락된 속성은 그대로 유지
Object.defineProperty(obj, 'x', { writable: true });
// { value: 1, writable: true, enumerable: false, configurable: false }
```

이 차이를 모르면 생각보다 많은 버그가 발생합니다. 새 프로퍼티를 추가할 때는 필요한 속성을 명시적으로 지정하는 것이 안전합니다.

---

## 실무 활용

- **읽기 전용 상수**: `writable: false, configurable: false`
- **숨겨진 내부 상태**: `enumerable: false`
- **반응형 시스템**: `get`/`set`으로 값 변경을 감지
- **Vue 2**의 반응형 데이터가 `Object.defineProperty`로 구현됐습니다. Vue 3는 `Proxy`로 이전했지만, 원리는 같습니다

다음 글에서는 객체 리터럴과 클래스에서 더 간결하게 getter/setter를 정의하는 문법을 살펴봅니다.

---

**다음 글:** [getter와 setter — 프로퍼티 접근을 함수로 위장하기](/posts/js-getter-setter/)

<br>
읽어주셔서 감사합니다. 😊
