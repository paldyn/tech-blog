---
title: "클로저의 본질 — 함수가 기억하는 것"
description: "JavaScript 클로저의 정의와 동작 원리를 렉시컬 환경과 스코프 체인을 통해 정확히 이해하고, 클로저가 가능한 이유와 실용적 의미를 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "클로저", "렉시컬환경", "스코프체인", "함수", "메모리"]
featured: false
draft: false
---

[지난 글](/posts/js-call-stack/)에서 함수 호출이 콜 스택에 쌓이고, 반환되면 pop된다는 것을 배웠습니다. 자연스러운 의문이 생깁니다 — 함수가 pop되면 그 안의 변수도 사라지는 걸까요? 대부분의 경우엔 그렇습니다. 하지만 **클로저(Closure)**가 있으면 이야기가 달라집니다. 클로저는 함수가 반환된 후에도 바깥 함수의 변수를 살아있게 만듭니다. 이것이 어떻게 가능한지, 그 내부 원리를 정확하게 이해해봅시다.

---

## 클로저의 정의

MDN의 정의는 간결합니다: "클로저는 함수와 그 함수가 선언된 렉시컬 환경의 조합이다." 핵심 단어는 **렉시컬 환경(Lexical Environment)**입니다. 함수는 실행될 때가 아니라 **선언된 위치**를 기준으로 스코프를 결정합니다. 이것이 렉시컬 스코핑(Lexical Scoping)이며, 클로저의 토대입니다.

```javascript
function makeCounter() {
  let count = 0;          // 외부 함수의 변수

  return function increment() {
    count++;              // 외부 변수를 참조
    return count;
  };
}

const counter = makeCounter();
counter(); // 1
counter(); // 2
counter(); // 3
```

`makeCounter()`는 `increment` 함수를 반환하고 종료됩니다. 일반적 기대라면 `count`는 사라져야 합니다. 하지만 `counter()`를 호출할 때마다 `count`는 이전 값을 유지합니다. 이것이 클로저입니다.

![클로저의 구조 — 함수와 렉시컬 환경](/assets/posts/js-closure-essence-diagram.svg)

---

## 왜 변수가 살아있는가

JavaScript 엔진은 함수를 생성할 때 내부 슬롯 `[[Environment]]`에 **현재 렉시컬 환경의 참조**를 저장합니다. `increment` 함수가 생성될 때 `[[Environment]]`는 `makeCounter`의 렉시컬 환경을 가리킵니다.

`makeCounter`가 반환된 후 `counter` 변수가 `increment` 함수를 참조하고, `increment`의 `[[Environment]]`가 `makeCounter`의 렉시컬 환경을 참조합니다. 이 참조 사슬이 유지되는 한 가비지 컬렉터는 `makeCounter`의 렉시컬 환경을 메모리에서 해제할 수 없습니다.

```javascript
// 엔진 내부 동작 (개념적 표현)
// increment 함수 객체의 내부:
// {
//   [[Call]]: increment 코드,
//   [[Environment]]: makeCounter의 렉시컬 환경 참조
//                    → { count: 3, outer: 전역 렉시컬 환경 }
// }
```

---

## 렉시컬 스코프와 변수 탐색

함수가 변수를 참조할 때 탐색 경로는 **선언 위치 기준**입니다. 현재 스코프에서 찾지 못하면 `[[Environment]]`가 가리키는 바깥 스코프로 올라가며, 전역 스코프까지 올라가도 없으면 `ReferenceError`가 발생합니다.

```javascript
const x = 'global';

function outer() {
  const x = 'outer';

  function inner() {
    // x 탐색: inner 스코프 → outer 스코프 → 발견!
    console.log(x); // 'outer'
  }

  return inner;
}

const fn = outer();
fn(); // 'outer' — outer()가 끝났어도 outer의 x를 기억
```

![클로저와 스코프 체인](/assets/posts/js-closure-essence-scope.svg)

---

## 모든 함수는 클로저다

JavaScript의 모든 함수는 선언 시점의 렉시컬 환경 참조를 `[[Environment]]`에 가집니다. 즉, 기술적으로 모든 함수는 클로저입니다. 다만 보통 "클로저"라고 부를 때는 **바깥 스코프의 변수를 실제로 활용하는** 경우를 말합니다.

```javascript
// 전역 함수 — 전역 렉시컬 환경을 [[Environment]]로 가짐
function globalFn() { return 1; } // 클로저지만 보통 클로저라 부르지 않음

// 내부 함수 — 외부 변수를 실제로 캡처
function outer() {
  const secret = 42;
  return () => secret; // 이것을 "클로저"라 부름
}
```

---

## 독립적인 클로저 인스턴스

같은 팩토리 함수를 여러 번 호출하면 **각각 독립적인 렉시컬 환경**이 생성됩니다. 클로저들은 서로 다른 환경을 참조하므로 상태가 공유되지 않습니다.

```javascript
const counter1 = makeCounter();
const counter2 = makeCounter();

counter1(); // 1
counter1(); // 2
counter2(); // 1 ← counter1과 독립적
```

`counter1`과 `counter2`의 `[[Environment]]`는 서로 다른 `makeCounter` 실행으로 생성된 **다른** 렉시컬 환경을 가리킵니다. 각자의 `count`는 서로 영향을 주지 않습니다.

---

## 클로저가 실용적으로 쓰이는 맥락

클로저가 빛나는 대표적인 패턴은 **은닉(encapsulation)**입니다. 외부에서 직접 접근할 수 없는 "private" 변수를 만들 수 있습니다.

```javascript
function createBankAccount(initialBalance) {
  let balance = initialBalance; // 외부에서 직접 접근 불가

  return {
    deposit(amount) { balance += amount; },
    withdraw(amount) {
      if (amount > balance) throw new Error('잔액 부족');
      balance -= amount;
    },
    getBalance() { return balance; },
  };
}

const account = createBankAccount(1000);
account.deposit(500);
account.getBalance(); // 1500
// account.balance — undefined (접근 불가)
```

이 패턴은 모듈 패턴의 기초이며, ES2022 private 필드(`#field`) 이전부터 JavaScript의 정보 은닉을 담당했습니다.

---

## 핵심 정리

| 개념 | 설명 |
|------|------|
| `[[Environment]]` | 함수가 선언 시 저장하는 외부 렉시컬 환경 참조 |
| 렉시컬 스코핑 | 변수 탐색은 호출 위치가 아닌 선언 위치 기준 |
| 클로저 | 함수 + 선언 시점의 렉시컬 환경 |
| GC와 클로저 | 참조가 살아있는 한 외부 환경은 메모리에 유지 |

클로저는 JavaScript 함수형 프로그래밍, 모듈 패턴, React 훅 등 수많은 패턴의 기반입니다. 다음 글에서는 클로저를 활용한 구체적인 패턴들을 살펴봅니다.

---

**지난 글:** [콜 스택 — JavaScript 실행 흐름의 핵심](/posts/js-call-stack/)

**다음 글:** [클로저 패턴 — 실전 활용법](/posts/js-closure-patterns/)

<br>
읽어주셔서 감사합니다. 😊
