---
title: "Redux Toolkit — 현대적 Redux 개발"
description: "Redux Toolkit의 configureStore, createSlice, createAsyncThunk, Immer 내장, RTK Query까지 — 보일러플레이트 없는 Redux 개발법을 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Redux", "Redux Toolkit", "RTK Query", "상태관리", "React", "Immer", "createSlice"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "state-redux-core"
  title: "Redux 핵심 — 단방향 데이터 흐름과 미들웨어"
next:
  slug: "state-zustand-jotai-recoil"
  title: "Zustand · Jotai · Recoil — 가벼운 상태 관리 비교"
---

[지난 글](/posts/state-redux-core/)에서 Redux의 단방향 데이터 흐름과 미들웨어 원리를 살펴봤습니다. Redux는 예측 가능한 상태 관리를 제공하지만, 실제 프로젝트에서는 액션 타입 상수, 액션 생성자, 리듀서를 각각 파일로 분리해야 하는 **보일러플레이트** 문제가 개발 속도를 크게 떨어뜨립니다. Redux Toolkit(이하 RTK)은 이 문제를 공식적으로 해결하는 Redux 팀의 권장 패키지입니다.

---

## Redux Toolkit 등장 배경

Redux 공식 문서도 오랫동안 "Redux는 너무 많은 코드가 필요하다"는 피드백을 받아왔습니다. 전통적인 Redux 프로젝트는 다음 세 가지 파일을 거의 항상 동반했습니다.

```
store/
  counter/
    actionTypes.js   // 상수 문자열 정의
    actions.js       // 액션 생성자 함수
    reducer.js       // switch-case 리듀서
```

`INCREMENT` 같은 상수를 하나 추가하려면 세 파일을 모두 수정해야 했고, Immer 없이 불변 객체를 직접 스프레드로 처리해야 했습니다. 비동기 로직은 `redux-thunk`를 별도 설치하고 액션 타입도 `FETCH_USERS_REQUEST`, `FETCH_USERS_SUCCESS`, `FETCH_USERS_FAILURE` 세 가지씩 정의해야 했습니다.

2019년 Redux Toolkit이 정식 출시되면서 이 모든 패턴을 하나의 패키지로 통합했습니다. RTK는 독립 라이브러리가 아니라 `redux`, `immer`, `redux-thunk`, `reselect`를 내부에 번들링하고 사용하기 쉬운 API를 씌운 것입니다.

```bash
npm install @reduxjs/toolkit react-redux
```

---

## configureStore — 스토어 설정 단순화

기존 `createStore` 대신 `configureStore`를 사용합니다. 가장 큰 차이는 **미들웨어 자동 설정**입니다.

```typescript
// Before: 전통 Redux
import { createStore, applyMiddleware, compose } from 'redux'
import thunk from 'redux-thunk'
import { composeWithDevTools } from 'redux-devtools-extension'

const store = createStore(
  rootReducer,
  composeWithDevTools(applyMiddleware(thunk))
)

// After: Redux Toolkit
import { configureStore } from '@reduxjs/toolkit'

const store = configureStore({
  reducer: {
    counter: counterReducer,
    users: usersReducer,
  },
  // middleware: redux-thunk 자동 포함
  // DevTools: 자동 연결 (프로덕션에서는 비활성화)
})
```

`configureStore`는 기본적으로 `redux-thunk`를 포함하고, 개발 환경에서 Redux DevTools Extension을 자동으로 연결합니다. 직렬화 불가능한 값이 상태나 액션에 들어오면 콘솔 경고도 자동으로 띄웁니다.

TypeScript와 함께 사용할 때는 스토어에서 타입을 추출하는 패턴이 권장됩니다.

```typescript
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

---

## createSlice — 리듀서와 액션 통합

![createSlice 보일러플레이트 비교](/assets/posts/state-redux-toolkit-slice.svg)

`createSlice`는 RTK의 핵심 API입니다. 슬라이스 이름, 초기 상태, 리듀서 함수 맵을 받아 리듀서 함수와 액션 생성자를 **동시에** 생성합니다.

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface CounterState {
  value: number
  status: 'idle' | 'loading' | 'failed'
}

const initialState: CounterState = {
  value: 0,
  status: 'idle',
}

const counterSlice = createSlice({
  name: 'counter',           // 액션 타입 prefix: 'counter/increment'
  initialState,
  reducers: {
    increment(state) {
      state.value += 1       // Immer 덕분에 직접 변경 가능
    },
    decrement(state) {
      state.value -= 1
    },
    incrementByAmount(state, action: PayloadAction<number>) {
      state.value += action.payload
    },
    reset() {
      return initialState    // 객체를 반환하면 상태 전체를 교체
    },
  },
})

// 액션 생성자 자동 생성
export const { increment, decrement, incrementByAmount, reset } =
  counterSlice.actions

// 리듀서 내보내기
export default counterSlice.reducer
```

