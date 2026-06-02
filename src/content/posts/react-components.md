---
title: "컴포넌트 기초 — React 앱의 기본 구성 단위"
description: "함수형 컴포넌트의 구조, PascalCase 명명 규칙, 컴포넌트 합성과 트리 구조, 순수 함수 원칙, 그리고 컴포넌트 분리 기준을 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["컴포넌트", "함수형컴포넌트", "PascalCase", "컴포넌트합성", "순수함수", "React기초"]
featured: false
draft: false
---

[지난 글](/posts/react-fragments/)에서 Fragment로 불필요한 래퍼를 제거하는 방법을 배웠다. 이번 글에서는 React 앱을 구성하는 핵심 단위인 **컴포넌트**를 깊이 이해한다.

## 컴포넌트란

컴포넌트는 **UI의 일부를 반환하는 JavaScript 함수**다. props를 입력으로 받아 JSX를 출력한다.

```jsx
// 가장 단순한 컴포넌트
function Hello() {
  return <h1>안녕하세요!</h1>;
}

// props를 받는 컴포넌트
function Greeting({ name, age }) {
  return (
    <div>
      <h2>{name}님, 환영합니다!</h2>
      <p>나이: {age}세</p>
    </div>
  );
}
```

## 컴포넌트 해부도

![컴포넌트 해부도](/assets/posts/react-components-anatomy.svg)

함수형 컴포넌트는 크게 5개 영역으로 나뉜다.

1. **Import** — Hook과 다른 컴포넌트를 가져온다
2. **Props** — 부모로부터 받은 데이터 (기본값 설정 가능)
3. **State** — 컴포넌트 자체의 내부 상태
4. **이벤트 핸들러** — 사용자 상호작용 처리 로직
5. **JSX 반환** — 현재 state와 props로 그려질 UI

## PascalCase 명명 규칙

**컴포넌트 이름은 반드시 대문자로 시작해야 한다.** React는 대소문자로 내장 HTML 태그와 사용자 정의 컴포넌트를 구분한다.

```jsx
// React가 태그를 해석하는 방식
<div>        // 소문자 → HTML 태그
<p>          // 소문자 → HTML 태그
<Counter />  // 대문자 → React 컴포넌트
<UserCard /> // 대문자 → React 컴포넌트

// ❌ 소문자 컴포넌트는 작동하지 않는다
function counter() { return <div />; }
<counter /> // HTML 태그로 인식 → 에러 또는 예상 외 동작
```

## 컴포넌트 합성

React 앱은 컴포넌트들의 트리다. 작은 컴포넌트를 조합해 점점 더 복잡한 UI를 만든다.

![컴포넌트 합성 — 트리 구조](/assets/posts/react-components-composition.svg)

```jsx
// 작은 단위 컴포넌트들
function Avatar({ src, alt }) {
  return <img className="avatar" src={src} alt={alt} />;
}

function UserInfo({ user }) {
  return (
    <div className="user-info">
      <Avatar src={user.avatarUrl} alt={user.name} />
      <span>{user.name}</span>
    </div>
  );
}

// 조합
function Comment({ comment }) {
  return (
    <article>
      <UserInfo user={comment.author} />
      <p>{comment.text}</p>
    </article>
  );
}
```

## 컴포넌트 순수성(Purity)

React 컴포넌트는 **순수 함수**처럼 동작해야 한다. 같은 props를 주면 항상 같은 JSX를 반환해야 하며, 렌더링 중 외부 상태를 변경하면 안 된다.

```jsx
// ❌ 순수하지 않음: 외부 변수를 렌더 중 변경
let count = 0;
function ImpureCounter() {
  count++;                    // Side effect!
  return <p>Count: {count}</p>;
}

// ✅ 순수함: 항상 같은 결과
function PureGreeting({ name }) {
  return <p>Hello, {name}!</p>;
}
```

렌더링 중 발생하는 부수 효과(side effect)는 `useEffect`로 처리한다. 이 주제는 시리즈 후반에서 다룬다.

## 컴포넌트 분리 기준

언제 컴포넌트를 분리해야 할까? 다음 상황이 신호다.

```jsx
// 분리 전: 하나의 큰 컴포넌트
function ProductPage({ product }) {
  return (
    <div>
      {/* 이미지 갤러리 로직 30줄 */}
      <div className="gallery">
        {product.images.map(img => (
          <img key={img.id} src={img.url} alt={img.alt} />
        ))}
      </div>

      {/* 가격 정보 로직 20줄 */}
      <div className="price-section">
        <span className="original">{product.originalPrice}</span>
        <span className="sale">{product.salePrice}</span>
      </div>

      {/* 리뷰 목록 로직 40줄 */}
      ...
    </div>
  );
}

// 분리 후: 각 책임을 독립 컴포넌트로
function ProductPage({ product }) {
  return (
    <div>
      <ImageGallery images={product.images} />
      <PriceSection prices={product.prices} />
      <ReviewList productId={product.id} />
    </div>
  );
}
```

**단일 책임 원칙**: 하나의 컴포넌트는 하나의 역할만 한다. 컴포넌트가 너무 커지거나, 같은 UI가 여러 곳에서 반복되거나, 함께 변경되지 않는 로직이 섞여 있으면 분리를 고려한다.

---

**지난 글:** [Fragment — 불필요한 래퍼 없이 여러 요소 반환하기](/posts/react-fragments/)

**다음 글:** [children prop — 컴포넌트 안에 컴포넌트 넣기](/posts/react-children/)

<br>
읽어주셔서 감사합니다. 😊
