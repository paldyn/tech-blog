---
title: "함수형 업데이트: 이전 상태를 안전하게 읽는 법"
description: "setState에 값 대신 함수를 넘기는 함수형 업데이트가 왜 필요한지, 클로저 함정과 React의 업데이트 큐 처리 방식, 그리고 언제 함수형 업데이트를 써야 하는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["React", "useState", "함수형 업데이트", "클로저", "배치"]
featured: false
draft: false
---

[지난 글](/posts/react-usestate/)에서 `useState`로 상태를 선언하고 `setCount(count + 1)`처럼 업데이트하는 방법을 살펴봤습니다. 이 방식은 대부분의 경우에 잘 작동하지만, 짧은 시간 안에 같은 상태를 여러 번 업데이트할 때는 **클로저 함정**에 빠질 수 있습니다. 이를 피하는 것이 **함수형 업데이트**입니다.

---

## 클로저 함정

React 컴포넌트 함수가 호출될 때, 그 시점의 `count` 값이 클로저에 캡처됩니다. 이벤트 핸들러 내부에서 `setCount(count + 1)`을 여러 번 호출해도 모두 같은 `count` 값을 읽습니다.

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleTripleClick() {
    setCount(count + 1); // 렌더 시점 count = 0 → 1
    setCount(count + 1); // 렌더 시점 count = 0 → 1 (같음)
    setCount(count + 1); // 렌더 시점 count = 0 → 1 (같음)
    // 최종 결과: 1 (3이 되어야 하는데!)
  }

  return <button onClick={handleTripleClick}>{count}</button>;
}
```

세 번 호출했지만 React는 같은 값(1)을 세 번 요청받아 최종적으로 1만 적용합니다.

![클로저 함정과 함수형 업데이트](/assets/posts/react-functional-updates-problem.svg)

---

## 함수형 업데이트

`setState`에 **값 대신 함수**를 넘기면, React가 큐에서 이전 상태를 인자로 전달해 줍니다.

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleTripleClick() {
    setCount(prev => prev + 1); // prev=0 → 1
    setCount(prev => prev + 1); // prev=1 → 2
    setCount(prev => prev + 1); // prev=2 → 3 ✓
  }

  return <button onClick={handleTripleClick}>{count}</button>;
}
```

React는 이 함수들을 순서대로 큐에 넣고, 렌더링 직전에 하나씩 적용합니다. 각 함수는 직전 함수의 결과를 `prev`로 받으므로 항상 최신 값을 기준으로 계산합니다.

![React 상태 업데이트 큐 처리](/assets/posts/react-functional-updates-queue.svg)

---

## 언제 함수형 업데이트를 써야 하는가

**이전 상태 값에 의존해서 다음 상태를 계산**할 때는 항상 함수형 업데이트를 사용합니다.

```jsx
// ✓ 이전 상태 기반 계산 — 함수형 업데이트
const toggle = () => setIsOpen(prev => !prev);
const increment = () => setCount(prev => prev + 1);
const addItem = item => setItems(prev => [...prev, item]);
const removeItem = id => setItems(prev => prev.filter(i => i.id !== id));

// 단순 교체 — 함수형 업데이트 불필요
const setUser = () => setUser(newUserData);     // 이전 값과 무관
const reset = () => setCount(0);               // 고정값으로 교체
```

---

## useEffect 안에서의 함수형 업데이트

`useEffect` 내부에서 상태를 업데이트할 때도 함수형 업데이트를 쓰면 `count`를 의존성 배열에 추가하지 않아도 됩니다.

```jsx
// ❌ count를 의존성에 넣어야 해 — 매초 effect 재등록
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);
  return () => clearInterval(id);
}, [count]); // count 변할 때마다 재실행

// ✓ count를 의존성에서 제거 가능
useEffect(() => {
  const id = setInterval(() => setCount(prev => prev + 1), 1000);
  return () => clearInterval(id);
}, []); // 마운트 시 한 번만 실행
```

함수형 업데이트를 쓰면 `prev`만 참조하고 렌더 클로저의 `count`를 참조하지 않으므로, 의존성 배열에서 제외해도 안전합니다.

---

## 객체 상태와 함수형 업데이트

객체 상태도 마찬가지입니다. 이전 객체를 펼치고 변경된 필드만 덮어씁니다.

```jsx
const [user, setUser] = useState({ name: '', age: 0, email: '' });

// 특정 필드만 업데이트 (이전 필드 보존)
const updateName = name => setUser(prev => ({ ...prev, name }));
const updateAge = age => setUser(prev => ({ ...prev, age }));
```

---

## 핵심 요약

| 방식 | 문법 | 사용 시점 |
|---|---|---|
| 값 교체 | `setState(newValue)` | 이전 값과 무관한 교체 |
| 함수형 업데이트 | `setState(prev => ...)` | 이전 값 기반 계산 |

이전 상태에 의존하는 업데이트라면 항상 `prev => ...` 형식을 사용하세요. 버그를 예방하고 코드의 의도를 명확하게 만드는 가장 간단한 습관입니다.

---

**지난 글:** [useState로 상태 관리하기](/posts/react-usestate/)

**다음 글:** [불변성 업데이트 패턴](/posts/react-immutable-updates/)

<br>
읽어주셔서 감사합니다. 😊
