---
title: "이터러블과 제너레이터 — 반복을 프로토콜로 다루다"
description: "JavaScript의 이터레이션 프로토콜이 무엇인지 이해하고, 제너레이터 함수로 지연 평가·무한 수열·비동기 흐름 제어를 구현하는 방법을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "이터러블", "이터레이터", "제너레이터", "Symbol.iterator", "지연평가", "ES6"]
featured: false
draft: false
---

지난 글에서 실행 컨텍스트가 어떻게 코드 실행 환경을 구성하는지 살펴봤습니다. 이번에는 그 위에서 동작하는 언어 기능 중 하나인 **이터레이션 프로토콜(Iteration Protocol)** 을 살펴봅니다.

`for...of`, 스프레드 문법 `[...arr]`, 구조분해 `const [a, b] = ...` — 이 모든 문법은 이터레이션 프로토콜을 사용합니다. 배열뿐 아니라 문자열, Map, Set, DOM의 NodeList도 이 규약을 따르기 때문에 동일한 문법으로 다룰 수 있습니다. ES6(ES2015)에서 도입된 이 프로토콜은 JavaScript 반복의 표준 인터페이스입니다.

---

## 이터레이션 프로토콜

이터레이션 프로토콜은 두 가지로 이루어집니다.

**이터러블 프로토콜**: `Symbol.iterator` 메서드를 가진 객체는 이터러블입니다. 이 메서드를 호출하면 이터레이터를 반환해야 합니다.

**이터레이터 프로토콜**: `next()` 메서드를 가진 객체는 이터레이터입니다. `next()`는 `{ value, done }` 형태의 IteratorResult를 반환해야 합니다.

```js
const arr = [10, 20, 30];
const iter = arr[Symbol.iterator](); // 이터레이터 획득

console.log(iter.next()); // { value: 10, done: false }
console.log(iter.next()); // { value: 20, done: false }
console.log(iter.next()); // { value: 30, done: false }
console.log(iter.next()); // { value: undefined, done: true }
```

`for...of` 루프는 이 과정을 자동으로 수행합니다. 내부적으로 `Symbol.iterator`를 호출해 이터레이터를 얻고, `done: true`가 될 때까지 `next()`를 반복 호출합니다.

![이터레이션 프로토콜 — 이터러블, 이터레이터, IteratorResult의 관계](/assets/posts/js-iterable-generator-protocol.svg)

---

## 직접 이터러블 만들기

프로토콜을 직접 구현해 커스텀 이터러블을 만들 수 있습니다. 예를 들어 범위(range)를 나타내는 이터러블입니다.

```js
function range(start, end) {
  return {
    [Symbol.iterator]() {
      let current = start;
      return {
        next() {
          return current <= end
            ? { value: current++, done: false }
            : { value: undefined, done: true };
        },
      };
    },
  };
}

for (const n of range(1, 5)) {
  console.log(n); // 1, 2, 3, 4, 5
}

console.log([...range(1, 3)]); // [1, 2, 3]
```

`range(1, 5)` 객체는 `Symbol.iterator`를 구현했으므로 `for...of`, 스프레드, 구조분해 모두 사용할 수 있습니다.

---

## 제너레이터 함수

위의 `range` 구현은 동작하지만 보일러플레이트가 많습니다. **제너레이터 함수(Generator Function)** 를 사용하면 같은 결과를 훨씬 간결하게 표현할 수 있습니다.

제너레이터 함수는 `function*` 키워드로 선언합니다. 내부에서 `yield` 키워드를 사용해 값을 하나씩 내보내고, `yield`를 만날 때마다 실행이 일시정지됩니다. `next()`가 호출될 때 다음 `yield`까지 재개됩니다.

```js
function* range(start, end) {
  for (let i = start; i <= end; i++) {
    yield i;
  }
}

for (const n of range(1, 5)) {
  console.log(n); // 1, 2, 3, 4, 5
}
```

