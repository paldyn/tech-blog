---
title: "children prop — 컴포넌트 합성의 기초"
description: "children prop의 개념, 다양한 children 타입, 렌더 프롭 패턴, Named Slot 패턴, TypeScript에서 children 타입 선언 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["children prop", "컴포넌트합성", "렌더프롭", "React", "TypeScript"]
featured: false
draft: false
---

[지난 글](/posts/react-components/)에서 컴포넌트의 구조와 설계 원칙을 배웠다. React에서 컴포넌트를 유연하게 재사용하는 핵심 메커니즘이 바로 **children prop**이다. 여는 태그와 닫는 태그 사이에 넣은 모든 것이 `children`으로 전달된다.

## children prop이란

JSX에서 컴포넌트를 열고 닫는 태그 사이에 넣은 콘텐츠는 자동으로 `children` prop으로 전달된다.

```jsx
// 부모 — 태그 사이 콘텐츠가 children
<Card title="프로필">
  <Avatar src="/photo.jpg" />
  <p>홍길동</p>
</Card>

// Card 컴포넌트 — children을 props로 수신
function Card({ title, children }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}
```

이처럼 컴포넌트가 내부 콘텐츠를 모르는 채로 외부에서 받아 렌더링하는 패턴을 **합성(Composition)**이라 한다.

![children prop 전달 방식](/assets/posts/react-children-prop.svg)

## children이 될 수 있는 것

`children`은 React가 렌더링할 수 있는 모든 값이 될 수 있다.

```jsx
// 문자열
<Button>저장</Button>

// JSX 요소
<Button><StarIcon /> 즐겨찾기</Button>

// 여러 요소 (Fragment 없이도 됨)
<Card>
  <h3>제목</h3>
  <p>내용</p>
</Card>

// null/undefined (아무것도 렌더링 안 됨)
<Modal>{isOpen ? <Content /> : null}</Modal>

// 함수 (Render Props 패턴)
<DataFetcher url="/api/users">
  {(data) => <UserList users={data} />}
</DataFetcher>
```

## 합성으로 레이아웃 컴포넌트 만들기

children을 활용하면 어떤 콘텐츠든 담을 수 있는 범용 레이아웃 컴포넌트를 만들 수 있다.

```jsx
// 재사용 가능한 Modal 컴포넌트
function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

// 사용 측 — 어떤 내용이든 담을 수 있음
<Modal isOpen={isOpen} onClose={close} title="사용자 정보">
  <UserForm onSubmit={handleSubmit} />
</Modal>
```

## Named Slot 패턴 (여러 children 영역)

여러 개의 독립적인 콘텐츠 영역이 필요할 때는 JSX를 별도 prop으로 전달한다.

```jsx
function PageLayout({ header, sidebar, main, footer }) {
  return (
    <div className="page">
      <header className="page-header">{header}</header>
      <div className="page-body">
        <aside className="sidebar">{sidebar}</aside>
        <main className="main-content">{main}</main>
      </div>
      <footer className="page-footer">{footer}</footer>
    </div>
  );
}

// 사용 측
<PageLayout
  header={<NavBar />}
  sidebar={<CategoryMenu />}
  main={<ArticleList />}
  footer={<SiteFooter />}
/>
```

이 패턴은 Angular의 `ng-content`나 Vue의 `<slot>`과 유사하다.

![children 활용 패턴과 TypeScript 타입](/assets/posts/react-children-api.svg)

## Render Props 패턴

children이 함수일 때, 컴포넌트 내부 상태를 함수 인자로 넘겨 외부에서 렌더링을 제어할 수 있다.

```jsx
// Render Props — children이 함수
function DataFetcher({ url, children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(url)
      .then(r => r.json())
      .then(data => { setData(data); setLoading(false); });
  }, [url]);

  return children(data, loading); // 함수를 호출해 렌더링
}

// 사용 측 — children이 함수
<DataFetcher url="/api/users">
  {(users, loading) =>
    loading ? <Spinner /> : <UserList users={users} />
  }
</DataFetcher>
```

단, 렌더 프롭은 커스텀 훅으로 대체하는 것이 더 간결하다. 기존 코드를 읽을 때 이해하기 위해 알아두면 충분하다.

## TypeScript에서 children 타입

TypeScript로 React를 쓸 때 children 타입을 올바르게 선언해야 한다.

```tsx
import { type ReactNode, type ReactElement } from 'react';

// ReactNode: 가장 넓은 타입 (문자열, 숫자, JSX, null, undefined, 배열 모두)
type CardProps = {
  children: ReactNode;
  title: string;
};

// ReactElement: JSX 요소만 (문자열/null 제외)
type IconButtonProps = {
  children: ReactElement;  // 반드시 JSX 요소여야 할 때
};

// children을 선택적으로
type MaybeChildrenProps = {
  children?: ReactNode;    // 없어도 되는 children
};

function Card({ title, children }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children ?? <p className="empty">내용이 없습니다</p>}
    </div>
  );
}
```

## children 패턴 선택 가이드

```
children 사용 상황 결정 트리:

내용 영역이 1개?
  └─ YES → children prop 사용
       <Modal>{content}</Modal>

내용 영역이 여러 개?
  └─ YES → named slot (JSX as prop)
       <Layout header={...} main={...} />

내부 상태를 외부에 노출해야?
  └─ YES → render props 또는 커스텀 훅
       <Toggle>{(on, toggle) => ...}</Toggle>
```

## 정리

`children`은 React 합성 패턴의 근간이다. 태그 사이의 콘텐츠를 유연하게 주입해 범용적이고 재사용 가능한 컴포넌트를 만들 수 있다. 단일 children, Named Slot, Render Props를 상황에 맞게 사용하면 컴포넌트 설계가 훨씬 유연해진다. 다음 글에서는 데이터를 전달하는 **props**를 더 깊이 파헤친다.

---

**지난 글:** [React 컴포넌트 — 함수형과 클래스형, 컴포넌트 설계 원칙](/posts/react-components/)

**다음 글:** [Props 완전 정복 — 데이터 전달과 기본값, 타입 검증](/posts/react-props/)

<br>
읽어주셔서 감사합니다. 😊
