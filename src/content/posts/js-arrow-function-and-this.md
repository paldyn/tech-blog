---
title: "화살표 함수와 this"
description: "ES2015 화살표 함수의 간결한 문법과 렉시컬 this 바인딩 원리, 일반 함수와의 차이, 메서드·생성자에서 주의할 함정과 클래스 필드 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "화살표함수", "arrow-function", "this", "렉시컬this", "lexical-this", "클래스필드"]
featured: false
draft: false
---

[지난 글](/posts/js-function-declaration-vs-expression/)에서 함수 선언식과 표현식의 호이스팅 차이를 살펴봤습니다. 이번에는 ES2015가 도입한 **화살표 함수(arrow function)**를 다룹니다. 화살표 함수는 단순히 짧은 문법이 아닙니다. `this`를 **렉시컬(lexical)**하게 바인딩하는 근본적으로 다른 함수 타입입니다.

## 문법

화살표 함수는 `=>` 기호를 사용하며 파라미터·본문에 따라 다양하게 축약됩니다.

```javascript
// 완전 형태
const add = (a, b) => { return a + b; };

// 표현식 본문 — return과 중괄호 생략
const add = (a, b) => a + b;

// 단일 파라미터 — 괄호 생략 가능
const double = n => n * 2;

// 파라미터 없음 — 빈 괄호 필수
const greet = () => 'Hello!';

// 객체 리터럴 반환 — 괄호 필수 (중괄호 모호성 제거)
const mkUser = name => ({ name, role: 'guest' });
```

표현식 본문(단일 표현식)일 때 `return`이 암묵적으로 적용됩니다. 이 간결함 덕분에 `map`·`filter` 같은 콜백에 특히 잘 어울립니다.

```javascript
const nums = [1, 2, 3, 4, 5];
const evens  = nums.filter(n => n % 2 === 0);   // [2, 4]
const squares = nums.map(n => n ** 2);           // [1, 4, 9, 16, 25]
```

## 렉시컬 this — 핵심 차이

일반 함수의 `this`는 **호출 시점**에 결정됩니다. 메서드로 호출하면 객체가, 단독 호출하면 전역(또는 strict 모드에서 `undefined`)이 됩니다.

화살표 함수는 `this`를 아예 소유하지 않습니다. 대신 **정의된 위치의 외부 스코프 `this`를 캡처**합니다. 이를 렉시컬(lexical) this 바인딩이라 합니다.

```javascript
function Timer() {
  this.seconds = 0;

  // 일반 함수: this가 window/global로 바뀜
  setInterval(function() {
    this.seconds++; // this !== Timer 인스턴스!
  }, 1000);

  // 화살표 함수: Timer의 this를 캡처
  setInterval(() => {
    this.seconds++; // this === Timer 인스턴스 ✓
  }, 1000);
}
```

화살표 함수가 도입되기 전에는 `const self = this` 또는 `.bind(this)`로 해결했습니다.

![화살표 함수와 this 바인딩](/assets/posts/js-arrow-function-this-binding.svg)

## call/apply/bind로 this를 바꿀 수 없다

화살표 함수는 `this`를 소유하지 않으므로 `call`, `apply`, `bind`로 `this`를 변경해도 무시됩니다.

```javascript
const arrow = () => this;
const obj = { name: 'Kim' };

arrow.call(obj);    // 여전히 외부 스코프의 this
arrow.bind(obj)();  // 동일
```

`bind`를 쓰고 싶다면 일반 함수를 사용해야 합니다.

## 객체 메서드에서의 함정

객체 리터럴 내 메서드에 화살표 함수를 쓰면 `this`가 객체가 아닌 외부 스코프(보통 전역)를 가리킵니다.

```javascript
const user = {
  name: 'Kim',
  greet: () => `안녕, ${this.name}!`,  // this = 전역 → undefined
  hello() { return `안녕, ${this.name}!`; } // 단축 메서드 → ✓
};

user.greet();  // '안녕, undefined!'
user.hello();  // '안녕, Kim!'
```

**객체 메서드는 항상 단축 메서드 문법(`method() {}`)을 사용**하세요.

![화살표 함수 메서드 함정](/assets/posts/js-arrow-function-method-pitfall.svg)

## 생성자·제너레이터로 사용 불가

화살표 함수는 `prototype` 프로퍼티가 없으므로 `new`로 인스턴스를 만들 수 없습니다.

```javascript
const Fn = () => {};
new Fn(); // TypeError: Fn is not a constructor
Fn.prototype; // undefined
```

제너레이터 화살표 함수(`=>*`)도 존재하지 않습니다.

## 클래스 필드 화살표 — 이벤트 핸들러 패턴

클래스 퍼블릭 필드와 화살표 함수를 조합하면 이벤트 핸들러를 `bind` 없이 인스턴스에 자동 바인딩할 수 있습니다.

```javascript
class Button {
  label = '클릭';

  // 인스턴스 생성 시 this가 바인딩된 화살표 함수가 프로퍼티로 저장됨
  handleClick = () => {
    console.log(`${this.label} 클릭됨`);
  };
}

const btn = new Button();
document.addEventListener('click', btn.handleClick);
// btn.handleClick.call(anything) 해도 this는 항상 btn
```

단점은 메서드가 프로토타입이 아닌 인스턴스마다 별도로 생성된다는 것입니다. 인스턴스가 수천 개라면 메모리 압력이 생길 수 있으므로, 핸들러 등록 시에만 사용하거나 `constructor`에서 명시적으로 `bind`하는 방식과 비교하세요.

## arguments 없음

화살표 함수에는 `arguments` 객체가 없습니다. 가변 인수가 필요하면 나머지 파라미터(`...args`)를 사용합니다.

```javascript
const sum = (...args) => args.reduce((a, b) => a + b, 0);
sum(1, 2, 3); // 6
```

외부 일반 함수 안에서 화살표를 쓰면 바깥 함수의 `arguments`를 캡처합니다.

---

**지난 글:** [함수 선언식 vs 함수 표현식](/posts/js-function-declaration-vs-expression/)

**다음 글:** [일급 함수 완전 정복](/posts/js-first-class-functions/)

<br>
읽어주셔서 감사합니다. 😊
