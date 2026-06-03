---
title: "Virtual DOM — 개념과 작동 원리"
description: "React의 Virtual DOM이 무엇인지, 왜 도입됐는지, 상태 변경 시 실제 DOM에 반영되기까지 diffing 과정이 어떻게 이루어지는지 설명합니다. '항상 더 빠르다'는 오해도 함께 바로잡습니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["React", "VirtualDOM", "가상DOM", "Diffing", "재조정", "성능", "DOM"]
featured: false
draft: false
---

[지난 글](/posts/react-component-lifecycle/)에서 함수형 컴포넌트의 생명주기를 살펴봤다. 이번에는 React의 핵심 개념 중 하나인 Virtual DOM을 다룬다. "React는 Virtual DOM 덕분에 빠르다"는 말을 자주 듣지만, 정확히 어떻게 작동하는지, 그리고 언제 이점이 있는지 이해하는 것이 중요하다.

## Real DOM의 문제

브라우저의 Real DOM 조작은 생각보다 비용이 크다. DOM 노드 하나를 변경하면 브라우저가 레이아웃을 재계산하고(reflow), 화면을 다시 그린다(repaint). 복잡한 UI에서 자주 발생하면 성능 저하로 이어진다.

전통적인 방식으로는 DOM을 직접 조작했다.

```javascript
// 전통적인 명령형 DOM 조작
const list = document.getElementById('list');
list.innerHTML = ''; // 전체 비우고

items.forEach(item => {
  const li = document.createElement('li');
  li.textContent = item.name;
  list.appendChild(li); // 하나씩 추가
});
```

이 방식은 정확히 어떤 DOM만 바꿔야 하는지 개발자가 직접 관리해야 한다. UI가 복잡해질수록 버그가 생기기 쉽고, 성능 최적화도 어렵다.

## Virtual DOM이란

Virtual DOM은 Real DOM을 메모리 상에 표현한 JavaScript 객체 트리다. React는 상태가 변경될 때 Real DOM을 바로 건드리지 않고, 먼저 Virtual DOM에서 변경을 계산한다.

```javascript
// Virtual DOM 노드의 단순화된 표현
const vNode = {
  type: 'div',
  props: { className: 'container' },
  children: [
    { type: 'h1', props: {}, children: ['Hello'] },
    { type: 'p', props: {}, children: ['World'] },
  ]
};
```

실제로 React의 `createElement`가 반환하는 것이 이런 구조의 객체다. JSX는 결국 이 함수 호출로 변환된다.

![Virtual DOM 개념과 Real DOM 비교](/assets/posts/react-virtual-dom-concept.svg)

## 업데이트 흐름: Diffing과 Patching

상태가 변경되면 React는 다음 흐름으로 처리한다.

1. **새 Virtual DOM 생성**: 컴포넌트 함수를 다시 호출해서 새 Virtual DOM 트리를 만든다
2. **Diffing**: 이전 Virtual DOM과 새 Virtual DOM을 비교해서 어떤 부분이 달라졌는지 파악한다
3. **Patching**: 달라진 부분만 Real DOM에 최소한으로 적용한다

```jsx
// 이전 상태
function Counter() {
  return <div>카운트: 0</div>;
}

// 상태 변경 후
function Counter() {
  return <div>카운트: 1</div>; // 텍스트 노드만 변경
}
// React는 <div> 자체는 그대로 두고 텍스트 "0" → "1"만 변경
```

![Virtual DOM 업데이트 흐름](/assets/posts/react-virtual-dom-update.svg)

## Diffing 알고리즘

React의 diffing 알고리즘은 두 가지 가정을 기반으로 O(n) 복잡도를 달성한다.

**가정 1**: 다른 타입의 요소는 다른 트리를 만든다.
`<div>` → `<span>`으로 타입이 바뀌면 전체 서브트리를 교체한다. 같은 타입이면 속성만 업데이트하고 자식을 재귀적으로 비교한다.

**가정 2**: `key` prop을 통해 어떤 요소가 동일한지 힌트를 줄 수 있다.
리스트에서 key가 없으면 인덱스로 비교하고, key가 있으면 key로 동일성을 추적한다.

```jsx
// key 없음 — 앞에 삽입 시 모든 노드 업데이트
<ul>
  <li>홍길동</li>
  <li>김철수</li>
</ul>

// key 있음 — 삽입된 항목만 DOM에 추가
<ul>
  <li key="1">홍길동</li>
  <li key="2">김철수</li>
</ul>
```

## "Virtual DOM은 항상 빠르다"는 오해

Virtual DOM이 항상 Real DOM 직접 조작보다 빠른 것은 아니다. 오히려 Virtual DOM 비교 비용이 추가되므로, 간단한 UI에서는 Vanilla JS가 더 빠를 수 있다.

Virtual DOM의 진짜 가치는 다른 곳에 있다.

- **예측 가능성**: 상태(state)만 관리하면 UI는 자동으로 동기화된다. 수동 DOM 조작 버그가 없다
- **선언형 코드**: "어떻게 변경할지"가 아닌 "최종 상태가 어떠해야 하는지"만 명시한다
- **자동 최적화**: 어떤 DOM을 바꿔야 하는지 개발자가 직접 계산하지 않아도 된다
- **크로스 플랫폼**: 같은 컴포넌트 모델로 React Native 등 다른 렌더러를 사용할 수 있다

```jsx
// 선언형 — 상태에 따라 UI를 선언
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id} className={todo.done ? 'done' : ''}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
// todos가 바뀌면 React가 알아서 최소 DOM 변경
```

## React Fiber: 현대적 Virtual DOM 엔진

React 16부터 내부 구현이 Fiber 아키텍처로 재구성됐다. Fiber는 각 컴포넌트에 대한 작업 단위 객체로, Render 단계 작업을 중단하고 재개할 수 있게 한다. 이를 통해 우선순위 기반 스케줄링이 가능해졌고, `useTransition` 같은 동시성 기능의 기반이 됐다.

Virtual DOM의 개념은 그대로지만, 내부 구현이 더 정교해진 것이다.

---

**지난 글:** [함수형 컴포넌트 생명주기](/posts/react-component-lifecycle/)

**다음 글:** [재조정(Reconciliation) — Diffing 알고리즘](/posts/react-reconciliation/)

<br>
읽어주셔서 감사합니다. 😊
