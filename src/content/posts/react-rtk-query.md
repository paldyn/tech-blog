---
title: "RTK Query — Redux에서 서버 상태 관리하기"
description: "Redux Toolkit에 내장된 RTK Query로 데이터 페칭과 캐싱을 처리하는 방법을 다룹니다. createApi, fetchBaseQuery, 자동 생성 훅, providesTags와 invalidatesTags를 이용한 캐시 무효화까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["RTKQuery", "Redux", "데이터페칭", "캐싱", "서버상태"]
featured: false
draft: false
---

[지난 글](/posts/react-redux-slices/)에서 Slice 패턴으로 클라이언트 상태를 도메인별로 구조화했다. 그런데 실제 앱 상태의 상당 부분은 서버에서 가져온 데이터다. 로딩 플래그, 에러 처리, 캐싱, 중복 요청 제거를 매번 `createAsyncThunk`로 직접 구현하는 것은 반복적이고 실수하기 쉽다. **RTK Query**는 Redux Toolkit에 내장된 데이터 페칭 솔루션으로, 이 모든 것을 선언 한 번으로 자동화한다.

## createApi로 API 슬라이스 정의하기

RTK Query의 출발점은 `createApi`다. 엔드포인트를 선언하면 훅, 리듀서, 미들웨어가 모두 자동 생성된다.

```tsx
// services/postsApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface Post {
  id: number;
  title: string;
  body: string;
}

export const postsApi = createApi({
  reducerPath: 'postsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Post'],
  endpoints: (builder) => ({
    getPosts: builder.query<Post[], void>({
      query: () => '/posts',
      providesTags: ['Post'],
    }),
    getPost: builder.query<Post, number>({
      query: (id) => `/posts/${id}`,
      providesTags: (result, error, id) => [{ type: 'Post', id }],
    }),
  }),
});

// 엔드포인트 이름 기반으로 훅이 자동 생성된다
export const { useGetPostsQuery, useGetPostQuery } = postsApi;
```

스토어에는 리듀서와 미들웨어를 함께 등록한다. 미들웨어가 캐시 수명 관리와 폴링을 담당하기 때문에 빠뜨리면 안 된다.

```tsx
// store.ts
import { configureStore } from '@reduxjs/toolkit';
import { postsApi } from './services/postsApi';

export const store = configureStore({
  reducer: {
    [postsApi.reducerPath]: postsApi.reducer,
    // ...다른 슬라이스
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(postsApi.middleware),
});
```

## 자동 생성 훅 사용하기

컴포넌트에서는 자동 생성된 훅을 호출하기만 하면 된다. 로딩 상태, 에러, 데이터가 전부 반환된다.

