---
title: "Zustand · Jotai · Recoil — 가벼운 상태 관리 비교"
description: "Redux 없이 상태를 관리하는 세 가지 경량 라이브러리 — Zustand, Jotai, Recoil의 API, 패러다임, 성능, 선택 기준을 실전 예제로 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Zustand", "Jotai", "Recoil", "상태관리", "React", "Atomic", "경량"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "state-redux-toolkit"
  title: "Redux Toolkit — 현대적 Redux 개발"
next:
  slug: "state-mobx"
  title: "MobX — 반응형 상태 관리"
---

[지난 글](/posts/state-redux-toolkit/)에서 Redux Toolkit을 통해 Redux의 보일러플레이트를 줄이는 방법을 살펴봤습니다. RTK는 강력하지만, 여전히 스토어 설정·리듀서·Provider 래핑이 필요합니다. 컴포넌트 간에 상태를 공유하는 데 굳이 Redux만큼의 무게가 필요하지 않은 경우도 많습니다. 이 글에서는 **Zustand**, **Jotai**, **Recoil** 세 가지 경량 라이브러리를 비교합니다.

---

## Redux의 복잡성, 어디까지 줄일 수 있나

Redux의 진짜 가치는 **예측 가능성**과 **DevTools**입니다. 하지만 소규모 앱이나 UI 상태처럼 단순한 경우에 다음이 과도하게 느껴질 수 있습니다.

- Provider로 앱 전체 감싸기
- 슬라이스·리듀서 파일 구조 설계
- `useSelector`와 `useDispatch` 조합 반복
- 비동기마다 `createAsyncThunk` 작성

경량 라이브러리들은 이런 의식을 줄이는 것을 목표로 설계됐습니다.

---

## 라이브러리 비교 한눈에 보기

![경량 상태 관리 라이브러리 비교](/assets/posts/state-zustand-jotai-recoil-compare.svg)

| | Zustand | Jotai | Recoil |
|---|---|---|---|
| 번들 크기 | ~1KB | ~4KB | ~20KB+ |
| 패러다임 | Flux (단일 스토어) | Atomic (원자 단위) | Atomic (원자 단위) |
| Provider 필요 | 불필요 | 불필요 | RecoilRoot 필요 |
| 비동기 | 직접 async 함수 | Async atom + Suspense | Async selector + Suspense |
| DevTools | 지원 | 제한적 | 지원 |
| 유지보수 | 활발 | 활발 | 비활성화 추세 |

---

## Zustand — 가장 단순한 전역 상태

Zustand는 Jotai와 같은 팀(pmndrs)이 만든 라이브러리로, **훅 기반의 단순한 전역 스토어**를 제공합니다. Redux와 마찬가지로 단일 스토어를 사용하지만, Provider 없이 어디서든 `import`해서 바로 사용합니다.

### create — 스토어 생성

```typescript
import { create } from 'zustand'

interface BearState {
  bears: number
  fish: number
  addBear: () => void
  eatFish: () => void
  reset: () => void
}

const useBearStore = create<BearState>((set, get) => ({
  bears: 0,
  fish: 10,
  addBear: () => set((state) => ({ bears: state.bears + 1 })),
  eatFish: () => {
    // get()으로 현재 상태 읽기
    if (get().fish > 0) {
      set((state) => ({ fish: state.fish - 1 }))
    }
  },
  reset: () => set({ bears: 0, fish: 10 }),
}))
```

`create`의 콜백이 받는 `set`은 부분 업데이트를 병합합니다. `get`으로 현재 상태를 읽을 수 있습니다. 반환된 훅은 컴포넌트에서 직접 사용합니다.

```typescript
function BearCounter() {
  const bears = useBearStore((state) => state.bears)
  const addBear = useBearStore((state) => state.addBear)

  return <button onClick={addBear}>곰 {bears}마리</button>
}
```

### 선택적 구독 — 불필요한 리렌더 방지

