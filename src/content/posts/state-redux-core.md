---
title: "Redux 핵심 — 단방향 데이터 흐름과 미들웨어"
description: "Redux의 세 가지 원칙, Action·Reducer·Store의 역할, 불변성 유지 방법, Redux Thunk 미들웨어, react-redux의 useSelector·useDispatch까지 Redux 핵심 개념을 코드 예시와 함께 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Redux", "상태관리", "단방향데이터흐름", "미들웨어", "ReduxThunk", "react-redux", "Reducer"]
featured: false
draft: false
---

[지난 글](/posts/fw-meta-frameworks/)에서 메타 프레임워크 생태계를 살펴봤습니다. 이번에는 **Redux**를 다룹니다. 등장한 지 10년이 넘었지만 여전히 대규모 React 애플리케이션의 상태 관리 표준으로 쓰이고, Redux Toolkit이라는 현대적인 외관을 입고도 여전히 내부는 같은 원리로 동작합니다. 원리를 제대로 이해하면 어떤 상태 관리 라이브러리도 빠르게 파악할 수 있습니다.

---

## Redux란

Redux는 **예측 가능한 상태 컨테이너(Predictable State Container)**입니다. 2015년 Dan Abramov가 Elm 아키텍처에서 영감을 받아 만들었습니다. 핵심 아이디어는 애플리케이션의 전체 상태를 하나의 JavaScript 객체에 담고, 그 상태를 바꾸는 유일한 방법을 "Action을 dispatch하는 것"으로 제한한다는 것입니다.

![Redux 단방향 데이터 흐름](/assets/posts/state-redux-core-flow.svg)

---

## 세 가지 원칙

Redux는 세 가지 핵심 원칙으로 요약됩니다.

### 1. 단일 진실의 원천 (Single Source of Truth)

애플리케이션의 전체 상태는 **단 하나의 Store** 안에 있는 단 하나의 객체 트리에 저장됩니다. 어느 컴포넌트에서든 같은 Store를 바라보기 때문에 UI와 데이터의 불일치가 생기지 않습니다.

```javascript
// Store의 상태 예시
{
  auth: { user: { id: '1', name: '홍길동' }, isLoading: false },
  todos: { items: [{ id: 1, text: 'Redux 배우기', done: false }] },
  ui: { theme: 'dark', sidebar: true }
}
```

### 2. 읽기 전용 State (State is Read-Only)

state를 직접 수정하는 것은 금지입니다. 상태를 바꾸려면 반드시 **Action 객체**를 dispatch해야 합니다. 이 덕분에 모든 상태 변경 이력이 Action 로그로 남아, 디버깅·타임 트래블이 가능해집니다.

```javascript
// 잘못된 방법 — 절대 금지
state.todos.push({ text: 'bad' })  // ❌

// 올바른 방법
store.dispatch({ type: 'todos/add', payload: { text: 'good' } })  // ✓
```

### 3. 순수 함수로 변경 (Changes by Pure Functions)

상태 변화는 **Reducer**라는 순수 함수로 기술합니다. 순수 함수는 같은 입력에 항상 같은 출력을 반환하고, 부수 효과(side effect)가 없습니다. 네트워크 요청, 랜덤 값 생성 같은 비순수 작업은 Reducer 밖에서 처리합니다.

---

## Action과 Action Creator

**Action**은 "무슨 일이 일어났는지"를 서술하는 plain JavaScript 객체입니다. `type` 필드가 필수이며, 추가 데이터는 관례상 `payload`에 담습니다.

```javascript
// Action 객체
{ type: 'todos/add', payload: { text: 'Redux 배우기' } }
{ type: 'todos/toggle', payload: { id: 1 } }
{ type: 'todos/remove', payload: { id: 1 } }
```

**Action Creator**는 Action 객체를 생성해 반환하는 함수입니다. 타입 오타를 방지하고 재사용성을 높입니다.

```javascript
// actionTypes.js
const ADD_TODO    = 'todos/add'
const TOGGLE_TODO = 'todos/toggle'
const REMOVE_TODO = 'todos/remove'

// actionCreators.js
function addTodo(text) {
  return { type: ADD_TODO, payload: { text } }
}

function toggleTodo(id) {
  return { type: TOGGLE_TODO, payload: { id } }
}

function removeTodo(id) {
  return { type: REMOVE_TODO, payload: { id } }
}
```

