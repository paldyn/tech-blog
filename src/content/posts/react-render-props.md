---
title: "렌더 프롭 패턴"
description: "함수를 prop으로 전달해 렌더링 로직을 외부에서 주입하는 렌더 프롭 패턴의 원리, children as function 변형, 마우스 트래커·데이터 페칭 등 실전 예제와 커스텀 훅과의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 7
type: "knowledge"
category: "React"
tags: ["React", "렌더프롭", "RenderProps", "childrenAsFunction", "패턴", "재사용"]
featured: false
draft: false
---

[지난 글](/posts/react-compound-components/)에서 Context를 이용해 서브 컴포넌트끼리 상태를 공유하는 컴파운드 컴포넌트 패턴을 다뤘다. 렌더 프롭은 또 다른 재사용 패턴이다. 컴포넌트가 상태와 로직을 관리하되, 어떻게 렌더링할지는 외부에서 함수로 주입받는다. "어떤 데이터를 줄지"와 "그 데이터로 무엇을 그릴지"를 분리하는 것이 핵심이다.

## 렌더 프롭의 핵심 아이디어

```jsx
// 렌더 로직 분리: render prop으로 UI를 주입
<MouseTracker render={({ x, y }) => (
  <p>마우스 위치: {x}, {y}</p>
)} />
```

`MouseTracker`는 마우스 위치를 추적하는 상태와 이벤트 핸들링만 담당한다. 그 데이터를 어떻게 보여줄지는 `render` prop으로 받은 함수가 결정한다. 다른 곳에서는 같은 `MouseTracker`를 재사용하면서 다른 UI를 그릴 수 있다.

![렌더 프롭 패턴 다이어그램](/assets/posts/react-render-props-diagram.svg)

## 기본 구현

```jsx
function MouseTracker({ render }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function handleMouseMove(e) {
    setPos({ x: e.clientX, y: e.clientY });
  }

  return (
    <div style={{ height: '100vh' }} onMouseMove={handleMouseMove}>
      {render(pos)}
    </div>
  );
}

// 같은 컴포넌트, 다른 UI
<MouseTracker render={({ x, y }) => <Cursor x={x} y={y} />} />
<MouseTracker render={({ x, y }) => <p>{x}, {y}</p>} />
<MouseTracker render={({ x, y }) => <Canvas mouseX={x} mouseY={y} />} />
```

## children as function

render prop 대신 `children`을 함수로 받는 방식이 더 자연스러운 JSX를 만들 때가 많다.

![렌더 프롭 vs children as function](/assets/posts/react-render-props-children.svg)

```jsx
function Toggle({ children }) {
  const [on, setOn] = useState(false);
  return children({
    on,
    toggle: () => setOn(v => !v),
    setOn,
  });
}

// 사용 — 컴포넌트 태그 안에 함수를 작성
<Toggle>
  {({ on, toggle }) => (
    <div>
      <button onClick={toggle}>{on ? '끄기' : '켜기'}</button>
      {on && <p>켜진 상태입니다!</p>}
    </div>
  )}
</Toggle>
```

## 데이터 페칭에 응용

```jsx
function Fetch({ url, children }) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    setState({ data: null, loading: true, error: null });
    fetch(url)
      .then(r => r.json())
      .then(data => setState({ data, loading: false, error: null }))
      .catch(error => setState({ data: null, loading: false, error }));
  }, [url]);

  return children(state);
}

// 사용
<Fetch url="/api/users">
  {({ data, loading, error }) => {
    if (loading) return <Spinner />;
    if (error) return <ErrorMessage error={error} />;
    return <UserList users={data} />;
  }}
</Fetch>
```

로딩·에러·성공 상태 관리 로직을 재사용하면서, 각 데이터를 어떻게 보여줄지는 사용처에서 결정한다.

## 렌더 프롭 vs 커스텀 훅

렌더 프롭은 React Hooks 이전에 로직 재사용의 표준 방법이었다. 현재는 커스텀 훅이 더 간결하고 합성하기 쉽다.

```jsx
// 커스텀 훅 버전 (현재 권장)
function useMousePosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = e => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
  return pos;
}

function Cursor() {
  const { x, y } = useMousePosition(); // 훨씬 간결
  return <div style={{ left: x, top: y }} className="cursor" />;
}
```

렌더 프롭은 여전히 유용하다. 컴포넌트 트리 구조에 렌더링 로직이 연결되어야 하거나, `<FetchList>`처럼 선언적 데이터 흐름을 표현해야 할 때 자연스럽다. 반면 로직만 재사용하고 UI는 호출처에서 자유롭게 구성한다면 커스텀 훅이 낫다.

다음 글에서는 컴포넌트를 감싸 기능을 추가하는 고차 컴포넌트(HOC) 패턴을 다룬다.

---

**지난 글:** [컴파운드 컴포넌트 패턴](/posts/react-compound-components/)

**다음 글:** [고차 컴포넌트 (HOC)](/posts/react-higher-order-components/)

<br>
읽어주셔서 감사합니다. 😊
