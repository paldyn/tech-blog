---
title: "children prop 완전 정복 — 컴포넌트 슬롯 패턴"
description: "children prop의 동작 원리, 단일/다중 슬롯 패턴, children을 조작하는 React.Children API, 함수를 children으로 전달하는 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["children", "props", "슬롯패턴", "합성", "React.Children", "컴포넌트설계"]
featured: false
draft: false
---

[지난 글](/posts/react-components/)에서 컴포넌트의 구조와 합성 원칙을 배웠다. `children`은 React에서 가장 강력하면서도 자주 과소평가되는 prop이다. 컴포넌트가 자신의 내부 내용을 사용 측에 위임할 수 있게 해주는 **슬롯 메커니즘**이다.

## children은 특별한 prop이다

JSX에서 컴포넌트 태그 사이에 작성한 내용은 자동으로 `props.children`에 들어간다. 명시적으로 전달하지 않아도 된다.

```jsx
function Card({ children }) {
  return <div className="card">{children}</div>;
}

// 사용 측
<Card>
  <h2>제목</h2>
  <p>내용</p>
</Card>
```

`Card`는 어떤 내용이 올지 미리 알 필요가 없다. 레이아웃(`.card` 스타일)만 담당하고 실제 내용은 사용 측이 결정한다. 이 분리가 재사용성의 핵심이다.

## children의 타입

`children`은 상황에 따라 타입이 달라진다.

```jsx
<Comp>Hello</Comp>
// children: "Hello" (문자열)

<Comp><span>A</span></Comp>
// children: ReactElement (단일 요소)

<Comp><span>A</span><span>B</span></Comp>
// children: [ReactElement, ReactElement] (배열)

<Comp />
// children: undefined (없음)
```

타입이 불안정하기 때문에 `children`을 배열로 다루려면 `React.Children.toArray()`로 정규화하거나, 스프레드 전에 존재 여부를 확인해야 한다.

![children prop 슬롯 패턴](/assets/posts/react-children-slot.svg)

## 다중 슬롯 — 명명된 children props

헤더·바디·푸터처럼 여러 위치에 외부 내용을 받고 싶을 때는 prop 이름을 붙인다.

```jsx
function Modal({ header, children, footer }) {
  return (
    <div className="modal">
      <div className="modal-header">{header}</div>
      <div className="modal-body">{children}</div>
      <div className="modal-footer">{footer}</div>
    </div>
  );
}

// 사용
<Modal
  header={<h2>확인하시겠습니까?</h2>}
  footer={<button onClick={onClose}>닫기</button>}
>
  <p>이 작업은 되돌릴 수 없습니다.</p>
</Modal>
```

`children`은 메인 슬롯으로 태그 사이 내용을 받고, `header`와 `footer`는 명시적 JSX prop으로 받는다.

![다중 슬롯 패턴](/assets/posts/react-children-api.svg)

## 렌더 prop — 함수를 children으로

`children`에 함수를 전달하는 패턴이 있다. 컴포넌트가 내부 데이터를 자식에게 역으로 주입할 때 사용한다.

```jsx
function DataLoader({ url, children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [url]);

  return children({ data, loading });
}

// 사용 — children이 함수다
<DataLoader url="/api/posts">
  {({ data, loading }) =>
    loading ? <Spinner /> : <PostList posts={data} />
  }
</DataLoader>
```

`DataLoader`가 데이터 패칭을 담당하고, 렌더 방식은 완전히 사용 측이 결정한다. 이 패턴을 **렌더 prop(render prop)** 패턴이라 한다. 요즘은 커스텀 훅으로 대부분 대체할 수 있지만, 서드파티 라이브러리나 오래된 코드베이스에서 자주 만난다.

## React.Children 유틸리티

`children`을 순회하거나 개수를 세야 할 때 `React.Children` API를 쓴다.

```jsx
import { Children, cloneElement } from 'react';

function RadioGroup({ children, name }) {
  return (
    <div>
      {Children.map(children, child =>
        cloneElement(child, { name })
      )}
    </div>
  );
}
```

`Children.map()`, `Children.count()`, `Children.toArray()` 등이 있다. 단, 이 API는 React 컴포넌트 트리의 불투명한 내부를 건드리는 것이라 일반적으로 권장되지 않는다. 가능하면 context나 명시적 props로 해결하는 것이 더 명확하다.

## children에 기본값 설정

`children`이 전달되지 않을 때 기본 UI를 보여주려면 기본값을 설정한다.

```jsx
function Button({ children = '확인' }) {
  return <button>{children}</button>;
}

<Button />           // → <button>확인</button>
<Button>취소</Button> // → <button>취소</button>
```

## 정리

- 태그 사이 내용은 자동으로 `props.children`으로 전달된다
- `children`을 활용하면 레이아웃과 내용을 분리해 재사용성을 높일 수 있다
- 여러 슬롯이 필요하면 `header`, `footer` 같은 명명된 JSX props를 사용한다
- 렌더 prop 패턴으로 컴포넌트가 내부 데이터를 자식 함수에 주입할 수 있다
- `React.Children` API는 최후 수단으로 쓴다

다음 글에서는 부모가 자식에게 데이터를 전달하는 **Props**를 전면적으로 다룬다.

---

**지난 글:** [컴포넌트 완전 정복 — 함수 컴포넌트와 설계 원칙](/posts/react-components/)

**다음 글:** [Props 완전 정복 — 컴포넌트 인터페이스 설계](/posts/react-props/)

<br>
읽어주셔서 감사합니다. 😊
