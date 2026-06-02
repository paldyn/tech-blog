---
title: "리스트 렌더링 — 배열을 UI로 변환하기"
description: "React에서 배열을 map으로 JSX 리스트로 변환하는 방법, key prop의 역할, filter/map 조합, 중첩 리스트, key에 index 쓰면 안 되는 이유를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 10
type: "knowledge"
category: "React"
tags: ["리스트렌더링", "map", "key", "filter", "중첩리스트", "React기초"]
featured: false
draft: false
---

[지난 글](/posts/react-conditional-rendering/)에서 조건부 렌더링의 모든 패턴을 배웠다. 이번 글에서는 React 앱에서 매우 자주 쓰이는 **리스트 렌더링**을 다룬다. 데이터 배열을 JSX 요소 배열로 변환하는 것이 핵심이다.

## 기본 패턴: Array.map()

JavaScript의 `map()`은 배열의 각 요소를 변환해 새 배열을 반환한다. React에서는 데이터 배열을 JSX 배열로 변환할 때 쓴다.

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

## map 렌더링 흐름

![배열 → UI: map() 렌더링](/assets/posts/react-list-rendering-map.svg)

실무에서는 문자열 배열보다 객체 배열이 더 흔하다.

```jsx
const products = [
  { id: 1, name: '노트북', price: 1200000 },
  { id: 2, name: '마우스', price: 45000 },
  { id: 3, name: '키보드', price: 89000 },
];

function ProductList() {
  return (
    <ul className="product-list">
      {products.map(product => (
        <li key={product.id} className="product-item">
          <strong>{product.name}</strong>
          <span>{product.price.toLocaleString()}원</span>
        </li>
      ))}
    </ul>
  );
}
```

## key prop이 반드시 필요한 이유

`key`는 React가 리스트의 항목을 식별하는 데 사용하는 특별한 prop이다. 항목이 추가·삭제·재정렬될 때 어떤 DOM 노드를 업데이트해야 하는지 결정한다.

```jsx
// key 없으면 경고: Each child in a list should have a unique "key" prop.
{items.map(item => <Card item={item} />)}   // ⚠ key 없음

// key 있음
{items.map(item => <Card key={item.id} item={item} />)}  // ✅
```

**key는 리스트 내에서 고유하면 충분하다.** 전체 앱에서 고유할 필요는 없다. 같은 배열 내에서 중복되지 않으면 된다.

## filter + map 조합

![filter + map 패턴 & 중첩 리스트](/assets/posts/react-list-rendering-filter.svg)

조건에 맞는 항목만 렌더링하려면 `filter`를 먼저 적용한다.

```jsx
function TodoList({ todos, showCompleted }) {
  const filtered = showCompleted
    ? todos.filter(t => t.done)
    : todos;

  return (
    <ul>
      {filtered.map(todo => (
        <li key={todo.id} className={todo.done ? 'done' : ''}>
          {todo.title}
        </li>
      ))}
    </ul>
  );
}
```

## index를 key로 쓰면 안 되는 경우

배열이 정렬되거나 항목이 삽입·삭제되는 경우 `index`를 key로 쓰면 React가 잘못된 컴포넌트를 재사용한다.

```jsx
// ❌ 정렬 가능한 리스트에서 index를 key로 쓰면 안 된다
{sortedItems.map((item, index) => (
  <SortableRow key={index} item={item} />  // 재정렬 시 버그 발생
))}

// ✅ 고유 ID 사용
{sortedItems.map(item => (
  <SortableRow key={item.id} item={item} />
))}
```

**예외**: 정적인 리스트(순서 변경, 추가, 삭제가 없는)이고 항목에 고유 ID가 없을 때만 index를 써도 괜찮다.

## 빈 리스트 처리

```jsx
function ItemList({ items }) {
  if (items.length === 0) {
    return <p className="empty">항목이 없습니다.</p>;
  }

  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

## 컴포넌트로 리스트 아이템 분리

리스트 아이템이 복잡해지면 별도 컴포넌트로 분리한다. `key`는 반환되는 컴포넌트가 아닌 map 안의 최상위 요소에 붙인다.

```jsx
function ProductCard({ product }) {
  return (
    <li className="product-card">
      <img src={product.imageUrl} alt={product.name} />
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <button>담기</button>
    </li>
  );
}

function ProductGrid({ products }) {
  return (
    <ul className="grid">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}
```

---

**지난 글:** [조건부 렌더링 — 상황에 따라 다른 UI 보여주기](/posts/react-conditional-rendering/)

<br>
읽어주셔서 감사합니다. 😊
