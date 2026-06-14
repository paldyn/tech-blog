---
title: "리스트 렌더링"
description: "React에서 배열 데이터를 .map()으로 렌더링하는 방법, filter와 조합하는 패턴, 빈 배열 처리, 중첩 리스트 구현을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["React", "리스트렌더링", "map", "filter", "key"]
featured: false
draft: false
---

[지난 글](/posts/react-conditional-rendering/)에서 조건에 따라 다른 UI를 보여주는 패턴을 살펴봤습니다. 이번에는 배열 데이터를 화면에 나열하는 **리스트 렌더링**을 다룹니다. React에서는 JavaScript의 `.map()`이 핵심 도구입니다.

---

## 기본 패턴 — .map()

React에서 배열 데이터를 렌더링할 때는 `.map()`으로 각 항목을 JSX 요소로 변환합니다.

```jsx
const fruits = ['사과', '바나나', '체리'];

function FruitList() {
  return (
    <ul>
      {fruits.map((fruit, index) => (
        <li key={index}>{fruit}</li>
      ))}
    </ul>
  );
}
```

`.map()`의 반환값(JSX 배열)을 `{}`으로 감싸면 React가 자동으로 각 요소를 렌더링합니다.

---

## 객체 배열 렌더링

실무에서는 대부분 객체 배열을 다룹니다. 각 객체의 고유 `id`를 `key`로 사용합니다.

```jsx
const products = [
  { id: 1, name: '노트북', price: 1_200_000 },
  { id: 2, name: '마우스', price: 35_000 },
  { id: 3, name: '모니터', price: 450_000 },
];

function ProductList() {
  return (
    <ul className="product-list">
      {products.map(product => (
        <li key={product.id} className="product-item">
          <span className="name">{product.name}</span>
          <span className="price">{product.price.toLocaleString()}원</span>
        </li>
      ))}
    </ul>
  );
}
```

![리스트 렌더링 map 패턴](/assets/posts/react-list-rendering-map.svg)

---

## 컴포넌트로 분리하기

리스트 항목이 복잡할수록 별도 컴포넌트로 분리하면 코드가 깔끔해집니다.

```jsx
function ProductCard({ id, name, price, category }) {
  return (
    <article className="card" aria-labelledby={`product-${id}`}>
      <h3 id={`product-${id}`}>{name}</h3>
      <p className="category">{category}</p>
      <p className="price">{price.toLocaleString()}원</p>
    </article>
  );
}

function ProductGrid({ products }) {
  return (
    <div className="grid">
      {products.map(product => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  );
}
```

---

## filter + map 조합

조건에 맞는 항목만 렌더링할 때는 `.filter()` 뒤에 `.map()`을 연결합니다.

```jsx
function PremiumProducts({ products }) {
  return (
    <section>
      <h2>프리미엄 상품</h2>
      <ul>
        {products
          .filter(p => p.price >= 100_000)
          .map(p => (
            <li key={p.id}>{p.name} — {p.price.toLocaleString()}원</li>
          ))}
      </ul>
    </section>
  );
}
```

---

## 빈 배열 처리 (Empty State)

배열이 비었을 때 "항목 없음" UI를 보여주는 것은 좋은 UX의 기본입니다.

```jsx
function CommentList({ comments }) {
  if (comments.length === 0) {
    return (
      <div className="empty-state">
        <p>아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!</p>
      </div>
    );
  }

  return (
    <ul>
      {comments.map(comment => (
        <li key={comment.id}>
          <strong>{comment.author}</strong>: {comment.text}
        </li>
      ))}
    </ul>
  );
}
```

---

## 중첩 리스트

카테고리 안에 아이템이 있는 구조처럼 중첩 리스트도 `.map()` 안에 `.map()`을 씁니다. 각 수준의 요소에 별도로 `key`를 지정합니다.

```jsx
function CategoryMenu({ categories }) {
  return (
    <nav>
      {categories.map(category => (
        <section key={category.id}>
          <h2>{category.name}</h2>
          <ul>
            {category.items.map(item => (
              <li key={item.id}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
```

![리스트 렌더링 패턴](/assets/posts/react-list-rendering-patterns.svg)

---

## key에 대한 오해

`key`는 React 내부에서만 사용하며, 컴포넌트의 `props`로 전달되지 않습니다. 자식 컴포넌트에서 `key` 값을 사용하려면 별도 prop으로 명시적으로 내려야 합니다.

```jsx
// key는 props.key로 접근 불가
function Item({ id, name }) {
  // ❌ props.key로 받을 수 없음
  return <li data-id={id}>{name}</li>;
}

// 렌더링 시: key와 id를 둘 다 전달
{items.map(item => (
  <Item key={item.id} id={item.id} name={item.name} />
))}
```

`key`에 대한 더 자세한 내용은 다음 글에서 다룹니다.

---

**지난 글:** [조건부 렌더링](/posts/react-conditional-rendering/)

**다음 글:** [key의 역할과 올바른 사용](/posts/react-keys/)

<br>
읽어주셔서 감사합니다. 😊
