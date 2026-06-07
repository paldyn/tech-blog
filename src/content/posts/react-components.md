---
title: "컴포넌트 완전 정복 — 함수 컴포넌트와 설계 원칙"
description: "React 함수 컴포넌트의 구조, 순수 함수 원칙, 컴포넌트 합성 트리 설계, 언제 컴포넌트를 나눠야 하는지 실전 기준을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["컴포넌트", "함수컴포넌트", "합성", "순수함수", "React", "설계"]
featured: false
draft: false
---

[지난 글](/posts/react-fragments/)에서 Fragment로 불필요한 DOM 노드를 없애는 방법을 봤다. React 개발의 본질은 **컴포넌트를 잘 만들고, 잘 조합하는 것**이다. 이 글에서는 함수 컴포넌트의 구조와 동작 방식, 언제 어떻게 컴포넌트를 나눠야 하는지 설계 원칙까지 다룬다.

## 함수 컴포넌트의 구조

React 컴포넌트는 다음 형태의 함수다. Props를 받아서 JSX를 반환한다.

```jsx
function UserCard({ name, role }) {
  // ① 훅 — 렌더 사이에 정보 유지
  const [open, setOpen] = useState(false);

  // ② 파생 계산 — state/props로 결정되는 값
  const label = role === 'admin' ? '관리자' : '일반';

  // ③ JSX 반환
  return (
    <div onClick={() => setOpen(!open)}>
      <span>{name}</span>
      <span>{label}</span>
      {open && <p>상세 정보</p>}
    </div>
  );
}
```

컴포넌트 함수 내부는 크게 세 구역으로 나뉜다. 훅 선언 → 파생 값 계산 → JSX 반환. 이 순서를 지키면 코드 읽기가 훨씬 쉬워진다.

![React 함수 컴포넌트 해부](/assets/posts/react-components-anatomy.svg)

## 컴포넌트는 순수 함수여야 한다

React 컴포넌트에는 중요한 규칙이 있다. **같은 props와 state에 대해 항상 동일한 JSX를 반환해야 한다.** 수학의 순수 함수처럼 입력이 같으면 출력이 같아야 한다.

```jsx
// ❌ 순수하지 않음 — 외부 변수를 렌더 중 변경
let count = 0;
function BadCounter() {
  count += 1;  // 렌더마다 외부 상태를 변경
  return <p>{count}</p>;
}

// ✅ 순수함 — useState로 내부에서 관리
function GoodCounter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

렌더 중에 외부 상태를 바꾸거나, API 호출을 하거나, 무작위 값을 직접 쓰는 등의 행위는 부수 효과(side effect)다. 부수 효과는 `useEffect`나 이벤트 핸들러 안에서만 처리해야 한다. React 18 Strict Mode는 개발 환경에서 렌더 함수를 의도적으로 두 번 호출해 이 규칙 위반을 잡아낸다.

## 컴포넌트 합성 — 레고처럼 조립하기

React 앱은 컴포넌트 트리로 구성된다. 최상위 `App` 컴포넌트 아래에 `Header`, `Main`, `Footer`가 있고, `Main` 아래에 `PostList`와 `Sidebar`가 있는 식이다.

```jsx
function App() {
  return (
    <>
      <Header />
      <Main>
        <PostList posts={posts} />
        <Sidebar />
      </Main>
      <Footer />
    </>
  );
}
```

각 컴포넌트는 자신이 필요한 데이터만 props로 받는다. 너무 많은 props를 받으면 컴포넌트가 너무 많은 것을 알고 있다는 신호다.

![컴포넌트 합성 트리](/assets/posts/react-components-composition.svg)

## 언제 컴포넌트를 나눠야 할까

**단일 책임 원칙**: 컴포넌트는 한 가지 일만 해야 한다. 한 컴포넌트가 너무 많은 UI 조각을 담당하거나, 로직과 UI가 섞여 읽기 어려워졌다면 분리 신호다.

구체적인 기준:

| 상황 | 판단 |
|---|---|
| 같은 UI 패턴이 두 군데 이상 반복된다 | 컴포넌트로 추출 |
| 컴포넌트 함수가 100줄을 넘는다 | 분리 검토 |
| 내부 상태가 UI 일부에만 관련된다 | 해당 부분만 분리 |
| 서로 다른 관심사가 섞여 있다 | 분리 |

반대로 너무 잘게 나누면 props 전달이 복잡해지고 코드 추적이 어려워진다. 과도한 분리도 피해야 한다.

## 컴포넌트 이름 규칙

- **반드시 대문자로 시작한다** — 앞서 봤듯이, 소문자는 DOM 태그로 해석된다
- 컴포넌트가 하는 일을 명사 또는 명사구로 표현한다 (`UserCard`, `PostList`, `LoadingSpinner`)
- 불린 props는 `is`, `has`, `can`으로 시작하는 것이 관례다 (`isLoading`, `hasError`)

## 정리

- 함수 컴포넌트는 props → 훅 → 파생 계산 → JSX 반환 구조다
- 같은 입력에 같은 출력 — 순수 함수 원칙을 지켜야 한다
- 렌더 중 부수 효과는 금지. `useEffect` 또는 이벤트 핸들러에서 처리한다
- 작은 컴포넌트를 조합해 트리를 구성한다 (합성)
- 단일 책임, 반복 패턴, 100줄 기준으로 분리를 판단한다

다음 글에서는 `children` prop을 더 깊이 탐구하고, 컴포넌트가 내부 내용을 위임받는 패턴을 다룬다.

---

**지난 글:** [Fragment — 불필요한 DOM 노드 없애기](/posts/react-fragments/)

**다음 글:** [children prop 완전 정복 — 컴포넌트 슬롯 패턴](/posts/react-children/)

<br>
읽어주셔서 감사합니다. 😊
