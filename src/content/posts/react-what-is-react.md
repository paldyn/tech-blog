---
title: "React란 무엇인가? — UI를 만드는 JavaScript 라이브러리"
description: "React가 왜 만들어졌는지, 컴포넌트·상태·Virtual DOM이 무엇인지, 그리고 라이브러리와 프레임워크 차이까지 한 글로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React", "컴포넌트", "VirtualDOM", "상태관리", "프론트엔드", "JavaScript"]
featured: false
draft: false
---

웹 개발을 배우다 보면 React라는 이름을 아주 빨리 마주친다. 구인 공고마다 등장하고, 튜토리얼마다 "React로 시작하세요"라고 말한다. 그런데 정작 **React가 왜 필요한지**, **어떤 문제를 해결하는지**를 먼저 이해하지 않으면 학습 전체가 흔들린다. 이 글에서는 React의 탄생 배경부터 핵심 개념까지, 코드를 처음 쓰기 전에 알아야 할 모든 것을 다룬다.

## React가 생긴 이유

2013년 이전 웹 개발은 대부분 이런 패턴이었다.

```javascript
// 좋아요 수를 1 늘리는 코드 (Vanilla JS)
const btn = document.querySelector('#like-btn');
btn.addEventListener('click', () => {
  const count = parseInt(document.querySelector('#count').textContent);
  document.querySelector('#count').textContent = count + 1;
});
```

간단한 카운터 하나에도 DOM을 직접 찾고, 값을 읽고, 다시 쓰는 세 단계가 필요하다. 화면에 보여줄 요소가 10개, 100개로 늘어나면 이 수동 조작 코드가 폭발적으로 늘어난다. 페이스북은 2013년에 뉴스피드·채팅·알림이 동시에 업데이트되는 복잡한 UI를 다루면서 이 문제를 절감했고, 그 해결책으로 React를 오픈소스로 공개했다.

React의 핵심 아이디어는 단순하다. **"UI는 상태(state)의 함수다."** 상태가 주어지면 화면은 항상 동일한 결과를 만들어내야 하고, 상태가 바뀌면 React가 알아서 최소한의 DOM만 다시 그린다. 개발자는 DOM을 직접 건드리지 않아도 된다.

![React란 무엇인가?](/assets/posts/react-what-is-react-overview.svg)

## 컴포넌트 — UI를 조각으로 나누다

React의 가장 중요한 단위는 **컴포넌트(Component)**다. 컴포넌트는 UI의 한 조각을 반환하는 JavaScript 함수다.

```jsx
// 가장 단순한 React 컴포넌트
function Greeting() {
  return <h1>안녕하세요, React!</h1>;
}
```

버튼 하나, 카드 하나, 헤더 전체를 각각 컴포넌트로 만들고, 이 조각들을 조립해서 전체 화면을 구성한다. 레고 블록과 같다.

```jsx
function App() {
  return (
    <div>
      <Header />
      <PostList />
      <Footer />
    </div>
  );
}
```

## 상태(State) — 화면이 변하는 이유

정적인 HTML과 달리 웹 앱은 사용자 행동에 반응해 화면이 바뀐다. React에서 이 "변하는 데이터"를 **상태(state)**라고 부른다. `useState` 훅으로 상태를 선언하면, 값이 바뀔 때마다 해당 컴포넌트가 자동으로 다시 렌더된다.

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      클릭 횟수: {count}
    </button>
  );
}
```

`setCount`를 호출하면 `count`가 바뀌고, React는 버튼 텍스트만 업데이트한다. 개발자가 DOM을 건드리는 코드는 한 줄도 없다.

## Props — 부모에서 자식으로

컴포넌트끼리 데이터를 주고받을 때는 **props**를 사용한다. 부모 컴포넌트가 자식에게 HTML 속성처럼 값을 내려보내고, 자식은 그 값을 읽기만 할 수 있다(읽기 전용).

```jsx
function Badge({ label, color }) {
  return (
    <span style={{ background: color }}>
      {label}
    </span>
  );
}

// 사용
<Badge label="신규" color="#55c555" />
<Badge label="인기" color="#e05555" />
```

같은 `Badge` 컴포넌트를 다른 props로 여러 번 재사용한다. 이것이 컴포넌트 재사용의 핵심이다.

## Virtual DOM — 빠른 업데이트의 비결

React는 브라우저의 실제 DOM을 직접 조작하지 않는다. 대신 메모리 안에 가상의 DOM 트리(Virtual DOM)를 유지하고, 상태가 바뀌면 새 Virtual DOM을 만들어 이전 것과 비교한다. 바뀐 부분만 실제 DOM에 반영하는 이 과정을 **재조정(Reconciliation)**이라고 한다.

```
상태 변경
  → 새 Virtual DOM 생성
  → 이전 Virtual DOM과 비교 (diffing)
  → 차이가 있는 노드만 실제 DOM 업데이트
```

사용자 입장에서는 화면이 빠르게 반응한다. 개발자 입장에서는 DOM을 직접 건드리지 않아도 된다.

## 라이브러리 vs 프레임워크

React는 **라이브러리**다. **프레임워크가 아니다.** 이 차이가 중요하다.

| 구분 | 설명 |
|---|---|
| 라이브러리 | 특정 기능만 제공. 나머지는 개발자가 선택 |
| 프레임워크 | 앱 전체 구조를 정해두고, 그 틀 안에서 개발 |

React는 UI 렌더링만 담당한다. 라우팅(페이지 이동), 서버 통신, 전역 상태 관리는 별도 라이브러리로 직접 고른다. 이 유연성이 장점이기도 하고, "뭘 써야 하지?"라는 초기 혼란의 원인이기도 하다.

Next.js, Remix 같은 **메타 프레임워크**는 React를 기반으로 라우팅·SSR 등을 미리 갖춰놓은 더 큰 구조물이다.

![React 에코시스템](/assets/posts/react-what-is-react-ecosystem.svg)

## React 18과 현재

2022년 출시된 React 18은 **Concurrent 기능**을 도입했다. 긴 작업이 UI를 블로킹하지 않도록 렌더링을 쪼개서 처리할 수 있게 됐다. `useTransition`, `useDeferredValue` 같은 새 훅이 이때 등장했고, 이 시리즈 후반부에서 자세히 다룬다.

현재 React는 Meta의 오픈소스 프로젝트로 유지되며, GitHub에서 활발히 개발 중이다. React Server Components, Actions 같은 기능이 계속 추가되고 있다.

## 정리

- React는 UI를 컴포넌트로 조각내고, 상태가 바뀌면 자동으로 화면을 업데이트하는 JavaScript 라이브러리다
- Virtual DOM으로 최소한의 DOM 조작만 수행한다
- Props는 부모→자식 단방향 데이터 흐름, State는 컴포넌트 내부의 변하는 데이터다
- UI 라이브러리이므로 라우팅·상태관리는 별도로 선택해야 한다

다음 글에서는 React 코드에서 가장 먼저 마주치는 문법인 **JSX**를 깊이 파헤친다.

---

**다음 글:** [JSX란 무엇인가? — HTML이 아닌 JavaScript](/posts/react-jsx/)

<br>
읽어주셔서 감사합니다. 😊
