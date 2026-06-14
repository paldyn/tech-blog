---
title: "children prop으로 컴포넌트 조합하기"
description: "React children prop의 작동 원리, 받을 수 있는 값의 종류, 레이아웃 컴포넌트·슬롯 패턴·render prop 등 실전 컴포지션 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["React", "children", "컴포지션", "props", "패턴"]
featured: false
draft: false
---

[지난 글](/posts/react-props/)에서 props로 데이터를 전달하는 방법을 살펴봤습니다. props 중에서도 가장 특별한 `children`은 컴포넌트 태그 사이에 넣은 모든 내용을 받는 통로입니다. React가 상속 대신 컴포지션을 권장하는 이유가 바로 이 `children` prop에 있습니다.

---

## children이란

`children`은 컴포넌트 여는 태그와 닫는 태그 사이의 내용을 담는 **특별히 이름 붙여진 prop**입니다.

```jsx
// 사용 측 — 태그 사이의 내용이 children
<Card title="공지">
  <p>내용입니다.</p>
  <button>닫기</button>
</Card>

// 정의 측 — props.children으로 수신
function Card({ title, children }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}    {/* 여기서 렌더링 */}
    </div>
  );
}
```

`children`은 다른 prop과 똑같이 `props.children`으로 접근하거나 구조 분해로 꺼낼 수 있습니다. React가 마법처럼 처리하는 것이 아니라, 단지 이름이 `children`인 일반 prop입니다.

![children prop 작동 원리](/assets/posts/react-children-concept.svg)

---

## children이 받을 수 있는 값

`children`에는 다양한 타입이 올 수 있습니다.

```jsx
// 문자열
<Label>이름</Label>         // children = "이름"

// 단일 React 요소
<Box><p>단락</p></Box>      // children = <p>단락</p>

// 여러 요소 (배열)
<Box><a /><b /><c /></Box>  // children = [<a/>, <b/>, <c/>]

// 표현식
<Box>{user.name}</Box>      // children = user.name 값

// 함수 (render prop 패턴)
<Loader>{data => <List items={data} />}</Loader>
```

TypeScript에서 `children`의 타입은 `React.ReactNode`로 선언합니다.

```tsx
interface CardProps {
  title: string;
  children: React.ReactNode;   // string | number | JSX.Element | null | undefined | ...
}
```

---

## 레이아웃 컴포넌트

페이지 전체 구조를 `children`으로 조합하는 패턴입니다. 헤더·사이드바·푸터는 고정하고 본문 영역만 `children`으로 교체합니다.

```jsx
function AppLayout({ children }) {
  return (
    <div className="app">
      <Header />
      <aside className="sidebar">
        <Nav />
      </aside>
      <main className="content">
        {children}
      </main>
      <Footer />
    </div>
  );
}

// 사용
function HomePage() {
  return (
    <AppLayout>
      <HeroBanner />
      <ArticleList />
    </AppLayout>
  );
}
```

---

## 슬롯 패턴: 여러 삽입 지점

`children` 외에 추가 prop으로 다른 영역도 외부에서 주입할 수 있습니다.

```jsx
function Dialog({ header, children, footer }) {
  return (
    <div className="dialog" role="dialog">
      {header && <div className="dialog-header">{header}</div>}
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </div>
  );
}

// 사용
<Dialog
  header={<h2>알림</h2>}
  footer={<button onClick={onClose}>닫기</button>}
>
  <p>작업이 완료되었습니다.</p>
</Dialog>
```

이 패턴은 Angular의 `ng-content`, Vue의 `<slot>`과 동일한 개념입니다.

![children 활용 컴포지션 패턴](/assets/posts/react-children-patterns.svg)

---

## 함수 children (Render Prop)

`children`이 함수인 경우, 컴포넌트가 데이터를 인자로 넘기며 함수를 호출합니다.

```jsx
function DataFetcher({ url, children }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(url).then(r => r.json()).then(setData);
  }, [url]);

  if (!data) return <Spinner />;
  return children(data);       // 데이터를 넘기며 children(함수)를 호출
}

// 사용
<DataFetcher url="/api/posts">
  {posts => (
    <ul>
      {posts.map(post => <li key={post.id}>{post.title}</li>)}
    </ul>
  )}
</DataFetcher>
```

로직을 컴포넌트 안에 캡슐화하면서, 렌더링 결과는 외부에서 제어할 수 있습니다.

---

## children 다루기 시 주의사항

```jsx
// children이 없을 수 있으므로 방어적으로 처리
function Panel({ children }) {
  if (!children) return null;
  return <div className="panel">{children}</div>;
}

// 또는 기본값 설정
function Panel({ children = <p>내용 없음</p> }) {
  return <div className="panel">{children}</div>;
}
```

`React.Children` API(`React.Children.count`, `React.Children.map` 등)는 `children`을 배열처럼 다루는 유틸리티입니다. 하지만 단일 자식인 경우 `children`이 배열이 아니기 때문에, 직접 `.length`를 호출하면 오류가 발생합니다. `React.Children.count(children)`을 쓰면 단일·복수·null을 일관되게 처리할 수 있습니다.

```jsx
function List({ children }) {
  const count = React.Children.count(children); // 0, 1, 또는 n
  return (
    <div>
      <span>{count}개 항목</span>
      <ul>{children}</ul>
    </div>
  );
}
```

---

**지난 글:** [props로 데이터 전달하기](/posts/react-props/)

**다음 글:** [Props 스프레딩과 전달 패턴](/posts/react-props-spreading/)

<br>
읽어주셔서 감사합니다. 😊
