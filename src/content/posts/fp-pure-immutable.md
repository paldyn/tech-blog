---
title: "순수 함수와 불변성 — 함수형 프로그래밍의 기초"
description: "순수 함수의 정의와 참조 투명성, 부수효과 격리 전략, 객체·배열 불변 업데이트 패턴, Object.freeze와 structuredClone을 활용한 실전 불변성 기법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "함수형프로그래밍", "순수함수", "불변성", "FP", "참조투명성", "부수효과"]
featured: false
draft: false
---

[지난 글](/posts/sec-dependency-audit/)에서 의존성 공급망 보안을 다뤘습니다. 이번 글부터는 **함수형 프로그래밍(Functional Programming)** 시리즈를 시작합니다. 그 첫 번째 주제는 모든 FP 개념의 토대인 **순수 함수(Pure Function)** 와 **불변성(Immutability)** 입니다.

## 순수 함수란

순수 함수는 두 가지 조건을 만족하는 함수입니다.

1. **동일 입력 → 항상 동일 출력** (결정론적)
2. **부수효과(Side Effect) 없음** — 외부 상태를 읽거나 변경하지 않음

![순수 함수 vs 불순 함수](/assets/posts/fp-pure-immutable-concept.svg)

```js
// 순수 함수 — 언제 호출해도 결과 동일
function multiply(a, b) {
  return a * b;
}

// 불순 함수 — 외부 Date에 의존
function getGreeting(name) {
  const hour = new Date().getHours(); // 부수효과: 시스템 시간 읽기
  return hour < 12 ? `Good morning, ${name}` : `Hello, ${name}`;
}
```

`getGreeting`은 같은 `name`을 입력해도 호출 시각에 따라 다른 값을 반환합니다. 이런 함수는 테스트가 어렵고, 결과를 예측하기 힘듭니다.

## 부수효과(Side Effect)

부수효과는 함수가 **외부 세계를 변경하거나 외부 세계에 의존**하는 모든 행위입니다.

```js
// 부수효과 목록
let globalCount = 0;

function impure(x) {
  globalCount++;            // 외부 변수 변경
  console.log(x);           // I/O (콘솔 출력)
  fetch('/api/data');        // 네트워크 요청
  localStorage.setItem('k', x); // 브라우저 저장소 변경
  return x * 2;
}
```

부수효과가 나쁜 것은 아닙니다. I/O 없이는 유용한 프로그램을 만들 수 없습니다. 핵심은 **부수효과를 격리**하는 것입니다. 핵심 로직(순수 함수)과 부수효과를 분리해 경계를 명확히 합니다.

## 참조 투명성

순수 함수는 **참조 투명성(Referential Transparency)** 을 갖습니다. 함수 호출을 그 결과 값으로 대체해도 프로그램이 동일하게 동작합니다.

```js
// add(2, 3)을 5로 대체해도 동일
const result = add(2, 3) + add(4, 5); // 5 + 9 = 14
const result2 = 5 + 9;                // 동일
```

이 성질 덕분에 컴파일러·런타임이 **메모이제이션**, **지연 평가**, **병렬 실행** 최적화를 안전하게 적용할 수 있습니다.

## 불변성이란

불변성은 **생성된 데이터를 변경하지 않는다**는 원칙입니다. 변경이 필요할 때는 원본을 건드리지 않고 새 값을 반환합니다.

```js
// 가변 — 원본 훼손
const arr = [3, 1, 2];
arr.sort();    // 원본 변경!
arr.push(4);   // 원본 변경!

// 불변 — 새 배열 반환
const sorted = [...arr].sort();
const appended = [...arr, 4];
// arr는 그대로 [3, 1, 2]
```

![순수 함수의 장점과 불변성 기법](/assets/posts/fp-pure-immutable-benefits.svg)

## 객체 불변 업데이트

스프레드 연산자로 "수정된 복사본"을 만드는 패턴이 가장 일반적입니다.

