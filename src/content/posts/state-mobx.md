---
title: "MobX — 반응형 상태 관리"
description: "MobX의 투명한 반응형(Transparent Reactivity) 철학, Observable·Computed·Reaction 세 가지 핵심 개념, makeAutoObservable로 클래스 스토어 만들기, observer() HOC, 비동기 처리(runInAction·flow), Redux 대비 장단점까지 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "MobX", "상태관리", "반응형프로그래밍", "Observable", "Computed", "React", "makeAutoObservable"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "state-zustand-jotai-recoil"
  title: "Zustand · Jotai · Recoil — 가벼운 상태 관리 비교"
next:
  slug: "state-rxjs-intro"
  title: "RxJS 입문 — Observable과 반응형 프로그래밍"
---

[지난 글](/posts/state-zustand-jotai-recoil/)에서 Zustand·Jotai·Recoil의 가벼운 상태 관리 패턴을 살펴봤습니다. 이번에는 전혀 다른 접근 방식인 **MobX**를 다룹니다. MobX는 "상태를 어떻게 갱신할지" 대신 "어떤 상태가 변했는지"를 추적해 필요한 계산과 렌더링을 자동으로 처리하는 **투명한 반응형(Transparent Reactivity)** 라이브러리입니다.

---

## MobX 철학: 불필요한 동기화 제거

Redux를 사용하다 보면 "상태를 바꿨는데 왜 UI가 안 바뀌지?"라는 상황을 겪습니다. Action을 dispatch했는지, selector가 올바른지, 컴포넌트가 리렌더 조건을 충족했는지 일일이 확인해야 합니다.

MobX의 설계 원칙은 단순합니다:

> **"애플리케이션 상태에서 파생될 수 있는 모든 것은 자동으로 파생되어야 한다."**

관찰 가능한(observable) 상태를 정의해두면 그 상태를 참조하는 computed 값과 reaction(UI 렌더링 포함)이 상태 변경 시 자동으로 다시 계산됩니다. 개발자는 데이터 흐름을 수동으로 연결할 필요가 없습니다.

![MobX 반응형 시스템](/assets/posts/state-mobx-reactive.svg)

---

## 세 가지 핵심 개념

### 1. Observable State — 추적 대상

Observable은 MobX가 변경을 추적하는 상태입니다. 객체, 배열, Map, Set, 원시 값 모두 observable로 만들 수 있습니다.

```javascript
import { observable } from 'mobx'

const store = observable({
  price: 15000,
  quantity: 3,
  taxRate: 0.1,
  items: []
})
```

클래스 방식에서는 `makeObservable` 또는 `makeAutoObservable`로 선언합니다.

### 2. Computed Values — 파생 상태

Computed는 observable 상태로부터 자동으로 계산되는 값입니다. 의존하는 observable이 변경될 때만 재계산되고, 그렇지 않으면 캐시된 값을 반환합니다.

```javascript
import { computed } from 'mobx'

const subtotal = computed(() => store.price * store.quantity)
const total = computed(() => subtotal.get() * (1 + store.taxRate))
```

Computed는 순수 함수여야 합니다. 부수 효과(API 호출, DOM 조작 등)를 넣으면 안 됩니다.

### 3. Reactions — 부수 효과 자동 실행

Reaction은 observable 또는 computed 값이 변경될 때 자동으로 실행되는 함수입니다. UI 렌더링, 로깅, 네트워크 요청 등에 활용합니다.

```javascript
import { autorun, reaction, when } from 'mobx'

// autorun: 처음 실행되고, 의존하는 observable이 바뀔 때마다 재실행
const dispose = autorun(() => {
  console.log('총액:', total.get())
})

// reaction: 첫 번째 함수(데이터 선택)의 반환값이 바뀔 때만 두 번째 함수 실행
const stopReaction = reaction(
  () => store.items.length,
  count => console.log(`아이템 수 변경: ${count}`)
)

// 메모리 누수 방지: 더 이상 필요 없으면 해제
dispose()
stopReaction()
```

---

## MobX 5 vs MobX 6: 데코레이터에서 makeObservable로

MobX 5까지는 TypeScript 실험적 데코레이터(`@observable`, `@computed`, `@action`)가 주요 API였습니다. MobX 6부터는 **`makeObservable`** 과 **`makeAutoObservable`** 이 권장 방식이 되었습니다.

```javascript
// MobX 5 방식 (레거시)
class CartStore {
  @observable items = []
  @computed get total() { return this.items.reduce(...) }
  @action addItem(item) { this.items.push(item) }
}

// MobX 6 방식 (현재 권장)
class CartStore {
  items = []
  constructor() {
    makeObservable(this, {
      items: observable,
      total: computed,
      addItem: action
    })
  }
  get total() { return this.items.reduce(...) }
  addItem(item) { this.items.push(item) }
}
```

