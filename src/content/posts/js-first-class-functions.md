---
title: "일급 함수 완전 정복"
description: "JavaScript에서 함수가 일급 객체(first-class citizen)인 이유와 그 의미, 변수 저장·인수 전달·반환값으로서의 활용, 함수 합성·전략 패턴·팩토리 등 핵심 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 16
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "일급함수", "first-class-function", "고차함수", "함수합성", "전략패턴", "함수형프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/js-arrow-function-and-this/)에서 화살표 함수와 렉시컬 `this`를 살펴봤습니다. 이번에는 JavaScript 함수형 프로그래밍의 근간인 **일급 함수(first-class function)** 개념을 다룹니다. 함수가 일급 시민(first-class citizen)이라는 것은 함수를 다른 값과 동일하게 취급할 수 있다는 뜻입니다. 변수에 저장하고, 다른 함수에 인수로 넘기고, 함수의 반환값으로 사용할 수 있습니다.

## 일급 시민의 세 가지 조건

프로그래밍 언어에서 특정 개체가 일급 시민이라면:

1. **변수에 할당** 가능
2. **함수의 인수**로 전달 가능
3. **함수의 반환값**으로 사용 가능

JavaScript의 함수는 이 세 가지를 모두 충족합니다.

```javascript
// ① 변수에 저장
const double = n => n * 2;
const ops = [double, Math.sqrt, Math.abs];  // 배열에도 저장

// ② 인수로 전달
[1, 2, 3].map(double);    // [2, 4, 6]
[1, -2, 3].filter(n => n > 0); // [1, 3]

// ③ 반환값으로
function multiplier(factor) {
  return n => n * factor;  // 함수를 반환
}
const triple = multiplier(3);
triple(5); // 15
```

![일급 함수 개념](/assets/posts/js-first-class-functions-concept.svg)

## 함수는 객체다

JavaScript에서 함수는 `Function` 생성자의 인스턴스이자 일반 객체입니다. 프로퍼티를 갖고, `typeof`로 확인하면 `'function'`이 나오며, 프로토타입 체인을 통해 `call`, `apply`, `bind` 같은 메서드를 상속합니다.

```javascript
function greet(name) {
  return `Hello, ${name}!`;
}

greet.language = 'Korean';   // 프로퍼티 추가
greet.description = '인사 함수';

console.log(greet.name);     // 'greet'
console.log(greet.length);   // 1 (선언된 파라미터 수)
console.log(greet.language); // 'Korean'
```

이 특성을 이용해 메모이제이션 구현 시 캐시를 함수 프로퍼티로 저장하는 패턴도 있습니다(단, 클로저 방식이 더 캡슐화에 유리합니다).

## 고차 함수 (Higher-Order Function)

함수를 인수로 받거나 반환하는 함수를 **고차 함수**라고 합니다. `Array.prototype.map`, `filter`, `reduce`가 대표적입니다.

```javascript
// 직접 만드는 고차 함수
function repeat(n, fn) {
  for (let i = 0; i < n; i++) fn(i);
}

repeat(3, i => console.log(`반복 ${i}`));
// 반복 0
// 반복 1
// 반복 2

// 데코레이터 패턴 — 함수를 받아 기능 추가
function withLogging(fn) {
  return function(...args) {
    console.log(`호출: ${fn.name}(${args})`);
    const result = fn(...args);
    console.log(`결과: ${result}`);
    return result;
  };
}

const loggedDouble = withLogging(double);
loggedDouble(5);
// 호출: double(5)
// 결과: 10
```

## 함수 합성 (Function Composition)

여러 함수를 연결하여 새로운 함수를 만드는 패턴입니다. `compose`는 오른쪽→왼쪽, `pipe`는 왼쪽→오른쪽 순서로 실행합니다.

```javascript
const compose = (...fns) => x =>
  fns.reduceRight((acc, fn) => fn(acc), x);

const pipe = (...fns) => x =>
  fns.reduce((acc, fn) => fn(acc), x);

const trim = s => s.trim();
const lower = s => s.toLowerCase();
const words = s => s.split(' ');

const process = pipe(trim, lower, words);
process('  Hello World  ');
// ['hello', 'world']
```

합성은 각 함수가 단일 책임을 지고, 단순한 함수들을 조립해 복잡한 처리를 만드는 함수형 프로그래밍의 핵심입니다.

![일급 함수 활용 패턴](/assets/posts/js-first-class-functions-patterns.svg)

## 전략 패턴 — 함수 맵

조건 분기 대신 함수를 값으로 저장한 객체(맵)를 사용하면 코드가 깔끔해집니다.

```javascript
const formatters = {
  currency: n => `₩${n.toLocaleString()}`,
  percent:  n => `${(n * 100).toFixed(1)}%`,
  date:     d => new Date(d).toLocaleDateString('ko-KR'),
};

function format(type, value) {
  const fn = formatters[type];
  if (!fn) throw new Error(`알 수 없는 타입: ${type}`);
  return fn(value);
}

format('currency', 12345);   // '₩12,345'
format('percent', 0.856);    // '85.6%'
```

새 포맷을 추가할 때 조건문을 수정하지 않고 `formatters` 객체에 항목만 추가하면 됩니다.

## 함수 팩토리 — 설정을 캡처한 함수 생성

함수를 반환하는 함수로 설정값을 클로저에 캡처한 특화 함수를 만들 수 있습니다.

```javascript
const makeAdder = n => x => x + n;
const add5  = makeAdder(5);
const add10 = makeAdder(10);

add5(3);   // 8
add10(3);  // 13

// URL 빌더 팩토리
const makeApiCall = (baseUrl) => (path, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return `${baseUrl}${path}${query ? '?' + query : ''}`;
};

const api = makeApiCall('https://api.example.com');
api('/users', { page: 1 });  // 'https://api.example.com/users?page=1'
```

## 주의: 함수 레퍼런스 vs 호출

콜백을 넘길 때 실수하기 쉬운 부분입니다.

```javascript
// ✓ 함수 참조 전달 (나중에 map이 호출)
[1, 2, 3].map(double);

// ✗ 즉시 호출 후 결과(NaN)를 전달
[1, 2, 3].map(double());

// setTimeout도 동일
setTimeout(fn, 1000);       // ✓
setTimeout(fn(), 1000);     // ✗ 즉시 실행
setTimeout(() => fn(), 1000); // ✓ 래퍼 화살표
```

---

**지난 글:** [화살표 함수와 this](/posts/js-arrow-function-and-this/)

**다음 글:** [기본값 파라미터와 나머지 파라미터](/posts/js-default-rest-parameters/)

<br>
읽어주셔서 감사합니다. 😊
