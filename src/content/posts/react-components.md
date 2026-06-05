---
title: "React 컴포넌트 — 함수형과 클래스형, 컴포넌트 설계 원칙"
description: "함수형과 클래스형 컴포넌트의 차이, 컴포넌트를 올바르게 만드는 규칙, 순수 컴포넌트 개념, 실전 컴포넌트 설계 원칙을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["React컴포넌트", "함수형컴포넌트", "클래스컴포넌트", "컴포넌트설계", "순수컴포넌트"]
featured: false
draft: false
---

[지난 글](/posts/react-fragments/)에서 Fragment로 불필요한 DOM 노드를 없애는 방법을 배웠다. React의 모든 UI는 **컴포넌트**로 만들어진다. 컴포넌트를 제대로 이해하고 올바르게 설계하는 것이 React 개발의 핵심이다.

## 컴포넌트란 무엇인가

컴포넌트는 **props를 받아 JSX(React Element)를 반환하는 함수**(또는 클래스)다. UI를 독립적이고 재사용 가능한 조각으로 분리한다.

```jsx
// 가장 단순한 컴포넌트
function Hello() {
  return <p>안녕하세요!</p>;
}

// props를 받는 컴포넌트
function Greeting({ name, age }) {
  return (
    <div>
      <h2>{name}님 안녕하세요</h2>
      <p>나이: {age}세</p>
    </div>
  );
}
```

컴포넌트 이름은 **반드시 대문자로 시작**해야 한다. 소문자로 시작하면 JSX에서 HTML 네이티브 태그로 해석된다.

## 함수형 vs 클래스형 컴포넌트

React는 초기에 클래스형 컴포넌트만 상태와 생명주기를 다룰 수 있었다. React 16.8(2019)에 Hooks가 도입된 이후 함수형 컴포넌트가 모든 기능을 갖추게 됐고, 현재는 함수형이 표준이다.

![함수형 vs 클래스형 컴포넌트](/assets/posts/react-components-types.svg)

```jsx
// 현재 표준: 함수형 컴포넌트
function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);
  return (
    <button onClick={() => setCount(c => c + 1)}>
      클릭: {count}
    </button>
  );
}

// 레거시: 클래스형 컴포넌트
class Counter extends React.Component {
  state = { count: this.props.initialCount ?? 0 };
  render() {
    return (
      <button onClick={() => this.setState(s => ({ count: s.count + 1 }))}>
        클릭: {this.state.count}
      </button>
    );
  }
}
```

클래스형을 새로 작성할 필요는 없다. **Error Boundary** 구현이 아직 클래스 컴포넌트만 지원하는 유일한 예외다.

## 컴포넌트 구조 해부

함수형 컴포넌트의 전형적인 구조는 다음과 같다.

![컴포넌트 구조 해부](/assets/posts/react-components-anatomy.svg)

```jsx
import { useState, useEffect, useCallback } from 'react';

function ProductCard({ product, onAddToCart }) {
  // 1. State 선언 (최상위에서만 Hooks 호출)
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 2. 파생값 계산 (상태나 props로부터)
  const discountedPrice = product.price * (1 - product.discount);

  // 3. 이벤트 핸들러
  const handleFavorite = useCallback(() => {
    setIsFavorited(prev => !prev);
  }, []);

  const handleAddToCart = async () => {
    setIsLoading(true);
    await onAddToCart(product.id);
    setIsLoading(false);
  };

  // 4. JSX 반환
  return (
    <div className="card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>{discountedPrice.toLocaleString()}원</p>
      <button onClick={handleFavorite}>
        {isFavorited ? '♥' : '♡'}
      </button>
      <button onClick={handleAddToCart} disabled={isLoading}>
        {isLoading ? '추가 중...' : '장바구니 담기'}
      </button>
    </div>
  );
}
```

## 순수 컴포넌트(Pure Component)

React는 컴포넌트가 **순수 함수**처럼 동작할 것을 요구한다. 같은 props에는 항상 같은 JSX를 반환해야 하고, 렌더링 중에 외부 상태를 변경해서는 안 된다.

```jsx
// ❌ 불순 컴포넌트 — 렌더링 중 외부 값 변경
let renderCount = 0;
function BadComponent({ name }) {
  renderCount++;          // 외부 변수 변경 — 부수 효과!
  return <p>{name}</p>;
}

// ✅ 순수 컴포넌트 — 같은 props → 같은 출력
function GoodComponent({ name, count }) {
  return <p>{name}: {count}회</p>;
}
```

부수 효과(API 호출, DOM 조작, 구독 등)는 반드시 `useEffect` 안에서 처리한다.

## 컴포넌트 설계 5원칙

### 1. 단일 책임 원칙

하나의 컴포넌트는 하나의 역할만 한다. 너무 커지면 분리할 신호다.

```jsx
// ❌ 너무 많은 책임
function UserDashboard() {
  // 사용자 정보 fetch, 통계 계산, 알림 처리, 프로필 렌더링...
}

// ✅ 책임별로 분리
function UserDashboard() {
  return (
    <div>
      <UserProfile />
      <UserStats />
      <Notifications />
    </div>
  );
}
```

### 2. 컴포넌트를 최대한 작고 순수하게

```jsx
// ❌ props가 너무 많음 (5개 이상은 재고 신호)
function UserCard({ name, age, email, avatar, role, score, isAdmin, onClick }) { ... }

// ✅ 관련 props를 객체로 묶기
function UserCard({ user, onSelect }) {
  const { name, age, email, avatar, role } = user;
  return ...;
}
```

### 3. 컴포넌트 파일 구조

```
src/
├── components/
│   ├── ui/              # 범용 UI 컴포넌트 (Button, Input...)
│   │   ├── Button.jsx
│   │   └── Input.jsx
│   └── features/        # 기능별 컴포넌트
│       └── UserCard.jsx
├── pages/               # 라우트 단위 컴포넌트
│   └── HomePage.jsx
└── App.jsx
```

### 4. 명확한 컴포넌트 네이밍

```jsx
// 명사(무엇)로 네이밍 — 역할이 명확
UserCard, ProductList, NavigationBar, SearchInput

// 페이지 컴포넌트는 Page 접미사
HomePage, ProfilePage, SettingsPage

// 조각 컴포넌트
CartItem, MessageBubble, TableRow
```

### 5. default export vs named export

```jsx
// 컴포넌트는 주로 default export
export default function Button({ ... }) { ... }

// 여러 컴포넌트를 한 파일에서 export할 때는 named
export function PrimaryButton({ ... }) { ... }
export function SecondaryButton({ ... }) { ... }
```

## 정리

컴포넌트는 props를 받아 JSX를 반환하는 함수다. 함수형 컴포넌트가 현재 표준이며, Hooks로 상태와 생명주기를 모두 다룬다. 좋은 컴포넌트는 순수하고, 단일 책임을 갖고, 재사용 가능하다. 다음 글에서는 컴포넌트 합성의 핵심인 **children prop**을 깊이 다룬다.

---

**지난 글:** [React Fragment — 불필요한 DOM 노드 없애기](/posts/react-fragments/)

**다음 글:** [children prop — 컴포넌트 합성의 기초](/posts/react-children/)

<br>
읽어주셔서 감사합니다. 😊