---

## makeAutoObservable로 클래스 스토어 만들기

`makeAutoObservable`은 클래스의 모든 프로퍼티·게터·메서드를 MobX가 자동으로 분류해줍니다. 일반 프로퍼티 → `observable`, getter → `computed`, 메서드 → `action`으로 자동 지정됩니다.

![MobX makeAutoObservable 패턴](/assets/posts/state-mobx-code.svg)

```javascript
import { makeAutoObservable } from 'mobx'

class CartStore {
  items = []
  taxRate = 0.1
  isLoading = false
  error = null

  constructor() {
    makeAutoObservable(this)
  }

  // computed — items나 taxRate가 바뀔 때만 재계산
  get subtotal() {
    return this.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  }

  get total() {
    return this.subtotal * (1 + this.taxRate)
  }

  get itemCount() {
    return this.items.reduce((n, item) => n + item.qty, 0)
  }

  // action — 상태를 변경하는 메서드
  addItem(item) {
    const existing = this.items.find(i => i.id === item.id)
    if (existing) {
      existing.qty += 1
    } else {
      this.items.push({ ...item, qty: 1 })
    }
  }

  removeItem(id) {
    this.items = this.items.filter(i => i.id !== id)
  }

  clearCart() {
    this.items = []
  }
}

export const cartStore = new CartStore()
```

스토어 인스턴스를 모듈 최상위에서 생성하고 export하는 것이 일반적인 패턴입니다.

---

## observer() HOC와 useLocalObservable

### observer()

`mobx-react-lite`의 `observer`로 컴포넌트를 감싸면, 컴포넌트가 렌더 중에 읽은 observable이 바뀔 때 자동으로 리렌더됩니다.

```jsx
import { observer } from 'mobx-react-lite'
import { cartStore } from './CartStore'

const CartSummary = observer(() => {
  return (
    <div>
      <p>상품 수: {cartStore.itemCount}</p>
      <p>소계: {cartStore.subtotal.toLocaleString()}원</p>
      <p>합계: {cartStore.total.toLocaleString()}원</p>
    </div>
  )
})
```

`observer`는 함수 컴포넌트와 클래스 컴포넌트 모두 지원하지만, 함수 컴포넌트에서는 `mobx-react-lite`를 사용하는 것이 더 가볍습니다.

### useLocalObservable

컴포넌트 로컬 상태를 MobX로 관리할 때 `useLocalObservable`을 사용합니다.

```jsx
import { useLocalObservable, observer } from 'mobx-react-lite'

const Counter = observer(() => {
  const state = useLocalObservable(() => ({
    count: 0,
    get doubled() { return this.count * 2 },
    increment() { this.count++ },
    decrement() { this.count-- }
  }))

  return (
    <div>
      <button onClick={state.decrement}>-</button>
      <span>{state.count} (x2: {state.doubled})</span>
      <button onClick={state.increment}>+</button>
    </div>
  )
})
```

---

## action으로 상태 변경

MobX는 `action` 내부에서 여러 observable을 변경해도 리렌더를 한 번만 발생시킵니다. `makeAutoObservable`을 사용하면 클래스 메서드는 자동으로 action이 됩니다.

명시적으로 action을 쓰고 싶다면:

```javascript
import { action, observable } from 'mobx'

const store = observable({ count: 0, name: '' })

const resetAll = action(() => {
  store.count = 0
  store.name = ''
  // 두 변경 모두 배치 처리 → reaction/observer가 한 번만 실행
})
```

---

## runInAction과 flow — 비동기 처리

### runInAction

비동기 함수 안에서는 `await` 이후의 상태 변경이 자동으로 action 컨텍스트에서 실행되지 않습니다. `runInAction`으로 명시적으로 감싸야 합니다.

```javascript
class ProductStore {
  products = []
  isLoading = false
  error = null

  constructor() {
    makeAutoObservable(this)
  }

  async fetchProducts() {
    this.isLoading = true       // action 컨텍스트 (makeAutoObservable)
    this.error = null

    try {
      const data = await fetch('/api/products').then(r => r.json())

      runInAction(() => {       // await 이후는 runInAction 필요
        this.products = data
        this.isLoading = false
      })
    } catch (err) {
      runInAction(() => {
        this.error = err.message
        this.isLoading = false
      })
    }
  }
}
```

### flow

`flow`는 제너레이터 함수를 사용해 `runInAction` 없이도 비동기 처리를 깔끔하게 작성할 수 있게 해줍니다.

```javascript
import { makeAutoObservable, flow } from 'mobx'

class ProductStore {
  products = []
  isLoading = false

  constructor() {
    makeAutoObservable(this, {
      fetchProducts: flow  // flow로 명시
    })
  }

  *fetchProducts() {           // function* 제너레이터
    this.isLoading = true
    try {
      const response = yield fetch('/api/products')
      this.products = yield response.json()
    } finally {
      this.isLoading = false
    }
  }
}
```