`useBearStore`에 셀렉터 함수를 넘기면 해당 값이 바뀔 때만 리렌더됩니다. 셀렉터 없이 `useBearStore()`를 사용하면 스토어 전체를 구독해 모든 변경에 반응합니다.

```typescript
// bears만 구독 — fish가 바뀌어도 리렌더 안 함
const bears = useBearStore((state) => state.bears)

// 여러 값을 한 번에 — 얕은 비교로 최적화
import { useShallow } from 'zustand/react/shallow'
const { bears, fish } = useBearStore(
  useShallow((state) => ({ bears: state.bears, fish: state.fish }))
)
```

### 미들웨어 — persist, devtools

Zustand는 미들웨어를 **함수 래핑** 방식으로 적용합니다.

```typescript
import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'

const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set) => ({
        theme: 'dark' as 'dark' | 'light',
        language: 'ko',
        setTheme: (theme) => set({ theme }),
        setLanguage: (lang) => set({ language: lang }),
      }),
      {
        name: 'settings-storage',  // localStorage 키
        partialize: (state) =>     // 일부만 저장
          ({ theme: state.theme }),
      }
    ),
    { name: 'SettingsStore' }      // DevTools에 표시될 이름
  )
)
```

`persist` 미들웨어는 기본적으로 `localStorage`를 사용하며, `storage` 옵션으로 `sessionStorage`나 커스텀 스토리지를 지정할 수 있습니다.

### 비동기 액션

Zustand는 별도 미들웨어 없이 `set` 안에서 async/await를 사용합니다.

```typescript
const usePostStore = create<PostState>((set) => ({
  posts: [],
  loading: false,
  error: null,
  fetchPosts: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/posts')
      const posts = await res.json()
      set({ posts, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },
}))
```

---

## Jotai — Atom 단위의 정밀한 상태

Jotai는 **Atomic 상태 관리** 패러다임을 따릅니다. 각 상태 조각이 독립적인 `atom`이고, 컴포넌트는 필요한 atom만 구독합니다. 이 구조 덕분에 관련 없는 상태 변경이 리렌더를 유발하지 않습니다.

### atom — 기본 상태 단위

```typescript
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'

const countAtom = atom(0)
const textAtom = atom('hello')
const darkModeAtom = atom(false)

// 컴포넌트에서 사용
function Counter() {
  const [count, setCount] = useAtom(countAtom)
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      카운트: {count}
    </button>
  )
}

// 읽기만 필요한 경우
function Display() {
  const count = useAtomValue(countAtom)  // 리렌더 최적화
  return <span>{count}</span>
}

// 쓰기만 필요한 경우
function ResetButton() {
  const setCount = useSetAtom(countAtom)  // 구독 없이 setter만
  return <button onClick={() => setCount(0)}>초기화</button>
}
```

`useAtomValue`와 `useSetAtom`을 분리하면 불필요한 구독을 줄여 성능을 높일 수 있습니다.

### 파생 atom — 의존 관계 선언

Jotai의 강력함은 **파생 atom**에 있습니다. 기존 atom을 조합해 새로운 atom을 만들고, 의존 atom이 바뀌면 자동으로 재계산됩니다.

![Jotai 파생 Atom 의존 그래프](/assets/posts/state-zustand-jotai-recoil-atomic.svg)

```typescript
const priceAtom = atom(15000)
const quantityAtom = atom(3)
const taxRateAtom = atom(0.1)

// 파생 atom — 읽기 전용
const subtotalAtom = atom((get) => get(priceAtom) * get(quantityAtom))
const taxAtom = atom((get) => get(subtotalAtom) * get(taxRateAtom))
const totalAtom = atom((get) => get(subtotalAtom) + get(taxAtom))

// 쓰기 가능한 파생 atom
const priceWithDiscountAtom = atom(
  (get) => get(priceAtom),
  (get, set, discount: number) => {
    set(priceAtom, Math.round(get(priceAtom) * (1 - discount)))
  }
)
```

