---
title: "원시 타입 7가지 — JavaScript의 기본 데이터"
description: "JavaScript의 7가지 원시 타입(number, string, boolean, null, undefined, Symbol, BigInt)의 특징과 typeof 동작, 원시 타입과 참조 타입의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-24"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "원시 타입", "primitive", "typeof", "null", "undefined", "Symbol", "BigInt"]
featured: false
draft: false
---

[지난 글](/posts/js-tdz/)에서 `let`과 `const`의 Temporal Dead Zone이 왜 존재하는지, 그리고 어떤 상황에서 ReferenceError가 발생하는지 살펴봤습니다. 이번 글에서는 JavaScript의 자료형 체계의 기초인 **원시 타입(primitive type)**을 정리합니다.

## 원시 타입이란

JavaScript에서 모든 값은 **원시 타입**이거나 **참조 타입(객체)**입니다. 원시 타입은 가장 기본적인 데이터 형태로, **불변(immutable)**합니다. 값 자체를 직접 변경할 수 없고, 변수에 새 값을 할당할 뿐입니다.

```javascript
let str = "hello";
str.toUpperCase();     // "HELLO" — 원본을 바꾸지 않음
console.log(str);      // "hello" — 그대로

str = str.toUpperCase(); // 새 문자열을 변수에 재할당
console.log(str);        // "HELLO"
```

![원시 타입 7가지](/assets/posts/js-primitive-types-overview.svg)

## 1. number

JavaScript에는 정수와 실수를 구분하는 타입이 없습니다. 모두 **IEEE 754 배정밀도 부동소수점** 형식으로 저장됩니다.

```javascript
typeof 42;        // "number"
typeof 3.14;      // "number"
typeof -0;        // "number"
typeof NaN;       // "number" — Not a Number도 number 타입!
typeof Infinity;  // "number"

// 정수 범위
Number.MAX_SAFE_INTEGER;  // 9007199254740991 (2^53 - 1)
Number.MIN_SAFE_INTEGER;  // -9007199254740991

// 특수 값
isNaN(NaN);    // true
isFinite(Infinity); // false
```

`NaN`은 "숫자가 아니다"라는 의미지만 `typeof NaN === "number"`라는 역설적 결과를 줍니다. 또 `NaN !== NaN`이 `true`이므로 `===`로는 NaN을 검사할 수 없습니다. `Number.isNaN()` 또는 `Object.is(x, NaN)`을 사용하세요.

## 2. string

문자열은 UTF-16 코드 유닛의 시퀀스입니다. 작은 따옴표, 큰 따옴표, 백틱(템플릿 리터럴) 세 가지로 만들 수 있습니다.

```javascript
const s1 = 'single';
const s2 = "double";
const s3 = `template ${1 + 1}`; // "template 2"

// 문자열은 불변
const str = "hello";
str[0] = "H"; // 조용히 무시됨 (strict: TypeError)
console.log(str); // "hello" — 바뀌지 않음

// 연결은 새 문자열 생성
const result = str + " world"; // "hello world"
```

## 3. boolean

`true`와 `false` 두 값만 갖습니다. 조건문, 논리 연산자, 비교 연산자의 결과로 자주 등장합니다.

```javascript
typeof true;  // "boolean"
typeof false; // "boolean"

// falsy 값들 — boolean 변환 시 false가 되는 값
Boolean(0);           // false
Boolean("");          // false
Boolean(null);        // false
Boolean(undefined);   // false
Boolean(NaN);         // false
Boolean(false);       // false
// 위 6개 외의 모든 값은 truthy
```

## 4. null

`null`은 **의도적으로 값이 없음**을 나타냅니다. 프로그래머가 명시적으로 "여기에는 아무것도 없다"고 선언할 때 사용합니다.

```javascript
let user = null; // 아직 사용자가 없음

typeof null; // "object" ← 유명한 버그!
```

