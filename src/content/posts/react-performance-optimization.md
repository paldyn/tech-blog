---
title: "React 성능 최적화 종합 가이드"
description: "React 앱 성능 최적화의 전체 그림을 그립니다. 리렌더 제거부터 코드 분할, 가상화, Concurrent 기능까지 각 기법의 적용 타이밍과 우선순위를 실전 관점에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["React성능최적화", "코드분할", "Lazy로딩", "useMemo", "useCallback"]
featured: false
draft: false
---

[지난 글](/posts/react-react-memo/)에서 `React.memo`로 컴포넌트 리렌더를 건너뛰는 방법을 배웠다. 이번 글에서는 리렌더 외에도 **초기 로딩 성능, 계산 비용, 렌더 스케줄링**까지 아우르는 성능 최적화 전체 그림을 그린다.

## 황금 규칙: 먼저 측정하라

```
측정 없는 최적화 = 추측
```

React DevTools Profiler, Chrome Performance 탭, Lighthouse를 먼저 사용해 **실제 병목을 확인**한 뒤 최적화를 적용한다. 체감이 없는 컴포넌트에 `memo`와 `useCallback`을 남발하면 코드 복잡도만 올라가고 오히려 느려질 수 있다.

![성능 최적화 체크리스트](/assets/posts/react-performance-optimization-checklist.svg)

## 1. 불필요한 리렌더 제거

가장 먼저 다룰 영역이다. Profiler에서 필요 없이 자주 리렌더되는 컴포넌트를 찾아 다음 도구를 적용한다.

```tsx
// React.memo — props가 동일하면 컴포넌트 스킵
const ProductCard = memo(function ProductCard({ product }: ProductCardProps) {
  return <div>{product.name}</div>;
});

// useCallback — 콜백 참조 안정화
const handleDelete = useCallback((id: number) => {
  dispatch({ type: 'DELETE', payload: id });
}, [dispatch]);

// useMemo — 비싼 계산 캐싱
const sortedProducts = useMemo(
  () => [...products].sort((a, b) => a.price - b.price),
  [products],
);
```

**적용 우선순위**: 계산이 무거운 컴포넌트, 자주 리렌더되는 리스트 아이템, 부모 렌더와 무관한 사이드바·헤더.

## 2. 상태 관리 최적화

상태를 올바른 위치에 두는 것만으로도 많은 리렌더를 막을 수 있다.

```tsx
// ❌ 전역에 둬서 무관한 컴포넌트가 리렌더됨
function App() {
  const [inputValue, setInputValue] = useState('');  // 검색창 상태
  return (
    <>
      <SearchInput value={inputValue} onChange={setInputValue} />
      <ExpensiveDashboard />  {/* inputValue 바뀔 때마다 리렌더 */}
    </>
  );
}

// ✓ 상태를 필요한 컴포넌트 안으로 내림(colocation)
function SearchInput() {
  const [inputValue, setInputValue] = useState('');  // 여기서 관리
  return <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} />;
}
```

**State Colocation**: 상태를 실제로 필요한 컴포넌트 트리에서 가장 낮은 곳에 두면 리렌더 범위가 최소화된다.

## 3. 코드 분할 · 지연 로딩

초기 번들 크기를 줄여 첫 화면 로딩 속도를 개선한다.

```tsx
import { lazy, Suspense } from 'react';

// 라우트별 코드 분할 — React Router와 조합
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

```tsx
// 무거운 컴포넌트 지연 로딩
const HeavyChartLibrary = lazy(() =>
  import('./components/Chart').then((module) => ({
    default: module.AreaChart,
  })),
);
```

각 라우트를 별도 청크로 분할하면 초기 번들이 크게 줄어 FCP(First Contentful Paint)가 개선된다.

## 4. 렌더링 부담 줄이기 — 가상화

수천 개 아이템을 가진 목록은 **react-window**나 **@tanstack/virtual**로 뷰포트에 보이는 항목만 렌더링한다.

```tsx
import { FixedSizeList } from 'react-window';

function VirtualList({ items }: { items: Item[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ItemCard item={items[index]} />
    </div>
  );

  return (
    <FixedSizeList height={600} itemCount={items.length} itemSize={80} width="100%">
      {Row}
    </FixedSizeList>
  );
}
```

1만 개 아이템도 DOM에는 ~10개만 존재해 메모리·레이아웃 비용이 고정된다.

## 5. Concurrent 기능으로 인터랙션 부드럽게

React 18의 `useTransition`과 `useDeferredValue`로 긴급 업데이트와 비긴급 업데이트를 분리한다.

```tsx
import { useState, useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);  // 긴급: 입력창 즉시 업데이트

    startTransition(() => {
      // 비긴급: 검색 결과는 나중에 업데이트
      setResults(expensiveSearch(e.target.value));
    });
  };

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}
      <ResultList results={results} />
    </>
  );
}
```

![성능 최적화 도구 비교](/assets/posts/react-performance-optimization-tools.svg)

## 최적화 우선순위 결론

```
1. 상태를 올바른 위치에 (colocation)
2. 코드 분할로 초기 번들 축소
3. 가상화로 긴 목록 처리
4. Profiler 측정 → memo/useCallback/useMemo 선택 적용
5. useTransition으로 인터랙션 부드럽게
```

성능 최적화는 코드 복잡도를 높이는 트레이드오프를 수반한다. 실측 데이터 없이 "느릴 것 같다"는 예상만으로 최적화를 미리 적용하지 말자. 다음 글에서는 실측 도구인 **React DevTools Profiler**를 본격적으로 활용하는 방법을 다룬다.

---

**지난 글:** [React.memo — 컴포넌트 메모이제이션 완전 정복](/posts/react-react-memo/)

**다음 글:** [React DevTools Profiler 활용법](/posts/react-devtools-profiler/)

<br>
읽어주셔서 감사합니다. 😊
