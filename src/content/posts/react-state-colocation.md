---
title: "상태 배치(State Colocation): 상태는 쓰는 곳에"
description: "State Colocation 원칙 — 상태를 사용하는 최소 공통 조상에 배치해야 하는 이유, state 올리기(Lift Up) 패턴, 그리고 불필요한 리렌더를 막는 state 내리기 리팩터링을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["React", "state colocation", "lift state up", "리렌더", "컴포넌트 설계"]
featured: false
draft: false
---

[지난 글](/posts/react-derived-state/)에서 계산 가능한 값은 state로 만들지 말아야 한다는 원칙을 살펴봤습니다. 이번에는 state를 **어디에** 두어야 하는가를 결정하는 **State Colocation** 원칙을 알아봅니다. 잘못 배치된 state는 불필요한 리렌더를 일으키고 코드를 복잡하게 만듭니다.

---

## State Colocation 원칙

> **state는 그것을 사용하는 최소 공통 조상에 배치한다.**

"최소 공통 조상"이란, 해당 state를 필요로 하는 모든 컴포넌트들의 가장 가까운 공통 부모입니다.

- **오직 한 컴포넌트만 사용**한다면 → 그 컴포넌트 안에
- **두 형제 컴포넌트가 공유**해야 한다면 → 두 컴포넌트의 부모로 올리기(Lift Up)
- **앱 전체**에서 필요하다면 → Context나 전역 상태 관리

![State Colocation: 상태는 쓰는 곳에](/assets/posts/react-state-colocation-concept.svg)

---

## 안티패턴: 필요 이상으로 높이 있는 state

모달 오픈 여부를 App 최상위에 두면, 모달 버튼을 클릭할 때 App 전체가 리렌더됩니다.

```jsx
// ❌ 모달 state가 App에 있어 불필요한 리렌더 발생
function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <Header />
      <SearchBar />         {/* modal과 무관한데 리렌더 */}
      <UserList />          {/* modal과 무관한데 리렌더 */}
      <ModalButton onClick={() => setIsModalOpen(true)} />
      {isModalOpen && <Modal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
```

```jsx
// ✓ modal state를 ModalContainer 안으로 내리기
function ModalContainer() {
  const [isOpen, setIsOpen] = useState(false);  // 여기서만 사용

  return (
    <>
      <button onClick={() => setIsOpen(true)}>열기</button>
      {isOpen && <Modal onClose={() => setIsOpen(false)} />}
    </>
  );
}

function App() {
  return (
    <div>
      <Header />
      <SearchBar />      {/* modal state 변경 시 리렌더 안 됨 */}
      <UserList />       {/* modal state 변경 시 리렌더 안 됨 */}
      <ModalContainer /> {/* 이것만 리렌더 */}
    </div>
  );
}
```

---

## State 올리기(Lift Up): 형제 간 공유

두 형제 컴포넌트가 같은 데이터를 필요로 할 때는 공통 부모로 state를 올립니다.

![State 올리기 패턴](/assets/posts/react-state-colocation-lifting.svg)

```jsx
// ❌ 각자 독립 state — 동기화 안 됨
function CelsiusInput() {
  const [celsius, setCelsius] = useState('');
  // fahrenheit와 연결 불가
}
function FahrenheitInput() {
  const [fahrenheit, setFahrenheit] = useState('');
}

// ✓ 부모가 공유 state 소유
function TemperatureForm() {
  const [celsius, setCelsius] = useState('');
  const fahrenheit = celsius !== '' ? (celsius * 9) / 5 + 32 : '';

  return (
    <>
      <CelsiusInput
        value={celsius}
        onChange={c => setCelsius(c)}
      />
      <FahrenheitInput
        value={fahrenheit.toString()}
        onChange={f => setCelsius(((f - 32) * 5) / 9)}
      />
    </>
  );
}
```

두 입력값이 항상 동기화됩니다. 데이터는 부모의 `celsius` 하나가 단일 진실 공급원(Single Source of Truth)입니다.

---

## 리팩터링 예시: 검색 state 내리기

```jsx
// ❌ 검색 state가 불필요하게 높은 위치에
function ProductPage({ products }) {
  const [query, setQuery] = useState('');
  const filtered = products.filter(p => p.name.includes(query));

  return (
    <div>
      <PageTitle />
      <Breadcrumbs />
      <SearchInput value={query} onChange={setQuery} />
      <ProductGrid items={filtered} />
    </div>
  );
}
```

`query`는 `SearchInput`과 `ProductGrid`만 사용합니다. `PageTitle`과 `Breadcrumbs`는 query 변경과 무관합니다. state를 내리면 이들의 리렌더를 막을 수 있습니다.

```jsx
// ✓ SearchSection이 state를 소유
function SearchSection({ products }) {
  const [query, setQuery] = useState('');
  const filtered = products.filter(p => p.name.includes(query));

  return (
    <>
      <SearchInput value={query} onChange={setQuery} />
      <ProductGrid items={filtered} />
    </>
  );
}

function ProductPage({ products }) {
  return (
    <div>
      <PageTitle />      {/* query 변경 시 리렌더 안 됨 */}
      <Breadcrumbs />    {/* query 변경 시 리렌더 안 됨 */}
      <SearchSection products={products} />
    </div>
  );
}
```

---

## 체크리스트

- [ ] 이 state를 사용하는 컴포넌트들의 공통 부모가 어디인가?
- [ ] 공통 부모보다 더 위에 있다면 → 내려도 되는가?
- [ ] 형제 컴포넌트가 공유해야 한다면 → 부모로 올렸는가?
- [ ] 하나의 컴포넌트만 쓰는데 부모에 있다면 → 해당 컴포넌트로 내렸는가?

---

**지난 글:** [파생 상태와 계산된 값](/posts/react-derived-state/)

**다음 글:** [자동 배칭(Automatic Batching)](/posts/react-automatic-batching/)

<br>
읽어주셔서 감사합니다. 😊
