---
title: "기본값 파라미터와 나머지 파라미터"
description: "ES2015 기본값 파라미터(default parameters)와 나머지 파라미터(rest parameters)의 문법, 평가 시점, arguments와의 차이, 옵션 객체 패턴과 필수 파라미터 강제 기법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "기본값파라미터", "default-parameters", "나머지파라미터", "rest-parameters", "ES6", "함수파라미터"]
featured: false
draft: false
---

[지난 글](/posts/js-first-class-functions/)에서 함수를 값으로 다루는 일급 함수 개념을 살펴봤습니다. 이번에는 ES2015가 도입한 함수 파라미터 두 가지 — **기본값 파라미터(default parameters)**와 **나머지 파라미터(rest parameters)** 를 다룹니다. 두 기능은 이전에 관용적으로 쓰이던 `arguments` 객체 조작과 `||` 기본값 패턴을 대체하여 코드를 명확하게 만들어 줍니다.

## 기본값 파라미터

파라미터 이름 뒤에 `= 기본값`을 붙이면, 해당 인수가 `undefined`일 때 기본값이 사용됩니다.

```javascript
function greet(name = 'World', greeting = 'Hello') {
  return `${greeting}, ${name}!`;
}

greet();                  // 'Hello, World!'
greet('Kim');             // 'Hello, Kim!'
greet('Kim', '안녕');    // '안녕, Kim!'
greet(undefined, '안녕'); // '안녕, World!' — undefined만 기본값 사용
greet(null, '안녕');      // '안녕, null!' — null은 그대로 전달
```

`null`은 "값이 없음을 의도한 전달"로 간주하여 기본값이 적용되지 않는 점에 주의하세요.

### 기본값은 런타임에 매번 평가

기본값은 함수 정의 시 한 번이 아니라 호출 때마다 새로 평가됩니다.

```javascript
function addItem(item, list = []) {  // 매 호출마다 새 배열
  list.push(item);
  return list;
}

addItem('a');  // ['a']
addItem('b');  // ['b'] — 같은 배열이 재사용되지 않음
```

이는 Python의 기본값이 한 번만 평가되어 공유되는 것과 다릅니다. JavaScript에서는 변경 가능한 값도 기본값으로 안전하게 사용할 수 있습니다.

### 앞 파라미터를 기본값으로 참조

이전 파라미터를 뒤 파라미터의 기본값으로 사용할 수 있습니다.

```javascript
function createRect(width, height = width) {
  return { width, height };
}

createRect(10);     // { width: 10, height: 10 } — 정사각형
createRect(10, 20); // { width: 10, height: 20 }
```

단, 역방향은 불가합니다. `function f(a = b, b)` 구조는 TDZ 때문에 에러가 납니다.

![기본값·나머지 파라미터 문법](/assets/posts/js-default-rest-params-syntax.svg)

## 나머지 파라미터

마지막 파라미터 앞에 `...`을 붙이면, 나머지 모든 인수를 **진짜 배열**로 수집합니다.

```javascript
function sum(first, ...rest) {
  return rest.reduce((acc, n) => acc + n, first);
}

sum(1, 2, 3, 4);   // 10
sum(5);            // 5 (rest = [])
```

`...rest`는 반드시 마지막 파라미터여야 합니다. `function f(...a, b)`는 SyntaxError입니다.

## arguments 객체와의 차이

| 항목 | `arguments` | 나머지 파라미터 |
|------|-------------|----------------|
| 타입 | 유사 배열 | 진짜 배열 |
| 배열 메서드 | 직접 사용 불가 | map/filter/reduce 직접 사용 |
| 화살표 함수 | 없음 | 있음 |
| 명시적 이름 | 없음 | 있음 |

```javascript
// 구식 패턴
function oldFn() {
  const args = Array.from(arguments); // 변환 필요
  return args.reduce((a, b) => a + b, 0);
}

// 현대 패턴
const newFn = (...args) => args.reduce((a, b) => a + b, 0);
```

## 함수.length에 미치는 영향

`함수.length`는 기본값이 없는 파라미터의 수를 반환합니다. 기본값이 있는 파라미터부터는 카운트에서 제외되고, 나머지 파라미터도 포함되지 않습니다.

```javascript
function f1(a, b, c) {}       f1.length // 3
function f2(a, b = 0, c) {}   f2.length // 1 (b부터 제외)
function f3(a, ...rest) {}    f3.length // 1 (rest 제외)
```

이는 함수 오버로딩 라이브러리나 커링 구현에서 arity를 파악할 때 영향을 줍니다.

## 옵션 객체 패턴

파라미터가 많을 때 객체를 받고 구조 분해로 기본값을 적용하는 패턴이 가장 명확합니다.

```javascript
function createServer({
  host = 'localhost',
  port = 3000,
  timeout = 5000,
  tls = false,
} = {}) {
  return { host, port, timeout, tls };
}

createServer();                        // 모두 기본값
createServer({ port: 8080, tls: true }); // 일부만 지정
```

`= {}` 를 빠뜨리면 인수 없이 호출 시 TypeError가 나므로 항상 포함하세요.

![기본값·나머지 파라미터 실전 패턴](/assets/posts/js-default-rest-params-advanced.svg)

## 필수 파라미터 강제 패턴

기본값으로 에러를 던지는 함수를 사용해 필수 파라미터를 선언적으로 강제할 수 있습니다.

```javascript
const required = (param) => {
  throw new TypeError(`${param} 파라미터는 필수입니다.`);
};

function saveUser(
  id   = required('id'),
  name = required('name'),
  role = 'viewer'
) {
  return { id, name, role };
}

saveUser(1, 'Kim');       // { id:1, name:'Kim', role:'viewer' }
saveUser(1);              // TypeError: name 파라미터는 필수입니다.
```

## strict mode와 기본값 파라미터

기본값 파라미터나 나머지 파라미터를 사용한 함수 내부에서는 `'use strict'`를 직접 선언할 수 없습니다. 파일 상단에 선언하거나 ES 모듈(자동 strict mode)을 사용하세요.

```javascript
// ✗ SyntaxError
function fn(a = 1) {
  'use strict';
}

// ✓ 파일 상단에
'use strict';
function fn(a = 1) { /* ... */ }
```

---

**지난 글:** [일급 함수 완전 정복](/posts/js-first-class-functions/)

**다음 글:** [arguments 객체 완전 정복](/posts/js-arguments-object/)

<br>
읽어주셔서 감사합니다. 😊
