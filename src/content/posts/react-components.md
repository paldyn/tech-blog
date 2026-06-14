---
title: "컴포넌트의 개념"
description: "React 컴포넌트의 정의와 함수 컴포넌트 작성법, 컴포넌트 트리로 UI를 조합하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["React", "컴포넌트", "함수형컴포넌트", "JSX", "트리"]
featured: false
draft: false
---

[지난 글](/posts/react-jsx/)에서 JSX가 JavaScript로 변환되는 과정을 살펴봤습니다. 이번에는 React의 가장 기본 단위인 **컴포넌트**가 무엇인지, 어떻게 만들고 조합하는지 알아봅니다.

---

## 컴포넌트란

컴포넌트(Component)는 **UI의 한 조각**입니다. 버튼 하나, 카드 하나, 페이지 레이아웃 하나 — 모두 컴포넌트가 될 수 있습니다. React 애플리케이션은 이 컴포넌트들을 레고 블록처럼 조합해 전체 화면을 구성합니다.

컴포넌트는 다음 두 가지를 갖습니다.
- **입력**: `props`(부모로부터 전달된 데이터)와 `state`(컴포넌트 내부 상태)
- **출력**: JSX(화면에 렌더링될 UI 설계도)

---

## 함수 컴포넌트

현재 React에서 컴포넌트를 만드는 표준 방식은 **함수 컴포넌트**입니다. props를 인자로 받아 JSX를 반환하는 순수 함수입니다.

```jsx
// 가장 단순한 함수 컴포넌트
function Greeting() {
  return <h1>안녕하세요!</h1>;
}
```

조금 더 실용적인 예시로, 재사용 가능한 `Button` 컴포넌트를 만들어 봅니다.

```jsx
function Button({ label, onClick, disabled = false }) {
  return (
    <button
      className="btn"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
```

화살표 함수로도 동일하게 작성할 수 있습니다.

```jsx
const Button = ({ label, onClick, disabled = false }) => (
  <button className="btn" onClick={onClick} disabled={disabled}>
    {label}
  </button>
);
```

![컴포넌트 구조 해부](/assets/posts/react-components-anatomy.svg)

---

## 컴포넌트 두 가지 필수 규칙

### 1. 이름은 반드시 대문자로 시작

React는 태그 이름의 첫 글자가 소문자이면 HTML 기본 태그로, 대문자이면 컴포넌트로 해석합니다.

```jsx
// ❌ 소문자 — <card>라는 HTML 태그로 취급 (미작동)
function card() { return <div>카드</div>; }

// ✅ 대문자 — Card 컴포넌트로 인식
function Card() { return <div>카드</div>; }
```

### 2. JSX 또는 null 반환

컴포넌트는 반드시 JSX를 반환해야 합니다. 아무것도 렌더링하지 않으려면 `null`을 반환합니다.

```jsx
function ConditionalBanner({ show }) {
  if (!show) return null;  // 아무것도 렌더링하지 않음
  return <div className="banner">공지사항</div>;
}
```

---

## 컴포넌트 조합 — 트리 구조

실제 애플리케이션은 수십~수백 개의 컴포넌트가 **트리(Tree)** 구조로 중첩되어 구성됩니다.

![컴포넌트 트리](/assets/posts/react-components-tree.svg)

```jsx
function ArticleCard({ title, summary, author }) {
  return (
    <article className="card">
      <h2>{title}</h2>
      <p>{summary}</p>
      <footer>By {author}</footer>
    </article>
  );
}

function ArticleList({ articles }) {
  return (
    <section>
      {articles.map(article => (
        <ArticleCard
          key={article.id}
          title={article.title}
          summary={article.summary}
          author={article.author}
        />
      ))}
    </section>
  );
}

function App() {
  return (
    <>
      <Header />
      <main>
        <ArticleList articles={data} />
        <Sidebar />
      </main>
      <Footer />
    </>
  );
}
```

트리에서 **상위 컴포넌트**(부모)는 하위 컴포넌트(자식)에게 `props`를 통해 데이터를 전달합니다. 이 단방향 흐름 덕분에 데이터가 어디서 오는지 추적하기 쉽습니다.

---

## 컴포넌트 파일 구성

실무에서는 보통 컴포넌트 하나당 파일 하나를 만들고, 컴포넌트 이름과 파일 이름을 일치시킵니다.

```
src/
  components/
    Button.jsx        # Button 컴포넌트
    ArticleCard.jsx   # ArticleCard 컴포넌트
    Header.jsx        # Header 컴포넌트
  pages/
    App.jsx           # 루트 App 컴포넌트
```

컴포넌트 파일 맨 아래에 `export default` 또는 `export`로 내보내고 다른 파일에서 `import`해 사용합니다.

```jsx
// Button.jsx
export default function Button({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>;
}

// App.jsx
import Button from './components/Button';

function App() {
  return <Button label="클릭" onClick={() => alert('클릭!')} />;
}
```

---

## 순수 함수로 생각하기

React 컴포넌트는 가능한 한 **순수 함수**처럼 작성해야 합니다. 동일한 props와 state가 주어지면 항상 동일한 JSX를 반환하고, 렌더링 중 외부 상태를 바꾸지 않는 것이 이상적입니다.

```jsx
// 순수: 입력이 같으면 출력이 항상 같음
function PureGreeting({ name }) {
  return <p>안녕하세요, {name}님!</p>;
}

// 비순수: 렌더링마다 외부를 변경 — React가 경고
let renderCount = 0;
function ImpureCounter() {
  renderCount++;  // ❌ 렌더링 중 외부 변수 수정
  return <p>렌더: {renderCount}</p>;
}
```

사이드 이펙트(데이터 페칭, DOM 접근 등)는 나중에 배울 `useEffect`를 통해 처리합니다.

---

**지난 글:** [JSX 문법 이해하기](/posts/react-jsx/)

**다음 글:** [props로 데이터 전달하기](/posts/react-props/)

<br>
읽어주셔서 감사합니다. 😊
