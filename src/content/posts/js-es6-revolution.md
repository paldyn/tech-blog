---
title: "ES6 대혁신 — JavaScript가 달라진 날"
description: "2015년 ECMAScript 6가 가져온 변화를 큰 그림으로 살펴봅니다. let/const, 화살표 함수, 클래스, 모듈, 구조 분해, 템플릿 리터럴 — JavaScript를 현대 언어로 탈바꿈시킨 핵심 기능들을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-24"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "ES6", "ES2015", "화살표함수", "클래스", "모듈", "구조분해", "let", "const"]
featured: false
draft: false
---

지금까지 비동기 시리즈(콜백, Promise, async/await, 비동기 패턴)를 달려왔습니다. 이 모든 것의 뿌리를 짚는 글로 잠시 돌아봅니다. **2015년, ECMAScript 6**가 나왔습니다. JavaScript 역사에서 이 해를 기점으로 "이전"과 "이후"를 나눌 수 있을 만큼 큰 변화였습니다.

---

## 왜 '혁명'인가

ES6 이전 JavaScript의 마지막 대규모 업데이트는 2009년의 ES5였습니다. **6년의 공백** 동안 웹 환경은 급격히 변했습니다. 싱글 페이지 애플리케이션이 등장했고, Node.js가 서버에서 JavaScript를 쓸 수 있게 했으며, 코드베이스는 수만 줄 단위로 커졌습니다.

ES5로는 이 변화를 감당하기 어려웠습니다. `var`의 함수 스코프와 호이스팅은 예측 불가한 버그를 낳았고, 프로토타입 기반 상속 문법은 진입 장벽이 높았으며, 모듈 시스템이 없어 스크립트들이 전역을 공유했습니다. 비동기 처리는 콜백 헬에 빠졌고, `this` 바인딩은 악명 높은 혼란의 원천이었습니다.

![JavaScript 표준화 연표 — ES5부터 ES2024까지](/assets/posts/js-es6-revolution-timeline.svg)

TC39(Technical Committee 39)는 이 모든 문제를 한 번에 해결하려 했습니다. 결과가 ES6, 정식 명칭으로 ECMAScript 2015입니다. 이 업데이트 이후 ECMAScript는 매년 작은 업데이트를 배포하는 방식으로 전환되었습니다. 그래서 ES2016, ES2017... 식으로 연도가 붙게 됩니다.

---

## 여섯 가지 카테고리로 보는 ES6

![ES6 주요 기능 — 6대 카테고리](/assets/posts/js-es6-revolution-features.svg)

ES6의 변화는 크게 여섯 카테고리로 나눌 수 있습니다. 각각을 살펴봅니다.

---

## 1. 변수와 스코프 — let, const

`var`의 문제는 단순했습니다. 함수 단위 스코프만 지원하고, 선언 전에도 접근 가능(호이스팅)하며, 재선언도 허용했습니다.

```js
// ES5: var의 예측 불가 동작
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 3, 3, 3
}

// ES6: let의 블록 스코프
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 0, 1, 2
}
```

`let`은 블록 스코프(`{ }`)를 가지고, 호이스팅은 일어나지만 초기화 전 접근 시 ReferenceError를 던집니다(TDZ, Temporal Dead Zone). `const`는 재할당이 불가능한 바인딩입니다. 단, 객체나 배열의 내부는 변경할 수 있습니다.

규칙은 간단합니다: 기본적으로 `const`를 쓰고, 재할당이 필요할 때만 `let`을 씁니다. `var`는 더 이상 쓸 이유가 없습니다.

---

## 2. 함수 개선 — 화살표 함수

화살표 함수는 문법 단축만이 아닙니다. `this` 바인딩 방식이 근본적으로 다릅니다. 일반 함수는 호출 방법에 따라 `this`가 결정되지만, 화살표 함수는 정의된 위치의 `this`를 그대로 씁니다.

```js
// ES5: this를 보존하려면 var self = this 같은 우회책이 필요
function Timer() {
  this.seconds = 0;
  var self = this;
  setInterval(function () {
    self.seconds++;
  }, 1000);
}

// ES6: 화살표 함수는 외부 this를 그대로 사용
function Timer() {
  this.seconds = 0;
  setInterval(() => {
    this.seconds++; // this가 Timer 인스턴스를 가리킴
  }, 1000);
}
```

기본 매개변수와 나머지 매개변수도 함께 도입되었습니다. `function(a, b = 0) {}`처럼 기본값을 선언하고, `function(...args) {}`로 가변 인자를 배열로 받습니다.

---

## 3. 문법 편의 — 구조 분해와 템플릿 리터럴

**구조 분해 할당(Destructuring)**은 배열이나 객체에서 값을 꺼내는 문법입니다.

```js
// 객체 구조 분해
const { name, age, address: { city } = {} } = user;

// 배열 구조 분해
const [first, second, ...rest] = items;

// 함수 매개변수에서
function render({ title, content, author = "익명" }) { ... }
```

이전에는 `const name = user.name; const age = user.age;`를 반복해야 했습니다. 함수 매개변수 구조 분해는 명명된 매개변수처럼 쓸 수 있어 가독성을 높입니다.

