---
title: "useTransition으로 UI 응답성 개선"
description: "useTransition의 startTransition과 isPending을 활용해 무거운 렌더링 중에도 입력이 즉각 반응하도록 하는 방법, Suspense와의 조합 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["React", "useTransition", "startTransition", "동시성", "isPending", "응답성"]
featured: false
draft: false
---

[지난 글](/posts/react-concurrent-features/)에서 동시성 기능의 전체 그림을 살펴봤다. 이번에는 그 중 핵심인 **useTransition**을 깊이 파고든다.

## 문제: 무거운 렌더링이 입력을 블로킹

검색창에 타이핑하면서 즉각 결과를 필터링하는 UI를 만든다고 하자:

```tsx
function SearchBox() {
  const [query, setQuery] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    // query가 바뀔 때마다 1000개 아이템 리렌더링...
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      <BigList query={query} /> {/* 렌더 100ms 소요 */}
    </>
  );
}
```

`BigList`가 렌더링에 100ms가 걸린다면, 타이핑할 때마다 입력이 100ms씩 지연된다. 사용자가 빠르게 입력하면 input 자체가 버벅인다.

## useTransition으로 해결

![useTransition 동작 흐름](/assets/posts/react-usetransition-flow.svg)

```tsx
import { useState, useTransition, memo } from 'react';

const BigList = memo(function BigList({ query }: { query: string }) {
  // 무거운 렌더링 로직...
  return <ul>{/* 1000개 아이템 */}</ul>;
});

function SearchBox() {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // 1. 입력값은 즉시 업데이트 (긴급)
    setInputValue(e.target.value);

    // 2. 검색 쿼리는 전환으로 (후순위)
    startTransition(() => {
      setSearchQuery(e.target.value);
    });
  }

  return (
    <>
      <input value={inputValue} onChange={handleChange} />
      {isPending && <span className="searching">검색 중...</span>}
      <BigList query={searchQuery} />
    </>
  );
}
```

`inputValue`는 즉시 반영되어 input이 끊김 없이 동작한다. `searchQuery`는 전환으로 처리되어, React가 다른 더 긴급한 업데이트(추가 타이핑)가 없을 때 `BigList`를 렌더링한다.

## Suspense와 함께 사용

![useTransition과 Suspense 조합](/assets/posts/react-usetransition-suspense.svg)

`startTransition` 안에서 발생하는 state 변경이 Suspense를 트리거할 때, React는 fallback을 즉시 보여주지 않고 이전 UI를 유지한다. 이것이 `transition + Suspense`의 가장 강력한 조합이다.

```tsx
const LazyPost = lazy(() => import('./PostPage'));

function App() {
  const [page, setPage] = useState('home');
  const [isPending, startTransition] = useTransition();

  return (
    <Suspense fallback={<PageLoader />}>
      <nav>
        <button
          onClick={() => startTransition(() => setPage('post'))}
          aria-busy={isPending}
        >
          글 보기
        </button>
      </nav>
      {/* page === 'post'일 때 Suspense 발생 */}
      {page === 'post' && <LazyPost />}
    </Suspense>
  );
}
```

`startTransition` 없이 `setPage('post')`를 호출하면 `LazyPost`가 로드되는 동안 즉시 `<PageLoader />`가 표시된다(깜빡임). `startTransition`으로 감싸면 현재 페이지를 유지하다가 `LazyPost`가 준비되면 한 번에 교체한다.

## isPending으로 시각적 피드백

전환 중임을 사용자에게 알리는 방법:

```tsx
function TabButton({
  tab,
  currentTab,
  onClick,
}: {
  tab: string;
  currentTab: string;
  onClick: (tab: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={tab === currentTab ? 'active' : ''}
      onClick={() => startTransition(() => onClick(tab))}
      style={{
        opacity: isPending ? 0.7 : 1,
        cursor: isPending ? 'wait' : 'pointer',
      }}
    >
      {tab}
      {isPending && <Spinner size="small" />}
    </button>
  );
}
```

각 버튼이 독립적인 `useTransition`을 가지면 어떤 탭이 로딩 중인지 표시할 수 있다.

## 서버 액션과 useTransition

React 19와 Next.js App Router에서 서버 액션도 `startTransition`으로 래핑할 수 있다:

```tsx
'use client';
import { useTransition } from 'react';

function LikeButton({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          await likePost(postId); // 서버 액션
        });
      }}
      disabled={isPending}
    >
      {isPending ? '처리 중...' : '좋아요'}
    </button>
  );
}
```

`startTransition`에 비동기 함수를 전달하면 프로미스가 완료될 때까지 `isPending`이 유지된다.

## useTransition 제약사항

```
✗ transition 안에서 제어 컴포넌트의 input value 업데이트 금지
  → input은 즉각 업데이트 필요, transition으로 감싸면 지연됨

✗ transition 안에서 외부 상태(store) 직접 변경 시 inconsistency 가능

✓ setState만 transition에 — side effect는 transition 밖에서
```

## 언제 useTransition을 쓸까?

- 클릭/키보드 입력에 반응해 **무거운 재렌더링**이 발생할 때
- **탭 전환, 페이지 이동** 등 현재 UI를 유지하고 싶은 경우
- **Suspense 경계를 가진 lazy 컴포넌트** 전환 시
- 서버 액션의 **낙관적 업데이트** 패턴과 함께

---

**지난 글:** [동시성(Concurrent) 기능 개요](/posts/react-concurrent-features/)

**다음 글:** [useDeferredValue로 후순위 업데이트 분리](/posts/react-usedeferredvalue/)

<br>
읽어주셔서 감사합니다. 😊
