---
title: "클래스 메서드와 this — 잃어버리기 쉬운 컨텍스트"
description: "JavaScript 클래스 메서드에서 this가 소실되는 원인과 세 가지 해결 방법(constructor bind, 클래스 필드 화살표, 호출 시 래핑)의 장단점을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "class", "this", "메서드", "bind", "클래스필드", "prototype"]
featured: false
draft: false
---

[지난 글](/posts/js-call-apply-bind/)에서 `call`, `apply`, `bind`로 `this`를 명시적으로 지정하는 방법을 살펴봤습니다. 이번에는 클래스 메서드에서 `this`가 예상치 못하게 소실되는 패턴과 그 해결책을 다룹니다. 이 문제는 React 컴포넌트 핸들러, DOM 이벤트 리스너, 콜백 전달 등에서 매우 자주 발생하므로 반드시 이해해야 합니다.

---

## 클래스 메서드와 prototype

`class` 문법으로 정의한 메서드는 클래스의 `prototype`에 저장됩니다. 인스턴스들이 이 메서드를 공유합니다. 이는 메모리 효율적이지만, 메서드를 변수에 할당하거나 콜백으로 전달하면 `this`가 소실됩니다.

```javascript
class Counter {
  count = 0;

  increment() {
    this.count++; // this = Counter 인스턴스를 기대
    return this.count;
  }
}

const c = new Counter();
c.increment(); // 1 — OK (obj.method() 형태: 암묵적 바인딩)

// 문제: 메서드 참조 분리
const fn = c.increment;
fn(); // TypeError or NaN — this가 undefined/전역
```

`c.increment`는 prototype의 함수 참조를 복사할 뿐, 컨텍스트 객체 `c`와의 연결은 복사되지 않습니다.

---

## 왜 this가 소실되는가

클래스 본문은 암묵적으로 엄격 모드입니다. `c.increment`를 변수 `fn`에 할당한 후 `fn()`으로 호출하면:

- 점 표기법이 없으므로 암묵적 바인딩 적용 불가
- 엄격 모드이므로 기본 바인딩이 `undefined`
- 결과: `this === undefined` → `this.count` 접근 시 `TypeError`

이 문제는 이벤트 리스너, `setTimeout`, 콜백 전달에서 빈번하게 발생합니다.

```javascript
const c = new Counter();
// 모두 this 소실
setTimeout(c.increment, 1000);          // undefined this
[1, 2, 3].forEach(c.increment);         // undefined this
button.addEventListener('click', c.increment); // undefined this
```

![클래스 메서드와 this — prototype vs 클래스 필드](/assets/posts/js-class-method-this-diagram.svg)

---

## 해결책 1 — constructor에서 bind

`constructor` 내부에서 메서드를 `bind(this)`로 인스턴스 프로퍼티에 재할당합니다.

```javascript
class Counter {
  constructor() {
    this.count = 0;
    // prototype 메서드를 this가 고정된 새 함수로 덮어씀
    this.increment = this.increment.bind(this);
  }

  increment() {
    this.count++;
    return this.count;
  }
}

const c = new Counter();
const fn = c.increment;
fn(); // 1 — this가 c로 고정됨
```

**장점**: `increment`는 여전히 prototype에도 있고, 인스턴스 프로퍼티가 prototype 메서드를 가립니다.  
**단점**: 메서드마다 `bind(this)`를 명시해야 하고, 인스턴스마다 별도 함수 객체가 생성됩니다.

---

## 해결책 2 — 클래스 필드 화살표 함수

클래스 필드(class field) 문법으로 화살표 함수를 정의하면 각 인스턴스 생성 시 자동으로 `this`가 캡처됩니다.

```javascript
class Counter {
  count = 0;

  // 인스턴스 생성 시 현재 this를 캡처
  increment = () => {
    this.count++;
    return this.count;
  };
}

const c = new Counter();
const fn = c.increment;
fn(); // 1 — 화살표 함수가 c를 캡처
```

이 문법은 ES2022에 정식 표준화되었으며, 이전부터 Babel, TypeScript에서 지원했습니다.

**장점**: 가장 간결하고 직관적. `bind`를 잊을 위험 없음.  
**단점**: 인스턴스마다 별도 함수 객체가 생성됩니다. `c1.increment !== c2.increment`. 인스턴스가 많으면 메모리 사용이 증가합니다.

```javascript
const c1 = new Counter();
const c2 = new Counter();
c1.increment === c2.increment; // false — 각자 별도 함수
```

---

## 해결책 3 — 호출 시 래핑

사용처에서 화살표 함수로 래핑해 `this`를 유지합니다. 가장 침습적이지 않지만, 래핑 책임이 호출자에게 있어 실수가 생길 수 있습니다.

```javascript
class Counter {
  count = 0;
  increment() { this.count++; }
}

const c = new Counter();
button.addEventListener('click', () => c.increment()); // ✓

// bind 사용도 가능
button.addEventListener('click', c.increment.bind(c)); // ✓
```

---

## 세 가지 해결책 비교

![클래스 메서드 this 소실 해결 방법](/assets/posts/js-class-method-this-solutions.svg)

| 방법 | 메모리 효율 | this 안전 | 권장 상황 |
|------|------------|-----------|-----------|
| constructor bind | 중간 | ✓ | React class 컴포넌트 레거시 |
| 클래스 필드 화살표 | 낮음 (인스턴스별) | ✓ | 소수 인스턴스, 핸들러 중심 코드 |
| 호출 시 래핑 | 높음 (prototype 공유) | ✓ | 라이브러리 메서드 사용, 제어권 외부 |

---

## React class 컴포넌트와 this

React class 컴포넌트에서 이 문제가 가장 빈번히 발생했습니다.

```javascript
class MyComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
    // 방법 1: constructor bind
    this.handleClick = this.handleClick.bind(this);
  }

  // 방법 2: 클래스 필드 (더 현대적)
  handleClick = () => {
    this.setState(s => ({ count: s.count + 1 }));
  };

  render() {
    return <button onClick={this.handleClick}>{this.state.count}</button>;
  }
}
```

오늘날 React에서는 함수 컴포넌트와 훅을 권장하므로 이 문제 자체가 사라지지만, 레거시 코드베이스를 읽을 때 필수 지식입니다.

---

## 어떤 방법을 선택해야 하는가

- **메서드를 콜백으로 자주 전달** → 클래스 필드 화살표
- **많은 인스턴스 생성** → prototype 메서드 + 호출 시 래핑으로 메모리 효율 확보
- **레거시 코드와의 호환** → constructor bind

현대 React 프로젝트에서는 대부분 함수 컴포넌트를 사용하므로 `this` 문제 자체를 피할 수 있습니다. 하지만 클래스 기반 코드를 작성하거나 읽는다면 이 세 가지 패턴을 모두 인식할 수 있어야 합니다.

---

**지난 글:** [call, apply, bind 완전 이해](/posts/js-call-apply-bind/)

**다음 글:** [이벤트 핸들러와 this — currentTarget과 바인딩](/posts/js-this-in-event-handler/)

<br>
읽어주셔서 감사합니다. 😊
