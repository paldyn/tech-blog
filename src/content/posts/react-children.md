---
title: "children prop — 컴포넌트 안에 컴포넌트 넣기"
description: "React children prop의 개념, 타입 종류, 레이아웃 래퍼 패턴, 슬롯 패턴, 함수 children, 그리고 React.Children API를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["children", "props.children", "슬롯패턴", "레이아웃래퍼", "React패턴", "컴포넌트합성"]
featured: false
draft: false
---

[지난 글](/posts/react-components/)에서 컴포넌트의 기본 구조와 합성 원칙을 배웠다. 이번 글에서는 컴포넌트 합성에서 핵심 역할을 하는 **children prop**을 깊이 이해한다.

## children이란

JSX에서 여는 태그와 닫는 태그 사이에 있는 모든 내용은 자동으로 `props.children`으로 전달된다.

```jsx
<Card>
  <h2>제목</h2>
  <p>내용</p>
</Card>

// 위는 사실상 이것과 같다
<Card children={[<h2>제목</h2>, <p>내용</p>]} />
```

컴포넌트 정의에서 `children`을 받아 원하는 위치에 렌더링한다.

```jsx
function Card({ title, children }) {
  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      <div className="card-body">
        {children}  {/* 부모가 넣어준 내용이 여기 들어간다 */}
      </div>
    </div>
  );
}
```

## children prop 개념

![children prop 개념](/assets/posts/react-children-concept.svg)

### children의 타입

`children`은 전달하는 내용에 따라 타입이 달라진다.

```jsx
// 1. 문자열
<Button>클릭하세요</Button>  // children = "클릭하세요"

// 2. 단일 React Element
<Card><Avatar /></Card>     // children = <Avatar /> (ReactElement 객체)

// 3. 배열 (여러 자식)
<List>
  <Item />
  <Item />
</List>                     // children = [<Item />, <Item />]

// 4. null/undefined (없음)
<Loading />                 // children = undefined
```

## children 활용 패턴

![children 활용 패턴](/assets/posts/react-children-patterns.svg)

### 레이아웃 래퍼 패턴

가장 흔한 children 사용 패턴이다. 공통 레이아웃(헤더, 사이드바, 푸터)은 래퍼 컴포넌트가 담당하고, 페이지 콘텐츠는 children으로 주입한다.

```jsx
function AppLayout({ children }) {
  return (
    <div className="app">
      <Header />
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
      <HeroSection />
      <FeaturedArticles />
    </AppLayout>
  );
}
```

### 슬롯 패턴

여러 위치에 다른 내용을 주입하려면 named props를 쓴다. Vue의 named slot과 비슷한 개념이다.

```jsx
function Dialog({ header, footer, children }) {
  return (
    <dialog className="dialog">
      <div className="dialog-header">{header}</div>
      <div className="dialog-body">{children}</div>
      <div className="dialog-footer">{footer}</div>
    </dialog>
  );
}

// 사용
<Dialog
  header={<h2>삭제 확인</h2>}
  footer={
    <>
      <button onClick={onCancel}>취소</button>
      <button onClick={onConfirm}>삭제</button>
    </>
  }
>
  <p>정말 삭제하시겠습니까?</p>
</Dialog>
```

## React.Children API

`children`이 배열인지 단일 요소인지 항상 보장이 안 되는 상황에서 `React.Children` API가 유용하다.

```jsx
import { Children, cloneElement } from 'react';

function TabGroup({ children, activeIndex }) {
  return (
    <div className="tabs">
      {Children.map(children, (child, index) =>
        cloneElement(child, {
          isActive: index === activeIndex,
        })
      )}
    </div>
  );
}
```

주요 메서드:

| 메서드 | 설명 |
|--------|------|
| `Children.map(children, fn)` | 각 child에 함수 적용 |
| `Children.forEach(children, fn)` | 반환값 없이 순회 |
| `Children.count(children)` | child 개수 반환 |
| `Children.only(children)` | child가 정확히 1개인지 검증 |
| `Children.toArray(children)` | children을 평탄한 배열로 변환 |

> React 18 이후 공식 문서는 `React.Children` 대신 `children`을 배열로 직접 받는 방식을 권장한다. `cloneElement`로 props를 주입하는 대신 context나 명시적 props 전달을 사용하면 코드가 더 명확해진다.

## children 없을 때 처리

```jsx
function Section({ title, children }) {
  if (!children) return null;     // children 없으면 렌더링 안 함

  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```

---

**지난 글:** [컴포넌트 기초 — React 앱의 기본 구성 단위](/posts/react-components/)

**다음 글:** [Props — 컴포넌트 간 데이터 전달의 모든 것](/posts/react-props/)

<br>
읽어주셔서 감사합니다. 😊
