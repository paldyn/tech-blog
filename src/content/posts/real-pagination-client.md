---
title: "페이지네이션 클라이언트 — 커서·오프셋·무한 스크롤 구현"
description: "오프셋·커서 기반 페이지네이션의 장단점을 비교하고, React 훅으로 커서 페이지네이션을 구현하고, IntersectionObserver로 무한 스크롤을 구축하는 방법을 실용 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "페이지네이션", "무한스크롤", "커서", "IntersectionObserver", "React", "실전", "UX"]
featured: false
draft: false
---

[지난 글](/posts/real-token-storage/)에서 인증 토큰을 안전하게 저장하는 방법을 살펴봤습니다. 이번에는 **페이지네이션**입니다. 대량의 데이터를 클라이언트에 어떻게 나눠서 보여줄지—오프셋·커서 방식의 차이, React 훅으로 구현하는 커서 페이지네이션, `IntersectionObserver`로 구현하는 무한 스크롤을 다룹니다.

![페이지네이션 방식 비교](/assets/posts/real-pagination-client-types.svg)

## 오프셋 vs 커서 페이지네이션

### 오프셋 방식

```javascript
// ?page=3&limit=20 → OFFSET 40 LIMIT 20
const res = await fetch(`/api/posts?page=${page}&limit=20`);
const { data, total } = await res.json();
const totalPages = Math.ceil(total / 20);
```

**문제**: 목록이 실시간으로 변하는 환경에서 새 글이 추가되면 OFFSET이 밀려 같은 글이 두 번 나오거나(중복) 건너뜁니다(누락). 또한 `OFFSET 100000`처럼 큰 값은 DB가 100000개를 읽고 버려야 하므로 느립니다.

### 커서 방식

```javascript
// ?after=cursor_xyz&limit=20 → WHERE id > 'cursor_xyz' LIMIT 20
const res = await fetch(`/api/posts?after=${cursor}&limit=20`);
const { data, nextCursor, hasMore } = await res.json();
```

커서(보통 마지막 항목의 `id` 또는 인코딩된 값)를 사용해 항상 특정 위치 이후의 데이터를 가져옵니다. 데이터가 추가·삭제되어도 현재 커서 위치 이후 데이터를 안정적으로 가져옵니다.

서버 응답 구조:

```json
{
  "data": [...],
  "nextCursor": "eyJpZCI6MTAwfQ==",
  "hasMore": true,
  "count": 20
}
```

`nextCursor`가 `null`이면 마지막 페이지입니다.

---

## 커서 페이지네이션 클라이언트 훅

![커서 페이지네이션 + 무한 스크롤 구현](/assets/posts/real-pagination-client-code.svg)

```javascript
import { useState, useCallback } from 'react';

function useCursorPagination(fetcher) {
  const [pages,   setPages]   = useState([]);
  const [cursor,  setCursor]  = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetcher({ cursor, limit: 20 });
      setPages(prev => [...prev, res.data]);
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading, fetcher]);

  const reset = useCallback(() => {
    setPages([]);
    setCursor(null);
    setHasMore(true);
    setError(null);
  }, []);

  // pages를 평탄화
  const items = pages.flat();

  return { items, loadMore, hasMore, loading, error, reset };
}
```

---

## 무한 스크롤 — IntersectionObserver

스크롤 이벤트 대신 `IntersectionObserver`를 사용합니다. throttle 없이도 viewport 진입만 감지하므로 성능이 좋습니다.

```javascript
import { useEffect, useRef } from 'react';

function useInfiniteScroll(callback, options = {}) {
  const { rootMargin = '200px', disabled = false } = options;
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (disabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) callback();
      },
      { rootMargin }
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);

    return () => observer.disconnect();
  }, [callback, rootMargin, disabled]);

  return sentinelRef;
}
```

### 조합해서 컴포넌트 만들기

```javascript
import { useCallback } from 'react';

async function fetchPosts({ cursor, limit }) {
  const params = new URLSearchParams({ limit });
  if (cursor) params.set('after', cursor);
  const res = await fetch(`/api/posts?${params}`);
  return res.json();
}

function PostList() {
  const { items, loadMore, hasMore, loading, error } = useCursorPagination(
    useCallback(fetchPosts, [])
  );

  const sentinelRef = useInfiniteScroll(loadMore, { disabled: !hasMore || loading });

  // 마운트 시 첫 페이지 로드
  useEffect(() => { loadMore(); }, []);

  return (
    <div>
      {items.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}

      {loading && <div>로딩 중...</div>}
      {error   && <button onClick={loadMore}>다시 시도</button>}

      {/* sentinel: 화면에 들어오면 loadMore 호출 */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {!hasMore && <div>모든 글을 불러왔습니다.</div>}
    </div>
  );
}
```

`sentinel` 요소가 viewport에서 200px 이내로 들어오면 `loadMore`를 호출합니다. `hasMore`가 `false`이거나 로딩 중이면 `disabled`로 Observer를 비활성화합니다.

---

## 오프셋 페이지네이션 구현 (관리자 화면)

임의 페이지 이동이 필요한 관리 UI에서는 오프셋을 사용합니다.

```javascript
function useOffsetPagination(fetcher, { pageSize = 20 } = {}) {
  const [page,  setPage]  = useState(1);
  const [data,  setData]  = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher({ page, limit: pageSize }).then(res => {
      if (!cancelled) {
        setData(res.data);
        setTotal(res.total);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [page, pageSize]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    data, page, totalPages, loading,
    goTo:    setPage,
    next:    () => setPage(p => Math.min(p + 1, totalPages)),
    prev:    () => setPage(p => Math.max(p - 1, 1)),
  };
}
```

---

## TanStack Query로 간단하게

직접 구현 대신 TanStack Query의 `useInfiniteQuery`를 사용하면 캐시·재시도·프리페치를 무료로 얻을 수 있습니다.

```javascript
import { useInfiniteQuery } from '@tanstack/react-query';

function useInfinitePost() {
  return useInfiniteQuery({
    queryKey:  ['posts'],
    queryFn:   ({ pageParam = null }) => fetchPosts({ cursor: pageParam }),
    getNextPageParam: last => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

function PostListWithQuery() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfinitePost();
  const sentinelRef = useInfiniteScroll(
    () => { if (hasNextPage) fetchNextPage(); },
    { disabled: !hasNextPage }
  );

  const items = data?.pages.flatMap(page => page.data) ?? [];
  // ... 렌더링
}
```

---

**지난 글:** [토큰 저장 전략 — 브라우저에서 인증 토큰 안전하게 관리하기](/posts/real-token-storage/)

**다음 글:** [제어 컴포넌트와 비제어 컴포넌트 — 폼 상태 관리 전략](/posts/real-form-controlled-uncontrolled/)

<br>
읽어주셔서 감사합니다. 😊
