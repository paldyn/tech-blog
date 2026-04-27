---
title: "원시 타입 vs 참조 타입 — 복사 버그의 근원"
description: "JavaScript에서 값이 어떻게 메모리에 저장되고 복사되는지 이해하면, 흔한 버그의 원인이 한눈에 보입니다."
author: "PALDYN Team"
pubDate: "2026-04-21"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "원시타입", "참조타입", "메모리", "스택", "힙", "얕은복사", "깊은복사"]
featured: false
draft: false
---

지난 [변수와 타입 — var, let, const 그리고 8가지 데이터 타입](/posts/js-variables-and-types/) 글에서 JavaScript의 타입을 원시 타입 7가지와 객체 타입으로 나눴습니다. 그런데 왜 굳이 이렇게 구분할까요? 이름이 달라서가 아닙니다. **메모리에 저장되는 방식과 복사 동작이 근본적으로 다르기 때문**입니다.

이 차이를 이해하지 못하면, 코드를 수정했는데 의도하지 않은 다른 변수도 함께 바뀌는 버그를 반복해서 만나게 됩니다.

---

## 두 종류의 메모리 공간

컴퓨터 메모리를 단순화하면 **스택(Stack)** 과 **힙(Heap)** 두 구역으로 나뉩니다.

**스택**은 작고 고정된 크기의 데이터를 빠르게 쌓고 꺼내는 공간입니다. 마치 책상 위 메모지처럼, 값이 작고 크기가 예측 가능할 때 씁니다. 원시 타입 값들이 여기 저장됩니다.

**힙**은 크기가 자유롭고 동적인 데이터를 저장하는 공간입니다. 객체, 배열, 함수처럼 얼마나 클지 미리 알 수 없는 데이터가 여기에 놓입니다. 스택의 변수에는 힙 안에 있는 데이터의 **메모리 주소(참조)** 가 저장됩니다.

![스택과 힙 메모리 구조 — 원시 타입과 객체 타입의 저장 위치](/assets/posts/js-primitive-vs-reference-memory.svg)

---

## 원시 타입: 값이 복사된다

원시 타입을 다른 변수에 할당하면, **값 자체가 복사**됩니다. 이후 원본을 바꿔도 복사본에는 영향이 없습니다.

```js
let a = 10;
let b = a;   // b에 10이라는 값이 복사됨

a = 99;
console.log(b); // 10 — b는 영향받지 않음
```

`b`는 `a`를 바라보는 게 아니라, 복사 시점의 값 `10`을 독립적으로 가집니다. 각자 자기 메모지를 갖는 셈입니다.

---

## 객체 타입: 주소가 복사된다

객체를 다른 변수에 할당하면, 데이터가 복사되는 게 아니라 **힙 안의 주소(참조)가 복사**됩니다. 두 변수는 같은 객체를 가리키게 됩니다.

```js
let obj1 = { x: 1 };
let obj2 = obj1;   // 주소가 복사됨

obj1.x = 99;
console.log(obj2.x); // 99 — 같은 객체를 가리키기 때문
```

같은 집 주소가 적힌 메모지를 두 장 만든 것과 같습니다. 한 사람이 그 집의 가구를 바꾸면, 다른 메모지를 가진 사람이 방문해도 바뀐 가구를 보게 됩니다.

![값 복사(원시)와 참조 복사(객체)의 차이](/assets/posts/js-primitive-vs-reference-copy.svg)

---

## 함수에서도 똑같이 동작한다

이 규칙은 함수에 인자를 넘길 때도 동일하게 적용됩니다.

```js
function double(n) {
  n = n * 2;
}

let num = 5;
double(num);
console.log(num); // 5 — 원시 타입은 값 복사, 원본 불변
```

```js
function rename(user) {
  user.name = "Bob";
}

let person = { name: "Alice" };
rename(person);
console.log(person.name); // "Bob" — 같은 객체를 수정함
```

원시 타입 인자는 함수 안에서 아무리 바꿔도 외부에 영향이 없지만, 객체 인자는 내부 속성을 수정하면 외부까지 바뀝니다.

---

## 원시 타입은 불변이다

원시 타입 값 자체는 변경할 수 없습니다. 문자열의 특정 문자를 바꾸려 해도 아무 일도 일어나지 않습니다.

```js
let str = "hello";
str[0] = "H";      // 아무 일도 일어나지 않음
console.log(str);  // "hello"
```

변수에 새 값을 재할당할 수는 있지만, 그것은 기존 값을 수정하는 게 아니라 변수가 가리키는 값을 교체하는 것입니다. 원시 타입의 불변성은 안전한 데이터 처리의 기반이 됩니다.

---

## 객체를 복사하려면

객체를 진짜로 복사하려면 명시적인 복사 작업이 필요합니다.

**얕은 복사(Shallow Copy)** — 최상위 속성만 복사합니다.

```js
const original = { a: 1, b: 2 };

// 방법 1: Object.assign
const copy1 = Object.assign({}, original);

// 방법 2: 스프레드 연산자 (ES2018)
const copy2 = { ...original };

copy1.a = 99;
console.log(original.a); // 1 — 독립적으로 복사됨
```

그런데 중첩된 객체가 있다면 여전히 참조가 공유됩니다.

```js
const original = { a: { x: 1 } };
const copy = { ...original };

copy.a.x = 99;
console.log(original.a.x); // 99 — 중첩 객체는 여전히 참조 공유
```

**깊은 복사(Deep Copy)** — 모든 깊이의 값을 독립적으로 복사합니다.

```js
// structuredClone (ES2022, 현대 브라우저/Node.js 17+)
const deep = structuredClone(original);

// 또는 JSON 방법 (함수, undefined, 날짜 등은 처리 불가)
const deep2 = JSON.parse(JSON.stringify(original));
```

`structuredClone`은 2022년에 표준화된 가장 안전한 방법입니다. 이전에는 재귀 함수를 직접 구현하거나 Lodash 같은 라이브러리를 쓰는 것이 일반적이었습니다.

---

## 등호 비교의 함정

`===` 로 객체를 비교하면 값이 아닌 **참조(주소)** 를 비교합니다.

```js
const a = { x: 1 };
const b = { x: 1 };
const c = a;

console.log(a === b); // false — 내용 같아도 다른 객체
console.log(a === c); // true  — 같은 객체를 가리킴
```

두 객체의 내용이 같은지 비교하려면 직접 속성을 비교하거나 `JSON.stringify`를 사용해야 합니다.

---

원시 타입과 참조 타입의 차이는 JavaScript를 다루는 내내 반복해서 등장합니다. 함수에 인자를 넘길 때, 상태를 업데이트할 때, 객체를 비교할 때마다 이 원칙이 적용됩니다. 다음 글에서는 JavaScript의 함수가 왜 특별한지—함수가 값처럼 취급되는 일급 객체라는 개념을 살펴봅니다.

---

**지난 글:** [변수와 타입 — var, let, const 그리고 8가지 데이터 타입](/posts/js-variables-and-types/)

**다음 글:** [함수는 일급 객체다 — 값처럼 다루는 함수](/posts/js-functions-first-class/)

<br>
읽어주셔서 감사합니다. 😊