파생 atom의 `get`은 의존성을 자동으로 추적합니다. `priceAtom`이 바뀌면 `subtotalAtom`, `taxAtom`, `totalAtom`이 순서대로 재계산됩니다.

### 비동기 atom과 Suspense

Jotai는 React Suspense와 자연스럽게 통합됩니다. `atom`의 getter에서 Promise를 반환하면 해당 atom을 사용하는 컴포넌트는 Suspense로 감싸야 합니다.

```typescript
const postsAtom = atom(async () => {
  const res = await fetch('/api/posts')
  return res.json() as Promise<Post[]>
})

// Suspense 없이 — loadable 래퍼 사용
import { loadable } from 'jotai/utils'
const postsLoadableAtom = loadable(postsAtom)

function PostList() {
  const postsLoadable = useAtomValue(postsLoadableAtom)

  if (postsLoadable.state === 'loading') return <Spinner />
  if (postsLoadable.state === 'hasError') return <ErrorView />
  return <ul>{postsLoadable.data.map(/* ... */)}</ul>
}
```

### atomWithStorage — 영속성

```typescript
import { atomWithStorage } from 'jotai/utils'

const darkModeAtom = atomWithStorage('darkMode', false)
// localStorage에 자동 저장·복원
```

`atomWithStorage`는 `localStorage`, `sessionStorage`, `AsyncStorage`(React Native)를 지원합니다.

---

## Recoil — Facebook의 Atomic 상태 관리

Recoil은 Facebook이 내부에서 사용하던 상태 관리 패턴을 오픈소스로 공개한 라이브러리입니다. Jotai와 비슷한 Atomic 모델을 사용하지만, 몇 가지 차이가 있습니다.

### atom과 selector

```typescript
import { atom, selector, useRecoilValue, useSetRecoilState } from 'recoil'

// atom은 반드시 전역 유일한 key 필요
const countState = atom({
  key: 'countState',   // 고유 문자열 key
  default: 0,
})

// selector — 파생 상태 (Jotai의 파생 atom에 해당)
const doubleCountState = selector({
  key: 'doubleCountState',
  get: ({ get }) => get(countState) * 2,
})

// 비동기 selector
const userState = selector({
  key: 'userState',
  get: async ({ get }) => {
    const id = get(userIdState)
    const res = await fetch(`/api/users/${id}`)
    return res.json()
  },
})
```

Jotai와 달리 모든 atom과 selector가 **전역 고유 key**를 가져야 합니다. 이는 Snapshot API나 서버 사이드 렌더링에서 상태를 직렬화할 때 사용됩니다.

```typescript
// RecoilRoot로 앱 감싸기 필요
function App() {
  return (
    <RecoilRoot>
      <Counter />
    </RecoilRoot>
  )
}
```

### Snapshot API

Recoil의 차별점은 **Snapshot**입니다. 특정 시점의 전체 상태를 캡처하고, 이를 비교하거나 롤백할 수 있습니다.

```typescript
import { useRecoilSnapshot } from 'recoil'

function DebugObserver() {
  const snapshot = useRecoilSnapshot()
  useEffect(() => {
    console.debug('State changed:')
    for (const node of snapshot.getNodes_UNSTABLE({ isModified: true })) {
      console.debug(node.key, snapshot.getLoadable(node))
    }
  }, [snapshot])
  return null
}
```

### Recoil의 현황과 한계

Recoil은 2020년 공개 이후 활발하게 발전했지만, 2023년부터 Facebook 내부의 우선순위 변화로 유지보수가 크게 줄었습니다. 핵심 팀원들이 이탈했고, 주요 버그 수정도 늦어지고 있습니다. 번들 크기도 ~20KB로 Zustand(~1KB), Jotai(~4KB)에 비해 상당히 큽니다.

Recoil을 기존 코드에서 사용 중이라면 당장 마이그레이션이 필요하지는 않지만, 신규 프로젝트에서는 Jotai가 더 나은 선택입니다. Jotai는 Recoil의 Atomic 모델을 계승하면서 더 가볍고 TypeScript 친화적으로 설계됐습니다.

---

