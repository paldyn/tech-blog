---
title: "클로저 — 함수가 기억하는 것들"
description: "JavaScript 클로저의 동작 원리를 렉시컬 스코프와 연결해 이해하고, 상태 은닉·팩토리·모듈 패턴 등 실용적인 활용법을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "클로저", "closure", "렉시컬스코프", "상태은닉", "팩토리함수", "모듈패턴"]
featured: false
draft: false
---

지난 글에서 스코프 체인을 살펴봤습니다. 안쪽 함수가 바깥 함수의 변수를 참조할 수 있고, 탐색은 안에서 밖으로 이루어진다고 했죠. **클로저(Closure)** 는 그 연장선입니다. 단순히 "바깥 변수를 쓸 수 있다"가 아니라, **함수가 종료된 뒤에도 바깥 스코프의 변수를 붙잡아 기억한다**는 것이 핵심입니다.

많은 개발자들이 클로저를 어려워합니다. 하지만 스코프 체인을 이해했다면 클로저는 "그 다음 자연스러운 결론"입니다.

---

## 가장 단순한 클로저

```js
function makeCounter() {
  let count = 0;

  return function() {
    count += 1;
    return count;
  };
}

const counter = makeCounter();
console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3
```

`makeCounter()`가 실행을 마치고 반환됩니다. 일반적인 관점에서 `count`는 이제 사라져야 합니다. 그런데 `counter()`를 호출할 때마다 `count`가 1씩 증가합니다. `count`가 살아있습니다.

왜일까요? 반환된 함수가 `count`를 **참조하고 있기 때문**입니다. 참조가 남아있는 한 가비지 컬렉터는 `count`를 메모리에서 제거하지 않습니다. 이것이 클로저입니다.

![클로저 동작 원리 — outer 함수가 끝나도 inner 함수가 렉시컬 환경을 붙잡는다](/assets/posts/js-closure-diagram.svg)

---

## 렉시컬 스코프: 정의된 위치가 기준

클로저를 이해하려면 **렉시컬 스코프(Lexical Scope)** 를 먼저 알아야 합니다.

JavaScript는 **함수가 어디서 정의됐는지**에 따라 스코프를 결정합니다. 어디서 호출됐는지가 아닙니다. 이를 렉시컬(lexical, "어휘적") 스코프라고 합니다.

```js
const greeting = "안녕하세요";

function sayGreeting() {
  console.log(greeting); // 정의 시점에 전역 greeting 참조
}

function outer() {
  const greeting = "Hello";
  sayGreeting(); // 호출 위치가 outer 안이어도
}

outer(); // "안녕하세요" — 정의 위치 기준
```

`sayGreeting`은 전역에 정의됐으므로, `outer` 안에서 호출돼도 전역의 `greeting`을 참조합니다. 호출 위치가 아니라 **정의 위치**가 스코프를 결정합니다.

클로저는 이 규칙의 결과입니다. 함수는 정의될 때의 렉시컬 환경을 내부적으로 저장합니다(`[[Environment]]`). 그 함수가 어디서 호출되든, 저장된 환경을 통해 바깥 변수에 접근합니다.

---

## 각 클로저는 독립적인 환경을 가진다

같은 팩토리 함수를 두 번 호출하면, 두 클로저는 서로 다른 `count`를 가집니다.

```js
const counterA = makeCounter();
const counterB = makeCounter();

console.log(counterA()); // 1
console.log(counterA()); // 2
console.log(counterB()); // 1 — counterA와 무관
console.log(counterA()); // 3
```

`makeCounter()`를 호출할 때마다 새로운 렉시컬 환경이 만들어집니다. `counterA`와 `counterB`는 각자의 `count`를 가집니다. 공유하지 않습니다.

---

## 클로저의 실용적 활용

![클로저의 네 가지 활용 패턴 — 상태 은닉, 팩토리, 모듈, 이벤트 핸들러](/assets/posts/js-closure-usecases.svg)

