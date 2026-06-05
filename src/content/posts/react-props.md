---
title: "Props 완전 정복 — 데이터 전달과 기본값, 타입 검증"
description: "React Props의 단방향 데이터 흐름, 구조분해 할당, 기본값 설정, 콜백 prop, TypeScript 타입 선언 방법을 상세히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 7
type: "knowledge"
category: "React"
tags: ["Props", "React", "단방향데이터흐름", "TypeScript", "컴포넌트통신"]
featured: false
draft: false
---

[지난 글](/posts/react-children/)에서 children prop을 통한 합성 패턴을 배웠다. Props는 React에서 컴포넌트 간 데이터를 전달하는 유일한 공식 방법이다. 부모가 자식에게, 단방향으로 흐른다. 이번 글에서는 props의 모든 것을 파헤친다.

## Props란 무엇인가

**Props(Properties)**는 부모 컴포넌트에서 자식 컴포넌트로 전달되는 읽기 전용 데이터다. 함수의 인자와 동일한 개념이다.

```jsx
// 부모 — props를 JSX 속성으로 전달
function App() {
  const user = { name: "홍길동", score: 95 };
  return <UserCard user={user} rank={1} isHighlighted={true} />;
}

// 자식 — props 객체를 인자로 수신
function UserCard(props) {
  return (
    <div className={props.isHighlighted ? 'highlighted' : ''}>
      <h3>{props.user.name}</h3>
      <p>#{props.rank} | {props.user.score}점</p>
    </div>
  );
}
```

실전에서는 **구조분해 할당**으로 props를 직접 꺼내 쓴다.

```jsx
// 구조분해 할당 — 더 깔끔한 코드
function UserCard({ user, rank, isHighlighted }) {
  return (
    <div className={isHighlighted ? 'highlighted' : ''}>
      <h3>{user.name}</h3>
      <p>#{rank} | {user.score}점</p>
    </div>
  );
}
```

## 단방향 데이터 흐름

Props는 항상 **부모 → 자식** 방향으로만 흐른다. 자식은 props를 직접 수정할 수 없다.

![Props 단방향 데이터 흐름](/assets/posts/react-props-flow.svg)

```jsx
function Child({ count }) {
  // ❌ Props 직접 수정 금지
  // count = count + 1; → 에러 또는 예측 불가능한 동작

  // ✅ 수정이 필요하면 부모에게 콜백을 받아 호출
  return <p>{count}</p>;
}
```

단방향 흐름 덕분에 데이터의 출처가 명확해지고, 버그를 추적하기 쉬워진다.

## 기본값(Default Props) 설정

Props가 전달되지 않을 때 사용할 기본값을 구조분해 할당에서 `=`으로 지정한다.

```jsx
function Button({
  label = '버튼',         // 문자열 기본값
  variant = 'primary',   // 열거형 기본값
  size = 'md',
  disabled = false,      // 불리언 기본값
  onClick = () => {},    // 빈 함수 기본값 (안전한 호출 보장)
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

// 기본값이 있으므로 props 생략 가능
<Button />                    // label="버튼", variant="primary"
<Button label="저장" />       // variant="primary" 기본값 유지
<Button variant="danger" disabled />  // disabled는 true로 전달됨
```

불리언 props는 `disabled={true}` 대신 `disabled`만 써도 `true`로 전달된다.

## 콜백 Props: 자식 → 부모 데이터 전달

자식이 부모에게 데이터를 보내야 할 때, 부모가 콜백 함수를 prop으로 내려보내고 자식이 이를 호출한다.

```jsx
// 부모 — 상태와 콜백 소유
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async (q) => {
    setQuery(q);
    const data = await fetchSearch(q);
    setResults(data);
  };

  return (
    <div>
      <SearchInput onSearch={handleSearch} />  {/* 콜백 전달 */}
      <ResultList items={results} />
    </div>
  );
}

// 자식 — 콜백을 받아 호출
function SearchInput({ onSearch }) {
  const [value, setValue] = useState('');

  const handleChange = (e) => {
    setValue(e.target.value);
    onSearch(e.target.value);  // 부모의 콜백 호출
  };

  return <input value={value} onChange={handleChange} placeholder="검색..." />;
}
```

## TypeScript Props 타입 선언

![Props 패턴과 타입](/assets/posts/react-props-patterns.svg)

TypeScript를 사용할 때 props 타입을 명시적으로 선언한다.

```tsx
// 기본 타입 선언
type UserCardProps = {
  name: string;                   // 필수 문자열
  age?: number;                   // 선택적 숫자
  role: 'admin' | 'user' | 'guest'; // 유니온 타입
  onSelect: (id: string) => void; // 콜백
  children?: React.ReactNode;     // JSX children
};

function UserCard({ name, age, role, onSelect, children }: UserCardProps) {
  return (
    <div onClick={() => onSelect(name)}>
      <h3>{name} ({role})</h3>
      {age !== undefined && <p>{age}세</p>}
      {children}
    </div>
  );
}
```

HTML 기본 속성을 모두 상속받고 싶을 때는 `ComponentPropsWithoutRef`를 확장한다.

```tsx
// 버튼의 모든 HTML 속성 + 커스텀 속성
type ButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
};

function Button({ variant = 'primary', isLoading, children, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={isLoading || rest.disabled}
      {...rest}
    >
      {isLoading ? <Spinner /> : children}
    </button>
  );
}
```

## Props 전달 팁

```jsx
// 1. 불리언 prop — true일 때 속성명만 써도 됨
<Input required />        // required={true}와 동일
<Input readOnly={false} /> // 명시적 false

// 2. 표현식 prop — 중괄호로 전달
<Card score={user.score * 1.1} />
<Card style={{ color: 'red' }} />

// 3. 문자열 prop — 따옴표 직접 사용 가능 (중괄호 불필요)
<Card title="홍길동" />   // "홍길동" 문자열
<Card title={'홍길동'} /> // 동일

// 4. 함수 prop
<Button onClick={() => console.log('clicked')} />
```

## 정리

Props는 React 단방향 데이터 흐름의 핵심이다. 항상 부모에서 자식으로 흐르며, 자식은 절대 직접 수정할 수 없다. 기본값은 구조분해 할당으로, 타입 안전성은 TypeScript로 확보한다. 자식이 부모에게 데이터를 보낼 때는 콜백 함수를 prop으로 받아 호출한다. 다음 글에서는 props 스프레딩의 편리함과 위험성을 함께 살펴본다.

---

**지난 글:** [children prop — 컴포넌트 합성의 기초](/posts/react-children/)

**다음 글:** [Props Spreading — 편리함과 위험성의 균형](/posts/react-props-spreading/)

<br>
읽어주셔서 감사합니다. 😊
