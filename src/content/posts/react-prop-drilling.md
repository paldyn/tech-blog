---
title: "Prop Drilling 문제와 해결책"
description: "중간 컴포넌트들이 불필요하게 props를 전달하는 prop drilling 문제의 원인, Context·컴포지션(slot)·상태 관리 라이브러리 세 가지 해결 전략과 각각의 적용 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 10
type: "knowledge"
category: "React"
tags: ["React", "PropDrilling", "Context", "컴포지션", "상태관리", "설계패턴"]
featured: false
draft: false
---

[지난 글](/posts/react-key-as-reset/)에서 key prop으로 컴포넌트를 리셋하는 패턴을 다뤘다. 이번에는 React 앱에서 매우 흔하게 마주치는 prop drilling 문제를 살펴본다. 컴포넌트 트리가 깊어질수록 필요 없는 곳을 거쳐 데이터가 전달되어야 하는 상황이 생긴다. 이 문제를 인식하고 세 가지 전략 중 상황에 맞는 것을 고르는 방법을 알아본다.

## Prop Drilling이란

어떤 데이터가 컴포넌트 트리 아래쪽에서 필요한데, 그 데이터를 실제로 사용하지 않는 중간 컴포넌트들도 전달받고 넘겨줘야 하는 상황이다.

```
App (user 데이터 보유)
  └── Page (user 필요 없음, 그냥 전달)
        └── Layout (user 필요 없음, 그냥 전달)
              └── Sidebar (user 필요 없음, 그냥 전달)
                    └── UserProfile (실제로 user를 사용!)
```

![Prop Drilling 문제와 Context 해결](/assets/posts/react-prop-drilling-diagram.svg)

이 구조는 여러 문제를 만든다. 중간 컴포넌트의 props 인터페이스가 지저분해진다. `user`의 타입이 바뀌면 중간 컴포넌트를 모두 수정해야 한다. 컴포넌트를 재사용하기 어려워진다. 코드를 읽을 때 props가 어디서 왔는지 추적하기 힘들다.

## 해결책 1: Context

가장 직접적인 해결책이다. 데이터가 필요한 컴포넌트들의 공통 조상에 Context.Provider를 설치하고, 필요한 곳에서 `useContext`로 직접 소비한다.

```jsx
const UserContext = createContext(null);

function App() {
  const user = useCurrentUser();
  return (
    <UserContext.Provider value={user}>
      <Page />
    </UserContext.Provider>
  );
}

// 중간 컴포넌트들: user prop 전혀 없음
function Page() { return <Layout />; }
function Layout() { return <Sidebar />; }
function Sidebar() { return <UserProfile />; }

// 실제 사용처
function UserProfile() {
  const user = useContext(UserContext); // 직접 소비
  return <div>{user.name}</div>;
}
```

Context는 "전역에 가까운 데이터"에 적합하다. 테마, 로케일, 인증 정보, 사용자 설정처럼 많은 컴포넌트가 공유하는 값이 대표적이다.

## 해결책 2: 컴포지션으로 drilling 자체를 없애기

Context 없이도 해결할 수 있는 경우가 많다. "위에서 이미 조합해서 아래로 내려보내기" 전략이다.

![컴포지션으로 Prop Drilling 회피](/assets/posts/react-prop-drilling-solution.svg)

```jsx
function App() {
  const user = useCurrentUser();

  // App이 직접 UserProfile을 만들어 Layout에 전달
  return (
    <Layout
      sidebar={<UserProfile user={user} />}
      header={<Header title="대시보드" />}
    >
      <MainContent />
    </Layout>
  );
}

function Layout({ header, sidebar, children }) {
  // user를 전혀 모른다 — 오직 배치만 담당
  return (
    <div className="layout">
      <header>{header}</header>
      <aside>{sidebar}</aside>
      <main>{children}</main>
    </div>
  );
}
```

`Layout`은 `user`를 알 필요가 없다. `App`이 이미 완성된 컴포넌트를 슬롯으로 전달했기 때문이다. 이 방식은 추가적인 API(Context)를 쓰지 않고, 컴포넌트 간 결합도를 낮춘다.

## 해결책 3: 외부 상태 관리 라이브러리

Zustand, Redux, Jotai처럼 컴포넌트 트리 외부에 스토어를 두고 어디서든 직접 구독하는 방법이다. 앱 전역 상태가 복잡하고, Context 리렌더 성능 이슈가 문제가 될 때 적합하다.

```jsx
// Zustand 예
import { create } from 'zustand';

const useUserStore = create(set => ({
  user: null,
  setUser: user => set({ user }),
}));

// 어느 컴포넌트에서든 props 없이 직접 접근
function UserProfile() {
  const user = useUserStore(state => state.user);
  return <div>{user?.name}</div>;
}
```

## 세 가지 해결책 선택 기준

```
prop drilling인가?
├── 1~2 단계이면 → 그냥 props로 전달 (문제 아님)
├── 중간 컴포넌트가 3단계 이상이면:
│     ├── 중간 컴포넌트가 UI 레이아웃만 담당하는가? → 컴포지션(slot)
│     ├── 로케일·테마·인증 같은 앱 전역 데이터인가? → Context
│     └── 복잡한 비즈니스 상태, 여러 컴포넌트가 업데이트하는가? → 외부 상태 관리
```

prop drilling은 모든 경우에 나쁜 것이 아니다. 1~2 단계 전달은 데이터 흐름이 명확하고 디버깅하기 쉽다. 오버엔지니어링보다 단순한 props 전달이 나을 때가 많다. 코드 리뷰에서 "props를 3단계 이상 내려보내고 있는가?"를 기준으로 리팩터링을 고민하면 좋다.

---

**지난 글:** [key를 이용한 컴포넌트 리셋](/posts/react-key-as-reset/)

<br>
읽어주셔서 감사합니다. 😊