## 세 라이브러리 비교 심화

### 구독 단위

```
Redux/Zustand         Jotai/Recoil
───────────────       ──────────────────────────
단일 스토어            개별 atom
컴포넌트는             컴포넌트는 구독한 atom만
스토어 일부를           변경될 때 리렌더
셀렉터로 선택
```

Zustand는 셀렉터를 잘 작성하면 리렌더를 최소화할 수 있습니다. Jotai는 atom 단위로 구독하므로 셀렉터 없이도 자동으로 최소 리렌더가 보장됩니다.

### 코드량 비교 — 동일한 장바구니 상태

```typescript
// Zustand
const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  total: 0,
}))

// Jotai
const cartItemsAtom = atom<Item[]>([])
const cartTotalAtom = atom((get) =>
  get(cartItemsAtom).reduce((sum, item) => sum + item.price, 0)
)
```

두 접근 모두 간결하지만 패러다임이 다릅니다. Zustand는 상태와 액션을 한 객체에 묶고, Jotai는 상태와 파생 상태를 atom으로 분리합니다.

### TypeScript 통합

세 라이브러리 모두 TypeScript를 지원합니다.

```typescript
// Zustand — 제네릭으로 스토어 타입 지정
const useStore = create<MyState>((set) => ({ /* ... */ }))

// Jotai — atom 타입 추론 (대부분 자동)
const countAtom = atom(0)             // Atom<number>
const nameAtom = atom<string | null>(null)  // 명시적 지정

// Recoil — AtomEffect, DefaultValue 등 별도 타입
const myAtom = atom<number>({ key: 'my', default: 0 })
```

Jotai는 타입 추론이 가장 자연스럽습니다. Zustand는 스토어 타입을 인터페이스로 명시해야 합니다.

---

## 선택 가이드

어떤 라이브러리를 선택해야 할까요?

### Zustand를 선택하세요, 만약

- 전역 상태 구조가 명확히 정의되어 있고, 팀이 Redux 스타일에 익숙한 경우
- 스토어 내부에 비즈니스 로직(액션 함수)을 함께 두고 싶은 경우
- Redux DevTools 수준의 시간 여행 디버깅이 필요한 경우
- 번들 크기가 극도로 중요한 경우 (~1KB)

### Jotai를 선택하세요, 만약

- 상태가 독립적인 여러 atom으로 나뉘고 파생 관계가 복잡한 경우
- React Suspense를 비동기 처리에 적극 활용하는 경우
- 서버 컴포넌트(RSC)와 SSR 환경이 중요한 경우
- Recoil을 사용 중인데 마이그레이션을 고려 중인 경우

### RTK Query / React Query를 선택하세요, 만약

- 상태 관리의 주목적이 서버 데이터 페칭·캐싱인 경우
- 이미 Redux를 사용 중이고 추가 라이브러리를 늘리고 싶지 않은 경우

### Context API를 선택하세요, 만약

- 상태를 공유하는 컴포넌트 범위가 좁고(테마, 언어 설정 등) 변경 빈도가 낮은 경우
- 외부 의존성을 최소화해야 하는 경우

---

## 마치며

Zustand, Jotai, Recoil은 모두 Redux의 복잡성을 줄이기 위해 설계됐지만 접근 방식이 다릅니다. Zustand는 단순함과 유연성을, Jotai는 원자 단위의 정밀한 구독을, Recoil은 Facebook 스케일의 Atomic 모델을 지향했습니다.

현재 기준으로 **Zustand**는 단순한 전역 상태에 최선의 선택이며, **Jotai**는 Atomic 패러다임이 필요할 때 Recoil보다 훨씬 나은 대안입니다. Recoil은 기존 프로젝트 유지 외에 신규 채택은 권장하지 않습니다.

다음 글에서는 반응형 프로그래밍 기반의 **MobX**를 살펴봅니다. MobX는 Observable 패턴으로 상태를 자동 추적해 Redux/Zustand와 전혀 다른 개발 경험을 제공합니다.
