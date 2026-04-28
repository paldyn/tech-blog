---
title: "제너레이터 함수"
description: "function* 문법과 yield로 실행을 일시 정지·재개하는 제너레이터 함수의 동작 원리, 무한 시퀀스, 지연 평가, yield* 위임까지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "제너레이터", "Generator", "이터러블", "지연 평가"]
featured: false
draft: false
---

[지난 글](/posts/js-tail-call-limitations/)에서 꼬리 호출 최적화의 현실적 한계를 살펴봤습니다. 이번에는 재귀보다 유연하게 반복 로직을 표현하는 **제너레이터 함수(Generator Functions)** 를 다룹니다. 제너레이터는 함수 실행을 중간에 멈추고 나중에 재개할 수 있는 독특한 함수 유형입니다.

## 제너레이터란?

일반 함수는 호출하면 끝날 때까지 실행됩니다. 제너레이터는 `yield` 키워드를 만나면 **실행을 일시 정지**하고 값을 반환하다가, 다시 호출하면 멈춘 지점부터 재개합니다.

```javascript
function* hello() {  // function* 로 선언
  console.log('A');
  yield 1;           // 첫 번째 정지점
  console.log('B');
  yield 2;           // 두 번째 정지점
  console.log('C');
  // 함수 종료
}

const gen = hello(); // 호출해도 실행 안 됨 — Iterator 객체 반환

gen.next(); // 'A' 출력, { value: 1, done: false }
gen.next(); // 'B' 출력, { value: 2, done: false }
gen.next(); // 'C' 출력, { value: undefined, done: true }
```

`next()`를 처음 호출하기 전까지 함수 본문은 전혀 실행되지 않습니다. `done: true`가 되면 더 이상 `next()`를 호출해도 `{ value: undefined, done: true }`만 반환됩니다.

![제너레이터 함수 실행 흐름](/assets/posts/js-generator-functions-lifecycle.svg)

## next()에 값 전달하기

`next(value)`로 제너레이터 내부에 값을 주입할 수 있습니다. `yield` 표현식의 결과값이 됩니다.

```javascript
function* calculator() {
  const a = yield '첫 번째 숫자를 입력하세요';
  const b = yield '두 번째 숫자를 입력하세요';
  return a + b;
}

const calc = calculator();
calc.next();       // { value: '첫 번째 숫자를 입력하세요', done: false }
calc.next(10);     // a = 10, { value: '두 번째 숫자를 입력하세요', done: false }
calc.next(20);     // b = 20, { value: 30, done: true }
```

첫 번째 `next()` 호출의 인자는 무시됩니다. `yield`가 실행되기 전이라 받을 곳이 없기 때문입니다.

## 무한 시퀀스

제너레이터의 강점 중 하나는 **무한히 값을 생성**할 수 있다는 점입니다. 배열에 담으면 메모리가 부족하지만, 제너레이터는 `next()`를 호출할 때만 하나씩 계산합니다.

```javascript
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

const fib = fibonacci();
fib.next().value; // 0
fib.next().value; // 1
fib.next().value; // 1
fib.next().value; // 2
fib.next().value; // 3
fib.next().value; // 5
```

`while (true)`지만 `yield`가 매 반복마다 실행을 멈추므로 무한 루프가 아닙니다.

## for...of와 스프레드

제너레이터 객체는 **이터러블 프로토콜**을 구현합니다. `for...of`, 스프레드 연산자, 구조 분해가 모두 동작합니다.

```javascript
function* range(start, end, step = 1) {
  for (let i = start; i < end; i += step) {
    yield i;
  }
}

// for...of
for (const n of range(0, 5)) {
  console.log(n); // 0 1 2 3 4
}

// 스프레드
const arr = [...range(0, 10, 2)]; // [0, 2, 4, 6, 8]

// 구조 분해
const [first, second] = range(10, 20);
console.log(first, second); // 10 11
```

![제너레이터 실전 활용 패턴](/assets/posts/js-generator-functions-patterns.svg)

## 지연 평가(Lazy Evaluation)

배열 메서드 체인은 모든 원소를 한 번에 처리합니다. 제너레이터로 각 단계를 지연시키면 필요한 만큼만 계산합니다.

```javascript
function* map(fn, iter) {
  for (const x of iter) yield fn(x);
}

function* filter(pred, iter) {
  for (const x of iter) if (pred(x)) yield x;
}

function* take(n, iter) {
  for (const x of iter) {
    yield x;
    if (--n === 0) return;
  }
}

// 무한 시퀀스에서 짝수만, 제곱해서, 5개만 꺼내기
// 배열 없이 필요한 값만 계산
const result = [
  ...take(5,
    map(x => x * x,
      filter(x => x % 2 === 0,
        fibonacci()
      )
    )
  )
];
// [0, 4, 16, 144, 1444] — 실제로는 더 큰 값
```

## yield* — 제너레이터 위임

`yield*`는 다른 이터러블에 실행을 **위임**합니다. 제너레이터를 조합하거나 배열을 그대로 yield할 때 편리합니다.

```javascript
function* inner() {
  yield 'A';
  yield 'B';
}

function* outer() {
  yield 1;
  yield* inner(); // inner의 모든 값을 yield
  yield* [3, 4];  // 배열 이터러블도 위임 가능
  yield 5;
}

console.log([...outer()]); // [1, 'A', 'B', 3, 4, 5]
```

`yield* expr`은 `expr`이 반환하는 최종값(return값)을 `yield*` 표현식의 결과로 받을 수도 있습니다.

## 에러 처리

`gen.throw(err)`로 제너레이터 내부에 예외를 주입할 수 있습니다.

```javascript
function* safe() {
  try {
    yield 1;
    yield 2;
  } catch (e) {
    console.log('잡힌 오류:', e.message);
    yield -1;
  }
}

const g = safe();
g.next();           // { value: 1, done: false }
g.throw(new Error('문제 발생')); // '잡힌 오류: 문제 발생', { value: -1, done: false }
```

`gen.return(value)`는 제너레이터를 즉시 완료 상태로 만들고 지정한 값을 반환합니다.

## 실무 활용 사례

- **페이지네이션**: 다음 페이지가 필요할 때만 API를 호출하는 무한 스크롤
- **ID 생성기**: 고유한 숫자를 순차적으로 발급
- **상태 머신**: 각 `yield`가 하나의 상태를 표현
- **비동기 흐름 제어**: `redux-saga`가 제너레이터로 비동기 액션을 표현

다음 글에서는 제너레이터와 `async/await`이 결합된 **비동기 제너레이터(Async Generator)** 를 살펴봅니다.

---

**지난 글:** [꼬리 호출 최적화의 한계](/posts/js-tail-call-limitations/)

**다음 글:** [비동기 제너레이터](/posts/js-async-generator/)

<br>
읽어주셔서 감사합니다. 😊
