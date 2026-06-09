---
title: "동시성(Concurrent) 기능 개요"
description: "React 18 동시성 렌더링의 개념, createRoot로 활성화하는 방법, startTransition·useDeferredValue·Suspense의 역할과 사용 원칙을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 7
type: "knowledge"
category: "React"
tags: ["React", "동시성", "Concurrent", "createRoot", "startTransition", "React18"]
featured: false
draft: false
---

[지난 글](/posts/react-lazy-loading/)에서 코드 스플리팅을 살펴봤다. 이번에는 React 18의 가장 큰 변화인 **동시성(Concurrent) 기능**을 다룬다. 이 기능들은 앱의 응답성을 크게 향상시키지만, 올바르게 이해하지 않으면 예상치 못한 동작을 유발할 수 있다.

## 동시성 렌더링이란?

React 17까지는 렌더링이 **동기적이었다**. 한번 렌더링이 시작되면 완료될 때까지 메인 스레드를 점유했다. 무거운 컴포넌트를 렌더링하는 동안 사용자 입력이 들어와도 처리가 지연됐다(jank).

React 18의 동시성 모드에서는 렌더링을 **중단(interrupt)하고 재개(resume)**할 수 있다. 더 중요한(긴급한) 작업이 생기면 현재 렌더링을 잠깐 멈추고 그것을 먼저 처리한다.

![동기 vs 동시성 렌더링](/assets/posts/react-concurrent-features-model.svg)

## 동시성 활성화: createRoot

React 18에서 동시성 기능을 사용하려면 `createRoot`로 앱을 마운트해야 한다:

```tsx
// React 17 (legacy)
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));

// React 18 (concurrent)
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

`createRoot`를 쓰지 않으면 `useTransition`을 임포트해도 동시성 스케줄링이 적용되지 않는다.

## 우선순위: 긴급 vs 전환

동시성의 핵심은 **렌더링에 우선순위**를 부여하는 것이다.

| 종류 | 예시 | 특성 |
|------|------|------|
| 긴급(Urgent) | 타이핑, 클릭, 스크롤 | 즉각 반응 필요 — 지연 시 UX 파탄 |
| 전환(Transition) | 탭 전환, 검색 결과, 페이지 이동 | 약간의 지연 허용 |

`startTransition`으로 감싼 업데이트는 "전환"으로 표시되어, 더 긴급한 업데이트가 있으면 뒤로 밀린다.

## startTransition

![startTransition과 isPending](/assets/posts/react-concurrent-features-scheduler.svg)

```tsx
import { startTransition } from 'react';

function handleSearch(query: string) {
  // 즉각적인 업데이트 (긴급)
  setInputValue(query);

  // 후순위 업데이트 (전환)
  startTransition(() => {
    setSearchResults(computeResults(query));
  });
}
```

`setInputValue`는 즉시 반영돼 input이 끊김 없이 동작하고, `setSearchResults`는 결과 목록 렌더링이 오래 걸려도 input을 블로킹하지 않는다.

### useTransition 훅

컴포넌트 안에서 `isPending` 상태와 함께 사용하려면 `useTransition`을 쓴다:

```tsx
import { useTransition } from 'react';

function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value); // 긴급

    startTransition(() => {
      setResults(search(e.target.value)); // 전환
    });
  }

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending && <span>검색 중...</span>}
      <ResultList results={results} />
    </div>
  );
}
```

`isPending`은 전환이 진행 중일 때 `true`가 되어 로딩 인디케이터를 표시할 수 있다.

## useDeferredValue

`useTransition`이 "업데이트를 전환으로 시작하는 것"이라면, `useDeferredValue`는 "이미 존재하는 값의 업데이트를 지연"하는 것이다.

```tsx
import { useDeferredValue, memo } from 'react';

const SlowList = memo(({ items }: { items: Item[] }) => {
  // 인위적으로 느린 렌더링
  return <ul>{items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>;
});

function SearchPage() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const items = useMemo(() => search(deferredQuery), [deferredQuery]);

  const isStale = query !== deferredQuery;

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.7 : 1 }}>
        <SlowList items={items} />
      </div>
    </div>
  );
}
```

`deferredQuery`는 `query`보다 약간 뒤처진 값이다. `SlowList`는 `deferredQuery` 기준으로 렌더링되므로, 타이핑 중에도 input이 즉각 반응한다.

## 동시성 기능 선택 가이드

```
내 컴포넌트에서 setState를 직접 제어할 수 있다면
  → useTransition + startTransition

외부에서 prop으로 받은 값의 렌더링을 지연하고 싶다면
  → useDeferredValue

비동기 로딩 상태를 선언적으로 처리하고 싶다면
  → Suspense
```

## 주의사항

동시성 모드에서는 컴포넌트 함수가 **여러 번 호출될 수 있다**. React는 렌더링을 준비하다가 더 중요한 업데이트로 인해 이전 렌더를 버리고 다시 시작할 수 있기 때문이다.

```tsx
// ⚠ side effect를 렌더 함수 본체에서 실행하면 안 됨
function Component() {
  logToServer(); // 동시성 모드에서 여러 번 호출될 수 있음!
  return <div />;
}

// ✓ useEffect 안에서만
function Component() {
  useEffect(() => {
    logToServer(); // 마운트 시 한 번만
  }, []);
  return <div />;
}
```

이것이 React Strict Mode에서 렌더 함수를 두 번 호출하는 이유다 — 동시성 모드에서 발생할 수 있는 문제를 미리 드러낸다.

---

**지난 글:** [React.lazy와 코드 스플리팅](/posts/react-lazy-loading/)

**다음 글:** [useTransition으로 UI 응답성 개선](/posts/react-usetransition/)

<br>
읽어주셔서 감사합니다. 😊
