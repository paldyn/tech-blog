---
title: "리스트 렌더링 — map, key, 성능 최적화"
description: "React에서 배열을 화면에 표시하는 map 패턴, key prop의 역할과 올바른 사용법, index를 key로 쓰면 안 되는 이유, 빈 목록 처리를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 10
type: "knowledge"
category: "React"
tags: ["리스트렌더링", "React", "map", "key prop", "Reconciliation"]
featured: false
draft: false
---

[지난 글](/posts/react-conditional-rendering/)에서 조건부 렌더링의 5가지 방법을 배웠다. 앱에서 데이터 목록을 화면에 표시하는 작업은 매우 자주 일어난다. React에서는 JavaScript 배열의 `map()` 메서드를 이용해 배열 데이터를 JSX 요소로 변환한다.

## 기본 패턴: 배열 → JSX

`Array.map()`은 배열의 각 요소를 변환해 새 배열을 반환한다. React는 JSX 배열을 그대로 렌더링할 수 있으므로, `map()`으로 JSX 배열을 만들면 리스트가 완성된다.

```jsx
const fruits = ['사과', '바나나', '딸기'];

function FruitList() {
  return (
    <ul>
      {fruits.map(fruit => (
        <li key={fruit}>{fruit}</li>
      ))}
    </ul>
  );
}
```

![리스트 렌더링 흐름](/assets/posts/react-list-rendering-flow.svg)

## key prop — 반드시 필요한 이유

리스트 렌더링 시 `key` prop이 없으면 React 경고가 발생한다. key는 React가 어떤 항목이 변경·추가·삭제됐는지 식별하는 데 사용한다.

```jsx
// ❌ key 없음 — 경고 + 잠재적 버그
{users.map(user => <UserCard user={user} />)}

// ✅ key 있음
{users.map(user => <UserCard key={user.id} user={user} />)}
```

### key의 역할: Reconciliation 최적화

상태 변화 시 React는 이전·현재 Virtual DOM을 비교해 실제로 변경된 부분만 DOM에 반영한다. key가 있으면 어떤 항목이 이동했는지 파악할 수 있어 DOM 조작을 최소화한다.

![key prop 올바른 사용법](/assets/posts/react-list-rendering-patterns.svg)

## index를 key로 쓰면 안 되는 이유

흔한 실수는 배열 인덱스를 key로 사용하는 것이다.

```jsx
// ❌ index를 key로 사용 — 이렇게 하면 안 됨
{items.map((item, index) => (
  <li key={index}>{item.name}</li>
))}
```

인덱스를 key로 쓰면 항목을 삭제·재정렬할 때 index가 재배정되어 React가 DOM을 잘못 재사용한다.

```jsx
// 문제 재현 예시
const [items, setItems] = useState([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]);

// 'Alice' 삭제 후 items = [{ id: 2, name: 'Bob' }]
// index key 사용 시: index 0 → 여전히 존재 → React는 "0번 항목이 그냥 바뀐 것"으로 판단
// → Bob의 input state가 Alice 자리에 그대로 남는 버그

function Item({ name }) {
  const [inputVal, setInputVal] = useState('');
  return (
    <li>
      {name}
      <input value={inputVal} onChange={e => setInputVal(e.target.value)} />
    </li>
  );
}
```

**index를 key로 써도 안전한 경우**: 목록이 재정렬·삭제되지 않고, 정적이며, 고유 ID가 없는 경우에만 한정된다.

## 올바른 key 만들기

```jsx
// 1. DB에서 오는 데이터 — id 사용
{posts.map(post => <PostCard key={post.id} post={post} />)}

// 2. ID가 없는 경우 — 고유한 문자열 조합
{tags.map(tag => <Tag key={tag.name} label={tag.name} />)}

// 3. 중복 가능한 값 — crypto.randomUUID() (초기화 1회만)
const [items] = useState(() =>
  initialItems.map(item => ({ ...item, uid: crypto.randomUUID() }))
);
{items.map(item => <Item key={item.uid} item={item} />)}
```

key는 같은 리스트 내에서 고유하면 된다. 전역적으로 유일할 필요는 없다.

## 빈 목록과 로딩 처리

```jsx
function ProductList({ products, isLoading }) {
  if (isLoading) {
    return (
      <ul>
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="skeleton-card" />
        ))}
      </ul>
    );
  }

  if (products.length === 0) {
    return (
      <div className="empty-state">
        <p>등록된 상품이 없습니다</p>
        <button>상품 추가하기</button>
      </div>
    );
  }

  return (
    <ul>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}
```

## 중첩 리스트

```jsx
function CategoryList({ categories }) {
  return (
    <nav>
      {categories.map(category => (
        <div key={category.id} className="category">
          <h3>{category.name}</h3>
          <ul>
            {category.items.map(item => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
```

중첩 리스트에서도 각 레벨의 key는 해당 레벨에서 고유하면 된다.

## map 외 다른 배열 메서드 활용

```jsx
function FilteredList({ items, query, maxCount = 20 }) {
  const visibleItems = items
    .filter(item => item.name.includes(query))     // 필터링
    .sort((a, b) => b.score - a.score)             // 정렬
    .slice(0, maxCount);                           // 개수 제한

  return (
    <ul>
      {visibleItems.map(item => (
        <li key={item.id}>
          {item.name} — {item.score}점
        </li>
      ))}
    </ul>
  );
}
```

단, `map()` 안에서 `filter()`를 호출하거나 부수 효과를 일으키지 않는다. 렌더링 로직은 순수하게 유지한다.

## 정리

리스트 렌더링의 핵심은 두 가지다. 첫째, `Array.map()`으로 데이터를 JSX 배열로 변환한다. 둘째, 반드시 `key` prop을 고유하고 안정적인 값(보통 ID)으로 설정한다. `index`를 key로 쓰는 것은 정적·불변 목록에서만 허용된다. 다음 글에서는 key가 React 재조정에 어떤 영향을 미치는지 더 깊이 살펴본다.

---

**지난 글:** [조건부 렌더링 — 상황에 맞는 UI 표현하기](/posts/react-conditional-rendering/)

<br>
읽어주셔서 감사합니다. 😊
