---
title: "클로저 패턴 — 실전 활용법"
description: "모듈 패턴, 함수 팩토리, 메모이제이션, 부분 적용, 이벤트 핸들러 바인딩까지 실무에서 자주 쓰이는 클로저 기반 패턴을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "클로저", "모듈패턴", "팩토리함수", "메모이제이션", "부분적용"]
featured: false
draft: false
---

[지난 글](/posts/js-closure-essence/)에서 클로저가 무엇인지, 왜 외부 변수가 살아있는지를 렉시컬 환경과 `[[Environment]]`를 통해 설명했습니다. 이번에는 "그래서 실무에서 어떻게 쓰는가"로 넘어갑니다. 클로저는 단순한 개념이 아니라, JavaScript의 상태 관리·캡슐화·함수 합성을 가능하게 하는 핵심 도구입니다.

---

## 1. 모듈 패턴

ES 모듈이 도입되기 전, JavaScript에서 `private` 상태를 만드는 표준 방법은 IIFE(즉시 실행 함수 표현식)와 클로저를 결합하는 **모듈 패턴**이었습니다.

```javascript
const counter = (() => {
  let count = 0; // private — 외부에서 직접 접근 불가

  return {
    increment() { count++; },
    decrement() { count--; },
    reset()     { count = 0; },
    value()     { return count; },
  };
})();

counter.increment();
counter.increment();
counter.value(); // 2
counter.count;   // undefined — private 변수 노출 없음
```

반환된 객체의 메서드들은 모두 `count`를 캡처한 클로저입니다. 외부 코드는 반환된 API를 통해서만 `count`와 상호작용할 수 있습니다.

![클로저 패턴 — 모듈 패턴](/assets/posts/js-closure-patterns-module.svg)

이 패턴은 jQuery 플러그인, Backbone 모델 등 jQuery 시대의 라이브러리들이 광범위하게 사용했습니다. 오늘날에도 번들러 없이 스크립트를 직접 작성하거나, React 커스텀 훅 내부 구현을 이해할 때 동일한 원리가 적용됩니다.

---

## 2. 함수 팩토리

클로저는 설정값을 캡처해서 **특화된 함수**를 생성하는 팩토리 역할을 합니다.

```javascript
function multiplier(factor) {
  return (n) => n * factor; // factor를 클로저로 캡처
}

const double = multiplier(2);
const triple = multiplier(3);

double(5); // 10
triple(5); // 15
// double과 triple은 서로 다른 factor를 독립적으로 유지
```

![클로저 패턴 — 함수 팩토리와 메모이제이션](/assets/posts/js-closure-patterns-factory.svg)

실용 예시로 API 기본 URL을 캡처하는 HTTP 클라이언트 팩토리를 들 수 있습니다.

```javascript
function createApiClient(baseUrl) {
  return {
    async get(path) {
      const res = await fetch(`${baseUrl}${path}`);
      return res.json();
    },
    async post(path, body) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.json();
    },
  };
}

const api = createApiClient('https://api.example.com');
api.get('/users'); // 'https://api.example.com/users' 호출
```

---

## 3. 메모이제이션

계산 비용이 높은 함수의 결과를 캐시하는 **메모이제이션**도 클로저 패턴입니다. `Map`을 클로저 내부에 유지하면 캐시가 외부에 노출되지 않습니다.

```javascript
function memoize(fn) {
  const cache = new Map(); // 클로저 안에 격리

  return function(key) {
    if (cache.has(key)) return cache.get(key);
    const result = fn(key);
    cache.set(key, result);
    return result;
  };
}

const expensiveFn = memoize((n) => {
  // 복잡한 계산...
  return n * n;
});

expensiveFn(10); // 계산 후 캐시
expensiveFn(10); // 캐시에서 즉시 반환
```

---

## 4. 부분 적용(Partial Application)

함수의 일부 인자를 미리 고정하는 **부분 적용**도 클로저로 구현합니다.

```javascript
function partial(fn, ...presetArgs) {
  return (...laterArgs) => fn(...presetArgs, ...laterArgs);
}

function add(a, b, c) {
  return a + b + c;
}

const add10 = partial(add, 10);     // a = 10 고정
const add10And5 = partial(add, 10, 5); // a = 10, b = 5 고정

add10(3, 4);    // 17
add10And5(2);   // 17
```

React의 이벤트 핸들러에서 `id`를 미리 바인딩할 때 자주 사용합니다.

```javascript
function handleDelete(id) {
  return () => deleteItem(id); // id를 클로저로 캡처
}

items.map(item => (
  `<button onclick="${handleDelete(item.id)}">삭제</button>`
));
```

---

## 5. 이벤트 리스너와 클로저

DOM 이벤트 핸들러에서 클로저는 필수적입니다. 핸들러가 외부 변수를 참조해야 할 때, 클로저가 그 연결을 유지합니다.

```javascript
function attachTooltip(element, message) {
  function showTooltip() {
    console.log(message); // message를 클로저로 캡처
  }

  element.addEventListener('mouseenter', showTooltip);

  // 정리(cleanup) 함수 반환
  return () => element.removeEventListener('mouseenter', showTooltip);
}

const cleanup = attachTooltip(button, '클릭하면 저장됩니다');
// 나중에 cleanup() 호출로 리스너 제거
```

---

## 6. React에서의 클로저

React 훅은 클로저를 기반으로 합니다. `useState`와 `useEffect` 안의 함수들은 컴포넌트 렌더 시점의 상태값을 클로저로 캡처합니다.

```javascript
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // count는 이 effect가 실행된 시점의 값을 캡처
      setCount(prev => prev + 1); // ✓ 함수형 업데이트로 최신값 참조
    }, 1000);

    return () => clearInterval(id);
  }, []); // 빈 배열 → 마운트 시 1회 실행

  return <div>{count}</div>;
}
```

`setCount(prev => prev + 1)` 패턴은 클로저의 스냅샷 문제(오래된 state 참조)를 피하기 위해 함수형 업데이트를 사용하는 대표적인 예입니다.

---

## 패턴 요약

| 패턴 | 클로저가 캡처하는 것 | 목적 |
|------|---------------------|------|
| 모듈 패턴 | 내부 상태(변수) | 정보 은닉·캡슐화 |
| 함수 팩토리 | 설정값·인자 | 특화된 함수 생성 |
| 메모이제이션 | Map(캐시) | 중복 연산 방지 |
| 부분 적용 | 일부 인자 | 함수 재사용성 증가 |
| 이벤트 핸들러 | 외부 데이터·element | 핸들러에 컨텍스트 주입 |

---

**지난 글:** [클로저의 본질 — 함수가 기억하는 것](/posts/js-closure-essence/)

**다음 글:** [클로저와 메모리 누수 — 언제 문제가 되는가](/posts/js-closure-memory-leak/)

<br>
읽어주셔서 감사합니다. 😊
