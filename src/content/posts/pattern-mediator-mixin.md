---
title: "미디에이터·믹스인 패턴 — 협력과 조합"
description: "컴포넌트 간 직접 참조를 제거하고 이벤트 버스로 조율하는 미디에이터 패턴과, 단일 상속의 한계를 넘어 기능을 합성하는 믹스인 패턴을 JavaScript 실용 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "디자인패턴", "미디에이터", "믹스인", "이벤트버스", "합성", "GoF", "행위패턴"]
featured: false
draft: false
---

[지난 글](/posts/pattern-module/)에서 모듈 패턴으로 캡슐화와 네임스페이스를 관리하는 방법을 살펴봤습니다. 이번에는 JavaScript 패턴 시리즈의 마지막 두 패턴—**미디에이터(Mediator)**와 **믹스인(Mixin)**—을 정리합니다. 미디에이터는 컴포넌트 간 결합도를 낮추고, 믹스인은 단일 상속의 한계를 넘어 기능을 재사용합니다.

![미디에이터 vs 직접 통신](/assets/posts/pattern-mediator-mixin-mediator.svg)

## 미디에이터 패턴 — 통신의 중재자

N개의 컴포넌트가 서로 직접 통신하면 결합도가 **N×(N-1)/2**로 폭발적으로 증가합니다. 미디에이터는 이 통신을 한 곳으로 집중해 각 컴포넌트가 **미디에이터만** 알면 되도록 만듭니다.

### 이벤트 버스 미디에이터

가장 범용적인 구현은 이벤트 버스입니다.

```javascript
class EventBus {
  #handlers = new Map();

  on(event, fn) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, []);
    this.#handlers.get(event).push(fn);
    return () => this.off(event, fn); // unsubscribe 반환
  }

  off(event, fn) {
    const list = this.#handlers.get(event) ?? [];
    this.#handlers.set(event, list.filter(h => h !== fn));
  }

  emit(event, payload) {
    (this.#handlers.get(event) ?? []).forEach(fn => fn(payload));
  }
}

const bus = new EventBus();

// 검색창 컴포넌트
bus.on('search:query', ({ term }) => {
  console.log('결과 목록 업데이트:', term);
});

bus.on('search:query', ({ term }) => {
  console.log('검색 히스토리 저장:', term);
});

// 사용자가 검색할 때
bus.emit('search:query', { term: 'JavaScript' });
```

`bus`를 제외하면 컴포넌트끼리 서로를 참조하지 않습니다.

### 구조화된 미디에이터 — 타입 안전 이벤트

TypeScript 환경에서는 이벤트 맵으로 타입을 보장하지만, 순수 JS에서도 객체 맵으로 구조화할 수 있습니다.

```javascript
class AppMediator {
  #bus = new EventBus();

  // 검색 관련 이벤트 API
  onSearch(fn) { return this.#bus.on('search', fn); }
  search(term) { this.#bus.emit('search', { term, timestamp: Date.now() }); }

  // 필터 관련 이벤트 API
  onFilter(fn) { return this.#bus.on('filter', fn); }
  applyFilter(filters) { this.#bus.emit('filter', filters); }

  // 페이지 이동
  onPageChange(fn) { return this.#bus.on('page', fn); }
  goToPage(page)   { this.#bus.emit('page', { page }); }
}

const mediator = new AppMediator();

// 검색창은 검색 이벤트만 발행
function SearchBox({ mediator }) {
  const input = document.querySelector('#search');
  input.addEventListener('input', () => mediator.search(input.value));
}

// 결과 목록은 구독만
function ResultList({ mediator }) {
  mediator.onSearch(({ term }) => {
    console.log(`"${term}" 검색 결과를 가져오는 중...`);
  });
}
```

로직이 `AppMediator` 안에 집중되므로 컴포넌트 교체나 이벤트 흐름 변경이 쉽습니다.

### Redux/Flux와 미디에이터

Redux의 `store`는 사실 미디에이터입니다. 컴포넌트는 `dispatch`로 액션을 발행하고, `subscribe`로 상태 변경을 구독합니다. 서로를 직접 참조하지 않습니다.

---

## 믹스인 패턴 — 기능의 조합

JavaScript는 단일 상속만 지원합니다. `class Foo extends Bar`는 하나의 클래스만 상속받을 수 있습니다. **믹스인**은 여러 클래스의 기능을 하나의 클래스에 합성하는 방법입니다.

