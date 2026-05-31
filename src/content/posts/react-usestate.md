---
title: "useState로 상태 관리하기"
description: "React의 useState Hook 사용법, 다양한 타입의 state 관리, 객체와 배열을 불변적으로 업데이트하는 방법, 지연 초기화 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 10
type: "knowledge"
category: "React"
tags: ["React", "useState", "Hook", "state", "불변성"]
featured: false
draft: false
---

[지난 글](/posts/react-state-concept/)에서 state의 개념과 동작 원리를 살펴봤습니다. 이번에는 React에서 state를 실제로 다루는 `useState` Hook의 사용법과 다양한 패턴을 구체적으로 살펴봅니다.

---

## useState 기본 사용법

`useState`는 React에서 제공하는 Hook으로, 함수 컴포넌트에 state를 추가합니다.

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);  // 초기값 0

  return (
    <div>
      <p>카운트: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={() => setCount(count - 1)}>-1</button>
      <button onClick={() => setCount(0)}>초기화</button>
    </div>
  );
}
```

`useState(초기값)`은 `[현재값, setter함수]` 쌍을 배열로 반환합니다. 구조 분해 할당으로 각각 이름을 붙여 사용합니다.

![useState 해부](/assets/posts/react-usestate-anatomy.svg)

---

## 다양한 타입의 state

`useState`에는 어떤 JavaScript 값이든 넣을 수 있습니다.

```jsx
// 숫자
const [score, setScore] = useState(0);

// 문자열
const [query, setQuery] = useState('');

// 불리언
const [isLoading, setIsLoading] = useState(false);
const [isOpen, setIsOpen] = useState(false);

// 배열
const [todos, setTodos] = useState([]);

// 객체
const [user, setUser] = useState({ name: '', email: '' });

// null (데이터 로딩 전)
const [data, setData] = useState(null);
```

여러 관련 state는 하나의 객체로 묶을 수 있지만, 독립적으로 변경되는 state는 분리하는 것이 좋습니다.

```jsx
// 관련 있는 state는 묶기
const [position, setPosition] = useState({ x: 0, y: 0 });

// 독립적인 state는 분리
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);
const [data, setData] = useState(null);
```

---

## 업데이터 함수 (Functional Update)

이전 state를 기반으로 새 state를 계산할 때는 **업데이터 함수**를 사용합니다.

```jsx
// ❌ 스냅샷 함정 — 여러 번 호출해도 1번만 증가
function handleClick() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
}

// ✅ 업데이터 함수 — 최신 state를 항상 보장
function handleClick() {
  setCount(c => c + 1);  // c: 0 → 1
  setCount(c => c + 1);  // c: 1 → 2
  setCount(c => c + 1);  // c: 2 → 3
}
```

비동기 콜백, 이벤트 핸들러에서 최신 state가 필요할 때도 업데이터 함수를 씁니다.

```jsx
// setTimeout 안에서도 최신 count 보장
function handleDelayedIncrement() {
  setTimeout(() => {
    setCount(c => c + 1);  // 업데이터 함수 사용
  }, 1000);
}
```

---

## 객체 state 불변 업데이트

React는 state 참조가 바뀌어야 변경을 감지합니다. 객체를 직접 수정하면 참조가 그대로여서 리렌더가 발생하지 않습니다.

![객체·배열 불변 업데이트](/assets/posts/react-usestate-updates.svg)

```jsx
const [form, setForm] = useState({ name: '', email: '', age: 0 });

// 특정 필드만 업데이트 — 스프레드 연산자
function handleNameChange(e) {
  setForm(prev => ({
    ...prev,          // 기존 필드 모두 복사
    name: e.target.value  // 변경할 필드만 덮어씀
  }));
}

// 여러 필드 동시 업데이트
function handleReset() {
  setForm({ name: '', email: '', age: 0 });
}
```

---

## 배열 state 불변 업데이트

배열도 직접 `push`, `splice`, `sort`를 쓰면 안 됩니다. 새 배열을 만들어서 전달합니다.

```jsx
const [todos, setTodos] = useState([]);

// 추가 — 스프레드 또는 concat
function addTodo(text) {
  setTodos(prev => [
    ...prev,
    { id: crypto.randomUUID(), text, done: false }
  ]);
}

// 삭제 — filter
function removeTodo(id) {
  setTodos(prev => prev.filter(todo => todo.id !== id));
}

// 수정 — map
function toggleTodo(id) {
  setTodos(prev =>
    prev.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done } : todo
    )
  );
}

// 정렬 — slice + sort (원본 배열 복사 후 sort)
function sortByText() {
  setTodos(prev => [...prev].sort((a, b) => a.text.localeCompare(b.text)));
}
```

---

## 지연 초기화 (Lazy Initialization)

초기값 계산이 비용이 클 때, 함수를 초기값으로 전달해 첫 렌더에서만 실행하도록 합니다.

```jsx
// ❌ 매 렌더마다 실행
const [list, setList] = useState(parseHeavyData());

// ✅ 함수를 전달 — 첫 렌더에서만 호출
const [list, setList] = useState(() => parseHeavyData());

// localStorage에서 초기값 읽기 (매우 자주 쓰는 패턴)
const [theme, setTheme] = useState(
  () => localStorage.getItem('theme') ?? 'light'
);
```

---

## 전체 예제 — TodoList

```jsx
import { useState } from 'react';

function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  function handleAdd() {
    if (!input.trim()) return;
    setTodos(prev => [
      ...prev,
      { id: crypto.randomUUID(), text: input.trim(), done: false }
    ]);
    setInput('');
  }

  function handleToggle(id) {
    setTodos(prev =>
      prev.map(t => t.id === id ? { ...t, done: !t.done } : t)
    );
  }

  function handleRemove(id) {
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div>
      <div>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="할 일 입력"
        />
        <button onClick={handleAdd}>추가</button>
      </div>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => handleToggle(todo.id)}
            />
            <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}>
              {todo.text}
            </span>
            <button onClick={() => handleRemove(todo.id)}>삭제</button>
          </li>
        ))}
      </ul>
      <p>완료: {todos.filter(t => t.done).length} / {todos.length}</p>
    </div>
  );
}
```

---

**지난 글:** [상태(state)란 무엇인가](/posts/react-state-concept/)

**다음 글:** [폼과 제어 컴포넌트](/posts/react-forms-controlled-inputs/)

<br>
읽어주셔서 감사합니다. 😊