```js
const user = { name: 'Alice', age: 30, role: 'admin' };

// 특정 필드만 변경 — 나머지는 원본에서 복사
const olderUser = { ...user, age: 31 };

// 중첩 객체 업데이트
const state = {
  user: { name: 'Alice', prefs: { theme: 'dark' } },
  count: 0
};

const newState = {
  ...state,
  user: {
    ...state.user,
    prefs: { ...state.user.prefs, theme: 'light' }
  }
};
```

중첩이 깊어지면 스프레드 체인이 복잡해집니다. 이때 **Immer**의 `produce`가 유용합니다(다음 글에서 다룹니다).

## 배열 불변 메서드

JavaScript 배열 메서드는 원본을 변경하는 것과 새 배열을 반환하는 것으로 나뉩니다.

```js
const items = [
  { id: 1, text: 'buy milk', done: false },
  { id: 2, text: 'read book', done: true },
  { id: 3, text: 'exercise', done: false },
];

// 추가
const added = [...items, { id: 4, text: 'code', done: false }];

// 제거
const removed = items.filter(item => item.id !== 2);

// 수정
const toggled = items.map(item =>
  item.id === 3 ? { ...item, done: true } : item
);

// 정렬 (원본 보존)
const sorted = [...items].sort((a, b) => a.text.localeCompare(b.text));
```

`ES2023`의 `toSorted()`, `toReversed()`, `toSpliced()`, `with()` 메서드는 이 패턴을 언어 차원에서 지원합니다.

```js
// ES2023 불변 배열 메서드
const arr = [3, 1, 2];
arr.toSorted();    // [1, 2, 3] — 원본 유지
arr.toReversed();  // [2, 1, 3] — 원본 유지
arr.with(1, 99);   // [3, 99, 2] — 원본 유지
```

## Object.freeze와 한계

`Object.freeze()`로 객체를 동결할 수 있지만, **얕은 동결(shallow freeze)** 입니다.

```js
const config = Object.freeze({
  api: { url: 'https://api.example.com', timeout: 3000 },
  retries: 3
});

config.retries = 5;         // 무시됨 (strict mode에서 TypeError)
config.api.url = 'hacked';  // 변경됨! — 중첩 객체는 동결 안 됨
```

깊은 동결이 필요하다면 재귀 freeze 함수를 직접 작성하거나, Immer/Immutable.js를 사용합니다.

```js
function deepFreeze(obj) {
  Object.getOwnPropertyNames(obj).forEach(name => {
    const value = obj[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}
```

## 부수효과를 경계로 밀어내기

실용적인 FP 접근법은 "부수효과를 완전히 제거"가 아니라 **"가장자리로 밀어내기"** 입니다.

```js
// 핵심 로직 — 순수
function calculateDiscount(price, member) {
  if (member.tier === 'gold') return price * 0.8;
  if (member.tier === 'silver') return price * 0.9;
  return price;
}

// 경계 — 부수효과 격리
async function applyDiscountToOrder(orderId) {
  const order = await db.orders.findById(orderId);  // I/O (부수효과)
  const member = await db.members.findById(order.memberId); // I/O
  const discounted = calculateDiscount(order.price, member); // 순수
  await db.orders.update(orderId, { price: discounted }); // I/O
}
```

`calculateDiscount`는 DB와 무관하게 단위 테스트할 수 있습니다. 복잡한 비즈니스 로직을 순수 함수로 추출하는 것이 핵심입니다.

## 정리

순수 함수와 불변성은 **예측 가능하고 테스트하기 쉬운 코드**의 기반입니다. 모든 함수를 순수하게 만들 수는 없지만, 핵심 로직을 순수 함수로 추출하고 부수효과를 명시적으로 격리하면 코드 품질이 크게 높아집니다.

---

**지난 글:** [의존성 감사 — npm audit과 공급망 보안](/posts/sec-dependency-audit/)

**다음 글:** [펑터와 모나드 입문 — 함수형 프로그래밍의 핵심 추상](/posts/fp-functor-monad-intro/)

<br>
읽어주셔서 감사합니다. 😊
