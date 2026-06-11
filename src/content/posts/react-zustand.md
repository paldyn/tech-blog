---
title: "Zustand — 가볍고 단순한 상태 관리"
description: "보일러플레이트 없이 전역 상태를 관리하는 Zustand를 다룹니다. create로 스토어 만들기, 셀렉터 기반 선택적 구독, useShallow, persist·devtools·immer 미들웨어, 스토어 슬라이스 패턴까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["Zustand", "상태관리", "전역상태", "셀렉터", "미들웨어"]
featured: false
draft: false
---

[지난 글](/posts/react-rtk-query/)에서 Redux 생태계 안에서 서버 상태까지 관리하는 방법을 살펴봤다. 그런데 모든 프로젝트에 Redux의 구조가 필요한 것은 아니다. 액션 타입도, 디스패치도, Provider도 없이 전역 상태를 다루고 싶다면 **Zustand**가 가장 인기 있는 선택지다. 핵심 API가 함수 하나(`create`)뿐인데도, 셀렉터 기반 구독 덕분에 성능 특성은 Context보다 오히려 좋다.

## 스토어 만들기 — create 하나면 끝

```tsx
// stores/useBearStore.ts
import { create } from 'zustand';

interface BearState {
  bears: number;
  fish: number;
  increase: (by: number) => void;
  eatFish: () => void;
  reset: () => void;
}

export const useBearStore = create<BearState>((set) => ({
  bears: 0,
  fish: 10,
  increase: (by) => set((state) => ({ bears: state.bears + by })),
  eatFish: () => set((state) => ({ fish: state.fish - 1 })),
  reset: () => set({ bears: 0, fish: 10 }),
}));
```

이게 전부다. Provider로 트리를 감쌀 필요도 없고, 리듀서나 액션 타입을 정의할 필요도 없다. `set`은 기존 상태와 **얕게 병합**되므로 `{ bears: state.bears + by }`만 반환해도 `fish`는 유지된다.

## 셀렉터로 구독하기 — 리렌더링 최소화의 핵심

스토어 훅을 호출할 때 **셀렉터 함수**를 넘기면 그 조각만 구독한다.

```tsx
function BearCounter() {
  // bears만 구독 — fish가 바뀌어도 리렌더링되지 않는다
  const bears = useBearStore((state) => state.bears);
  return <h1>곰 {bears}마리</h1>;
}

function Controls() {
  const increase = useBearStore((state) => state.increase);
  return <button onClick={() => increase(1)}>한 마리 추가</button>;
}
```

`set`이 호출되면 Zustand는 각 구독자의 셀렉터를 다시 실행하고, 결과가 `Object.is` 비교로 달라진 컴포넌트만 리렌더링한다.

![Zustand 스토어 모델](/assets/posts/react-zustand-store.svg)

주의할 점이 하나 있다. 셀렉터 없이 `useBearStore()`를 호출하면 스토어 전체를 구독하게 되어 어떤 값이 바뀌든 리렌더링된다. 항상 필요한 조각만 선택하는 습관을 들이자.

## 여러 값을 선택할 때 — useShallow

셀렉터가 객체를 새로 만들어 반환하면 매번 다른 참조가 되어 무한 리렌더링 경고가 발생한다. 이럴 때는 `useShallow`로 얕은 비교를 적용한다.

```tsx
import { useShallow } from 'zustand/react/shallow';

function BearDashboard() {
  // 객체 리터럴을 반환하지만 얕은 비교로 안정화
  const { bears, fish } = useBearStore(
    useShallow((state) => ({ bears: state.bears, fish: state.fish }))
  );

  return <p>곰 {bears} / 물고기 {fish}</p>;
}
```

## React 밖에서 스토어 사용하기

Zustand 스토어는 React 트리 밖에 존재하는 일반 객체다. 그래서 이벤트 핸들러, 유틸 함수, 심지어 WebSocket 콜백에서도 자유롭게 읽고 쓸 수 있다.

```ts
// 컴포넌트 밖 어디서든
const bears = useBearStore.getState().bears;   // 현재 값 읽기
useBearStore.setState({ bears: 100 });          // 값 쓰기

// 변경 구독 (React 외부 로직 연동)
const unsubscribe = useBearStore.subscribe((state) => {
  console.log('상태 변경:', state.bears);
});
```

Redux에서 미들웨어를 동원해야 했던 일들이 그냥 함수 호출로 해결된다.

## 미들웨어 — persist, devtools, immer

Zustand의 미들웨어는 스토어 생성자 함수를 감싸는 고차 함수다. 여러 개를 양파처럼 중첩해 합성한다.

```tsx
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export const useCartStore = create<CartState>()(
  devtools(
    persist(
      immer((set) => ({
        items: [],
        addItem: (item: CartItem) =>
          set((state) => {
            // immer 덕분에 직접 수정 문법 사용 가능
            state.items.push(item);
          }),
        clear: () => set((state) => {
          state.items = [];
        }),
      })),
      { name: 'cart-storage' }   // localStorage 키
    )
  )
);
```

![Zustand 미들웨어 합성](/assets/posts/react-zustand-middleware.svg)

- **persist**: 상태를 localStorage(또는 지정한 스토리지)에 자동 저장하고 새로고침 시 복원한다
- **devtools**: Redux DevTools 확장에서 상태 변화를 추적할 수 있다
- **immer**: `set` 안에서 mutable 문법을 쓰면 내부적으로 불변 업데이트로 변환한다

TypeScript에서 미들웨어를 쓸 때는 `create<T>()(...)` 처럼 **커리드 형태**로 호출해야 타입 추론이 올바르게 동작한다.

## 스토어가 커질 때 — 슬라이스 패턴

하나의 스토어가 비대해지면 Redux의 Slice처럼 도메인별 생성 함수로 나눌 수 있다.

```tsx
import { StateCreator } from 'zustand';

interface AuthSlice {
  user: User | null;
  login: (user: User) => void;
}

interface CartSlice {
  items: CartItem[];
  addItem: (item: CartItem) => void;
}

const createAuthSlice: StateCreator<AuthSlice & CartSlice, [], [], AuthSlice> =
  (set) => ({
    user: null,
    login: (user) => set({ user }),
  });

const createCartSlice: StateCreator<AuthSlice & CartSlice, [], [], CartSlice> =
  (set) => ({
    items: [],
    addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  });

export const useAppStore = create<AuthSlice & CartSlice>()((...args) => ({
  ...createAuthSlice(...args),
  ...createCartSlice(...args),
}));
```

## Redux와 무엇이 다른가

| 관점 | Redux Toolkit | Zustand |
|---|---|---|
| 보일러플레이트 | Slice, 스토어 설정 필요 | `create` 호출 한 번 |
| Provider | 필수 | 불필요 |
| 구독 단위 | `useSelector` | 셀렉터 (동일한 개념) |
| 미들웨어 생태계 | 매우 큼 | 핵심만 제공 |
| 적합한 규모 | 대규모·다인 팀 | 소~중규모, 빠른 개발 |

Zustand는 클라이언트 상태에 집중한 라이브러리다. 서버 데이터의 캐싱·재검증까지 Zustand로 해결하려 하면 결국 RTK Query 같은 것을 직접 만들게 된다. 다음 글에서는 서버 상태 관리의 사실상 표준이 된 TanStack Query를 살펴본다.

---

**지난 글:** [RTK Query — Redux에서 서버 상태 관리하기](/posts/react-rtk-query/)

**다음 글:** [TanStack Query — 서버 상태 관리의 표준](/posts/react-tanstack-query/)

<br>
읽어주셔서 감사합니다. 😊
