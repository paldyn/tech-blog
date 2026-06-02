---
title: "React란 무엇인가 — 핵심 개념과 멘탈 모델"
description: "React의 역할, Virtual DOM, 컴포넌트 기반 아키텍처, 그리고 UI = f(state)라는 핵심 멘탈 모델을 처음부터 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React", "Virtual DOM", "컴포넌트", "멘탈모델", "프론트엔드", "UI개발"]
featured: false
draft: false
---

React는 Facebook(현 Meta)이 2013년 오픈소스로 공개한 **사용자 인터페이스 구축 라이브러리**다. "라이브러리"라는 단어가 중요하다 — React는 풀 프레임워크가 아니라 UI를 그리는 "View" 레이어만 담당하고, 라우팅·서버 통신·전역 상태 같은 나머지 기능은 생태계의 다른 도구들이 채운다.

## React가 해결하는 문제

전통적인 jQuery 방식에서는 DOM을 직접 조작한다. 버튼을 클릭하면 개발자가 직접 `document.getElementById`로 요소를 찾아 텍스트를 바꾸고, 클래스를 추가하고, 이벤트 리스너를 붙인다. 앱이 커질수록 "무엇이 DOM을 바꾸는가"를 추적하기 어려워진다.

React는 이 문제를 **선언형(Declarative)** 패러다임으로 해결한다.

```jsx
// 명령형 (jQuery 스타일)
document.getElementById('count').textContent = count;

// 선언형 (React 스타일)
function Counter() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>; // "count가 이 값일 때 이런 UI를 보여줘"
}
```

개발자는 "지금 상태에서 UI가 어떻게 보여야 하는가"만 선언하면 된다. DOM을 어떻게 바꿀지는 React가 알아서 계산한다.

## React 스택 개요

![React 스택 개요](/assets/posts/react-what-is-react-overview.svg)

React Core가 담당하는 세 가지 핵심 역할이 있다. 첫째, **컴포넌트 트리 구성** — UI를 작은 컴포넌트 함수들의 트리로 조직한다. 둘째, **Virtual DOM 생성** — 실제 DOM 대신 메모리 안에 경량 JavaScript 객체로 UI를 표현한다. 셋째, **Diff & Reconcile** — 이전 Virtual DOM과 새 Virtual DOM을 비교해 달라진 부분만 실제 DOM에 반영한다.

## UI = f(state) 멘탈 모델

React를 이해하는 가장 중요한 공식이다.

```
UI = f(state)
```

컴포넌트는 state(상태)를 입력으로 받아 UI를 출력하는 **순수 함수**처럼 동작한다. 같은 state를 주면 항상 같은 UI가 나온다.

![UI = f(state) 멘탈 모델](/assets/posts/react-what-is-react-mental-model.svg)

State가 변경되면 React는 컴포넌트 함수를 다시 실행해 새 Virtual DOM을 만들고, 이전 Virtual DOM과 비교(diff)해서 달라진 최솟값만 실제 DOM에 적용한다. 이 과정을 **재조정(Reconciliation)**이라 한다.

## 컴포넌트: React의 기본 단위

React 앱은 컴포넌트들의 트리다. 모든 컴포넌트는 props를 입력으로 받아 JSX를 반환하는 함수다.

```jsx
// 가장 단순한 React 컴포넌트
function Greeting({ name }) {
  return <h1>안녕하세요, {name}님!</h1>;
}

// 사용할 때
function App() {
  return <Greeting name="React 학습자" />;
}
```

컴포넌트를 HTML 태그처럼 쓸 수 있게 해주는 문법이 **JSX**다. 브라우저는 JSX를 이해하지 못하므로 빌드 도구(Vite, Babel 등)가 일반 JavaScript로 변환한다.

## React 시작하기

```bash
# Vite로 React 프로젝트 생성
npm create vite@latest my-app -- --template react
cd my-app
npm install
npm run dev
```

생성된 프로젝트 구조에서 `src/main.jsx`가 진입점이다.

```jsx
// src/main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`createRoot`가 DOM 노드(`#root`)에 React 앱을 마운트한다. `StrictMode`는 개발 중 잠재적 문제를 감지하는 도구로, 프로덕션 빌드에는 영향을 주지 않는다.

## React 18 이후의 변화

React 18은 **Concurrent Features**를 도입했다. 이전까지 React는 모든 업데이트를 동기적으로 처리했지만, React 18부터는 긴급하지 않은 업데이트를 뒤로 미루고(`startTransition`) 사용자 입력 같은 긴급 업데이트를 우선 처리할 수 있다. 이 시리즈의 후반부에서 자세히 다룬다.

---

**다음 글:** [JSX 기초 — HTML처럼 보이지만 JavaScript다](/posts/react-jsx/)

<br>
읽어주셔서 감사합니다. 😊
