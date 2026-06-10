---
title: "Redux Toolkit 완전 가이드 — createSlice와 configureStore"
description: "Redux Toolkit의 createSlice, configureStore, createAsyncThunk, Immer 통합, useSelector/useDispatch 패턴을 예제 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["Redux", "ReduxToolkit", "createSlice", "상태관리", "Immer"]
featured: false
draft: false
---

[지난 글](/posts/react-context-vs-external/)에서 Context와 외부 상태 관리 라이브러리의 차이를 살펴봤다. Redux는 대규모 애플리케이션에서 예측 가능한 상태 관리를 위한 검증된 솔루션이다. 과거의 Redux는 보일러플레이트가 많았지만, **Redux Toolkit(RTK)**이 이를 크게 개선했다.

## Redux Toolkit이 해결하는 문제

전통적인 Redux의 문제는 다음과 같다.

1. Action 타입 상수 정의
2. Action 생성자 함수 작성
3. 불변성을 위한 스프레드 연산자 남용
4. 여러 파일로 분산된 코드

RTK는 이 모든 것을 `createSlice` 하나로 해결한다.

## createSlice — 핵심 API

`createSlice`는 slice 이름, 초기 상태, reducer 함수들을 받아 action creators와 reducer를 자동으로 생성한다.

```tsx
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CounterState {
  value: number;
  step: number;
}

const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0, step: 1 } as CounterState,
  reducers: {
    // Immer 덕분에 직접 수정 가능 (실제로는 불변 처리됨)
    increment(state) {
      state.value += state.step;
    },
    decrement(state) {
      state.value -= state.step;
    },
    // PayloadAction으로 payload 타입 지정
    incrementByAmount(state, action: PayloadAction<number>) {
      state.value += action.payload;
    },
    setStep(state, action: PayloadAction<number>) {
      state.step = action.payload;
    },
  },
});

// Action creators 자동 생성
export const { increment, decrement, incrementByAmount, setStep } = counterSlice.actions;
export default counterSlice.reducer;
```

![Redux Toolkit 아키텍처](/assets/posts/react-redux-toolkit-architecture.svg)

## Immer 통합 — 불변성 걱정 없이

RTK는 내부적으로 [Immer](https://immerjs.github.io/immer/)를 사용한다. `createSlice`의 reducer 안에서 상태를 **직접 수정하는 것처럼 코드를 작성**하면 Immer가 불변 업데이트로 변환해 준다.

```tsx
// 전통 Redux: 불변 업데이트
case 'addItem':
  return {
    ...state,
    items: [...state.items, action.payload],
  };

// RTK + Immer: 직접 수정 가능
addItem(state, action: PayloadAction<Item>) {
  state.items.push(action.payload); // push 직접 사용 OK
}
```

단, 새 상태를 반환하면 Immer 대신 직접 return이 사용된다. 두 방식을 섞으면 안 된다.

```tsx
// OK: 직접 수정
resetItems(state) {
  state.items = [];
}

// OK: 새 값 반환
resetItems() {
  return { items: [] }; // initialState 형태
}

// 틀림: 두 가지 혼용 (return 값이 무시됨)
resetItems(state) {
  state.items = [];
  return state; // X — Immer에서 return은 "이 값으로 교체"를 의미
}
```

## configureStore — 스토어 설정

`configureStore`는 Redux DevTools, Thunk 미들웨어를 자동으로 설정한다.

```tsx
import { configureStore } from '@reduxjs/toolkit';
import counterReducer from './counterSlice';
import usersReducer from './usersSlice';

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    users: usersReducer,
  },
  // middleware, devTools 등 추가 설정 가능
});

// TypeScript: RootState, AppDispatch 타입 추출
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

## React와 연결 — Provider와 타입 훅

```tsx
// main.tsx
import { Provider } from 'react-redux';
import { store } from './store';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <App />
  </Provider>
);

// hooks.ts — 타입 지정된 훅 만들기
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (state: RootState) => T) =>
  useSelector(selector);

// 컴포넌트에서 사용
function Counter() {
  const count = useAppSelector(state => state.counter.value);
  const dispatch = useAppDispatch();

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => dispatch(increment())}>+</button>
      <button onClick={() => dispatch(decrement())}>-</button>
    </div>
  );
}
```

## createAsyncThunk — 비동기 액션

서버에서 데이터를 가져오는 등 비동기 작업은 `createAsyncThunk`로 처리한다.

```tsx
import { createAsyncThunk } from '@reduxjs/toolkit';

interface User { id: number; name: string }

export const fetchUsers = createAsyncThunk(
  'users/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('서버 오류');
      return (await response.json()) as User[];
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);
```

Slice에서 비동기 액션의 3가지 상태(pending, fulfilled, rejected)를 처리한다.

```tsx
interface UsersState {
  users: User[];
  loading: boolean;
  error: string | null;
}

const usersSlice = createSlice({
  name: 'users',
  initialState: { users: [], loading: false, error: null } as UsersState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});
```

![createAsyncThunk 비동기 흐름](/assets/posts/react-redux-toolkit-async.svg)

## Selector 함수 — 상태 파생과 최적화

복잡한 selector는 컴포넌트 밖에서 정의해 재사용한다. `createSelector`로 메모이제이션된 selector를 만들 수 있다.

```tsx
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './store';

// 기본 selector
export const selectUsers = (state: RootState) => state.users.users;
export const selectLoading = (state: RootState) => state.users.loading;

// 파생 selector (memoized)
export const selectActiveUsers = createSelector(
  selectUsers,
  (users) => users.filter(u => u.isActive) // selectUsers 결과가 같으면 재계산 안 함
);
```

RTK는 Redux를 현대적으로 쓰는 공식 방법이다. 다음 글에서는 RTK의 Slices 패턴을 더 깊이 살펴본다.

---

**지난 글:** [Context vs 외부 상태 관리 — 언제 무엇을 쓸까?](/posts/react-context-vs-external/)

**다음 글:** [Redux Slices 패턴 — 도메인 기반 상태 구조화](/posts/react-redux-slices/)

<br>
읽어주셔서 감사합니다. 😊
