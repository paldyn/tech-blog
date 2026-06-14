---
title: "props로 데이터 전달하기"
description: "React의 props 개념과 단방향 데이터 흐름, 다양한 값을 props로 전달하는 방법, 기본값과 children prop 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["React", "props", "단방향흐름", "컴포넌트", "children"]
featured: false
draft: false
---

[지난 글](/posts/react-components/)에서 컴포넌트를 만들고 트리로 조합하는 방법을 배웠습니다. 컴포넌트들이 서로 데이터를 주고받는 메커니즘이 **props**입니다. props를 제대로 이해하면 컴포넌트를 진정한 의미에서 재사용 가능하게 만들 수 있습니다.

---

## props란

**props(properties)**는 부모 컴포넌트가 자식 컴포넌트에게 전달하는 데이터입니다. 함수의 인자와 같은 개념으로, 컴포넌트 함수의 첫 번째 매개변수로 받습니다.

```jsx
// 부모가 props 전달
<UserCard name="Alice" score={42} />

// 자식이 props 수신
function UserCard(props) {
  return <p>{props.name} — {props.score}점</p>;
}
```

실무에서는 **구조 분해 할당**으로 받는 것이 관례입니다.

```jsx
function UserCard({ name, score }) {
  return <p>{name} — {score}점</p>;
}
```

---

## 단방향 데이터 흐름

![Props 단방향 흐름](/assets/posts/react-props-flow.svg)

props는 항상 **부모 → 자식** 방향으로만 흐릅니다. 자식은 받은 props를 읽을 수만 있고 직접 수정할 수 없습니다. 이것이 React의 **단방향 데이터 흐름(one-way data flow)**입니다.

```jsx
function Child({ count }) {
  // ❌ props 직접 수정 — 절대 금지
  count = count + 1;

  // ✅ 읽기만 가능
  return <p>현재: {count}</p>;
}
```

자식이 부모의 상태를 변경하려면, 부모가 **콜백 함수를 props로 내려주고** 자식이 그것을 호출합니다.

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  return <Child count={count} onIncrement={() => setCount(c => c + 1)} />;
}

function Child({ count, onIncrement }) {
  return (
    <div>
      <p>카운트: {count}</p>
      <button onClick={onIncrement}>+1</button>
    </div>
  );
}
```

---

## 전달할 수 있는 값의 종류

![Props 타입 종류](/assets/posts/react-props-types.svg)

JSX 속성의 `{}` 안에는 어떤 JavaScript 값이든 넣을 수 있습니다.

```jsx
<ProfileCard
  name="Alice"             // 문자열: 따옴표
  age={29}                 // 숫자: 중괄호
  isAdmin={true}           // 불리언: 중괄호 (또는 isAdmin 속성만 써도 true)
  tags={['React', 'TS']}   // 배열
  address={{ city: '서울', zip: '04001' }}  // 객체
  onEdit={handleEdit}      // 함수
/>
```

### children prop

여는 태그와 닫는 태그 사이의 내용은 자동으로 `props.children`에 담깁니다.

```jsx
function Card({ children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {children}
    </div>
  );
}

// 사용: 어떤 내용이든 Card 안에 넣을 수 있음
function App() {
  return (
    <Card className="featured">
      <h2>공지사항</h2>
      <p>이 내용이 Card의 children입니다.</p>
    </Card>
  );
}
```

`children`을 활용하면 **컨테이너** 역할을 하는 컴포넌트를 만들기 쉽습니다. Modal, Card, Layout, Tooltip 등이 이 패턴을 자주 사용합니다.

---

## 기본값 설정

props를 전달하지 않았을 때 사용할 기본값은 구조 분해 할당에서 `=`으로 설정합니다.

```jsx
function Button({
  label = '확인',
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick
}) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// 기본값 사용
<Button onClick={handleClick} />        // label='확인', variant='primary'

// 기본값 덮어쓰기
<Button label="삭제" variant="danger" onClick={handleDelete} />
```

---

## Props 스프레드

객체의 모든 속성을 props로 전달할 때 스프레드 연산자를 씁니다.

```jsx
const buttonProps = {
  label: '저장',
  variant: 'primary',
  onClick: handleSave,
};

// 개별 전달과 동일
<Button {...buttonProps} />
```

단, 과도하게 사용하면 어떤 props가 흘러가는지 파악하기 어려워집니다. 필요한 경우에만 사용하는 것이 좋습니다.

---

## Props vs State 한눈에 비교

| 특성 | props | state |
|------|-------|-------|
| 출처 | 부모로부터 전달 | 컴포넌트 자체 |
| 수정 | 읽기 전용 | `setState`로 수정 |
| 변경 시 | 부모가 바꾸면 리렌더 | `setState` 호출 시 리렌더 |
| 목적 | 컴포넌트 설정·구성 | 내부 동적 상태 |

state는 다음 글에서 자세히 다룹니다.

---

**지난 글:** [컴포넌트의 개념](/posts/react-components/)

**다음 글:** [조건부 렌더링](/posts/react-conditional-rendering/)

<br>
읽어주셔서 감사합니다. 😊
