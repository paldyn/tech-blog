---
title: "Props — 컴포넌트 간 데이터 전달의 모든 것"
description: "React props의 단방향 데이터 흐름, 읽기 전용 원칙, 다양한 타입의 props 전달, 기본값 설정, 콜백 패턴으로 자식→부모 소통하는 방법을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 7
type: "knowledge"
category: "React"
tags: ["props", "단방향데이터흐름", "읽기전용", "기본값", "콜백패턴", "React기초"]
featured: false
draft: false
---

[지난 글](/posts/react-children/)에서 children prop으로 컴포넌트를 합성하는 방법을 배웠다. 이번 글에서는 React 컴포넌트 간 데이터를 전달하는 핵심 메커니즘인 **props** 전체를 정리한다.

## Props란

Props(Properties)는 부모 컴포넌트가 자식 컴포넌트에 전달하는 데이터다. HTML 속성처럼 생겼지만 JavaScript 값 무엇이든 전달할 수 있다.

```jsx
// 부모가 props를 전달
function App() {
  const user = { name: 'Alice', age: 28 };

  return (
    <UserProfile
      name={user.name}
      age={user.age}
      isAdmin={true}
      onLogout={() => console.log('로그아웃')}
    />
  );
}

// 자식이 props를 받아 사용
function UserProfile({ name, age, isAdmin, onLogout }) {
  return (
    <div>
      <h2>{name} ({age}세)</h2>
      {isAdmin && <span className="badge">관리자</span>}
      <button onClick={onLogout}>로그아웃</button>
    </div>
  );
}
```

## 단방향 데이터 흐름

React props의 가장 중요한 규칙이다.

![Props: 단방향 데이터 흐름](/assets/posts/react-props-flow.svg)

**Props는 부모에서 자식으로만 흐른다.** 자식이 부모 데이터를 직접 바꿀 수 없다. 이 원칙이 React 앱의 데이터 흐름을 예측 가능하게 만든다.

```jsx
// ❌ 자식이 props를 변경하려 하면 안 된다
function Child({ user }) {
  user.name = 'Bob';  // 절대 하면 안 됨!
  return <p>{user.name}</p>;
}
```

자식에서 부모 상태를 변경해야 할 때는 부모가 전달한 **콜백 함수**를 호출한다.

```jsx
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <Child
      count={count}
      onIncrement={() => setCount(c => c + 1)}  // 콜백 전달
    />
  );
}

function Child({ count, onIncrement }) {
  return (
    <button onClick={onIncrement}>  {/* 콜백 실행 */}
      카운트: {count}
    </button>
  );
}
```

## Props 타입과 기본값

![Props 타입과 기본값 패턴](/assets/posts/react-props-types.svg)

### 전달 가능한 값 타입

```jsx
// 문자열 (따옴표로 직접)
<Button label="확인" />

// 그 외 모든 값 (중괄호 필수)
<Component
  count={42}              // 숫자
  disabled={false}        // boolean
  disabled              // {true}의 축약형
  user={{ name: 'Alice' }} // 객체 (이중 중괄호!)
  items={[1, 2, 3]}      // 배열
  render={() => <p />}   // 함수
  node={<span />}        // React Element
/>
```

### 기본값 설정

구조분해 할당에서 기본값을 지정하는 것이 가장 권장되는 방법이다.

```jsx
function Button({
  label = '버튼',
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
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

// 아무 props 없이 쓰면 기본값 사용
<Button />  // label="버튼", variant="primary", ...
```

## TypeScript로 Props 타입 정의

TypeScript를 쓰면 잘못된 props를 컴파일 타임에 잡을 수 있다.

```tsx
type ButtonProps = {
  label?: string;            // 선택적
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick: () => void;       // 필수
};

function Button({ label = '버튼', variant = 'primary', onClick }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {label}
    </button>
  );
}

// ❌ onClick 누락 → 컴파일 에러
<Button label="저장" />

// ✅ 올바른 사용
<Button label="저장" onClick={() => save()} />
```

## Props로 컴포넌트 전달하기

컴포넌트 자체를 props로 전달하면 렌더링 로직을 외부에서 주입할 수 있다.

```jsx
// 아이콘 컴포넌트를 prop으로 받는 Button
function IconButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick}>
      <Icon className="icon" />
      {label}
    </button>
  );
}

// 어떤 아이콘이든 주입 가능
<IconButton
  icon={StarIcon}
  label="즐겨찾기"
  onClick={toggleFavorite}
/>
```

---

**지난 글:** [children prop — 컴포넌트 안에 컴포넌트 넣기](/posts/react-children/)

**다음 글:** [Props Spreading — 유용하지만 주의가 필요한 패턴](/posts/react-props-spreading/)

<br>
읽어주셔서 감사합니다. 😊