**상태 은닉** — 클로저를 이용하면 변수를 외부에서 직접 접근하지 못하게 숨길 수 있습니다. 메서드를 통해서만 조작하도록 강제합니다.

```js
function createAccount(initialBalance) {
  let balance = initialBalance; // 외부에서 직접 접근 불가

  return {
    deposit: (amount) => { balance += amount; },
    withdraw: (amount) => { balance = Math.max(0, balance - amount); },
    getBalance: () => balance,
  };
}

const account = createAccount(1000);
account.deposit(500);
console.log(account.getBalance()); // 1500
console.log(account.balance);      // undefined — 직접 접근 불가
```

**팩토리 함수** — 공통 로직을 공유하면서 설정값만 다른 함수를 여러 개 만들 수 있습니다.

```js
function makeGreeter(language) {
  const greetings = { ko: "안녕하세요", en: "Hello", ja: "こんにちは" };
  return (name) => `${greetings[language]}, ${name}!`;
}

const greetKo = makeGreeter("ko");
const greetEn = makeGreeter("en");

greetKo("지민"); // "안녕하세요, 지민!"
greetEn("Alice"); // "Hello, Alice!"
```

**모듈 패턴** — ES6 모듈이 도입되기 전, 클로저와 IIFE를 조합해 모듈 수준의 캡슐화를 구현했습니다. 지금도 레거시 코드에서 자주 볼 수 있는 패턴입니다.

```js
const userModule = (() => {
  let users = [];

  return {
    add: (name) => users.push({ name, id: Date.now() }),
    list: () => [...users], // 복사본 반환으로 외부 변경 방지
    count: () => users.length,
  };
})();

userModule.add("Alice");
userModule.add("Bob");
console.log(userModule.count()); // 2
```

---

## 주의: 클로저와 반복문

스코프 글에서 잠깐 등장한 반복문 버그를 클로저 관점에서 다시 보겠습니다.

```js
const fns = [];
for (var i = 0; i < 3; i++) {
  fns.push(function() { return i; });
}

console.log(fns[0]()); // 3
console.log(fns[1]()); // 3
console.log(fns[2]()); // 3
```

세 함수 모두 같은 `i`를 클로저로 참조합니다. `var i`는 함수 스코프여서 반복문 전체가 하나의 `i`를 공유합니다. 반복이 끝나면 `i === 3`이고, 세 함수 모두 `3`을 반환합니다.

`let`으로 바꾸면 각 반복마다 새 블록 스코프가 생겨 문제가 해결됩니다.

```js
for (let i = 0; i < 3; i++) {
  fns.push(() => i);
}
fns[0](); // 0, fns[1](); // 1, fns[2](); // 2 ✓
```

---

## 클로저와 메모리

클로저는 바깥 스코프의 변수를 붙잡으므로, 그 변수는 클로저가 살아있는 동안 메모리에서 해제되지 않습니다. 대부분의 경우 문제가 없지만, 대용량 데이터를 클로저가 참조하면 메모리 누수의 원인이 될 수 있습니다.

필요없어진 클로저를 보유하는 변수를 `null`로 설정하거나, 이벤트 리스너를 제거하는 습관이 중요합니다.

---

## 현대 JavaScript와 클로저

React의 `useState`, `useEffect`, `useMemo` 같은 훅은 내부적으로 클로저를 사용합니다. 컴포넌트 함수가 렌더링될 때의 상태값을 핸들러가 기억하는 방식이 클로저의 동작 원리와 같습니다. 클로저를 이해하면 React 훅의 동작 방식이 더 명확하게 보입니다.

---

클로저는 JavaScript에서 가장 강력하고 자주 활용되는 개념 중 하나입니다. 다음 글에서는 또 다른 JavaScript의 핵심 개념인 **`this` 키워드**를 살펴봅니다. 함수가 호출되는 방식에 따라 `this`가 어떻게 달라지는지, 그 혼란스러운 동작을 명확하게 정리합니다.

---

**다음 글:** this 키워드 — 호출 방식이 this를 결정한다

<br>
읽어주셔서 감사합니다. 😊
