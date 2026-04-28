---
title: "순수 함수와 부수 효과"
description: "순수 함수의 정의와 특성, 부수 효과의 종류와 격리 전략을 이해하고 예측 가능한 코드를 작성하는 방법을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "함수형 프로그래밍", "순수 함수", "부수 효과", "테스트"]
featured: false
draft: false
---

[지난 글](/posts/js-higher-order-functions/)에서 고차 함수가 함수를 값처럼 다루는 방법을 살펴봤습니다. 이번에는 함수형 프로그래밍의 핵심 개념인 **순수 함수(Pure Function)** 와 **부수 효과(Side Effect)** 를 다룹니다. 이 두 개념을 명확히 구분하면 코드의 예측 가능성과 테스트 용이성이 눈에 띄게 향상됩니다.

## 순수 함수란?

순수 함수는 두 가지 조건을 모두 만족하는 함수입니다.

1. **동일한 입력에 대해 항상 동일한 출력을 반환한다.**
2. **외부 상태를 읽거나 변경하지 않는다.** (부수 효과가 없다)

```javascript
// 순수 함수 — 조건 1, 2 모두 충족
function add(a, b) {
  return a + b;
}

add(2, 3); // 항상 5
add(2, 3); // 항상 5
```

`add`는 외부 세계와 완전히 단절되어 있습니다. 어떤 시점에 호출하든, 몇 번을 호출하든 결과가 바뀌지 않습니다. 이 성질을 **참조 투명성(Referential Transparency)** 이라고 합니다. `add(2, 3)`을 `5`로 치환해도 프로그램이 전혀 달라지지 않는다는 뜻입니다.

![순수 함수 vs 부수 효과 개념도](/assets/posts/js-pure-functions-side-effects-concept.svg)

## 부수 효과의 종류

부수 효과란 함수가 반환값 외부에 미치는 모든 관찰 가능한 변화를 말합니다.

```javascript
let count = 0;

// 외부 상태 변경
function increment() {
  count++;       // 부수 효과: 전역 변수 수정
  return count;  // 호출할 때마다 다른 값 반환
}

// 콘솔 출력
function greet(name) {
  console.log(`Hello, ${name}`); // 부수 효과: I/O
}

// 날짜 의존
function getTodayLabel() {
  return new Date().toLocaleDateString(); // 호출 시각에 따라 다름
}
```

자주 만나는 부수 효과 유형은 다음과 같습니다.

| 유형 | 예시 |
|---|---|
| 전역/외부 변수 수정 | `window.title =`, `obj.x =` |
| DOM 조작 | `element.textContent =` |
| 네트워크 I/O | `fetch()`, `XMLHttpRequest` |
| 콘솔·로그 출력 | `console.log()` |
| 파일 시스템 접근 | Node.js `fs.writeFile()` |
| 날짜·난수 참조 | `Date.now()`, `Math.random()` |
| 타이머 | `setTimeout()`, `setInterval()` |

부수 효과가 나쁜 것은 아닙니다. 실용적인 프로그램은 반드시 외부 세계와 상호작용해야 합니다. 문제는 **부수 효과가 비즈니스 로직 안에 숨어 있을 때** 발생합니다.

## 참조 투명성과 등치 교환

순수 함수에서만 가능한 강력한 최적화가 있습니다. 동일한 인자를 다시 호출하는 대신 이전 결과를 재사용(메모이제이션)할 수 있습니다.

```javascript
// 순수 함수: 결과를 캐싱해도 동작이 동일
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

const slowAdd = (a, b) => {
  // 무거운 계산이라고 가정
  return a + b;
};

const fastAdd = memoize(slowAdd);
fastAdd(100, 200); // 계산 실행
fastAdd(100, 200); // 캐시에서 즉시 반환
```

불순 함수에 이 기법을 적용하면 캐시된 낡은 값을 돌려주는 버그가 생깁니다. 참조 투명성이 보장되어야 메모이제이션이 안전합니다.

## 부수 효과 격리 패턴

부수 효과를 완전히 제거하는 것은 불가능하지만, 핵심 로직과 명확히 **분리**할 수 있습니다.

![부수 효과 격리 패턴](/assets/posts/js-pure-functions-side-effects-isolation.svg)

```javascript
// ✗ Before: 비즈니스 로직 + I/O 혼재
async function loadAndDisplay(userId) {
  const res = await fetch(`/api/users/${userId}`);
  const data = await res.json();
  const fullName = data.firstName + ' ' + data.lastName;
  document.getElementById('name').textContent = fullName;
  return fullName;
}

// ✓ After: 순수 로직 분리
function formatFullName(data) {             // 순수 함수 — 독립 테스트 가능
  return data.firstName + ' ' + data.lastName;
}

async function loadUser(userId) {           // I/O 경계
  const res = await fetch(`/api/users/${userId}`);
  return res.json();
}

async function renderUser(userId) {         // 부수 효과 조율
  const data = await loadUser(userId);
  const name = formatFullName(data);        // 순수 로직 호출
  document.getElementById('name').textContent = name;
}
```

이렇게 분리하면 `formatFullName`은 `fetch`나 DOM 없이 단독으로 단위 테스트할 수 있습니다.

## 배열 메서드와 불변성

`Array.prototype.map`, `filter`, `reduce`는 원본 배열을 변경하지 않고 새 배열을 반환하는 순수한 고차 함수입니다.

```javascript
const numbers = [1, 2, 3, 4, 5];

// 순수: 원본 numbers 불변
const doubled = numbers.map(n => n * 2); // [2, 4, 6, 8, 10]
console.log(numbers); // [1, 2, 3, 4, 5] 그대로

// 불순: 원본 변경
numbers.push(6);      // 원본 수정 — 부수 효과
numbers.sort();       // 원본 정렬 — 부수 효과
```

불변 데이터를 다루는 순수 함수 체인은 어느 단계에서 문제가 생겼는지 추적하기 쉽습니다.

## 테스트 용이성

순수 함수의 가장 큰 실용적 장점은 테스트가 극도로 단순해진다는 점입니다.

```javascript
// 테스트 코드 (Jest)
describe('formatFullName', () => {
  it('이름과 성을 합친다', () => {
    expect(formatFullName({ firstName: '길동', lastName: '홍' }))
      .toBe('길동 홍');
  });

  it('빈 문자열도 처리', () => {
    expect(formatFullName({ firstName: '', lastName: '홍' }))
      .toBe(' 홍');
  });
});
```

`fetch` 모킹, DOM 셋업, 전역 상태 초기화 없이 입력과 출력만 확인하면 됩니다.

## 실무 가이드라인

- **데이터 변환 로직**은 순수 함수로 작성합니다.
- **I/O, 타이머, 랜덤**은 가장 바깥 레이어로 밀어냅니다.
- 함수가 외부를 변경해야 한다면 **이름이나 주석으로 명시**합니다.
- 리액트 컴포넌트의 렌더 함수, Vue의 computed 속성처럼 프레임워크도 순수성을 강하게 권장합니다.

순수 함수와 부수 효과의 경계를 의식하는 것만으로도 코드의 품질이 달라집니다. 다음 글에서는 이 개념 위에 세워진 **커링(Currying)과 부분 적용(Partial Application)** 을 살펴봅니다.

---

**지난 글:** [고차 함수](/posts/js-higher-order-functions/)

**다음 글:** [커링과 부분 적용](/posts/js-currying-partial-application/)

<br>
읽어주셔서 감사합니다. 😊