제너레이터 함수는 호출해도 즉시 실행되지 않습니다. 제너레이터 객체(이터레이터이자 이터러블)를 반환하고, `next()`를 호출할 때 비로소 코드가 실행됩니다.

![제너레이터 함수의 yield 기반 일시정지와 재개 흐름](/assets/posts/js-iterable-generator-flow.svg)

---

## yield와 next()의 양방향 통신

`next()`에 인자를 전달하면 그 값이 `yield` 표현식의 결과값이 됩니다. 이를 이용해 호출부와 제너레이터 사이에 양방향 통신이 가능합니다.

```js
function* dialogue() {
  const name = yield "이름이 무엇인가요?";
  const age = yield `안녕하세요, ${name}! 나이가 어떻게 되세요?`;
  yield `${name}님은 ${age}세시군요.`;
}

const gen = dialogue();
console.log(gen.next().value);        // "이름이 무엇인가요?"
console.log(gen.next("지민").value);  // "안녕하세요, 지민! 나이가 어떻게 되세요?"
console.log(gen.next(27).value);      // "지민님은 27세시군요."
```

처음 `next()`에 전달한 값은 첫 번째 `yield` 이전에 실행이 시작될 때는 의미가 없습니다 (무시됩니다). 두 번째 `next("지민")`의 `"지민"`이 `yield "이름이 무엇인가요?"` 표현식의 결과값으로 `name`에 할당됩니다.

---

## 무한 수열

제너레이터의 지연 평가(lazy evaluation) 특성 덕분에 무한 수열도 메모리 부담 없이 표현할 수 있습니다. 필요한 만큼만 소비하면 됩니다.

```js
function* naturals() {
  let n = 1;
  while (true) {
    yield n++;
  }
}

const gen = naturals();
console.log(gen.next().value); // 1
console.log(gen.next().value); // 2
console.log(gen.next().value); // 3
// 필요할 때 호출하면 계속 이어집니다
```

배열로 `[1, 2, 3, ...]`을 미리 만들면 메모리를 소모하지만, 제너레이터는 `next()`가 호출될 때만 다음 값을 계산합니다.

---

## yield* — 다른 이터러블에 위임하기

`yield*` 문법은 다른 이터러블을 전개해서 현재 제너레이터에서 yield합니다.

```js
function* concat(...iterables) {
  for (const iter of iterables) {
    yield* iter;
  }
}

console.log([...concat([1, 2], [3, 4], [5])]); // [1, 2, 3, 4, 5]
```

`yield* iter`는 `for (const v of iter) yield v;`와 동일합니다. 재귀적인 트리 탐색이나 여러 이터러블을 연결하는 경우에 유용합니다.

---

## 실용적인 활용

제너레이터는 비동기 흐름 제어에도 활용됐습니다. ES2017의 `async/await`이 도입되기 전, `co` 같은 라이브러리들이 제너레이터와 프로미스를 조합해 동기적 스타일의 비동기 코드를 구현했습니다. `async/await`은 사실 제너레이터를 기반으로 한 문법 설탕(syntactic sugar)과 유사한 개념으로 설명되기도 합니다.

현재도 제너레이터는 커스텀 이터레이션 로직, 지연 평가 파이프라인, 무한 데이터 스트림, 상태 기계(state machine) 구현에 유용하게 쓰입니다.

---

이터레이션 프로토콜은 JavaScript가 다양한 자료구조를 통일된 방식으로 다룰 수 있게 해주는 설계입니다. 다음 글에서는 JavaScript 런타임의 핵심인 **이벤트 루프**를 살펴봅니다. 싱글 스레드 언어인 JavaScript가 어떻게 비동기 작업을 처리하는지, 그 메커니즘을 파악해봅니다.

---

**지난 글:** [프로토타입과 상속 — JavaScript 객체 지향의 실체](/posts/js-prototype-and-inheritance/)

**다음 글:** [콜백 패턴 — 비동기의 시작과 콜백 헬](/posts/js-callback-pattern/)

<br>
읽어주셔서 감사합니다. 😊