슬라이스 이름 `'counter'`와 리듀서 키 `'increment'`가 결합되어 액션 타입은 `'counter/increment'`가 됩니다. 액션 타입 상수를 직접 선언할 필요가 없습니다.

### extraReducers — 외부 액션 처리

한 슬라이스에서 다른 슬라이스의 액션이나 `createAsyncThunk`의 라이프사이클 액션을 처리할 때 `extraReducers`를 사용합니다.

```typescript
const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: { /* ... */ },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserById.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.status = 'idle'
        state.value = action.payload
      })
      .addCase(fetchUserById.rejected, (state) => {
        state.status = 'failed'
      })
  },
})
```

---

## createAsyncThunk — 비동기 처리

비동기 작업(API 호출 등)을 위한 공식 패턴입니다. `createAsyncThunk`는 `pending`, `fulfilled`, `rejected` 세 가지 액션 타입을 자동으로 생성합니다.

```typescript
import { createAsyncThunk } from '@reduxjs/toolkit'

// 첫 번째 인자: 액션 타입 prefix
// 두 번째 인자: payload creator (async 함수)
export const fetchUserById = createAsyncThunk(
  'users/fetchById',
  async (userId: number, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/users/${userId}`)
      if (!response.ok) throw new Error('서버 오류')
      return await response.json()
    } catch (error) {
      // rejectWithValue로 에러 페이로드 제어
      return rejectWithValue((error as Error).message)
    }
  }
)
```

생성된 액션 타입:
- `users/fetchById/pending` — 요청 시작
- `users/fetchById/fulfilled` — 성공 (반환값이 `action.payload`)
- `users/fetchById/rejected` — 실패 (`rejectWithValue` 또는 에러)

두 번째 인자인 `thunkAPI`에는 `dispatch`, `getState`, `rejectWithValue`, `signal`(AbortController) 등이 포함됩니다. `signal`을 활용하면 컴포넌트 언마운트 시 요청을 취소할 수 있습니다.

```typescript
const fetchPosts = createAsyncThunk('posts/fetch', async (_, { signal }) => {
  const response = await fetch('/api/posts', { signal })
  return response.json()
})

// 컴포넌트에서
const promise = dispatch(fetchPosts())
return () => promise.abort() // 언마운트 시 요청 취소
```

---

## Immer 내장 — 가변 스타일 불변성

RTK는 Immer를 내장합니다. `createSlice`와 `createReducer`의 리듀서 함수 안에서는 **상태를 직접 변경하는 것처럼** 코드를 작성할 수 있습니다.

```typescript
// 기존 방식 — 스프레드로 불변성 유지
case 'ADD_TODO': {
  return {
    ...state,
    todos: [
      ...state.todos,
      { id: Date.now(), text: action.payload, done: false }
    ]
  }
}

// RTK + Immer — 직접 변경 스타일
addTodo(state, action: PayloadAction<string>) {
  state.todos.push({
    id: Date.now(),
    text: action.payload,
    done: false,
  })
}
```

Immer는 내부적으로 Proxy를 사용해 변경 사항을 추적하고, 실제로는 새 불변 객체를 생성합니다. 단, 두 가지 규칙이 있습니다.

1. 상태를 **직접 변경**하거나, **새 값을 반환**하거나 — 둘 중 하나만 해야 합니다. 둘 다 하면 런타임 오류가 발생합니다.
2. `Map`, `Set`은 Immer의 `enableMapSet()` 플러그인을 활성화해야 사용할 수 있습니다.

---

## RTK Query — 데이터 페칭 자동화

![RTK Query 흐름](/assets/posts/state-redux-toolkit-query.svg)

RTK Query는 RTK 2.0부터 `@reduxjs/toolkit/query/react`에 포함된 **데이터 페칭·캐시 레이어**입니다. React Query, SWR과 같은 문제를 Redux 생태계 안에서 해결합니다.

### createApi — API 정의

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const postsApi = createApi({
  reducerPath: 'postsApi',         // Redux 스토어 내 키
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return headers
    },
  }),
  tagTypes: ['Post', 'User'],      // 캐시 무효화 태그
  endpoints: (builder) => ({
    getPosts: builder.query<Post[], void>({
      query: () => '/posts',
      providesTags: ['Post'],      // 이 쿼리가 제공하는 태그
    }),
    getPostById: builder.query<Post, number>({
      query: (id) => `/posts/${id}`,
      providesTags: (result, error, id) => [{ type: 'Post', id }],
    }),
    addPost: builder.mutation<Post, Partial<Post>>({
      query: (body) => ({ url: '/posts', method: 'POST', body }),
      invalidatesTags: ['Post'],   // 성공 시 Post 캐시 무효화
    }),
  }),
})

export const { useGetPostsQuery, useGetPostByIdQuery, useAddPostMutation } =
  postsApi
```

