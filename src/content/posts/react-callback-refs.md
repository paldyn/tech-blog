---
title: "Callback Refs — DOM 연결 시점을 감지하는 ref"
description: "object ref(useRef)와 callback ref의 차이, DOM 연결/해제 시점에 콜백이 호출되는 원리, useCallback으로 참조를 고정해야 하는 이유, 그리고 크기 측정과 조건부 렌더 요소 추적 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["React", "callbackRef", "ref", "DOM", "useCallback", "getBoundingClientRect", "크기측정"]
featured: false
draft: false
---

[지난 글](/posts/react-useimperativehandle/)에서 `useImperativeHandle`로 ref 노출 범위를 제한하는 방법을 살펴봤다. 지금까지 다룬 ref는 모두 `useRef()`가 반환하는 **object ref**였다. 하지만 JSX의 `ref` prop은 함수를 받을 수도 있다. 이것을 **callback ref**라고 부른다.

## ref prop에 함수 넘기기

JSX의 `ref` prop에 함수를 주면, React는 DOM 요소를 연결하거나 해제할 때 그 함수를 호출한다.

```jsx
<div ref={node => {
  // 연결 시: node = DOM 요소
  // 해제 시: node = null
}} />
```

- **마운트(연결) 시**: `node = DOM 요소`로 호출
- **언마운트(해제) 시**: `node = null`로 호출

![Callback Ref vs Object Ref 비교](/assets/posts/react-callback-refs-flow.svg)

object ref는 단순히 `.current` 프로퍼티를 업데이트하지만, callback ref는 연결/해제 시점마다 콜백을 실행한다. DOM이 연결된 순간에 무언가를 해야 할 때 유용하다.

## 기본 사용 예시

```jsx
function AutoFocus() {
  return (
    <input
      ref={node => {
        if (node !== null) {
          node.focus(); // DOM 연결 즉시 포커스
        }
      }}
      placeholder="자동 포커스"
    />
  );
}
```

`useEffect(() => { ref.current.focus(); }, [])`로도 같은 결과를 얻을 수 있지만, callback ref는 Effect 대기 없이 DOM 연결 즉시 실행된다는 차이가 있다.

## useCallback으로 참조 고정

인라인 화살표 함수로 callback ref를 쓰면 매 렌더마다 새 함수가 만들어진다. React는 ref 함수가 바뀌면 이전 함수를 `null`로, 새 함수를 DOM 요소로 호출한다. 따라서 매 렌더마다 불필요한 해제/재연결이 반복된다.

```jsx
// 문제 — 매 렌더마다 ref 콜백이 null → DOM → null → DOM 순으로 호출됨
<div ref={node => console.log('ref called', node)} />
```

해결책은 `useCallback`으로 함수 참조를 고정하는 것이다.

```jsx
const callbackRef = useCallback(node => {
  if (node !== null) {
    // DOM 연결 시
  }
}, []); // 빈 배열 — 함수 참조 고정

<div ref={callbackRef} />;
```

의존성이 있는 경우에는 그 값을 deps에 넣는다.

## DOM 크기 측정 패턴

callback ref의 가장 실용적인 사용 예는 DOM 크기를 측정하는 것이다.

![DOM 크기 측정 패턴](/assets/posts/react-callback-refs-pattern.svg)

```jsx
function MeasuredDiv() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const measuredRef = useCallback(node => {
    if (node !== null) {
      const rect = node.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    }
  }, []);

  return (
    <div ref={measuredRef} className="box">
      {size.width} × {size.height}
    </div>
  );
}
```

왜 `useRef + useEffect`가 아닌 callback ref를 쓸까? `useEffect`는 페인트 후 비동기 실행이라 짧은 깜빡임이 생길 수 있다. 또한 조건부 렌더 요소는 Effect의 deps만으로는 연결 시점을 정확히 잡기 어렵다.

## 조건부 렌더 요소 추적

callback ref는 조건부로 렌더되는 요소의 마운트/언마운트를 추적할 때도 유용하다.

```jsx
function Tooltip({ show, children }) {
  const [tooltipEl, setTooltipEl] = useState(null);

  // show가 변경되면 tooltip DOM이 마운트/언마운트됨
  const tooltipRef = useCallback(node => {
    setTooltipEl(node); // null or DOM
  }, []);

  return (
    <>
      {children}
      {show && <div ref={tooltipRef} className="tooltip">안내 문구</div>}
      {tooltipEl && <Portal target={tooltipEl}>추가 렌더링</Portal>}
    </>
  );
}
```

`tooltipEl`이 null이면 tooltip이 사라진 것이고, DOM 요소면 마운트된 것이다. 이 state로 추가 로직을 자연스럽게 연결할 수 있다.

## 다수의 DOM 요소 추적

배열이나 맵으로 여러 DOM 요소를 동적으로 추적할 때도 쓰인다.

```jsx
function List({ items }) {
  const itemRefs = useRef(new Map());

  function scrollToItem(id) {
    itemRefs.current.get(id)?.scrollIntoView();
  }

  return (
    <ul>
      {items.map(item => (
        <li
          key={item.id}
          ref={node => {
            if (node) {
              itemRefs.current.set(item.id, node);
            } else {
              itemRefs.current.delete(item.id);
            }
          }}
        >
          {item.text}
        </li>
      ))}
    </ul>
  );
}
```

이 패턴은 개수가 동적으로 바뀌는 리스트에서 특정 항목으로 스크롤하는 기능을 구현할 때 자주 사용한다.

---

**지난 글:** [useImperativeHandle — ref로 메서드 노출하기](/posts/react-useimperativehandle/)

**다음 글:** [useContext — 전역 상태 공유](/posts/react-usecontext/)

<br>
읽어주셔서 감사합니다. 😊
