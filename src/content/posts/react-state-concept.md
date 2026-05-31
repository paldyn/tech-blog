---
title: "상태(state)란 무엇인가"
description: "React에서 state의 개념과 props와의 차이, state 변경 시 리렌더링이 발생하는 원리, 그리고 state가 스냅샷처럼 동작한다는 핵심 개념을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["React", "state", "useState", "리렌더링", "스냅샷"]
featured: false
draft: false
---

[지난 글](/posts/react-event-handling/)에서 사용자 이벤트를 처리하는 방법을 살펴봤습니다. 이번에는 React에서 UI를 동적으로 만드는 핵심 메커니즘인 **state(상태)**가 무엇인지, 어떻게 동작하는지 깊이 이해해 봅니다.

---

## state란

**state**는 컴포넌트가 시간이 지나면서 기억해야 하는 데이터입니다. 사용자가 버튼을 몇 번 클릭했는지, 어떤 탭이 선택되었는지, 모달이 열려 있는지 — 이런 정보들이 state입니다.

일반 JavaScript 변수와 달리 state는 두 가지 특별한 능력을 가집니다.

1. **렌더링 간 유지**: 함수가 끝나도 state 값이 사라지지 않습니다.
2. **변경 시 리렌더링 트리거**: state가 바뀌면 React가 컴포넌트를 다시 실행해 최신 UI를 화면에 반영합니다.

```jsx
// 일반 변수 — 리렌더 시마다 초기화됨, 변경해도 화면 안 바뀜
let count = 0;

// state — 렌더 간 유지 + 변경 시 자동 리렌더
const [count, setCount] = useState(0);
```

---

## state vs props

![State 개요 — props vs state](/assets/posts/react-state-concept-overview.svg)

| 특성 | props | state |
|------|-------|-------|
| 출처 | 부모 컴포넌트 | 컴포넌트 자체 |
| 읽기/쓰기 | 읽기 전용 | setXxx()로 변경 |
| 목적 | 컴포넌트 설정 | 내부 동적 데이터 |
| 변경 주체 | 부모 | 컴포넌트 자신 |

props는 "외부에서 설정하는 것", state는 "컴포넌트가 스스로 관리하는 기억"으로 이해하면 됩니다.

---

## state를 써야 할 때

모든 데이터가 state일 필요는 없습니다. 다음 질문으로 판단합니다.

1. **시간이 지나도 변하지 않는가?** → 변수나 상수로 충분
2. **부모가 내려준 데이터인가?** → props 사용
3. **다른 state나 props로 계산 가능한가?** → 파생 값으로 계산

```jsx
function ShoppingCart({ cartItems }) {
  // ✅ state: 사용자가 선택한 쿠폰 코드
  const [couponCode, setCouponCode] = useState('');

  // ✅ 파생 값: state/props로 계산 — 별도 state 불필요
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price, 0);
  const discountedPrice = couponCode === 'SAVE10'
    ? totalPrice * 0.9
    : totalPrice;

  return (
    <div>
      <p>합계: {discountedPrice.toLocaleString()}원</p>
      <input value={couponCode} onChange={e => setCouponCode(e.target.value)} />
    </div>
  );
}
```

---

## state는 스냅샷이다

React state를 이해하는 가장 중요한 개념은 **"state는 렌더링 시점의 스냅샷"**이라는 것입니다.

![State 스냅샷 개념](/assets/posts/react-state-concept-snapshot.svg)

```jsx
// 한 렌더 안에서 state는 변하지 않음
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1); // count = 0 → 예약: 1
    setCount(count + 1); // count = 0 → 예약: 1 (여전히 0!)
    setCount(count + 1); // count = 0 → 예약: 1
    // 세 번 호출해도 결과: count = 1 (0+1)
  }

  return <button onClick={handleClick}>{count}</button>;
}
```

동일한 렌더 안에서 `count`는 항상 `0`입니다. `setCount(count + 1)`를 아무리 여러 번 호출해도 `0 + 1 = 1`로 계산됩니다.

이전 state를 기반으로 업데이트하려면 **업데이터 함수(updater function)**를 사용합니다.

```jsx
function handleClick() {
  // c는 최신 state 값을 받음
  setCount(c => c + 1); // 0 → 1
  setCount(c => c + 1); // 1 → 2
  setCount(c => c + 1); // 2 → 3
  // 결과: count = 3
}
```

---

## state는 컴포넌트 인스턴스에 속한다

같은 컴포넌트를 여러 번 렌더링하면 각각 **독립적인 state**를 가집니다.

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

function App() {
  return (
    <>
      <Counter /> {/* 이 Counter의 count */}
      <Counter /> {/* 저 Counter의 count — 완전히 독립적 */}
    </>
  );
}
```

두 Counter의 버튼을 각각 클릭해도 서로 영향을 주지 않습니다.

---

## state 업데이트는 배치(Batch) 처리된다

React 18부터는 이벤트 핸들러 안의 모든 `setState` 호출이 **일괄 처리(batching)**됩니다. 여러 `setState`를 호출해도 리렌더링은 한 번만 발생합니다.

```jsx
function handleClick() {
  setFirstName('Alice');   // 리렌더 예약
  setLastName('Smith');    // 리렌더 예약
  setAge(30);              // 리렌더 예약
  // 세 setState가 하나의 리렌더로 합쳐짐 → 성능 최적화
}
```

다음 글에서는 `useState` Hook을 직접 사용하는 구체적인 방법을 살펴봅니다.

---

**지난 글:** [이벤트 처리](/posts/react-event-handling/)

**다음 글:** [useState로 상태 관리하기](/posts/react-usestate/)

<br>
읽어주셔서 감사합니다. 😊
