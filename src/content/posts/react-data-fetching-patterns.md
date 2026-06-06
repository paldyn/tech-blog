---
title: "데이터 페칭 패턴 비교 — useEffect, SWR, TanStack Query"
description: "React에서 서버 데이터를 가져오는 세 가지 패턴인 useEffect 직접 구현, SWR, TanStack Query를 캐싱·뮤테이션·재시도·로딩 상태 측면에서 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React", "데이터페칭", "SWR", "TanStack Query", "useEffect", "fetch", "비동기"]
featured: false
draft: false
---

[지난 글](/posts/react-abort-controller/)에서 `AbortController`로 진행 중인 fetch를 취소하는 방법을 배웠다. 이제 한 발 물러서서 "데이터를 어떻게 가져올 것인가"라는 더 큰 질문을 다뤄보자. useEffect로 직접 구현하는 방식부터 SWR, TanStack Query까지 각 접근법이 어떤 문제를 해결하는지 비교한다.

## useEffect로 직접 구현

가장 기본적인 패턴이다. 별도 라이브러리 없이 React 기본 훅만으로 데이터를 가져온다.

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setUser(data);
        setIsLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [userId]);

  if (isLoading) return <Spinner />;
  if (error) return <p>{error}</p>;
  return <Profile user={user} />;
}
```

이 패턴은 단순하고 의존성이 없다. 그러나 **캐싱이 없어서** 같은 userId로 두 컴포넌트가 동시에 마운트되면 요청이 두 번 날아간다. 탭을 전환했다가 돌아올 때 항상 새 요청이 발생한다.

![데이터 페칭 패턴 비교](/assets/posts/react-data-fetching-patterns-comparison.svg)

## 로딩 / 에러 / 성공 라이프사이클

세 패턴 모두 같은 상태 머신을 구현한다.

![데이터 페칭 라이프사이클](/assets/posts/react-data-fetching-patterns-lifecycle.svg)

- **로딩 중**: `isLoading: true`, `data: null`, `error: null`
- **성공**: `isLoading: false`, `data: {...}`, `error: null`
- **실패**: `isLoading: false`, `data: null`, `error: Error`

useEffect로 직접 구현하면 이 세 상태를 모두 손수 관리해야 한다. SWR과 TanStack Query는 이 상태를 자동으로 처리한다.

## SWR

Vercel이 만든 SWR(stale-while-revalidate)은 HTTP RFC 5861의 캐싱 전략을 React 훅에 구현한 라이브러리다.

```jsx
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then(r => r.json());

function UserProfile({ userId }) {
  const { data: user, error, isLoading } = useSWR(
    `/api/users/${userId}`,
    fetcher
  );

  if (isLoading) return <Spinner />;
  if (error) return <p>{error.message}</p>;
  return <Profile user={user} />;
}
```

useEffect 버전 대비 코드가 3분의 1로 줄었다. SWR이 자동으로 처리하는 것들:

- **캐싱**: 같은 키 요청은 캐시에서 즉시 반환
- **중복 제거(deduplication)**: 여러 컴포넌트가 같은 키를 요청해도 요청은 한 번만
- **포커스 재검증**: 탭을 전환했다 돌아오면 자동 재요청
- **오프라인 감지**: 네트워크 복귀 시 자동 재요청

뮤테이션(데이터 변경)은 `useSWRMutation`이나 `mutate`로 처리한다.

```jsx
import useSWRMutation from 'swr/mutation';

async function updateUser(url, { arg }) {
  return fetch(url, {
    method: 'PUT',
    body: JSON.stringify(arg),
  }).then(r => r.json());
}

function EditProfile({ userId }) {
  const { trigger, isMutating } = useSWRMutation(
    `/api/users/${userId}`,
    updateUser
  );

  return (
    <button
      onClick={() => trigger({ name: '새 이름' })}
      disabled={isMutating}
    >
      저장
    </button>
  );
}
```

## TanStack Query

TanStack Query(구 React Query)는 "서버 상태 관리 라이브러리"다. SWR보다 기능이 풍부하고 구조화되어 있다.

```jsx
import { useQuery } from '@tanstack/react-query';

function UserProfile({ userId }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetch(`/api/users/${userId}`).then(r => r.json()),
    staleTime: 1000 * 60 * 5, // 5분간 신선 상태
  });

  if (isLoading) return <Spinner />;
  if (error) return <p>{error.message}</p>;
  return <Profile user={user} />;
}
```

**쿼리 키**(`queryKey`)가 핵심이다. `['user', userId]`처럼 배열로 표현하며, 키가 같은 요청은 같은 캐시를 공유한다.

뮤테이션은 `useMutation`으로 처리하며, 낙관적 업데이트(Optimistic Update)를 기본 제공한다.

```jsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function EditProfile({ userId }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newData) =>
      fetch(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(newData),
      }).then(r => r.json()),
    onSuccess: (data) => {
      // 뮤테이션 성공 시 캐시 무효화 → 자동 재요청
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    },
    onMutate: async (newData) => {
      // 낙관적 업데이트: 응답 전에 UI 먼저 변경
      await queryClient.cancelQueries({ queryKey: ['user', userId] });
      const prev = queryClient.getQueryData(['user', userId]);
      queryClient.setQueryData(['user', userId], (old) => ({
        ...old, ...newData,
      }));
      return { prev }; // 롤백을 위해 이전 값 저장
    },
    onError: (err, _, context) => {
      // 실패 시 롤백
      queryClient.setQueryData(['user', userId], context.prev);
    },
  });

  return (
    <button onClick={() => mutation.mutate({ name: '새 이름' })}>
      저장
    </button>
  );
}
```

## 세 가지 패턴 비교 요약

| 항목 | useEffect | SWR | TanStack Query |
|------|-----------|-----|----------------|
| 설치 | 불필요 | `swr` | `@tanstack/react-query` |
| 캐싱 | 없음 | 기본 제공 | 강력한 캐시 |
| 중복 제거 | 없음 | 자동 | 자동 |
| 낙관적 업데이트 | 수동 | 수동 | 내장 |
| 번들 크기 | 0 | ~4kb | ~13kb |
| 학습 곡선 | 낮음 | 낮음 | 중간 |

## 언제 무엇을 쓸까

**useEffect 직접 구현**: 외부 라이브러리 의존성을 최소화해야 하거나, 딱 한 번만 쓰는 단순 요청에 적합하다. 하지만 캐싱이 필요해지는 순간 코드가 빠르게 복잡해진다.

**SWR**: API 읽기(GET)가 주를 이루는 앱에 적합하다. 실시간 데이터나 대시보드처럼 자동 갱신이 중요한 경우에 SWR의 stale-while-revalidate 전략이 빛난다.

**TanStack Query**: 복잡한 CRUD 앱, 낙관적 업데이트, 서버 상태와 클라이언트 상태를 엄격히 분리해야 할 때 적합하다. 기능이 많은 만큼 학습 비용도 있지만, 중~대형 앱에서는 투자 대비 효과가 크다.

---

**지난 글:** [AbortController로 fetch 요청 취소하기](/posts/react-abort-controller/)

**다음 글:** [useMemo 완전 정복 — 계산 결과 메모이제이션](/posts/react-usememo/)

<br>
읽어주셔서 감사합니다. 😊
