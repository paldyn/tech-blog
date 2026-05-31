---
title: "key의 역할과 올바른 사용"
description: "React에서 key prop이 리스트 재조정에서 하는 역할, 인덱스 key의 위험성, 그리고 key를 이용한 컴포넌트 초기화 트릭을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 7
type: "knowledge"
category: "React"
tags: ["React", "key", "재조정", "리스트", "성능"]
featured: false
draft: false
---

[지난 글](/posts/react-list-rendering/)에서 `.map()`으로 리스트를 렌더링할 때 `key` prop을 붙여야 한다고 소개했습니다. 왜 `key`가 필요한지, 무엇을 `key`로 써야 하는지, 그리고 `key`를 활용하는 고급 패턴까지 이번 글에서 자세히 살펴봅니다.

---

## key가 필요한 이유

React는 상태가 변경되면 이전 UI 트리와 새 UI 트리를 **비교(재조정, Reconciliation)**해서 달라진 부분만 DOM에 반영합니다. 리스트에서 항목이 추가·삭제·재정렬될 때 React는 각 항목이 어느 것인지 파악해야 효율적으로 업데이트할 수 있습니다.

`key`가 없으면 React는 위치(인덱스)로만 항목을 구분합니다. 항목의 순서가 바뀌면 React는 항목 자체가 바뀐 것으로 착각하고 불필요한 DOM 조작을 수행합니다.

```jsx
// React 경고: Each child in a list should have a unique "key" prop.
{items.map(item => <li>{item.name}</li>)}

// key를 추가하면 경고 해소 + 정확한 재조정
{items.map(item => <li key={item.id}>{item.name}</li>)}
```

---

## 인덱스 key의 위험성

![key 재조정 비교](/assets/posts/react-keys-reconciliation.svg)

많은 초보자가 `key={index}`를 씁니다. 리스트가 **변하지 않는다**면 문제가 없지만, 항목을 추가·삭제·정렬하면 심각한 버그가 생깁니다.

```jsx
// ❌ 인덱스 key — 항목에 입력값이 있으면 버그
function TodoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: '리액트 공부' },
    { id: 2, text: '운동하기' },
  ]);

  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}>  {/* 위험! */}
          <input defaultValue={todo.text} />
          <button onClick={() => removeTodo(todo.id)}>삭제</button>
        </li>
      ))}
    </ul>
  );
}
```

첫 번째 항목을 삭제하면 인덱스가 시프트됩니다. React는 `key=0`이 여전히 존재한다고 보고 기존 컴포넌트를 재사용하는데, 이때 `input`의 내부 상태(사용자가 입력한 값)는 이전 항목 것이 그대로 남습니다.

```jsx
// ✅ 안정적인 고유 ID 사용
{todos.map(todo => (
  <li key={todo.id}>
    <input defaultValue={todo.text} />
    <button onClick={() => removeTodo(todo.id)}>삭제</button>
  </li>
))}
```

---

## 올바른 key 선택 기준

![key 올바른 사용법](/assets/posts/react-keys-best-practices.svg)

| 상황 | 권장 key |
|------|---------|
| 데이터베이스에서 온 데이터 | DB의 고유 ID (`id`, `uuid`) |
| 클라이언트에서 생성 | `crypto.randomUUID()` 또는 `Date.now()` |
| 정적 목록 (순서 변경 없음) | 인덱스 허용 (경고만 없애는 경우) |
| 절대 피해야 할 경우 | 렌더링 중 생성한 랜덤 값 (`Math.random()`) |

```jsx
// 새 항목 추가 시 클라이언트에서 ID 생성
function addTodo(text) {
  setTodos(prev => [
    ...prev,
    { id: crypto.randomUUID(), text }
  ]);
}
```

---

## key는 형제 사이에서만 고유하면 됨

`key`의 유일성은 **같은 부모의 자식 사이**에서만 보장하면 됩니다. 다른 리스트끼리는 같은 `key` 값을 써도 됩니다.

```jsx
// list1의 key=1과 list2의 key=1은 서로 무관
<ul>
  {list1.map(item => <li key={item.id}>{item.name}</li>)}
</ul>
<ul>
  {list2.map(item => <li key={item.id}>{item.name}</li>)}
</ul>
```

---

## key 변경으로 컴포넌트 강제 초기화

`key`는 리스트 전용이 아닙니다. **단일 컴포넌트에 `key`를 바꾸면 이전 인스턴스를 언마운트하고 새로 마운트**합니다. 내부 상태를 완전히 초기화하는 데 유용합니다.

```jsx
// userId가 바뀔 때마다 UserProfile을 완전히 리셋
function App({ userId }) {
  return <UserProfile key={userId} userId={userId} />;
}
```

`useEffect`에서 상태를 초기화하는 것보다 훨씬 깔끔합니다. React 공식 문서도 이 패턴을 권장합니다.

---

## key는 props로 받을 수 없다

`key`는 React가 내부에서 사용하는 예약 prop입니다. 컴포넌트 내부에서 `props.key`로 접근할 수 없습니다.

```jsx
function Item({ id, name }) {
  // props.key는 undefined — 사용 불가
  // id를 별도 prop으로 받아서 사용
  return <li data-id={id}>{name}</li>;
}

// 렌더링 시: key와 id를 둘 다 명시
{items.map(item => (
  <Item key={item.id} id={item.id} name={item.name} />
))}
```

---

**지난 글:** [리스트 렌더링](/posts/react-list-rendering/)

**다음 글:** [이벤트 처리](/posts/react-event-handling/)

<br>
읽어주셔서 감사합니다. 😊