![미디에이터·믹스인 구현 패턴](/assets/posts/pattern-mediator-mixin-code.svg)

### 함수형 믹스인 — 팩토리 함수

가장 간단한 방법은 함수가 객체에 메서드를 추가하는 것입니다.

```javascript
const Serializable = {
  toJSON() { return JSON.stringify(this); },
  fromJSON(json) { return Object.assign(this, JSON.parse(json)); },
};

const Validatable = {
  validate(schema) {
    return Object.entries(schema).every(([key, fn]) => fn(this[key]));
  },
};

class User {
  constructor(name, email) {
    this.name  = name;
    this.email = email;
  }
}

Object.assign(User.prototype, Serializable, Validatable);

const user = new User('김코딩', 'kim@example.com');
user.toJSON(); // '{"name":"김코딩","email":"kim@example.com"}'

const isValid = user.validate({
  email: v => v.includes('@'),
  name:  v => v.length > 0,
});
console.log(isValid); // true
```

### 서브클래스 팩토리 믹스인 — SuperClass 패턴

`class extends Base` 형태를 함수로 래핑하면 `instanceof`·`super` 호출이 정상 작동하는 진정한 믹스인이 됩니다.

```javascript
const Timestamped = (Base) => class extends Base {
  #createdAt = new Date();
  #updatedAt = new Date();

  get createdAt() { return this.#createdAt; }
  get updatedAt() { return this.#updatedAt; }

  touch() { this.#updatedAt = new Date(); }
};

const Activatable = (Base) => class extends Base {
  #active = false;

  activate()   { this.#active = true; this.touch?.(); }
  deactivate() { this.#active = false; }
  get isActive() { return this.#active; }
};

// 조합: User에 Timestamped + Activatable 합성
class User extends Activatable(Timestamped(class {})) {
  constructor(name) {
    super();
    this.name = name;
  }
}

const user = new User('이자바');
user.activate();
console.log(user.isActive);  // true
console.log(user.updatedAt); // 현재 시각
```

믹스인 체인에서 가장 안쪽 `class {}`가 베이스 클래스 역할을 합니다. 실제 비즈니스 클래스(`User`)는 `extends ClassName`으로 보통 상속하는 것처럼 보입니다.

### 믹스인 vs 상속 vs 컴포지션

```javascript
// 상속: "is-a" 관계만 표현
class Animal {}
class Dog extends Animal {} // Dog는 Animal이다

// 믹스인: "has-a" 기능 추가
const Swimmable = (Base) => class extends Base {
  swim() { console.log('수영!'); }
};
const Flyable = (Base) => class extends Base {
  fly() { console.log('비행!'); }
};

class Duck extends Swimmable(Flyable(Animal)) {}
// Duck은 Animal이면서, 수영·비행 기능을 가짐

// 컴포지션: 객체에 기능을 위임
class Duck2 extends Animal {
  #swimmer = { swim: () => console.log('수영!') };
  #flyer   = { fly:  () => console.log('비행!') };
  swim() { this.#swimmer.swim(); }
  fly()  { this.#flyer.fly(); }
}
```

믹스인은 프로토타입 체인을 활용해 `instanceof`와 `super`를 자연스럽게 지원합니다. 컴포지션은 더 유연하지만 보일러플레이트가 많습니다.

---

## 미디에이터 vs 옵저버 vs 믹스인 정리

| 구분 | 미디에이터 | 옵저버 | 믹스인 |
|---|---|---|---|
| **목적** | 컴포넌트 간 통신 중재 | 상태 변경 알림 | 기능 재사용·합성 |
| **결합도** | 미디에이터에 집중 | Subject-Observer 직접 | 없음 |
| **사용 시점** | 채팅룸·폼 조율·라우터 | 이벤트 구독·반응형 상태 | 다중 역할 클래스 |
| **JS 구현** | 클래스 + EventBus | EventEmitter / 구독 | 팩토리 함수 + extends |

---

**지난 글:** [모듈 패턴 — 캡슐화와 네임스페이스](/posts/pattern-module/)

**다음 글:** [환경 변수 실전 — Node.js와 브라우저에서 설정 관리하기](/posts/real-env-vars/)

<br>
읽어주셔서 감사합니다. 😊
