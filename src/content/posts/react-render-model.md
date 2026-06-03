---
title: "React 렌더링 모델 — Render 단계와 Commit 단계"
description: "React가 상태 변화를 화면에 반영하는 과정을 Render 단계(컴포넌트 함수 호출)와 Commit 단계(DOM 조작)로 나눠 설명하고, 각 단계의 특성과 개발자가 알아야 할 핵심 원칙을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React", "렌더링모델", "RenderPhase", "CommitPhase", "Fiber", "성능최적화"]
featured: false
draft: false
---

[지난 글](/posts/react-prop-drilling/)에서 prop drilling 문제와 세 가지 해결 전략을 살펴봤다. 이번에는 React가 상태 변화를 실제 화면에 반영하기까지 내부에서 어떤 일이 일어나는지 살펴본다. 렌더링 모델을 이해하면 성능 최적화와 디버깅이 훨씬 명확해진다.

## React 렌더링의 두 단계

React는 상태 변경 후 화면을 업데이트하는 작업을 크게 두 단계로 나눈다.

**Render 단계**: 컴포넌트 함수를 호출해 새로운 React Element 트리를 만드는 순수 계산 단계다. 이전 트리와 새 트리를 비교(diffing)해서 어떤 DOM을 바꿔야 하는지 파악한다.

**Commit 단계**: Render 단계에서 계산된 변경 사항을 실제 DOM에 적용하는 단계다. 이 단계에서 비로소 화면이 업데이트된다.

![React 렌더링 모델 — Render와 Commit 단계](/assets/posts/react-render-model-phases.svg)

## Render 단계의 특징

Render 단계는 **순수 함수처럼 동작**해야 한다. 컴포넌트 함수가 호출될 때 DOM을 변경하거나 외부 시스템에 요청을 보내는 등 부수효과(side effect)를 일으켜서는 안 된다.

```jsx
// 올바른 Render 단계 코드 — 순수 계산만
function ProductCard({ product }) {
  const discountedPrice = product.price * 0.9; // 순수 계산 OK
  return (
    <div>
      <h2>{product.name}</h2>
      <p>{discountedPrice}원</p>
    </div>
  );
}
```

Render 단계에서 부수효과가 있으면 문제가 된다. React가 같은 컴포넌트를 여러 번 호출할 수 있기 때문이다. 특히 Concurrent Mode에서는 Render 단계를 중단하고 재개하거나 아예 폐기할 수도 있다. 부수효과가 있으면 예측할 수 없는 결과가 나온다.

```jsx
// 잘못된 Render 단계 코드 — 부수효과 있음
function Counter({ count }) {
  console.log('렌더됨:', count); // 로깅은 괜찮지만
  document.title = `카운트: ${count}`; // DOM 직접 조작은 금지!
  fetch('/api/log', { method: 'POST' }); // 네트워크 요청도 금지!
  return <div>{count}</div>;
}
```

## Commit 단계의 특징

Commit 단계는 **동기적으로 실행**된다. 중간에 중단할 수 없고, 변경된 DOM이 일관된 상태로 유지되도록 한 번에 처리한다.

Commit 단계는 다시 세 단계로 나뉜다.

1. **before mutation**: DOM을 변경하기 전 단계. `getSnapshotBeforeUpdate` 같은 작업
2. **mutation**: 실제 DOM 변경
3. **layout**: DOM 변경 직후, 화면 페인트 전. `useLayoutEffect` 실행

화면 페인트가 끝나고 나서 `useEffect`가 비동기적으로 실행된다.

```jsx
function Example() {
  useLayoutEffect(() => {
    // DOM 변경 직후, 페인트 전에 실행
    // DOM 크기 측정에 적합
    const rect = ref.current.getBoundingClientRect();
    setPosition(rect);
  });

  useEffect(() => {
    // 페인트 후 비동기 실행
    // 데이터 페칭, 구독 등에 적합
    fetchData();
    return () => cleanup();
  });

  return <div ref={ref}>...</div>;
}
```

## 언제 렌더링이 일어나는가

React는 세 가지 상황에서 리렌더링을 예약한다.

**최초 렌더링**: `createRoot().render()`를 호출할 때 처음 한 번 발생한다.

**상태 변경**: `useState`의 setter나 `useReducer`의 dispatch를 호출할 때 해당 컴포넌트와 그 자손들이 리렌더링된다.

**Context 변경**: `Context.Provider`의 `value`가 변경되면 해당 Context를 구독하는 컴포넌트들이 리렌더링된다.

![React 렌더링 트리거 유형](/assets/posts/react-render-model-triggers.svg)

## 흔한 오해: props가 바뀌어야만 리렌더된다?

많은 사람이 "props가 바뀌어야 리렌더된다"고 오해한다. **사실은 반대다**. 기본적으로 부모 컴포넌트가 리렌더되면 자식 컴포넌트도 함께 리렌더된다. props가 같아도 마찬가지다.

```jsx
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <Child name="고정값" /> {/* count 변경 시 Child도 리렌더됨 */}
    </div>
  );
}

function Child({ name }) {
  console.log('Child 렌더됨'); // 버튼 클릭마다 출력됨
  return <div>{name}</div>;
}
```

React의 기본 렌더링은 매우 빠르기 때문에 대부분의 경우 문제가 되지 않는다. 성능 문제가 실제로 측정될 때 `React.memo`로 최적화를 고려하면 된다.

## 같은 값이면 리렌더 안 된다

`setState`를 호출해도 새 값이 현재 값과 `Object.is()`로 같다면 React는 리렌더를 건너뛴다.

```jsx
const [count, setCount] = useState(5);

// 같은 값 설정 — 리렌더 없음
setCount(5); // Object.is(5, 5) === true

// 다른 값 설정 — 리렌더 발생
setCount(6); // Object.is(5, 6) === false
```

이 최적화는 원시값에서 잘 작동하지만, 객체와 배열은 주의해야 한다. 같은 내용이더라도 새 객체를 만들면 참조가 달라서 리렌더가 발생한다.

## 정리

React 렌더링 모델의 핵심은 단순하다. 컴포넌트 함수는 순수하게 유지하고(Render 단계), 실제 외부 영향은 useEffect나 이벤트 핸들러에서 다룬다(Commit 이후). 이 구분을 지키면 React의 최적화 기능이 제대로 동작하고, StrictMode에서 이중 호출해도 안전하다.

---

**다음 글:** [함수형 컴포넌트 생명주기](/posts/react-component-lifecycle/)

<br>
읽어주셔서 감사합니다. 😊
