---
title: "React.memo — 컴포넌트 메모이제이션 완전 정복"
description: "React.memo의 동작 원리, props 비교 방식, useCallback·useMemo와의 조합, 그리고 잘못 사용했을 때의 함정까지 실전 예제로 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["ReactMemo", "메모이제이션", "성능최적화", "useCallback", "useMemo"]
featured: false
draft: false
---

[지난 글](/posts/react-context-reducer-architecture/)에서 Context와 useReducer를 결합한 아키텍처를 살펴봤다. 이제 컴포넌트 수준에서 불필요한 리렌더를 막는 핵심 도구, **`React.memo`**를 파고든다.

## React.memo란?

`React.memo`는 컴포넌트를 감싸 **props가 이전과 같으면 리렌더를 건너뛰게** 만드는 고차 컴포넌트(HOC)다.

```tsx
import { memo } from 'react';

const ExpensiveChart = memo(function Chart({ data, title }: ChartProps) {
  // 데이터 시각화 등 무거운 렌더링
  return (
    <div>
      <h2>{title}</h2>
      <canvas>{/* 차트 */}</canvas>
    </div>
  );
});
```

부모가 리렌더될 때 `data`와 `title`이 이전과 **얕은 비교(===)** 로 같으면 `Chart`는 리렌더를 건너뛴다.

![React.memo 동작 원리](/assets/posts/react-react-memo-concept.svg)

## 얕은 비교의 의미

`React.memo`는 기본적으로 **각 prop에 대해 `Object.is`** 를 사용한다.

```tsx
// 원시값: 값이 같으면 동일
{ count: 42 } === { count: 42 }  // ✓ (number)

// 객체: 참조가 달라도 내용이 같으면 다르다고 판단
{ items: [] } !== { items: [] }  // ✗ (새 배열 참조)
```

따라서 **객체나 함수 prop이 있으면 반드시 `useMemo` / `useCallback`으로 참조를 안정화**해야 한다.

```tsx
// ❌ 매 렌더마다 새 객체 → memo 효과 없음
<ExpensiveChart data={{ values: [1, 2, 3] }} />

// ✓ useMemo로 안정화
const chartData = useMemo(() => ({ values: rawValues }), [rawValues]);
<ExpensiveChart data={chartData} />
```

## 콜백 prop과 useCallback

콜백을 prop으로 내릴 때 `useCallback`이 없으면 memo가 무용지물이 된다.

```tsx
// ❌ 부모가 리렌더될 때마다 새 함수 참조
function Parent() {
  const handleRemove = (id: number) => removeItem(id); // 매번 새 참조
  return <MemoChild onRemove={handleRemove} />;
}

// ✓ useCallback으로 참조 안정화
function Parent() {
  const handleRemove = useCallback((id: number) => removeItem(id), []);
  return <MemoChild onRemove={handleRemove} />;
}
```

![memo와 함께 쓰는 도구들](/assets/posts/react-react-memo-comparison.svg)

## 커스텀 비교 함수

기본 얕은 비교가 충분하지 않을 때 두 번째 인자로 비교 함수를 제공한다.

```tsx
const MemoizedList = memo(
  function ItemList({ items }: { items: Item[] }) {
    return (
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    );
  },
  // arePropsEqual: true를 반환하면 리렌더 건너뜀
  (prevProps, nextProps) =>
    prevProps.items.length === nextProps.items.length &&
    prevProps.items.every((item, i) => item.id === nextProps.items[i].id),
);
```

이 방법은 강력하지만, 비교 로직이 복잡해지면 버그 원인이 되기도 한다. 가급적 기본 얕은 비교가 작동하도록 props 구조를 단순하게 유지하는 것이 낫다.

## 언제 memo를 쓸까? (그리고 언제 쓰지 말까?)

### 쓰면 좋은 경우

- 렌더 비용이 실제로 큰 컴포넌트 (차트, 표, 복잡한 형태)
- 부모가 자주 리렌더되지만 해당 컴포넌트의 props는 잘 바뀌지 않는 경우
- `React.memo` + `useCallback`/`useMemo` 세트로 props 안정성이 보장될 때

### 쓰지 않는 게 나은 경우

```tsx
// 단순한 컴포넌트 — 비교 비용 > 렌더 비용
const Label = memo(({ text }: { text: string }) => <span>{text}</span>);
// → memo 없이 쓰는 게 더 빠를 수 있음

// props가 항상 바뀌는 컴포넌트 — 비교만 낭비
const LiveClock = memo(({ time }: { time: Date }) => <time>{time.toISOString()}</time>);
// → 매 초 time이 바뀌면 비교 후 결국 리렌더
```

**측정 없이 memo를 남발하면 오히려 성능이 나빠질 수 있다.** React DevTools Profiler로 실제로 느린 컴포넌트를 확인한 뒤 적용하는 것이 올바른 순서다.

## 흔한 실수 모음

```tsx
// ❌ 인라인 객체 prop
<MemoComp style={{ color: 'red' }} />   // 매번 새 객체

// ❌ 인라인 함수 prop
<MemoComp onClick={() => doSomething()} />  // 매번 새 함수

// ❌ children을 JSX로 전달
<MemoComp>
  <div>자식</div>  // JSX는 매번 새 ReactElement 객체
</MemoComp>

// ✓ 위 셋 모두 useMemo / useCallback / 안정된 참조로 해결
```

`children`을 JSX로 전달하는 경우는 특히 간과하기 쉽다. `children`을 받는 컴포넌트는 `memo`를 붙여도 부모가 리렌더될 때마다 `children` 참조가 새로 생성되어 리렌더가 방지되지 않는다.

---

**지난 글:** [Context + useReducer 아키텍처 — 상태와 액션 분리](/posts/react-context-reducer-architecture/)

**다음 글:** [React 성능 최적화 종합 가이드](/posts/react-performance-optimization/)

<br>
읽어주셔서 감사합니다. 😊