`createApi`를 정의하고 나면 스토어에 리듀서와 미들웨어를 추가합니다.

```typescript
const store = configureStore({
  reducer: {
    [postsApi.reducerPath]: postsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(postsApi.middleware),
})
```

### 자동 생성 Hook 사용

```typescript
function PostList() {
  const {
    data: posts,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetPostsQuery()

  const [addPost, { isLoading: isAdding }] = useAddPostMutation()

  if (isLoading) return <Spinner />
  if (isError) return <ErrorMessage error={error} />

  return (
    <ul>
      {posts?.map((post) => <PostItem key={post.id} post={post} />)}
      <button onClick={() => addPost({ title: '새 글' })} disabled={isAdding}>
        추가
      </button>
    </ul>
  )
}
```

### 캐시 전략

RTK Query는 기본적으로 **60초** 동안 캐시를 유지합니다. 구독자가 없어진 뒤 60초가 지나면 캐시가 삭제됩니다.

```typescript
getPosts: builder.query<Post[], void>({
  query: () => '/posts',
  keepUnusedDataFor: 300,   // 5분 동안 캐시 유지 (초 단위)
}),
```

`providesTags`와 `invalidatesTags`를 이용해 mutation 성공 후 관련 쿼리를 자동 재실행합니다. 낙관적 업데이트(optimistic update)는 `onQueryStarted` 콜백에서 `updateQueryData`를 사용해 구현합니다.

```typescript
addPost: builder.mutation<Post, Partial<Post>>({
  query: (body) => ({ url: '/posts', method: 'POST', body }),
  async onQueryStarted(newPost, { dispatch, queryFulfilled }) {
    // 낙관적으로 캐시 업데이트
    const patch = dispatch(
      postsApi.util.updateQueryData('getPosts', undefined, (draft) => {
        draft.push({ id: Date.now(), ...newPost } as Post)
      })
    )
    try {
      await queryFulfilled
    } catch {
      patch.undo()   // 실패 시 롤백
    }
  },
}),
```

---

## DevTools 통합

`configureStore`는 Redux DevTools Extension을 자동으로 연결합니다. RTK Query 캐시 상태도 DevTools에서 슬라이스처럼 확인할 수 있습니다.

```typescript
const store = configureStore({
  reducer: rootReducer,
  devTools: process.env.NODE_ENV !== 'production',   // 기본값
  // 프로덕션 빌드에서는 자동으로 비활성화됨
})
```

DevTools의 **Time Travel Debugging** 기능으로 과거 액션을 재실행하거나 특정 시점으로 돌아갈 수 있습니다. RTK Query 요청·응답·캐시 업데이트도 모두 액션으로 기록되어 추적됩니다.

---

## 마치며

Redux Toolkit은 Redux의 학습 곡선과 보일러플레이트를 크게 낮췄습니다.

| 기능 | 전통 Redux | RTK |
|---|---|---|
| 스토어 설정 | `createStore` + `compose` + DevTools 수동 | `configureStore` 한 줄 |
| 리듀서 + 액션 | 3개 파일 분리 | `createSlice` 1개 |
| 비동기 처리 | 직접 thunk 작성 + 3개 액션 타입 | `createAsyncThunk` |
| 불변성 유지 | 스프레드 연산자 수동 | Immer 내장 |
| 데이터 페칭 | 직접 구현 or 별도 라이브러리 | RTK Query |

새 프로젝트에서 Redux가 필요하다면 처음부터 RTK를 사용하는 것이 권장됩니다. 기존 프로젝트 마이그레이션도 `createSlice`부터 점진적으로 도입할 수 있습니다.

다음 글에서는 Redux보다 훨씬 가벼운 **Zustand, Jotai, Recoil**을 비교하며 각 라이브러리가 어떤 상황에 적합한지 살펴봅니다.