```tsx
function PostList() {
  const { data: posts, isLoading, isFetching, error, refetch } =
    useGetPostsQuery();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage onRetry={refetch} />;

  return (
    <ul style={{ opacity: isFetching ? 0.6 : 1 }}>
      {posts?.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

같은 쿼리를 여러 컴포넌트에서 호출해도 네트워크 요청은 한 번만 발생한다. RTK Query가 구독을 추적해서 동일 인자의 요청을 자동으로 합치기 때문이다.

![RTK Query 데이터 흐름](/assets/posts/react-rtk-query-flow.svg)

`isLoading`과 `isFetching`의 구분은 실무에서 중요하다.

- **isLoading**: 캐시가 전혀 없는 첫 요청. 스켈레톤이나 스피너를 보여줄 타이밍
- **isFetching**: 캐시 데이터를 보여주는 중에 백그라운드 재요청이 진행 중. 기존 UI를 유지하면서 살짝 흐리게 처리하는 정도가 적절하다

## Mutation — 데이터 변경하기

조회가 아닌 생성·수정·삭제는 `builder.mutation`으로 정의한다.

```tsx
endpoints: (builder) => ({
  // ...기존 쿼리
  addPost: builder.mutation<Post, Partial<Post>>({
    query: (body) => ({
      url: '/posts',
      method: 'POST',
      body,
    }),
    invalidatesTags: ['Post'],
  }),
  deletePost: builder.mutation<void, number>({
    query: (id) => ({
      url: `/posts/${id}`,
      method: 'DELETE',
    }),
    invalidatesTags: (result, error, id) => [{ type: 'Post', id }],
  }),
}),
```

Mutation 훅은 쿼리 훅과 달리 **트리거 함수와 상태의 튜플**을 반환한다. 호출 시점을 직접 제어해야 하기 때문이다.

```tsx
function NewPostForm() {
  const [addPost, { isLoading }] = useAddPostMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addPost({ title, body }).unwrap();
      // unwrap()은 실패 시 throw하므로 try/catch로 처리 가능
      navigate('/posts');
    } catch {
      toast.error('글 작성에 실패했습니다');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ...입력 필드 */}
      <button disabled={isLoading}>작성</button>
    </form>
  );
}
```

## 태그로 캐시 무효화 자동화하기

RTK Query 캐싱의 핵심은 **태그 시스템**이다. 쿼리가 `providesTags`로 캐시 항목에 태그를 붙이고, mutation이 `invalidatesTags`로 태그를 무효화하면, 해당 태그를 제공하는 모든 활성 쿼리가 자동으로 다시 실행된다.

![태그 기반 캐시 무효화](/assets/posts/react-rtk-query-tags.svg)

글 목록을 보고 있는 상태에서 새 글을 작성하면, `addPost` 성공 → `'Post'` 태그 무효화 → `getPosts` 자동 refetch가 연쇄적으로 일어나 목록이 즉시 갱신된다. "데이터를 바꿨으니 목록도 다시 불러와야 한다"는 동기화 로직을 직접 작성할 필요가 없다.

id 단위 태그를 쓰면 무효화 범위를 더 좁힐 수 있다.

```tsx
getPost: builder.query<Post, number>({
  query: (id) => `/posts/${id}`,
  // 상세 캐시에는 id 단위 태그
  providesTags: (result, error, id) => [{ type: 'Post', id }],
}),
updatePost: builder.mutation<Post, Post>({
  query: ({ id, ...patch }) => ({
    url: `/posts/${id}`,
    method: 'PATCH',
    body: patch,
  }),
  // 수정한 글의 상세 캐시만 무효화
  invalidatesTags: (result, error, { id }) => [{ type: 'Post', id }],
}),
```

## 폴링과 재검증 옵션

훅 옵션으로 자동 갱신 동작을 세밀하게 제어할 수 있다.

```tsx
const { data } = useGetPostsQuery(undefined, {
  pollingInterval: 30_000,        // 30초마다 자동 재요청
  refetchOnFocus: true,           // 창 포커스 시 재검증
  refetchOnReconnect: true,       // 네트워크 재연결 시 재검증
  skip: !isLoggedIn,              // 조건부 실행
});
```

`refetchOnFocus`를 쓰려면 스토어 설정에서 `setupListeners(store.dispatch)`를 호출해 두어야 한다.

## RTK Query를 선택하는 기준

이미 Redux Toolkit을 쓰고 있는 프로젝트라면 RTK Query는 자연스러운 선택이다. 클라이언트 상태와 서버 상태가 하나의 스토어에서 관리되고, Redux DevTools로 캐시 내부까지 들여다볼 수 있다. 반면 Redux를 쓰지 않는 프로젝트에서 데이터 페칭만 필요하다면, 더 가벼운 대안들이 있다. 이어지는 글에서는 그중 하나인 Zustand로 클라이언트 상태를 단순하게 관리하는 방법을 먼저 살펴본다.

---

**지난 글:** [Redux Slices 패턴 — 도메인 기반 상태 구조화](/posts/react-redux-slices/)

**다음 글:** [Zustand — 가볍고 단순한 상태 관리](/posts/react-zustand/)

<br>
읽어주셔서 감사합니다. 😊
