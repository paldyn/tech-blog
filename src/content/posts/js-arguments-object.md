---
title: "arguments 객체 완전 정복"
description: "JavaScript arguments 객체의 구조·유사 배열 특성·비엄격 파라미터 연동·callee 프로퍼티와, 나머지 파라미터와의 차이점 및 현대 코드에서의 올바른 대체 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 18
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "arguments", "유사배열", "array-like", "rest-parameters", "callee", "레거시"]
featured: false
draft: false
---

[지난 글](/posts/js-default-rest-parameters/)에서 기본값 파라미터와 나머지 파라미터를 다뤘습니다. 이번에는 나머지 파라미터의 선조이자 레거시 코드베이스에서 여전히 많이 만나게 되는 **`arguments` 객체**를 깊이 파헤칩니다. `arguments`를 제대로 이해해야 오래된 코드를 읽고 현대 패턴으로 안전하게 마이그레이션할 수 있습니다.

## arguments 객체란

일반 함수(`function` 키워드) 내부에서 자동으로 생성되는 특수 객체입니다. 함수 호출 시 전달된 **모든 인수**를 담습니다.

```javascript
function inspect() {
  console.log(arguments[0]);      // 첫 번째 인수
  console.log(arguments.length);  // 전달된 인수 개수
  console.log(arguments);         // Arguments 객체 전체
}

inspect(1, 'hello', true);
// 1
// 3
// Arguments(3) [1, 'hello', true]
```

중요한 것은 `arguments`가 **배열처럼 생겼지만 배열이 아니라는 점**입니다. 인덱스 접근(`arguments[0]`)과 `length` 프로퍼티는 있지만, `map`, `filter`, `reduce` 같은 배열 메서드는 없습니다.

```javascript
function tryMap() {
  return arguments.map(x => x * 2); // TypeError: arguments.map is not a function
}
```

## 배열로 변환

`arguments`를 실제 배열로 변환하는 방법은 세 가지입니다.

```javascript
function example() {
  // ES5 방식 — Function.prototype.call 활용
  const arr1 = Array.prototype.slice.call(arguments);

  // ES2015 — Array.from
  const arr2 = Array.from(arguments);

  // ES2015 — 스프레드 (가장 간결, 권장)
  const arr3 = [...arguments];

  return arr3.reduce((a, b) => a + b, 0);
}
example(1, 2, 3, 4); // 10
```

현대 코드에서는 `arguments` 변환보다 나머지 파라미터를 직접 사용하는 것이 훨씬 명확합니다.

![arguments 객체 해부](/assets/posts/js-arguments-object-anatomy.svg)

## 비엄격 모드의 파라미터 연동

비엄격(sloppy) 모드에서 `arguments`의 각 인덱스는 해당 이름 파라미터와 **live binding**으로 연결됩니다. 파라미터를 수정하면 `arguments`도 바뀌고, 반대도 마찬가지입니다.

```javascript
function sloppy(a, b) {
  a = 99;
  console.log(arguments[0]); // 99 — a와 연동
  arguments[1] = 100;
  console.log(b);             // 100 — 반대 방향도 연동
}
sloppy(1, 2);
```

엄격 모드에서는 이 연동이 사라집니다. `arguments`는 호출 시점의 값을 스냅샷으로 가지며 이후 변경에 영향받지 않습니다.

```javascript
function strict(a) {
  'use strict';
  a = 99;
  console.log(arguments[0]); // 1 — 원래 값 유지
}
strict(1);
```

이 비직관적 동작 때문에 비엄격 모드에서 `arguments`를 수정하는 패턴은 위험합니다.

## arguments.callee — 사용 금지

`arguments.callee`는 현재 실행 중인 함수 자신을 참조합니다. ES5 이전에 익명 재귀를 구현할 때 사용했습니다.

```javascript
// 구식 익명 재귀
var fac = function(n) {
  return n <= 1 ? 1 : n * arguments.callee(n - 1);
};
```

strict mode에서는 `arguments.callee` 접근 시 TypeError가 발생합니다. 현대 코드에서는 기명 함수 표현식으로 대체하세요.

```javascript
// 현대적 대체
const fac = function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
};
```

## 화살표 함수에는 arguments가 없다

화살표 함수에는 자체 `arguments` 바인딩이 없습니다. 화살표 함수 내부에서 `arguments`를 쓰면 외부 일반 함수의 `arguments`를 캡처합니다.

```javascript
function outer() {
  const inner = () => {
    console.log(arguments); // outer의 arguments!
  };
  inner(10, 20); // outer의 인수가 출력됨
}
outer(1, 2, 3);
```

화살표 함수에서 가변 인수를 처리하려면 나머지 파라미터를 사용하세요.

```javascript
const sum = (...args) => args.reduce((a, b) => a + b, 0);
```

![arguments vs 나머지 파라미터](/assets/posts/js-arguments-object-vs-rest.svg)

## 레거시 코드 마이그레이션

`arguments`를 나머지 파라미터로 변환하는 패턴입니다.

```javascript
// 이전
function oldLog() {
  var args = Array.prototype.slice.call(arguments);
  var level = args.shift();
  console[level].apply(console, args);
}

// 이후
function newLog(level, ...messages) {
  console[level](...messages);
}
```

## 실전: 파라미터 개수 오버로딩

`arguments.length`를 이용해 호출 패턴에 따라 동작을 분기하는 오버로딩 패턴입니다. 단, 나머지 파라미터와 조건문으로 더 명확하게 표현하는 것을 권장합니다.

```javascript
function range(...args) {
  if (args.length === 1) {
    return Array.from({ length: args[0] }, (_, i) => i);
  }
  if (args.length === 2) {
    const [start, end] = args;
    return Array.from({ length: end - start }, (_, i) => start + i);
  }
  const [start, end, step] = args;
  return Array.from(
    { length: Math.ceil((end - start) / step) },
    (_, i) => start + i * step
  );
}

range(5);          // [0,1,2,3,4]
range(2, 6);       // [2,3,4,5]
range(0, 10, 2);   // [0,2,4,6,8]
```

---

**지난 글:** [기본값 파라미터와 나머지 파라미터](/posts/js-default-rest-parameters/)

**다음 글:** [IIFE — 즉시 실행 함수 표현식](/posts/js-iife/)

<br>
읽어주셔서 감사합니다. 😊
