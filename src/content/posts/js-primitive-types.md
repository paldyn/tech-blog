---
title: "원시 타입 7가지 — JavaScript의 기본 자료형"
description: "number, string, boolean, null, undefined, symbol, bigint의 특성과 불변성, 값에 의한 복사, 래퍼 객체 자동 박싱, 참조 타입과의 메모리 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["원시타입", "number", "string", "boolean", "null", "undefined", "symbol", "bigint"]
featured: false
draft: false
---

[지난 글](/posts/js-tdz/)에서 TDZ를 통해 변수 선언 이전에 접근하는 것이 얼마나 위험한지 살펴보았습니다. 이제 그 변수들이 담을 수 있는 값의 타입으로 이야기를 옮깁니다. JavaScript의 모든 값은 **원시 타입(Primitive Type)** 또는 **참조 타입(Reference Type)** 중 하나입니다. 이번 글은 7가지 원시 타입의 특성과 참조 타입과의 본질적 차이를 다룹니다.

## 7가지 원시 타입

![JavaScript의 7가지 원시 타입](/assets/posts/js-primitive-types-overview.svg)

### number

64비트 IEEE 754 부동소수점 형식을 사용합니다. 정수와 실수를 구분하지 않습니다. 특수 값으로 `Infinity`, `-Infinity`, `NaN`(Not a Number)이 있습니다. 정밀도 한계로 `0.1 + 0.2 !== 0.3`이 됩니다 — 다음 글에서 자세히 다룹니다.

```javascript
typeof 42        // 'number'
typeof 3.14      // 'number'
typeof NaN       // 'number' (!!)
typeof Infinity  // 'number'
```

### string

UTF-16 코드 단위 시퀀스입니다. 작은따옴표, 큰따옴표, 백틱 세 가지로 표기합니다. **불변(immutable)**입니다 — 인덱스로 문자를 바꿀 수 없습니다.

```javascript
const s = 'hello';
s[0] = 'H'; // 조용히 무시 (strict mode에서도 오류 없음)
console.log(s); // 'hello' — 변경 없음

// 문자열 메서드는 항상 새 문자열 반환
console.log(s.toUpperCase()); // 'HELLO'
console.log(s);               // 'hello' — 원본 불변
```

### boolean

`true` 또는 `false` 두 값만 가집니다. 조건문과 논리 연산의 핵심입니다.

### null

"의도적으로 비어 있음"을 나타내는 값입니다. `typeof null`이 `'object'`를 반환하는 것은 역사적 버그입니다 — 수정하면 하위 호환이 깨지기 때문에 유지됩니다.

```javascript
typeof null // 'object' — JS 역사적 버그
null === null // true
```

### undefined

선언되었지만 초기화되지 않은 변수, 존재하지 않는 객체 속성, 반환값이 없는 함수의 기본값입니다.

```javascript
let x;
console.log(x); // undefined
console.log({}.missing); // undefined
function f() {}
console.log(f()); // undefined
```

### symbol

ES2015에 추가된 고유하고 변경 불가능한 식별자입니다. 같은 설명으로 생성해도 서로 다릅니다.

```javascript
const s1 = Symbol('id');
const s2 = Symbol('id');
console.log(s1 === s2); // false — 항상 고유

// 객체 속성의 충돌 없는 키로 활용
const KEY = Symbol('internalKey');
const obj = { [KEY]: 'secret' };
console.log(obj[KEY]); // 'secret'
console.log(Object.keys(obj)); // [] — 열거 안 됨
```

### bigint

ES2020에 추가된 임의 정밀도 정수 타입입니다. `number`의 안전한 정수 범위(`Number.MAX_SAFE_INTEGER = 2^53 - 1`)를 넘는 정수를 정확하게 처리합니다.

```javascript
const big = 9007199254740993n; // n 접미사
console.log(9007199254740992 + 1);  // 9007199254740992 (오류!)
console.log(9007199254740992n + 1n); // 9007199254740993n (정확)

typeof 42n // 'bigint'
// number와 혼합 연산 불가 — 명시적 변환 필요
```

## 원시 타입의 핵심 특성

### 불변성

원시 값은 생성 후 변경할 수 없습니다. 문자열 메서드는 원본을 수정하지 않고 새 값을 반환합니다. 변수에 새 값을 할당하는 것은 바인딩(변수가 가리키는 대상)을 바꾸는 것이지, 값을 수정하는 게 아닙니다.

### 값에 의한 복사와 비교

![원시 타입 vs 참조 타입 — 메모리 모델](/assets/posts/js-primitive-types-vs-reference.svg)

원시 값을 다른 변수에 할당하면 값 자체가 복사됩니다. 비교 시에도 값이 같으면 동등합니다.

```javascript
let a = 42;
let b = a; // 값 복사
b = 100;
console.log(a); // 42 — a는 변하지 않음

// 참조 타입은 다름
const obj1 = { x: 1 };
const obj2 = obj1; // 참조 복사
obj2.x = 99;
console.log(obj1.x); // 99 — 같은 객체를 가리킴
```

### 래퍼 객체 자동 박싱

원시 타입은 객체가 아니지만, `.length`나 `.toUpperCase()` 같은 프로퍼티에 접근할 때 JavaScript 엔진이 잠깐 해당 원시 타입의 래퍼 객체(`String`, `Number`, `Boolean`)를 생성합니다. 접근이 끝나면 즉시 폐기됩니다.

```javascript
'hello'.length;       // 5 — 임시 String 래퍼 생성
(42).toString(2);     // '101010' — 임시 Number 래퍼 생성
true.toString();      // 'true' — 임시 Boolean 래퍼 생성
```

**new 키워드로 래퍼 객체를 직접 생성하지 마세요.** 원시 값이 아니라 객체가 되어 예기치 않은 동작을 일으킵니다.

```javascript
const n = new Number(42);
typeof n; // 'object' (!!!)
n == 42;  // true (느슨한 비교)
n === 42; // false (타입 다름)
```

## typeof 연산자

```javascript
typeof undefined  // 'undefined'
typeof null       // 'object' ← 버그
typeof true       // 'boolean'
typeof 42         // 'number'
typeof 'hello'    // 'string'
typeof Symbol()   // 'symbol'
typeof 42n        // 'bigint'
typeof {}         // 'object'
typeof []         // 'object' ← 배열도 object
typeof function(){} // 'function' ← 특별 처리
```

`null` 체크에는 `=== null`을 사용하고, 배열 체크에는 `Array.isArray()`를 사용합니다.

---

**지난 글:** [TDZ — Temporal Dead Zone의 실체](/posts/js-tdz/)

**다음 글:** [number와 IEEE 754 — 0.1 + 0.2가 0.3이 아닌 이유](/posts/js-number-ieee754/)

<br>
읽어주셔서 감사합니다. 😊
