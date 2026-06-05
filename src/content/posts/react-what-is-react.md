---
title: "React란 무엇인가? — 핵심 개념과 등장 배경"
description: "React가 왜 만들어졌는지, 라이브러리와 프레임워크의 차이, 컴포넌트·State·Props·Virtual DOM의 핵심 개념을 처음부터 명확하게 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React", "리액트입문", "Virtual DOM", "컴포넌트", "자바스크립트라이브러리"]
featured: false
draft: false
---

프론트엔드 개발을 시작하면 곧 React라는 이름을 만나게 된다. 2013년 Facebook(현 Meta)이 오픈소스로 공개한 이후 React는 전 세계에서 가장 많이 쓰이는 UI 라이브러리가 됐다. 이번 글에서는 React가 무엇인지, 왜 이토록 인기를 얻었는지, 그리고 처음 배울 때 반드시 이해해야 할 핵심 개념을 살펴본다.

## React가 등장한 배경

2010년대 초, 웹 애플리케이션은 점점 복잡해졌다. 하나의 페이지에서 수십 개의 UI 요소가 사용자 인터랙션에 따라 실시간으로 바뀌어야 했고, jQuery로 DOM을 직접 조작하는 방식은 코드가 스파게티처럼 엉키기 시작했다. "어디서 무엇이 바뀌었는가"를 추적하는 것 자체가 버그의 온상이었다.

Facebook은 이 문제를 해결하기 위해 새로운 접근 방법을 고안했다. **"UI를 상태(State)의 함수로 표현한다"** — `UI = f(State)`. 상태가 바뀌면 React가 알아서 필요한 부분만 다시 그려준다. 개발자는 "언제 DOM을 바꿀까"를 고민하는 대신 "상태가 이럴 때 화면은 이렇게 생겼다"는 선언적 코드만 작성하면 된다.

![React 핵심 개념 개요](/assets/posts/react-what-is-react-overview.svg)

## React는 라이브러리다

React를 "프레임워크"라고 부르는 경우가 많은데, 정확히는 **라이브러리**다. 차이는 다음과 같다.

| 구분 | 라이브러리 (React) | 프레임워크 (Angular, Vue) |
|---|---|---|
| 역할 범위 | UI 렌더링에만 집중 | 라우팅·HTTP·폼 등 풀스택 |
| 자유도 | 높음 (조합 선택 가능) | 낮음 (정해진 방식 따름) |
| 제어권 | 개발자가 호출 | 프레임워크가 제어 |

React만으로는 라우팅, 전역 상태 관리, 서버 통신 등을 해결하지 않는다. 대신 React Router, Zustand, React Query 같은 생태계 라이브러리를 원하는 대로 조합해 사용한다.

## 세 가지 핵심 개념

### 컴포넌트(Component)

React는 UI를 **컴포넌트**라는 독립된 조각으로 쪼개 만든다. 레고 블록처럼 컴포넌트를 조합해 복잡한 UI를 만들 수 있다.

```jsx
// Button 컴포넌트 — 재사용 가능한 UI 조각
function Button({ label, onClick }) {
  return (
    <button className="btn" onClick={onClick}>
      {label}
    </button>
  );
}

// 어디서든 재사용
function App() {
  return (
    <div>
      <Button label="저장" onClick={() => save()} />
      <Button label="취소" onClick={() => cancel()} />
    </div>
  );
}
```

### 상태(State)

**상태**는 컴포넌트 내부에서 관리되는 데이터다. 상태가 바뀌면 React는 해당 컴포넌트(와 그 자손)를 자동으로 다시 렌더링한다.

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0); // 초기값 0

  return (
    <div>
      <p>클릭 수: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

### 속성(Props)

**Props**는 부모 컴포넌트가 자식에게 전달하는 읽기 전용 데이터다. 자식은 props를 받아 사용할 수 있지만, 직접 수정할 수 없다(단방향 데이터 흐름).

```jsx
// 부모
function ParentCard() {
  return <UserCard name="홍길동" age={30} />;
}

// 자식
function UserCard({ name, age }) {
  return <p>{name} ({age}세)</p>;
}
```

## Virtual DOM — 빠른 렌더링의 비밀

Real DOM 조작은 비용이 크다. React는 실제 DOM을 바로 건드리지 않고, 메모리 안에 **Virtual DOM**(가상 DOM)이라는 경량 JS 객체 트리를 유지한다.

![React Virtual DOM과 렌더링 흐름](/assets/posts/react-what-is-react-flow.svg)

상태가 바뀌면 React는 새로운 Virtual DOM을 만들어 이전 것과 비교(**diffing**)하고, 실제로 바뀐 부분만 Real DOM에 적용(**reconciliation**)한다.

## 첫 React 앱 만들기

현재 가장 많이 쓰이는 시작 방법은 **Vite**를 사용하는 것이다.

```bash
# Vite + React 프로젝트 생성
npm create vite@latest my-app -- --template react
cd my-app
npm install
npm run dev
```

프로젝트 구조:

```
my-app/
├── index.html          # 진입 HTML — <div id="root"> 포함
├── src/
│   ├── main.jsx        # React 앱 마운트 진입점
│   ├── App.jsx         # 루트 컴포넌트
│   └── App.css
└── package.json
```

## React 18의 주요 특징

```jsx
// React 17 이하 (구 방식)
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));

// React 18+ (새 방식 — Concurrent 기능 활성화)
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

`createRoot` API를 사용하면 **Concurrent Mode**가 활성화된다. 렌더링 작업을 우선순위에 따라 나누어 처리해 더 부드러운 UI를 만든다.

## 정리

React는 UI를 **선언적**으로, **컴포넌트** 단위로 구성할 수 있게 해주는 자바스크립트 라이브러리다. 상태 변화에 맞춰 Virtual DOM 비교를 통해 효율적으로 실제 DOM을 업데이트한다. 다음 글에서는 React의 문법적 핵심인 **JSX**를 깊이 파헤친다.

---

**다음 글:** [JSX란? — HTML처럼 생긴 자바스크립트 문법](/posts/react-jsx/)

<br>
읽어주셔서 감사합니다. 😊
