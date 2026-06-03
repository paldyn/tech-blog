---
title: "재조정(Reconciliation) — React Diffing 알고리즘"
description: "React가 Virtual DOM 트리 변경을 어떻게 비교(diff)하는지, 타입이 같을 때와 다를 때의 처리 방식, React Fiber의 double buffering, 그리고 컴포넌트를 렌더 중에 정의하면 안 되는 이유를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["React", "Reconciliation", "재조정", "Diffing", "Fiber", "VirtualDOM", "성능"]
featured: false
draft: false
---

[지난 글](/posts/react-virtual-dom/)에서 Virtual DOM의 개념과 업데이트 흐름을 살펴봤다. 이번에는 그 핵심인 재조정(Reconciliation) 알고리즘을 더 깊이 파고든다. React가 이전 트리와 새 트리를 어떻게 비교하는지 이해하면, 성능 최적화와 버그 방지에 직접적으로 도움이 된다.

## 재조정이란

재조정은 Virtual DOM의 이전 트리와 새 트리를 비교해서 Real DOM에 적용할 최소 변경 집합을 계산하는 과정이다. 이론적으로 두 트리를 완벽히 비교하려면 O(n³) 알고리즘이 필요하지만, React는 두 가지 휴리스틱으로 O(n)으로 줄인다.

## 규칙 1: 타입이 다르면 전체 교체

트리의 같은 위치에서 엘리먼트 타입이 바뀌면 React는 이전 서브트리 전체를 언마운트하고 새 서브트리를 마운트한다.

```jsx
// 이전
<div>
  <Counter />
</div>

// 이후 — div가 section으로 바뀜
<section>
  <Counter />
</section>
// Counter는 언마운트됐다가 새로 마운트됨 → state 초기화!
```

컴포넌트 타입도 동일하다. `<Counter />`가 `<List />`로 바뀌면 Counter는 완전히 언마운트된다.

![재조정 — Diffing 알고리즘 규칙](/assets/posts/react-reconciliation-diffing.svg)

## 규칙 2: 같은 타입이면 props만 업데이트

같은 위치에서 타입이 동일하면 React는 기존 인스턴스를 유지하고 props만 변경한다. DOM 요소는 변경된 속성만 업데이트하고, 컴포넌트는 state를 유지하면서 새 props로 리렌더링된다.

```jsx
// className만 변경 — DOM 노드 유지
<div className="old" /> → <div className="new" />
// React: div.className = 'new' 만 실행

// 컴포넌트 — state 보존됨
<Counter step={1} /> → <Counter step={2} />
// Counter 언마운트 없이 리렌더, 내부 count state 유지
```

## 흔한 실수: 렌더 중에 컴포넌트 정의

재조정 규칙 1에서 중요한 실수가 파생된다. 컴포넌트를 다른 컴포넌트 함수 **안에서 정의**하면 매 렌더마다 새 컴포넌트 타입이 생성된다.

```jsx
// 잘못된 코드
function Parent() {
  // 매 렌더마다 새 함수 객체 → 새 타입
  function Child() {
    return <div>자식</div>;
  }

  return <Child />;
}
// 부모가 리렌더될 때마다 Child가 언마운트/마운트됨
// Child의 state는 항상 초기화됨, 포커스도 잃음
```

```jsx
// 올바른 코드 — 컴포넌트를 바깥에 정의
function Child() {
  return <div>자식</div>;
}

function Parent() {
  return <Child />;
}
// Child 타입이 항상 동일 → 기존 인스턴스 재사용
```

## React Fiber: 재조정 엔진

React 16부터 재조정 엔진이 Fiber 아키텍처로 재구현됐다. Fiber는 각 컴포넌트/엘리먼트에 대한 작업 단위(work unit) 객체다.

![React Fiber와 재조정 엔진](/assets/posts/react-reconciliation-fiber.svg)

Fiber의 핵심 특징은 **double buffering**이다. 현재 화면에 표시 중인 트리(`current`)와 작업 중인 트리(`workInProgress`) 두 개를 유지한다. 작업이 완료되면 두 포인터가 교환된다.

```javascript
// Fiber 노드의 핵심 필드 (단순화)
const fiber = {
  type: MyComponent,    // 컴포넌트 타입
  stateNode: domNode,   // 실제 DOM 노드
  child: firstChild,    // 첫 번째 자식
  sibling: nextSibling, // 다음 형제
  return: parentFiber,  // 부모
  memoizedState: hooksLinkedList, // 훅 상태 (링크드 리스트)
  alternate: workInProgress, // 반대편 버퍼
};
```

`memoizedState`에 저장된 훅 링크드 리스트가 바로 훅 규칙이 중요한 이유다. 훅을 조건문 안에서 호출하면 이 리스트의 순서가 어긋나서 state가 엉뚱한 값을 참조하게 된다.

## Concurrent Mode에서의 재조정

React 18의 Concurrent 기능에서는 Render 단계(재조정)가 중단되고 재개될 수 있다. 더 높은 우선순위의 작업이 생기면 현재 진행 중인 재조정을 잠시 멈추고 우선순위 작업을 처리한 뒤 재개한다.

```jsx
// startTransition으로 낮은 우선순위 표시
startTransition(() => {
  setSearchQuery(value); // 이 업데이트는 중단 가능
});

// 사용자 입력(높은 우선순위)은 즉시 처리
setInputValue(value);
```

이 덕분에 무거운 렌더링이 진행 중에도 사용자 입력이 끊기지 않고 반응한다.

## key의 역할 예고

리스트를 재조정할 때 `key`는 중요한 힌트다. key가 없으면 React는 위치(인덱스)로 같은 요소인지 판단한다. key가 있으면 값으로 추적한다. 리스트 앞에 항목을 추가하면 key 없이는 모든 항목을 업데이트하지만, key가 있으면 새 항목만 DOM에 추가한다. 이 내용은 다음 글에서 자세히 다룬다.

---

**지난 글:** [Virtual DOM — 개념과 작동 원리](/posts/react-virtual-dom/)

**다음 글:** [key와 재조정 — 리스트에서 key가 하는 일](/posts/react-key-reconciliation/)

<br>
읽어주셔서 감사합니다. 😊