**템플릿 리터럴**은 백틱(`` ` ``)으로 감싸는 문자열입니다.

```js
const greeting = `안녕하세요, ${user.name}님!
오늘은 ${new Date().toLocaleDateString()}입니다.`;
```

문자열 보간, 멀티라인 지원이 내장됩니다. 복잡한 문자열 연결(`+`)에서 해방됩니다. 태그드 템플릿 리터럴로 SQL 이스케이핑, HTML 이스케이핑 같은 고급 활용도 가능합니다.

---

## 4. 클래스 — 익숙한 문법으로 프로토타입

ES6의 `class`는 새로운 상속 모델이 아닙니다. JavaScript의 프로토타입 기반 상속 위에 덧씌운 **문법적 설탕**입니다. 내부 동작은 동일하지만, 다른 언어를 알고 있는 개발자에게 훨씬 친숙한 형태입니다.

```js
class Animal {
  #name; // 프라이빗 필드 (ES2022)

  constructor(name) {
    this.#name = name;
  }

  speak() {
    return `${this.#name}이 소리를 냅니다`;
  }
}

class Dog extends Animal {
  speak() {
    return super.speak() + " — 왈왈!";
  }
}
```

`constructor`, `extends`, `super`, 정적 메서드(`static`), 게터/세터까지 지원합니다. 프라이빗 필드(`#`)는 ES2022에서 추가되었습니다.

---

## 5. 자료구조 — Map, Set, Symbol

`Object`는 키가 문자열(또는 Symbol)이어야 합니다. `Map`은 모든 타입을 키로 쓸 수 있습니다.

```js
const map = new Map();
map.set(document.querySelector("#btn"), { clicks: 0 });
// DOM 요소를 키로 사용 — Object로는 불가
```

`Set`은 중복을 허용하지 않는 값의 집합입니다. 배열 중복 제거에 자주 씁니다: `[...new Set(arr)]`.

`Symbol`은 ES6에서 추가된 원시 타입입니다. 매번 고유한 값을 만들어 객체의 프라이빗한 키나 특별한 동작(이터러블의 `Symbol.iterator` 등)을 정의할 때 씁니다.

---

## 6. 모듈 시스템 — import/export

ES6 이전에는 언어 수준의 모듈 시스템이 없었습니다. CommonJS(`require/module.exports`)나 AMD(`define/require`) 같은 비표준 방식을 써야 했습니다.

```js
// math.js
export const PI = 3.14159;
export function add(a, b) { return a + b; }
export default class Calculator { ... }

// main.js
import Calculator, { PI, add } from "./math.js";
import * as math from "./math.js";
```

ES 모듈은 정적 분석이 가능합니다. 번들러(Webpack, Rollup, Vite)가 사용되지 않는 코드를 제거하는 **트리 쉐이킹**이 가능한 이유입니다. 동적으로 모듈을 불러와야 한다면 `import()` 함수를 씁니다.

---

## 비동기 — Promise와 제너레이터

지금까지 별도 글로 다룬 `Promise`도 ES6에서 표준화되었습니다. 그리고 제너레이터(`function*`)도 ES6의 일부입니다. 제너레이터는 실행을 중간에 멈추고 값을 내보내는 특별한 함수로, 이터러블 프로토콜과 함께 비동기 처리(async/await의 전신)에 활용됩니다.

---

## ES6 이후 — 매년 업데이트

ES6의 폭발적인 변화 이후 TC39는 매년 소규모 업데이트를 배포하는 방식으로 전환했습니다.

ES2017에서 `async/await`가 도입되었고, ES2018에서 객체 스프레드 연산자가 추가되었습니다. ES2020에서 옵셔널 체이닝(`?.`), 널 병합 연산자(`??`), BigInt가 도입되었습니다. ES2021에서 논리 할당 연산자들, ES2022에서 클래스 프라이빗 필드(`#`)와 최상위 await가 나왔습니다.

이 시리즈의 다음 글들에서 모던 문법, 모듈 시스템, 배열 메서드, 객체 패턴을 각각 다루면서 이 업데이트들을 자세히 살펴볼 것입니다.

---

## ES6가 남긴 유산

ES6가 정말 중요한 이유는 기능의 숫자가 아닙니다. JavaScript를 **대규모 애플리케이션 개발에 적합한 언어**로 만들었다는 점입니다. 모듈로 코드를 분리하고, 클래스로 추상화를 표현하고, let/const로 의도를 명확히 하고, Promise로 비동기를 제어합니다.

현재 우리가 쓰는 React, Vue, Angular의 코드가 ES6 없이는 지금 형태로 존재하지 않았을 것입니다. TypeScript도 ES6 클래스와 모듈 위에 타입 시스템을 얹은 것입니다.

---

ES6는 JavaScript의 이전 모습과 결별하고 새로운 시대를 연 전환점이었습니다. 이후 시리즈에서는 ES6와 그 이후의 문법들을 실제 코드 맥락에서 더 자세히 살펴봅니다. 다음 글에서는 **모던 문법** — 옵셔널 체이닝, 널 병합, 논리 할당, 구조 분해의 고급 사용법 등 ES2018 이후 추가된 편의 문법들을 정리합니다.

---

**다음 글:** 모던 문법 — ES2018 이후 필수 문법 정리

<br>
읽어주셔서 감사합니다. 😊