---

## Reducer — 불변성과 순수 함수

Reducer는 `(state, action) => newState` 형태의 순수 함수입니다. 기존 state를 **절대 수정하지 않고** 새 객체를 반환합니다.

![Redux 기본 패턴](/assets/posts/state-redux-core-code.svg)

### 불변성 유지

```javascript
// todos reducer
const initialState = {
  items: [],
  filter: 'all'
}

function todosReducer(state = initialState, action) {
  switch (action.type) {
    case 'todos/add':
      return {
        ...state,               // 기존 state 복사
        items: [
          ...state.items,       // 기존 배열 복사
          {
            id: Date.now(),
            text: action.payload.text,
            done: false
          }
        ]
      }

    case 'todos/toggle':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, done: !item.done }  // 해당 아이템만 새 객체로
            : item
        )
      }

    case 'todos/remove':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload.id)
      }

    case 'todos/setFilter':
      return { ...state, filter: action.payload.filter }

    default:
      return state  // 알 수 없는 액션 → 기존 state 그대로 반환
  }
}
```

`default: return state`가 반드시 있어야 합니다. Redux 초기화 과정에서 내부 Action들이 Reducer를 거치기 때문입니다.

### Reducer 합성 — combineReducers

규모가 커지면 Reducer를 분리하고 `combineReducers`로 합칩니다.

```javascript
import { combineReducers } from 'redux'

const rootReducer = combineReducers({
  todos: todosReducer,    // state.todos 관리
  auth: authReducer,      // state.auth 관리
  ui: uiReducer           // state.ui 관리
})
```

각 Reducer는 자신이 담당하는 슬라이스(slice)만 다루고, 전체 state 구조는 `combineReducers`가 조합합니다.

---

## Store — dispatch, getState, subscribe

Store는 Redux의 중심입니다. `createStore`(또는 RTK의 `configureStore`)로 생성합니다.

```javascript
import { createStore } from 'redux'

const store = createStore(rootReducer)

// 현재 state 조회
console.log(store.getState())
// → { todos: { items: [], filter: 'all' }, auth: {...}, ui: {...} }

// Action dispatch → Reducer 실행 → state 갱신
store.dispatch(addTodo('Redux 핵심 공부'))
store.dispatch(addTodo('미들웨어 이해'))

// 상태 변경 구독
const unsubscribe = store.subscribe(() => {
  console.log('state 변경:', store.getState())
})

// 구독 해제
unsubscribe()
```

---

## 미들웨어 — 비동기 처리의 핵심

Reducer는 순수 함수이므로 API 호출·타이머 같은 비동기 작업을 직접 처리할 수 없습니다. **미들웨어**가 `dispatch`와 `Reducer` 사이에 끼어들어 이를 처리합니다.

```
dispatch(action)
  → [미들웨어 1]
  → [미들웨어 2]
  → Reducer
  → 새 state
```

### Redux Thunk

가장 단순한 미들웨어입니다. Action 객체 대신 **함수**를 dispatch할 수 있게 해줍니다.

```javascript
import { createStore, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'

const store = createStore(rootReducer, applyMiddleware(thunk))
```

Thunk Action Creator는 함수를 반환합니다. 그 함수는 `dispatch`와 `getState`를 인자로 받습니다.

```javascript
// 비동기 Action Creator (Thunk)
function fetchTodos() {
  return async function(dispatch, getState) {
    // 로딩 시작
    dispatch({ type: 'todos/fetchStart' })

    try {
      const response = await fetch('/api/todos')
      const data = await response.json()

      // 성공
      dispatch({ type: 'todos/fetchSuccess', payload: data })
    } catch (error) {
      // 실패
      dispatch({ type: 'todos/fetchError', payload: error.message })
    }
  }
}

// 사용
store.dispatch(fetchTodos())
```

비동기 패턴을 더 강력하게 다루려면 **Redux Saga**(제너레이터 기반)나 **RTK Query**(데이터 페칭 전용)를 사용합니다.

---

## React와 연결 — react-redux

React 컴포넌트에서 Redux Store를 사용하려면 `react-redux` 패키지가 필요합니다.

### Provider 설정

```jsx
// index.tsx
import { Provider } from 'react-redux'
import { store } from './store'

root.render(
  <Provider store={store}>
    <App />
  </Provider>
)
```

