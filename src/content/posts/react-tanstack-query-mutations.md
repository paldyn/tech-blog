---
title: "TanStack Query Mutations — 데이터 변경과 낙관적 업데이트"
description: "useMutation으로 생성·수정·삭제를 처리하는 방법을 다룹니다. mutate와 mutateAsync, 콜백 생명주기, invalidateQueries를 통한 캐시 동기화, onMutate 기반 낙관적 업데이트와 롤백 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["TanStackQuery", "useMutation", "낙관적업데이트", "캐시무효화", "서버상태"]
featured: false
draft: false
---

[지난 글](/posts/react-tanstack-query/)에서 useQuery로 서버 데이터를 읽고 캐싱하는 방법을 살펴봤다. 이제 반대 방향, 즉 서버 데이터를 **바꾸는** 쪽을 다룰 차례다. TanStack Query에서 생성·수정·삭제는 `useMutation`이 담당하며, 변경 후 화면을 어떻게 최신 상태로 동기화할 것인가가 이 글의 핵심 주제다.

## useMutation 기본형

쿼리와 달리 mutation은 마운트 시 자동 실행되지 않는다. 반환된 `mutate` 함수를 호출하는 시점에 실행된다.

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function NewTodoForm() {
  const queryClient = useQueryClient();

  const addTodo = useMutation({
    mutationFn: (newTodo: { title: string }) =>
      fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTodo),
      }).then((res) => {
        if (!res.ok) throw new Error('추가 실패');
        return res.json();
      }),
    onSuccess: () => {
      // 변경에 성공했으니 목록 캐시를 무효화한다
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        addTodo.mutate({ title });
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <button disabled={addTodo.isPending}>
        {addTodo.isPending ? '추가 중...' : '추가'}
      </button>
      {addTodo.isError && <p role="alert">{addTodo.error.message}</p>}
    </form>
  );
}
```

`isPending`, `isError`, `isSuccess` 플래그가 함께 제공되어 버튼 비활성화나 에러 표시에 바로 쓸 수 있다.

## 변경 후 동기화 — invalidateQueries

mutation 자체는 캐시를 건드리지 않는다. 새 할 일을 서버에 저장했어도 `['todos']` 캐시는 여전히 옛 목록이다. 가장 단순하고 안전한 동기화 방법이 **무효화 후 재요청**이다.

![Mutation과 캐시 무효화 흐름](/assets/posts/react-tanstack-query-mutations-flow.svg)

`invalidateQueries`는 두 가지를 한다. 매칭되는 쿼리를 stale로 표시하고, 현재 화면에서 구독 중인 쿼리는 즉시 refetch한다. 쿼리 키가 계층 구조라면 상위 키 하나로 목록·상세 캐시를 한꺼번에 무효화할 수 있다.

```tsx
onSuccess: (updatedPost) => {
  // 목록과 해당 상세를 모두 무효화
  queryClient.invalidateQueries({ queryKey: ['posts'] });
},
```

서버 응답에 최신 데이터가 담겨 있다면 refetch 없이 캐시를 직접 쓰는 방법도 있다.

```tsx
onSuccess: (updatedPost) => {
  // 응답으로 상세 캐시를 바로 교체 — 네트워크 요청 1회 절약
  queryClient.setQueryData(['posts', updatedPost.id], updatedPost);
  queryClient.invalidateQueries({ queryKey: ['posts', 'list'] });
},
```

## mutate vs mutateAsync

```tsx
// mutate: 콜백 스타일 — 에러는 onError가 처리
addTodo.mutate(newTodo, {
  onSuccess: () => toast.success('추가되었습니다'),
});

// mutateAsync: Promise 반환 — 순차 로직이 필요할 때
const handleSubmit = async () => {
  try {
    const created = await addTodo.mutateAsync(newTodo);
    navigate(`/todos/${created.id}`);
  } catch {
    // mutateAsync는 직접 catch해야 unhandled rejection이 없다
  }
};
```

특별한 이유가 없다면 `mutate`가 기본이다. `mutateAsync`는 mutation 결과를 받아 다음 단계로 이어가야 할 때만 쓴다.

## 낙관적 업데이트 — UI를 먼저 바꾸기

좋아요 버튼처럼 빠른 피드백이 중요한 인터랙션에서 서버 응답을 기다렸다가 UI를 바꾸면 늦다. **낙관적 업데이트**는 요청이 성공할 것이라 가정하고 캐시를 먼저 수정한 뒤, 실패하면 되돌리는 패턴이다.

![낙관적 업데이트 사이클](/assets/posts/react-tanstack-query-mutations-optimistic.svg)

```tsx
const toggleLike = useMutation({
  mutationFn: (postId: number) =>
    fetch(`/api/posts/${postId}/like`, { method: 'POST' }),

  onMutate: async (postId) => {
    // 1. 진행 중인 refetch 취소 — 낙관적 값을 덮어쓰지 않도록
    await queryClient.cancelQueries({ queryKey: ['posts', postId] });

    // 2. 롤백을 위한 스냅샷
    const previous = queryClient.getQueryData<Post>(['posts', postId]);

    // 3. 캐시를 즉시 수정 — UI가 바로 반응한다
    queryClient.setQueryData<Post>(['posts', postId], (old) =>
      old ? { ...old, liked: !old.liked, likes: old.likes + (old.liked ? -1 : 1) } : old
    );

    // 여기서 반환한 값이 onError/onSettled의 context로 전달된다
    return { previous };
  },

  onError: (err, postId, context) => {
    // 실패 — 스냅샷으로 롤백
    queryClient.setQueryData(['posts', postId], context?.previous);
    toast.error('잠시 후 다시 시도해 주세요');
  },

  onSettled: (data, error, postId) => {
    // 성공/실패와 무관하게 서버 상태와 최종 동기화
    queryClient.invalidateQueries({ queryKey: ['posts', postId] });
  },
});
```

세 단계의 역할 분담이 명확하다.

- **onMutate**: 진행 중인 쿼리 취소 → 스냅샷 저장 → 캐시 선반영. 반환값은 다른 콜백의 `context`가 된다
- **onError**: `context.previous`로 롤백
- **onSettled**: 결과와 무관하게 무효화해서 서버가 진실 공급원이 되도록 마무리

`cancelQueries`를 빼먹으면 미묘한 버그가 생긴다. 낙관적으로 캐시를 바꾼 직후, 이미 날아가 있던 refetch 응답(옛 데이터)이 도착해 낙관적 값을 덮어써 버리는 경우다.

## 어떤 전략을 쓸 것인가

| 전략 | 코드량 | UX | 적합한 곳 |
|---|---|---|---|
| invalidate 후 refetch | 최소 | 약간의 지연 | 대부분의 폼 제출 |
| setQueryData로 직접 갱신 | 중간 | 빠름 | 응답에 최신 데이터가 있을 때 |
| 낙관적 업데이트 | 많음 | 즉각적 | 좋아요·토글·드래그 정렬 |

기본은 무효화다. 낙관적 업데이트는 코드 복잡도가 확실히 올라가므로, 즉각적인 피드백이 UX에 결정적인 인터랙션에만 선별적으로 적용하는 것이 좋다.

서버 상태 관리까지 다뤘으니 이제 시리즈의 마지막 영역인 **테스트**로 넘어간다. 다음 글에서는 React Testing Library의 철학과 기본 사용법을 살펴본다.

---

**지난 글:** [TanStack Query — 서버 상태 관리의 표준](/posts/react-tanstack-query/)

**다음 글:** [React Testing Library — 사용자 관점의 테스트](/posts/react-testing-library/)

<br>
읽어주셔서 감사합니다. 😊
