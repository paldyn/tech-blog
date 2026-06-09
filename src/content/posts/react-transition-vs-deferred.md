---
title: "useTransition vs useDeferredValue 비교"
description: "useTransition과 useDeferredValue의 차이를 관점·사용 위치·로딩 표시 방법으로 비교하고, 각 훅의 적합한 사용 케이스와 함께 사용하는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 10
type: "knowledge"
category: "React"
tags: ["React", "useTransition", "useDeferredValue", "동시성", "성능비교"]
featured: false
draft: false
---

[지난 글](/posts/react-usedeferredvalue/)에서 `useDeferredValue`를 살펴봤다. 이번에는 `useTransition`과 `useDeferredValue`를 **나란히 비교**해 언제 어떤 훅을 선택해야 하는지 정리한다.

## 같은 목표, 다른 관점

두 훅은 모두 "무거운 렌더링을 긴급하지 않은 것으로 처리해 UI 응답성을 개선"한다는 공통 목표가 있다. 차이는 **어디서 지연을 선언하는가**다.

![useTransition vs useDeferredValue 비교](/assets/posts/react-transition-vs-deferred-compare.svg)

- **useTransition**: 업데이트를 **시작하는** 쪽 (이벤트 핸들러)
- **useDeferredValue**: 값을 **소비하는** 쪽 (렌더링하는 컴포넌트)

## 코드로 비교

같은 기능(검색 입력 최적화)을 두 방식으로 구현하면:

### useTransition 방식

```tsx
function SearchWithTransition() {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value); // 즉각

    startTransition(() => {
      setSearchQuery(e.target.value); // 전환
    });
  }

  return (
    <>
      <input value={inputValue} onChange={handleChange} />
      {isPending && <Spinner />}
      <ResultList query={searchQuery} />
    </>
  );
}
```

두 개의 state가 필요하다. `isPending`으로 명시적인 로딩 표시가 가능하다.

### useDeferredValue 방식

```tsx
const ResultList = memo(function ResultList({ query }: { query: string }) {
  const results = useMemo(() => search(query), [query]);
  return <ul>{results.map((r) => <li key={r.id}>{r.name}</li>)}</ul>;
});

function SearchWithDeferred() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const isStale = query !== deferredQuery;

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.7 : 1 }}>
        <ResultList query={deferredQuery} />
      </div>
    </>
  );
}
```

state는 하나. `memo`가 필수. stale 감지는 두 값 비교로.

## 선택 가이드

![선택 가이드](/assets/posts/react-transition-vs-deferred-guide.svg)

### useTransition을 선택하는 경우

```tsx
// 탭 전환 — setState 직접 제어
function Tabs() {
  const [tab, setTab] = useState('home');
  const [isPending, startTransition] = useTransition();

  return (
    <nav>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => startTransition(() => setTab(t))}
          style={{ opacity: isPending ? 0.6 : 1 }}
        >
          {t}
        </button>
      ))}
      <Suspense fallback={<Loading />}>
        <TabContent tab={tab} />
      </Suspense>
    </nav>
  );
}
```

탭 버튼을 클릭할 때 `setTab`을 직접 호출하므로 `useTransition`이 적합하다. Suspense와 함께 쓰면 새 탭 콘텐츠가 준비될 때까지 이전 탭을 유지할 수 있다.

### useDeferredValue를 선택하는 경우

```tsx
// 입력 기반 필터 — 외부에서 받은 prop 지연
function FilteredTable({ data }: { data: Item[] }) {
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);

  const filtered = useMemo(
    () => data.filter((item) => item.name.includes(deferredFilter)),
    [data, deferredFilter]
  );

  return (
    <>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      <Table rows={filtered} />
    </>
  );
}
```

`filter` state의 owner가 이 컴포넌트지만, `data`는 외부에서 온다. `useDeferredValue`로 필터링 연산을 후순위로 처리한다.

## 함께 사용하는 경우

드물지만 두 훅을 함께 쓸 수도 있다:

```tsx
function Parent() {
  const [tab, setTab] = useState('a');
  const [isPending, startTransition] = useTransition();

  return (
    <Child
      tab={tab}
      onSwitch={() => startTransition(() => setTab('b'))}
    />
  );
}

function Child({ tab, onSwitch }: { tab: string; onSwitch: () => void }) {
  // 부모의 startTransition + 자식의 useDeferredValue 이중 지연
  const deferredTab = useDeferredValue(tab);

  return (
    <>
      <button onClick={onSwitch}>전환</button>
      <HeavyContent tab={deferredTab} />
    </>
  );
}
```

부모에서 `useTransition`으로 전환을 시작하고, 자식에서 `useDeferredValue`로 추가 지연을 적용한다. 매우 무거운 렌더링에서 단계적으로 지연을 걸 때 사용할 수 있다.

## 공통 함정

```tsx
// ❌ memo 없이 useDeferredValue — 효과 없음
function SearchBad() {
  const [q, setQ] = useState('');
  const deferred = useDeferredValue(q);

  // memo 없는 컴포넌트: deferred가 바뀌지 않아도 부모 리렌더로 함께 렌더됨
  return <SlowListNoMemo query={deferred} />;
}

// ✓ memo + useDeferredValue
const SlowList = memo(({ query }: { query: string }) => { ... });
```

```tsx
// ❌ transition 안에서 input value 업데이트
startTransition(() => {
  setInputValue(e.target.value); // input은 긴급 — 전환으로 감싸면 지연됨
});

// ✓ input은 밖에서, 검색 결과는 안에서
setInputValue(e.target.value);
startTransition(() => setSearchQuery(e.target.value));
```

## 요약

| | useTransition | useDeferredValue |
|---|---|---|
| 위치 | 이벤트 핸들러 | 컴포넌트 상단 |
| 필요 state | 2개 (input + query) | 1개 |
| 로딩 표시 | isPending | value !== deferred |
| memo 필요 | 선택 | 필수 |
| Suspense 연동 | 이전 UI 유지 | 이전 값 유지 |
| 주요 use case | 탭 전환, 페이지 이동 | 검색 필터, 정렬 |

---

**지난 글:** [useDeferredValue로 후순위 업데이트 분리](/posts/react-usedeferredvalue/)

<br>
읽어주셔서 감사합니다. 😊