`typeof null === "object"`는 JavaScript 초기 구현의 버그입니다. 비트 표현에서 null의 태그가 객체와 같았던 것이 원인인데, 기존 코드 호환성 때문에 수정할 수 없습니다. `null` 체크는 항상 `=== null`로 해야 합니다.

## 5. undefined

`undefined`는 **값이 할당되지 않음**을 나타내는 JavaScript가 자동으로 부여하는 값입니다.

```javascript
let x;                  // undefined — 선언만, 초기화 안 됨
function fn() {}
fn();                   // undefined — 반환값 없는 함수
const obj = {};
obj.missing;            // undefined — 존재하지 않는 프로퍼티

// null vs undefined
null === undefined;     // false
null == undefined;      // true (느슨한 동등)
```

실용적 구분:
- `null`: 개발자가 의도적으로 비움
- `undefined`: JavaScript가 "아직 값 없음" 표시

## 6. Symbol (ES2015)

Symbol은 **유일하고 변경 불가한 식별자**를 만드는 데 사용합니다. 설명 인자는 디버깅용일 뿐, 유일성에 영향을 주지 않습니다.

```javascript
const id1 = Symbol("id");
const id2 = Symbol("id");
id1 === id2; // false — 항상 다름!

// 객체 키로 사용 — 충돌 방지
const KEY = Symbol("secret");
const obj = {
  [KEY]: "private data",
  name: "public"
};
obj[KEY]; // "private data"
Object.keys(obj); // ["name"] — Symbol 키는 열거되지 않음

// Well-known Symbols — 언어 내장 동작 커스터마이즈
class MyCollection {
  [Symbol.iterator]() { /* ... */ }
}
```

## 7. BigInt (ES2020)

`number` 타입은 `2^53 - 1`보다 큰 정수를 정확하게 표현하지 못합니다. `BigInt`는 임의 크기의 정수를 처리합니다.

```javascript
// number의 한계
9007199254740992 === 9007199254740993; // true! (잘못된 결과)

// BigInt는 정확하게
9007199254740992n === 9007199254740993n; // false (정확함)

const huge = 9007199254740993n;
typeof huge; // "bigint"

// 주의: number와 혼용 불가
1n + 1;   // TypeError
1n + 1n;  // 2n (OK)
Number(1n); // 1 (변환)
```

## typeof로 원시 타입 판별

![typeof 결과표](/assets/posts/js-primitive-types-typeof.svg)

```javascript
// null을 제외한 원시 타입은 typeof로 정확히 판별
typeof 42;          // "number"
typeof "hello";     // "string"
typeof true;        // "boolean"
typeof undefined;   // "undefined"
typeof Symbol();    // "symbol"
typeof 42n;         // "bigint"

// 함수는 별도
typeof function(){}; // "function"

// 객체, 배열, null은 모두 "object"
typeof {};          // "object"
typeof [];          // "object"
typeof null;        // "object" ← 버그

// null 정확한 체크
const isNull = (x) => x === null;
// 또는
const isObject = (x) => typeof x === "object" && x !== null;
```

## 원시 타입 vs 참조 타입

원시 타입은 **값(value) 복사**, 객체·배열 같은 참조 타입은 **참조(reference) 복사**입니다:

```javascript
// 원시 타입 — 값 복사
let a = 42;
let b = a;
b = 100;
console.log(a); // 42 — 영향 없음

// 참조 타입 — 주소 복사
let obj1 = { x: 1 };
let obj2 = obj1;    // 같은 객체를 가리킴
obj2.x = 99;
console.log(obj1.x); // 99 — 같은 객체!
```

이 차이는 함수에 인자를 넘길 때도 동일하게 적용됩니다. 원시 타입은 복사본이 전달되고, 객체는 참조가 전달됩니다.

---

**지난 글:** [TDZ (Temporal Dead Zone)](/posts/js-tdz/)

**다음 글:** [number의 IEEE 754 정밀도와 함정](/posts/js-number-ieee754/)

<br>
읽어주셔서 감사합니다. 😊