### useSelector — state 읽기

```javascript
import { useSelector } from 'react-redux'

function TodoList() {
  // state.todos.items만 선택 → 해당 값이 바뀔 때만 리렌더
  const items = useSelector(state => state.todos.items)
  const filter = useSelector(state => state.todos.filter)

  const visibleItems = items.filter(item => {
    if (filter === 'done') return item.done
    if (filter === 'active') return !item.done
    return true
  })

  return (
    <ul>
      {visibleItems.map(item => (
        <li key={item.id}>{item.text}</li>
      ))}
    </ul>
  )
}
```

`useSelector`는 얕은 비교(reference equality)를 기본으로 합니다. 불필요한 리렌더를 막으려면 셀렉터를 가능한 한 최소 단위로 쪼개거나, `reselect`의 `createSelector`로 메모이제이션합니다.

### useDispatch — Action 보내기

```javascript
import { useDispatch } from 'react-redux'

function AddTodoForm() {
  const dispatch = useDispatch()
  const [text, setText] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    dispatch(addTodo(text))
    setText('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="할 일 입력"
      />
      <button type="submit">추가</button>
    </form>
  )
}
```

---

## 언제 Redux가 필요한가

Redux가 도입된 초기에는 "React를 쓰면 Redux가 필수"라는 인식이 있었지만, 현재는 그렇지 않습니다. 다음 기준으로 판단합니다.

### Redux가 적합한 경우

- **여러 컴포넌트가 같은 state를 공유**하고 prop drilling이 깊어질 때
- **서버 데이터 + 클라이언트 UI 상태**가 복잡하게 얽혀 있을 때
- **실행 취소/재실행(Undo/Redo)**이 필요할 때
- **Redux DevTools**로 상태 변화를 시각적으로 추적해야 할 때
- 팀 전체가 일관된 패턴으로 상태를 관리해야 할 때

### Redux 없이도 충분한 경우

- 소규모 앱 또는 단일 팀 컴포넌트 트리
- `useState` + `useContext`로 충분한 경우
- React Query / SWR로 서버 상태만 관리하면 되는 경우
- Zustand, Jotai, Recoil처럼 가벼운 대안이 더 적합한 경우

```
상태의 출처가 서버 데이터인가?
  → YES: React Query / RTK Query 우선 고려
  → NO: 클라이언트 상태

클라이언트 상태의 범위는?
  → 로컬(단일 컴포넌트): useState
  → 컴포넌트 트리 내: useContext
  → 전역 / 복잡한 업데이트: Redux (또는 Zustand)
```

---

## DevTools로 디버깅

Redux DevTools Extension은 Redux의 가장 강력한 무기입니다. 크롬/파이어폭스 확장 프로그램을 설치하고 `composeWithDevTools`를 적용하면:

- 모든 Action 로그 확인
- 특정 시점으로 상태를 되감기(Time Travel)
- Action 재실행
- state 트리 실시간 검사

```javascript
import { createStore, applyMiddleware } from 'redux'
import { composeWithDevTools } from 'redux-devtools-extension'
import thunk from 'redux-thunk'

const store = createStore(
  rootReducer,
  composeWithDevTools(applyMiddleware(thunk))
)
```

---

## 정리

Redux의 핵심을 한 문장으로 표현하면: **"모든 상태 변경은 Action이라는 이벤트 기록을 통해서만 가능하고, 그 기록에 따라 순수 함수(Reducer)가 새 상태를 만든다."**

이 단순한 원칙이 만들어내는 효과는 큽니다 — 예측 가능성, 추적 가능성, 테스트 용이성. 오늘날 Redux Toolkit은 이 원칙을 유지하면서 보일러플레이트를 대폭 줄여줍니다.

- **Action** — 무슨 일이 일어났는지 서술하는 객체
- **Reducer** — (이전 state, action) → 새 state를 반환하는 순수 함수
- **Store** — 단 하나의 상태 트리, dispatch·getState·subscribe 제공
- **Middleware** — 비동기 처리를 위한 dispatch 확장(Thunk, Saga)
- **react-redux** — useSelector로 읽고, useDispatch로 쓴다

다음 글에서는 [Redux Toolkit — 현대적 Redux 개발](/posts/state-redux-toolkit/)에서 `createSlice`, `createAsyncThunk`, RTK Query를 다룹니다.
