---
title: "파생 상태와 계산된 값"
description: "다른 state나 prop으로부터 계산될 수 있는 값은 state로 관리하면 안 되는 이유, 파생 상태의 판단 기준, 그리고 useMemo로 비싼 계산을 최적화하는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 7
type: "knowledge"
category: "React"
tags: ["React", "파생 상태", "useMemo", "state 최소화", "성능"]
featured: false
draft: false
---

[지난 글](/posts/react-immutable-updates/)에서 불변성 업데이트로 React의 변경 감지를 올바르게 동작시키는 방법을 살펴봤습니다. 이번에는 state를 **얼마나 적게 가져야 하는가**에 관한 이야기입니다. 다른 state로부터 계산될 수 있는 값을 별도 state로 관리하면 동기화 버그가 생깁니다.

---

## 파생 상태란

**파생 상태(derived state)**는 기존 state나 prop으로부터 계산할 수 있는 값입니다. 이 값을 별도 `useState`로 관리하면 두 값이 불일치하는 버그가 발생할 위험이 생깁니다.

```jsx
// ❌ 동기화 위험 — items에서 이미 계산 가능
function Cart() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);  // 중복
  const [count, setCount] = useState(0);  // 중복

  function addItem(item) {
    setItems(prev => [...prev, item]);
    setTotal(prev => prev + item.price);  // 항상 함께 갱신해야 함
    setCount(prev => prev + 1);           // 하나 빠뜨리면 버그!
  }
}
```

대신, `items`만 state로 두고 나머지는 렌더링 중에 계산합니다.

```jsx
// ✓ items 하나만 state
function Cart() {
  const [items, setItems] = useState([]);

  const total = items.reduce((sum, i) => sum + i.price, 0); // 자동 동기화
  const count = items.length;                                // 자동 동기화

  function addItem(item) {
    setItems(prev => [...prev, item]); // 이것만 변경하면 됨
  }
}
```

![파생 상태: 계산하면 되는 걸 state로 만들지 마라](/assets/posts/react-derived-state-concept.svg)

---

## 파생 상태 판단 기준

> **"이 값을 기존 state나 prop으로부터 계산할 수 있는가?"**

Yes라면 state가 아닌 **계산된 변수**로 선언합니다.

![흔히 state로 만들지만 계산이 맞는 케이스](/assets/posts/react-derived-state-patterns.svg)

대표적인 파생 상태 케이스들:

```jsx
// 1. 필터된 목록 — filter 조건만 state
const [filter, setFilter] = useState('all');
const visible = todos.filter(t =>
  filter === 'all' || t.done === (filter === 'done')
);

// 2. 검색 결과 — 검색어만 state
const [query, setQuery] = useState('');
const results = users.filter(u =>
  u.name.toLowerCase().includes(query.toLowerCase())
);

// 3. 폼 유효성 — 입력값만 state
const [email, setEmail] = useState('');
const isEmailValid = email.includes('@') && email.length > 4;

// 4. 선택된 항목 — ID만 state
const [selectedId, setSelectedId] = useState(null);
const selected = items.find(i => i.id === selectedId);
```

---

## useMemo: 비싼 계산 메모이제이션

계산 비용이 크다면 `useMemo`로 감싸 불필요한 재계산을 피할 수 있습니다.

```jsx
// 수천 건의 필터링 — 렌더마다 재실행하면 비쌀 수 있음
const filteredList = useMemo(
  () => hugeList.filter(item => item.category === selectedCategory),
  [hugeList, selectedCategory]  // 의존성이 바뀔 때만 재계산
);
```

하지만 대부분의 계산은 useMemo 없이도 충분히 빠릅니다. **먼저 계산식으로 작성하고, 프로파일링 후 필요한 경우에만 useMemo를 추가**하는 것이 권장 방법입니다.

---

## 진짜 state인지 파생 상태인지 구분하는 질문

1. **시간이 지나도 변하는가?** — No라면 상수
2. **부모가 prop으로 전달하는가?** — Yes라면 state가 아님
3. **다른 state나 prop으로 계산되는가?** — Yes라면 파생 상태

세 질문 모두 No일 때만 state로 관리합니다.

```jsx
// 판단 예시
function ProductPage({ products, userId }) {
  // ✓ state: 시간에 따라 변하고, 계산 불가
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  // ✓ 파생: searchQuery, sortOrder, products로부터 계산
  const filtered = products
    .filter(p => p.name.includes(searchQuery))
    .sort((a, b) =>
      sortOrder === 'asc'
        ? a.price - b.price
        : b.price - a.price
    );

  // ✓ 파생: products에서 계산
  const totalCount = products.length;
  const avgPrice = products.reduce((s, p) => s + p.price, 0) / totalCount;
}
```

---

## 흔한 실수: Effect로 동기화하기

파생 상태를 잘못 처리하면 `useEffect`로 동기화하려는 시도가 생깁니다.

```jsx
// ❌ Effect로 동기화 — 한 렌더 늦게 반영되고, 무한 루프 위험
useEffect(() => {
  setFilteredItems(items.filter(i => i.active));
}, [items]);

// ✓ 렌더링 중 직접 계산
const filteredItems = items.filter(i => i.active);
```

`useEffect`는 외부 시스템과 동기화할 때 쓰는 도구입니다. 같은 컴포넌트 안의 state끼리 동기화하는 데 쓰면 거의 항상 파생 상태 문제입니다.

---

**지난 글:** [불변성 업데이트 패턴](/posts/react-immutable-updates/)

**다음 글:** [상태 배치(State Colocation)](/posts/react-state-colocation/)

<br>
읽어주셔서 감사합니다. 😊
