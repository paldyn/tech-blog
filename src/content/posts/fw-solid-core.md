---
title: "SolidJS 핵심 — 세밀한 반응성과 Virtual DOM 없는 선언적 UI"
description: "SolidJS의 세밀한 반응성(Fine-Grained Reactivity), createSignal/createMemo/createEffect/createResource, 제어 흐름 컴포넌트, JSX 컴파일 방식, React와의 핵심 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "SolidJS", "Signal", "반응성", "Virtual DOM", "JSX", "createSignal", "성능"]
featured: false
draft: false
---

[지난 글](/posts/fw-angular-core/)에서 Angular의 DI와 Signals를 살펴봤습니다. 이번에는 **SolidJS**를 다룹니다. SolidJS는 React와 문법이 매우 유사하지만(JSX, 함수형 컴포넌트) 내부 동작은 근본적으로 다릅니다. React는 상태가 바뀌면 컴포넌트 함수를 재실행하는 반면, **SolidJS는 컴포넌트 함수를 단 한 번만 실행하고, Signal 변경 시 연결된 DOM 노드만 직접 업데이트합니다.**

---

## 핵심: 컴포넌트는 한 번만 실행된다

![SolidJS — 세밀한 반응성](/assets/posts/fw-solid-core-reactivity.svg)

React에서 `useState`로 상태를 바꾸면 해당 컴포넌트 함수 전체가 다시 실행됩니다. Virtual DOM Diff를 통해 변경 사항을 DOM에 반영합니다.

SolidJS는 다릅니다. `createSignal`로 만든 Signal을 JSX 안에서 읽으면(`count()`), 컴파일러가 그 DOM 노드를 Signal의 의존성으로 등록합니다. Signal이 바뀌면 그 노드만 업데이트됩니다. 컴포넌트 함수는 초기 실행 시 DOM 구조를 한 번 만들고 끝납니다.

```javascript
import { createSignal, createMemo, createEffect } from 'solid-js'

function Counter() {
  // 이 함수는 마운트 시 단 한 번만 실행
  const [count, setCount] = createSignal(0)
  const doubled = createMemo(() => count() * 2)

  createEffect(() => {
    console.log('count changed:', count())  // count를 읽으므로 의존성 등록
  })

  return (
    <div>
      <p>Count: {count()}</p>       {/* count Signal에 연결된 텍스트 노드 */}
      <p>Doubled: {doubled()}</p>   {/* doubled Memo에 연결 */}
      <button onClick={() => setCount(c => c + 1)}>증가</button>
    </div>
  )
}
```

---

## 반응성 프리미티브

![SolidJS 반응성 프리미티브](/assets/posts/fw-solid-core-primitives.svg)

### createSignal

```javascript
const [count, setCount] = createSignal(0)

count()          // 현재 값 읽기 (Effect 안에서 읽으면 의존성 등록)
setCount(5)      // 값 설정
setCount(c => c + 1)  // 이전 값 기반 업데이트
```

### createMemo

Vue의 `computed`와 유사합니다. 의존 Signal이 변경될 때만 재계산됩니다.

```javascript
const doubled = createMemo(() => count() * 2)
const expensiveCalc = createMemo(() => {
  // count 또는 items가 바뀔 때만 재실행
  return items().filter(item => item.value > count())
})
```

### createEffect

Signal을 읽으면 의존성으로 자동 등록됩니다. cleanup을 위해 함수를 반환합니다.

```javascript
createEffect(() => {
  const timer = setTimeout(() => console.log(count()), 1000)
  return () => clearTimeout(timer)  // 재실행 전 cleanup
})
```

### createResource — 비동기 데이터

```javascript
async function fetchUser(id) {
  const res = await fetch(`/api/users/${id}`)
  return res.json()
}

function UserProfile() {
  const [userId, setUserId] = createSignal(1)

  // userId가 바뀌면 fetchUser를 자동으로 다시 호출
  const [user] = createResource(userId, fetchUser)

  return (
    <Suspense fallback={<p>로딩 중...</p>}>
      <ErrorBoundary fallback={err => <p>오류: {err.message}</p>}>
        <p>{user()?.name}</p>
      </ErrorBoundary>
    </Suspense>
  )
}
```

`user.loading`, `user.error`로 상태를 확인할 수 있습니다.

---

## 제어 흐름 — JSX를 쓰지 않는 이유

React에서 `{condition && <Component />}` 같은 JSX는 직관적이지만, SolidJS에서 이 패턴은 조건이 바뀔 때마다 불필요한 DOM 생성/삭제를 유발할 수 있습니다. 대신 **제어 흐름 컴포넌트**를 씁니다.

```jsx
import { Show, For, Switch, Match } from 'solid-js'

// Show — 조건부 렌더링
<Show when={user()} fallback={<p>로그인이 필요합니다</p>}>
  <p>환영합니다, {user().name}!</p>
</Show>

// For — 리스트 렌더링 (key 불필요, 참조 추적)
<For each={items()} fallback={<p>항목 없음</p>}>
  {(item, index) => <li>{index() + 1}. {item.name}</li>}
</For>

// Switch / Match — 다중 조건
<Switch fallback={<p>알 수 없는 상태</p>}>
  <Match when={status() === 'loading'}><Loading /></Match>
  <Match when={status() === 'error'}><Error /></Match>
  <Match when={status() === 'success'}><Data /></Match>
</Switch>
```

---

## Stores — 중첩 객체 반응성

`createStore`는 중첩 객체에서도 세밀한 반응성을 유지합니다.

```javascript
import { createStore, produce } from 'solid-js/store'

const [store, setStore] = createStore({
  users: [
    { id: 1, name: 'Alice', active: true },
    { id: 2, name: 'Bob', active: false },
  ],
})

// 경로 기반 업데이트 — 해당 노드만 업데이트됨
setStore('users', 0, 'name', 'Alice Smith')

// produce (Immer 유사 문법)
setStore(produce(state => {
  state.users.push({ id: 3, name: 'Charlie', active: true })
}))
```

---

## SolidStart — 메타 프레임워크

SolidStart는 SolidJS의 공식 메타 프레임워크입니다. 파일 시스템 라우팅, SSR, 서버 함수를 지원합니다.

```javascript
// routes/users/[id].jsx
import { createRouteData, useRouteData, useParams } from 'solid-start'

export function routeData() {
  const params = useParams()
  return createRouteData(() => fetchUser(params.id))
}

export default function UserPage() {
  const user = useRouteData()
  return <h1>{user()?.name}</h1>
}
```

---

## 성능 벤치마크 특성

SolidJS는 [js-framework-benchmark](https://krausest.github.io/js-framework-benchmark/)에서 지속적으로 최상위 성능을 기록합니다. Virtual DOM 없이 직접 DOM을 조작하고, 불필요한 컴포넌트 재실행이 없기 때문입니다. 번들 크기도 작습니다(약 7KB gzip).

다만 Signal 값을 읽을 때 반드시 함수를 호출해야 한다는 점(`count()`)이 처음엔 불편하게 느껴질 수 있고, React 생태계(React Query, UI 라이브러리 등)를 그대로 사용할 수 없다는 점이 단점입니다.

---

**지난 글:** [Angular 핵심 — Zone.js, DI, 변경 감지, Signals](/posts/fw-angular-core/)

**다음 글:** [Qwik 핵심 — 재개 가능성(Resumability)과 O(1) 로딩](/posts/fw-qwik-core/)

<br>
읽어주셔서 감사합니다. 😊
