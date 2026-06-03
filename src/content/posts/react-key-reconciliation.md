---
title: "key와 재조정 — 리스트에서 key가 하는 일"
description: "React 재조정 알고리즘에서 key prop이 리스트 아이템의 동일성을 어떻게 추적하는지, key 없을 때와 있을 때의 차이, 올바른 key 선택 기준, 그리고 key를 의도적으로 활용해 state를 초기화하는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["React", "key", "재조정", "Reconciliation", "리스트", "최적화"]
featured: false
draft: false
---

[지난 글](/posts/react-reconciliation/)에서 React 재조정 알고리즘의 두 가지 핵심 규칙을 살펴봤다. 이번에는 리스트 재조정에서 `key` prop이 어떤 역할을 하는지 자세히 다룬다. key는 단순히 경고를 없애는 용도가 아니다. 성능과 정확성에 직접 영향을 주는 중요한 힌트다.

## key 없을 때의 문제

React는 리스트를 재조정할 때 같은 위치의 요소가 같은 요소라고 가정한다. key가 없으면 **인덱스**로 비교한다.

리스트 끝에 항목을 추가하는 경우는 괜찮다.

```jsx
// 이전
<ul>
  <li>홍길동</li> {/* index 0 */}
  <li>김철수</li> {/* index 1 */}
</ul>

// 이후 — 끝에 추가
<ul>
  <li>홍길동</li> {/* index 0 — 동일 */}
  <li>김철수</li> {/* index 1 — 동일 */}
  <li>이영희</li> {/* index 2 — 새로 추가 */}
</ul>
// index 0, 1은 같음 → 재사용, index 2만 새로 생성
```

하지만 리스트 **앞**에 항목을 추가하면 문제가 생긴다.

```jsx
// 이전
<ul>
  <li>홍길동</li> {/* index 0 */}
  <li>김철수</li> {/* index 1 */}
</ul>

// 이후 — 앞에 추가
<ul>
  <li>박민준</li> {/* index 0 — "홍길동"이 "박민준"으로 변경? */}
  <li>홍길동</li> {/* index 1 — "김철수"가 "홍길동"으로 변경? */}
  <li>김철수</li> {/* index 2 — 새로 추가? */}
</ul>
// 3개 모두 업데이트 — 비효율적이고 state도 어긋남
```

![key 없을 때 리스트 재조정 문제](/assets/posts/react-key-reconciliation-without.svg)

## key 있을 때의 효율

key를 지정하면 React는 위치가 아닌 key 값으로 동일성을 추적한다.

```jsx
// 이전
<ul>
  <li key="1">홍길동</li>
  <li key="2">김철수</li>
</ul>

// 이후 — 앞에 추가
<ul>
  <li key="4">박민준</li> {/* 새 key → 새로 생성 */}
  <li key="1">홍길동</li> {/* 기존 key → 재사용, 이동만 */}
  <li key="2">김철수</li> {/* 기존 key → 재사용, 이동만 */}
</ul>
// key="1", key="2" 재사용 → key="4"만 새로 생성
```

![key 있을 때 효율적 재조정](/assets/posts/react-key-reconciliation-with.svg)

성능 뿐만 아니라 **정확성**도 중요하다. key 없이 앞에 삽입하면 기존 컴포넌트의 state가 엉뚱한 항목에 붙어있게 된다.

```jsx
// 체크박스 예시 — key 없을 때 state 오류
function TodoList({ todos }) {
  return todos.map(todo => (
    <TodoItem todo={todo} /> // key 없음!
  ));
}

function TodoItem({ todo }) {
  const [checked, setChecked] = useState(false); // 각 항목의 체크 상태
  return <li><input type="checkbox" checked={checked} />{todo.text}</li>;
}
// 앞에 새 항목 추가 시 → 첫 번째 항목의 checked state가
// 두 번째 위치로 이동한 것처럼 보임
```

## 올바른 key 선택

**데이터의 고유 id를 사용한다**. 서버에서 오는 데이터라면 데이터베이스 id가 이상적이다.

```jsx
// 좋은 예 — 데이터 id
users.map(user => <UserCard key={user.id} user={user} />)

// 좋은 예 — 고유 식별자
items.map(item => <Item key={item.sku} item={item} />)
```

**index는 최후의 수단이다**. 리스트가 재정렬되지 않고, 필터링되지 않으며, 앞에 추가되지 않는 경우에만 안전하다.

```jsx
// index 사용이 괜찮은 경우 — 정적이고 재정렬 없는 리스트
const MENU_ITEMS = ['홈', '소개', '연락처'];
MENU_ITEMS.map((item, index) => <NavLink key={index}>{item}</NavLink>)

// index 사용이 위험한 경우
filteredItems.map((item, index) => <Item key={index} item={item} />)
// 필터 변경 시 index가 달라짐 → state 오염
```

## key를 이용한 state 초기화

key의 또 다른 활용은 의도적으로 컴포넌트를 리셋하는 것이다. key가 바뀌면 React는 이전 컴포넌트를 언마운트하고 새 컴포넌트를 마운트한다. state가 초기화되는 효과가 있다.

```jsx
function ProfilePage({ userId }) {
  return <Profile key={userId} userId={userId} />;
}

function Profile({ userId }) {
  const [comment, setComment] = useState('');
  // userId가 바뀌어도 comment state가 남아있는 문제 방지
  // key={userId}로 userId 변경 시 완전히 새 Profile 마운트
  return (
    <div>
      <h1>사용자 {userId}</h1>
      <textarea value={comment} onChange={e => setComment(e.target.value)} />
    </div>
  );
}
```

useEffect로 userId 변경을 감지해서 state를 초기화하는 것보다 key를 활용하는 것이 훨씬 간결하다.

## 요약: key 선택 기준

| 상황 | key |
|------|-----|
| 서버 데이터 리스트 | 데이터베이스 id |
| 정적·불변 리스트 | index (제한적으로 허용) |
| 재정렬·필터링되는 리스트 | 고유 식별자 필수 |
| 컴포넌트 리셋이 필요한 경우 | 변경 트리거가 되는 값 |

---

**지난 글:** [재조정(Reconciliation) — Diffing 알고리즘](/posts/react-reconciliation/)

**다음 글:** [StrictMode — 개발 환경 품질 검사](/posts/react-strict-mode/)

<br>
읽어주셔서 감사합니다. 😊