`flow`는 내부적으로 각 `yield` 사이를 자동으로 action 컨텍스트로 감싸줍니다. `runInAction` 없이 더 선언적인 코드를 작성할 수 있습니다.

---

## MobX-React-Lite vs MobX-React

| 항목 | mobx-react-lite | mobx-react |
|---|---|---|
| 지원 컴포넌트 | 함수형만 | 함수형 + 클래스형 |
| 번들 크기 | 더 가벼움 | 더 큼 |
| `useLocalObservable` | 지원 | 지원 |
| `inject` HOC | 미지원 | 지원 (레거시) |
| 권장 여부 | 신규 프로젝트 권장 | 클래스형 필요 시 |

리액트 함수 컴포넌트만 사용한다면 `mobx-react-lite`를 선택하세요.

---

## Redux 대비 장단점

### MobX의 장점

**적은 보일러플레이트.** Redux는 Action type 상수, Action creator, Reducer, selector를 모두 작성해야 합니다. MobX는 클래스 하나에 상태·로직·파생 값을 함께 담을 수 있습니다.

**직관적인 변이.** `store.count++` 처럼 직접 변경하면 됩니다. 불변성을 수동으로 유지할 필요가 없습니다.

**자동 최적화.** Computed는 메모이제이션이 기본이고, observer 컴포넌트는 실제로 읽은 observable이 바뀔 때만 리렌더됩니다.

**OOP 친화적.** 클래스 기반 도메인 모델과 자연스럽게 맞습니다. 백엔드 경험이 있는 개발자가 접근하기 쉽습니다.

### MobX의 단점

**마법 같은 동작.** "왜 리렌더가 발생했는가" 또는 "왜 발생하지 않았는가"를 추적하기 어렵습니다. Redux의 명시적 데이터 흐름이 더 예측 가능하게 느껴질 수 있습니다.

**DevTools.** Redux DevTools만큼 강력하지 않습니다. MobX DevTools가 있지만 타임 트래블 디버깅이나 Action 로그 분석은 Redux가 우위입니다.

**엄격 모드(Strict Mode) 필요.** `configure({ enforceActions: 'always' })`로 action 밖에서 상태를 변경하지 못하게 강제해야 대규모 팀에서 일관성을 유지할 수 있습니다.

**서버 사이드 렌더링 주의.** 싱글턴 스토어 패턴은 SSR에서 요청 간 상태 공유 문제가 생길 수 있습니다. 요청마다 스토어 인스턴스를 새로 만들거나 React Context로 전달해야 합니다.

```javascript
// SSR 안전한 패턴: Context로 스토어 전달
const StoreContext = React.createContext(null)

export function StoreProvider({ children }) {
  const store = useRef(new CartStore()).current
  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  )
}

export function useCartStore() {
  return useContext(StoreContext)
}
```

---

## 언제 MobX를 선택할까

MobX는 다음 상황에서 특히 빛납니다:

- **복잡한 도메인 모델** — 엔티티 간 관계가 많고, 파생 값이 복잡한 비즈니스 로직
- **빠른 프로토타이핑** — 보일러플레이트 없이 빠르게 상태를 연결해야 할 때
- **OOP 스타일 선호** — 클래스와 캡슐화에 익숙한 팀
- **기존 MobX 코드베이스** — 레거시 MobX 5 코드를 MobX 6로 마이그레이션

반면 **예측 가능성과 추적 가능성**이 중요하고, 팀이 함수형 패러다임을 선호한다면 Redux Toolkit이나 Zustand가 더 나은 선택일 수 있습니다.

---

## 정리

MobX는 "필요한 것만 자동으로 업데이트"라는 원칙 하나로 복잡한 상태 동기화 코드를 줄여줍니다. 핵심 개념 세 가지를 기억하면 MobX를 빠르게 파악할 수 있습니다.

- **Observable** — MobX가 변경을 추적하는 상태
- **Computed** — observable로부터 자동 계산되는 파생 값 (캐시됨)
- **Reaction** — 상태 변경 시 자동으로 실행되는 부수 효과 (observer 포함)

`makeAutoObservable` 하나로 클래스 스토어를 빠르게 구성하고, `observer`로 컴포넌트를 감싸는 것이 MobX 6의 핵심 패턴입니다. 비동기는 `runInAction` 또는 `flow`로 처리합니다.

다음 글에서는 [RxJS 입문 — Observable과 반응형 프로그래밍](/posts/state-rxjs-intro/)에서 이벤트 스트림을 다루는 또 다른 반응형 접근 방식을 살펴봅니다.
