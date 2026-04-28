---
title: "화살표 함수와 this — 선언 시점의 this를 캡처한다"
description: "화살표 함수가 일반 함수와 this 동작이 다른 이유, 렉시컬 this의 의미, 그리고 화살표 함수를 써야 할 때와 쓰면 안 될 때를 명확하게 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "화살표함수", "this", "렉시컬this", "콜백", "클래스"]
featured: false
draft: false
---

[지난 글](/posts/js-this-rules/)에서 일반 함수의 `this`는 네 가지 규칙(new, 명시적, 암묵적, 기본)에 따라 **호출 방식**으로 결정된다는 것을 배웠습니다. 화살표 함수는 이 규칙 체계에서 완전히 벗어납니다. 화살표 함수는 자체적인 `this`를 갖지 않고, **선언된 시점의 외부 렉시컬 환경에서 `this`를 캡처**합니다. 이 단 하나의 차이점이 화살표 함수의 강점이자 함정입니다.

---

## 화살표 함수의 this — 렉시컬 this

화살표 함수는 생성될 때 주변(enclosing) 실행 컨텍스트의 `this`를 클로저처럼 캡처합니다. 이후 `call`, `apply`, `bind`로 `this`를 변경할 수 없으며, `new`로 생성자로 사용할 수도 없습니다.

```javascript
const obj = {
  name: 'Arrow',
  // 화살표 함수: 선언 시점의 외부 this (전역 or undefined) 캡처
  getName: () => this.name,
  // 일반 함수: 호출 시 obj가 this
  getName2() { return this.name; }
};

obj.getName();  // undefined (전역 this.name)
obj.getName2(); // 'Arrow'
```

`getName`이 선언된 객체 리터럴 `{}` 자체는 스코프를 만들지 않습니다. 따라서 화살표 함수가 캡처하는 외부 `this`는 객체 리터럴이 아닌 그 바깥 컨텍스트(전역 또는 모듈 수준)입니다.

---

## 콜백 내부에서 화살표 함수가 필요한 이유

가장 흔한 사용 사례는 클래스·생성자 함수의 메서드 내부에서 콜백을 사용할 때입니다.

```javascript
// ❌ 일반 함수 콜백 — this 소실
function Timer() {
  this.count = 0;
  setInterval(function() {
    this.count++; // this는 전역 or undefined — 의도와 다름
  }, 1000);
}

// ✓ 화살표 함수 콜백 — 외부 this 유지
function Timer() {
  this.count = 0;
  setInterval(() => {
    this.count++; // this = Timer 인스턴스 (캡처됨)
  }, 1000);
}

const t = new Timer();
```

![화살표 함수 this 비교](/assets/posts/js-this-in-arrow-compare.svg)

화살표 함수가 도입되기 전에는 `const self = this`나 `.bind(this)`를 사용했습니다. 화살표 함수는 이 문제를 언어 수준에서 해결합니다.

---

## Promise 체인에서의 화살표 함수

Promise `.then` 콜백에서 외부 `this`를 참조해야 할 때도 화살표 함수가 자연스럽습니다.

```javascript
class DataLoader {
  constructor() {
    this.data = [];
  }

  load(url) {
    fetch(url)
      .then(r => r.json())
      .then(json => {
        this.data = json; // this = DataLoader 인스턴스 (캡처됨)
      });
  }
}
```

`async/await` 방식으로 작성하면 `this` 문제가 자연스럽게 해결됩니다.

```javascript
class DataLoader {
  constructor() { this.data = []; }

  async load(url) {
    const r = await fetch(url);
    this.data = await r.json(); // this = DataLoader 인스턴스
  }
}
```

---

## 화살표 함수를 쓰면 안 되는 곳

화살표 함수가 `this`를 외부에서 캡처한다는 것은, **동적으로 `this`가 설정되길 기대하는 곳**에서는 문제가 됩니다.

```javascript
// ❌ 객체 리터럴 메서드
const user = {
  name: 'Alice',
  greet: () => this.name, // 전역 this.name = undefined
};

// ✅ 일반 함수 메서드 단축 표기
const user2 = {
  name: 'Alice',
  greet() { return this.name; }, // 'Alice'
};
```

```javascript
// ❌ prototype 메서드
function Person(name) { this.name = name; }
Person.prototype.greet = () => this.name; // 전역 this

// ✅
Person.prototype.greet = function() { return this.name; };
```

```javascript
// ❌ 생성자로 사용 불가
const Foo = () => {};
new Foo(); // TypeError: Foo is not a constructor
```

```javascript
// ❌ arguments 객체 없음
const fn = () => {
  console.log(arguments); // ReferenceError (또는 외부 arguments)
};

// ✅ rest 파라미터 사용
const fn2 = (...args) => {
  console.log(args); // 배열로 받음
};
```

![화살표 함수 this — 잘못 쓰는 패턴](/assets/posts/js-this-in-arrow-pitfalls.svg)

---

## 클래스 메서드에서 화살표 함수 필드

클래스 프로퍼티 문법을 사용하면 화살표 함수를 인스턴스 메서드로 정의할 수 있습니다. 이 방법은 이벤트 핸들러로 메서드를 전달할 때 `bind` 없이도 `this`를 유지합니다.

```javascript
class Button {
  label = 'Click me';

  // 클래스 필드: 각 인스턴스마다 별도 함수 생성
  handleClick = () => {
    console.log(this.label); // 항상 인스턴스 this
  };
}

const btn = new Button();
document.addEventListener('click', btn.handleClick); // this 유지 ✓
```

단점은 각 인스턴스마다 함수 객체가 생성된다는 것입니다. prototype 메서드는 공유되지만, 화살표 함수 필드는 공유되지 않아 메모리를 더 사용합니다.

---

## 중첩 화살표 함수에서의 this

화살표 함수가 중첩되어도 `this`는 항상 **가장 가까운 일반 함수(또는 클래스 constructor)**의 `this`를 캡처합니다.

```javascript
class Outer {
  constructor() {
    this.name = 'Outer';

    const arrow1 = () => {
      const arrow2 = () => {
        return this.name; // Outer 인스턴스의 this
      };
      return arrow2();
    };

    console.log(arrow1()); // 'Outer'
  }
}

new Outer();
```

---

## 요약: 화살표 함수 vs 일반 함수 this

| 특성 | 일반 함수 | 화살표 함수 |
|------|-----------|-------------|
| this 결정 시점 | 호출 시 | 선언 시 |
| this 결정 기준 | 호출 방식(4 규칙) | 외부 렉시컬 환경 |
| call/apply/bind | this 변경 가능 | 무효 (변경 불가) |
| new 사용 | 가능 | 불가 |
| arguments 객체 | 있음 | 없음 |
| 객체 메서드 | 적합 | 부적합 |
| 콜백 (외부 this 필요) | 부적합 | 적합 |

---

**지난 글:** [this 규칙 완전 정복](/posts/js-this-rules/)

**다음 글:** [call, apply, bind 완전 이해](/posts/js-call-apply-bind/)

<br>
읽어주셔서 감사합니다. 😊
