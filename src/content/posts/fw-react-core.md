---
title: "React 핵심 원리 — Virtual DOM, Fiber, Reconciliation"
description: "React의 Virtual DOM 개념, Fiber 아키텍처의 Render/Commit 단계, Reconciliation diff 알고리즘, Hook 연결 리스트 구조, useEffect 실행 타이밍, React 18 Concurrent 기능을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "React", "Fiber", "VirtualDOM", "Reconciliation", "Hooks", "Concurrent", "렌더링"]
featured: false
draft: false
---

[지난 글](/posts/fw-spa-mpa-mfe/)에서 SPA, MPA, MFE 아키텍처를 비교했습니다. 이번에는 **React의 핵심 내부 동작**, 즉 Virtual DOM이 실제로 어떻게 작동하고, Fiber 아키텍처가 왜 등장했으며, 렌더링이 어떤 단계를 거치는지 살펴봅니다. 이 원리를 이해하면 성능 최적화와 Hook 규칙의 이유를 자연스럽게 납득할 수 있습니다.

---

## Virtual DOM이란

**Virtual DOM**은 실제 DOM을 추상화한 JavaScript 객체 트리입니다. `<div className="box">Hello</div>` 같은 JSX는 `React.createElement('div', { className: 'box' }, 'Hello')` 호출로 컴파일되어 객체를 생성합니다. React는 상태가 바뀌면 새 Virtual DOM 트리를 만들고, 이전 트리와 **비교(Diff)**해서 달라진 부분만 실제 DOM에 반영합니다.

이를 통해 DOM 조작을 최소화합니다. DOM 조작은 레이아웃 재계산을 유발하기 때문에 빈번한 조작이 성능 문제를 일으킵니다.

---

## Fiber 아키텍처

React 16에서 내부 엔진을 **Fiber**로 전면 재작성했습니다. 이전 Stack Reconciler는 재귀 호출로 전체 트리를 단번에 처리했기 때문에 오래 걸리는 업데이트가 메인 스레드를 블록했습니다. Fiber는 작업을 작은 단위(**Fiber 노드**)로 나눠 우선순위에 따라 중단·재개할 수 있습니다.

![React Fiber — 렌더링 파이프라인](/assets/posts/fw-react-core-fiber.svg)

### Render Phase (중단 가능)

`beginWork` → 각 컴포넌트 함수 실행 → 새 Fiber 트리 구축 → `completeWork` → Effects 수집. 이 단계는 **비동기**로 실행될 수 있어서, 브라우저의 유휴 시간(idle time)을 활용하거나 더 급한 업데이트가 오면 현재 작업을 버리고 재시작합니다.

### Commit Phase (중단 불가)

수집된 DOM 변경 사항을 **동기적**으로 적용합니다. 세 서브 단계로 나뉩니다.
1. `before mutation`: `getSnapshotBeforeUpdate` 호출
2. `mutation`: 실제 DOM 삽입·삭제·수정
3. `layout`: `useLayoutEffect` 실행 (동기, 페인트 전)

`useEffect`는 Commit Phase가 끝난 후 브라우저 페인트 이후에 비동기로 실행됩니다.

---

## Reconciliation — Diff 알고리즘

React의 Diff는 O(n³) 일반 알고리즘 대신 두 가지 가정으로 O(n)을 달성합니다.

1. **다른 타입 = 다른 트리**: `<div>` → `<span>` 변경 시 이전 서브트리를 완전히 제거하고 새로 만든다.
2. **key로 안정적 식별**: 리스트 항목에 안정적인 `key`가 있으면 이동·삽입·삭제만 처리한다.

```jsx
// key가 없으면 인덱스 기반 비교 → 버그
{items.map((item, i) => <Item key={i} data={item} />)}

// key는 항목의 고유 식별자여야 함
{items.map(item => <Item key={item.id} data={item} />)}
```

`key`로 인덱스를 쓰면 항목이 추가·삭제·재정렬될 때 React가 이전 컴포넌트 상태를 잘못된 항목에 연결합니다.

---

## Hooks 내부 구조

![React Hooks 메커니즘](/assets/posts/fw-react-core-hooks.svg)

Fiber 노드마다 **Hook 연결 리스트**가 있습니다. 컴포넌트가 처음 실행될 때 각 `useState`, `useEffect`, `useMemo` 호출이 이 리스트에 순서대로 노드를 추가합니다. 다음 렌더링 때는 같은 순서로 노드를 꺼내서 이전 값과 비교합니다.

이것이 바로 **"Hook은 항상 같은 순서로 호출해야 한다"**는 규칙의 이유입니다. 조건문 안에서 Hook을 호출하면 순서가 바뀌어 `Hook[n]`이 다른 상태 슬롯을 가리킵니다.

---

## useEffect vs useLayoutEffect

```javascript
// useEffect: 페인트 후 비동기 실행 (99% 케이스)
useEffect(() => {
  // 비동기 API 호출, 이벤트 리스너 등록
  const id = setInterval(() => setCount(c => c + 1), 1000)
  return () => clearInterval(id)  // cleanup
}, [])

// useLayoutEffect: 페인트 전 동기 실행 (DOM 측정이 필요할 때)
useLayoutEffect(() => {
  const height = ref.current.getBoundingClientRect().height
  setHeight(height)  // 깜빡임 없이 레이아웃 조정
}, [])
```

`useLayoutEffect`는 서버 사이드 렌더링 환경에서 경고를 냅니다 (`useEffect`로 대체 필요).

---

## React 18 Concurrent 기능

### startTransition / useTransition

긴급하지 않은 업데이트(검색 결과 필터링 등)를 낮은 우선순위로 표시합니다.

```jsx
const [isPending, startTransition] = useTransition()

function handleChange(e) {
  setInput(e.target.value)  // 즉시 업데이트 (높은 우선순위)
  startTransition(() => {
    setFilteredList(filter(e.target.value))  // 낮은 우선순위
  })
}
```

### useDeferredValue

값 자체를 지연합니다. 외부 라이브러리와 함께 사용할 때 유용합니다.

```jsx
const deferredQuery = useDeferredValue(query)
const results = useMemo(() => filterData(deferredQuery), [deferredQuery])
```

### Suspense + Streaming SSR

React 18에서 `Suspense`는 클라이언트뿐 아니라 **서버에서도** 작동합니다. `renderToPipeableStream`으로 준비된 컴포넌트부터 순서대로 HTML을 스트리밍합니다.

```jsx
<Suspense fallback={<LoadingSkeleton />}>
  <SlowDataComponent />  {/* 데이터 준비 후 스트리밍 */}
</Suspense>
```

---

## 성능 최적화 핵심 3가지

```jsx
// 1. React.memo — props가 같으면 리렌더 건너뜀
const MemoizedItem = React.memo(function Item({ data }) {
  return <div>{data.name}</div>
})

// 2. useMemo — 계산 결과 메모이제이션
const sortedList = useMemo(
  () => [...list].sort((a, b) => a.name.localeCompare(b.name)),
  [list]
)

// 3. useCallback — 함수 참조 안정화 (자식 컴포넌트 리렌더 방지)
const handleClick = useCallback(
  (id) => dispatch({ type: 'DELETE', id }),
  [dispatch]
)
```

---

**지난 글:** [SPA vs MPA vs MFE — 프론트엔드 아키텍처 선택](/posts/fw-spa-mpa-mfe/)

**다음 글:** [Vue 3 핵심 — Composition API, Reactivity, Virtual DOM](/posts/fw-vue-core/)

<br>
읽어주셔서 감사합니다. 😊
