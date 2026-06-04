---
title: "Effect가 필요 없는 상황들"
description: "useEffect를 쓰지 말아야 할 대표 패턴 — 렌더 중 계산 가능한 파생 state, props에서 state 초기화, 이벤트 핸들러로 처리할 수 있는 로직, 앱 초기화, 그리고 컴포넌트 간 상태 공유 등을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["React", "useEffect", "파생상태", "이벤트핸들러", "리팩토링", "성능", "렌더링패턴"]
featured: false
draft: false
---

[지난 글](/posts/react-usereducer/)에서 `useReducer`로 복잡한 상태 로직을 관리하는 방법을 살펴봤다. 이번에는 반대 방향으로, `useEffect`를 쓰지 말아야 할 상황들을 다룬다. React 팀은 공식 문서에서 "You Might Not Need an Effect"라는 제목으로 이 주제를 상세히 다룰 만큼, 불필요한 Effect 사용이 매우 흔한 실수다.

## useEffect의 목적 재확인

`useEffect`는 **React 외부 시스템과 동기화**하기 위한 훅이다. 네트워크, DOM API, 타이머, WebSocket처럼 React가 직접 제어하지 않는 것들과 연결할 때 쓴다.

반대로, **props와 state로 계산 가능한 값**을 구하거나, **사용자 이벤트에 반응**하는 코드는 Effect가 필요 없다.

![useEffect 필요 여부 판단 흐름도](/assets/posts/react-no-effect-decision.svg)

## 1. 렌더 중 계산 가능한 파생 state

```jsx
// 잘못된 패턴 — 불필요한 리렌더 추가
const [firstName, setFirstName] = useState('');
const [lastName, setLastName] = useState('');
const [fullName, setFullName] = useState('');

useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// 올바른 패턴 — 렌더 중 계산
const [firstName, setFirstName] = useState('');
const [lastName, setLastName] = useState('');
const fullName = `${firstName} ${lastName}`; // 렌더마다 최신 값
```

Effect를 쓰면 `firstName`이 바뀔 때 렌더 → Effect → setFullName → 추가 렌더가 발생한다. 직접 계산하면 렌더 한 번에 끝난다.

## 2. 비용이 큰 계산 — useMemo

```jsx
// 잘못된 패턴
const [filteredList, setFilteredList] = useState([]);
useEffect(() => {
  setFilteredList(list.filter(item => item.active));
}, [list]);

// 올바른 패턴
const filteredList = useMemo(
  () => list.filter(item => item.active),
  [list]
);
```

단, 대부분의 경우 `useMemo` 없이 렌더 중 직접 계산해도 충분히 빠르다. `useMemo`는 프로파일러로 실제 성능 문제를 확인한 후 추가한다.

## 3. props 변경 시 state 초기화

```jsx
// 잘못된 패턴
function List({ items }) {
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    setSelection(null); // items 바뀌면 selection 초기화
  }, [items]);

  // 문제: items 변경 → 렌더 → Effect → setSelection → 추가 렌더
}

// 올바른 패턴 1: 렌더 중 처리
function List({ items }) {
  const [selection, setSelection] = useState(null);
  const [prevItems, setPrevItems] = useState(items);

  if (items !== prevItems) {
    setPrevItems(items);
    setSelection(null); // 렌더 중 즉시 업데이트
  }

  // 한 번의 렌더로 처리됨
}

// 올바른 패턴 2: key로 완전 초기화
<List key={userId} items={items} />
// userId 바뀌면 컴포넌트 전체 재생성 → 모든 state 초기화
```

`key`를 이용한 방법이 가장 간단하고 명확하다. 컴포넌트를 아예 새로 마운트해서 모든 state를 초기 상태로 돌린다.

## 4. 이벤트 핸들러에서 처리할 수 있는 로직

```jsx
// 잘못된 패턴 — 이벤트를 state로 우회
const [submitted, setSubmitted] = useState(false);

useEffect(() => {
  if (submitted) {
    sendForm(data);
    setSubmitted(false);
  }
}, [submitted]);

function handleSubmit(e) {
  e.preventDefault();
  setSubmitted(true); // 왜 Effect를 통해야 할까?
}

// 올바른 패턴 — 이벤트에서 직접 처리
function handleSubmit(e) {
  e.preventDefault();
  sendForm(data); // 직접 호출
}
```

이벤트 핸들러는 사용자가 **언제** 어떤 동작을 했는지 이미 알고 있다. Effect를 통해 우회할 이유가 없다.

## 5. 데이터 변환과 필터링

![useEffect 대신 쓸 수 있는 패턴들](/assets/posts/react-no-effect-cases.svg)

```jsx
// 잘못된 패턴
const [visible, setVisible] = useState([]);
useEffect(() => {
  setVisible(todos.filter(t => !t.done));
}, [todos]);

// 올바른 패턴
const visible = todos.filter(t => !t.done);
// 렌더마다 계산 — 배열 크기가 작으면 비용 거의 없음
```

## 6. 앱 초기화는 컴포넌트 밖에서

```jsx
// 잘못된 패턴 — Strict Mode에서 두 번 실행됨
useEffect(() => {
  checkAuthToken();
  loadConfig();
}, []);

// 올바른 패턴 — 모듈 레벨에서 단 한 번 실행
let initialized = false;
if (!initialized) {
  initialized = true;
  checkAuthToken();
  loadConfig();
}
```

앱 전체에서 단 한 번만 실행해야 하는 초기화 코드는 컴포넌트 밖에서 실행한다.

## 7. 부모에게 데이터 보내기

```jsx
// 잘못된 패턴
function Toggle({ onChange }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    onChange(on); // Effect로 부모에게 알림
  }, [on]);
}

// 올바른 패턴
function Toggle({ onChange }) {
  const [on, setOn] = useState(false);

  function handleClick() {
    const next = !on;
    setOn(next);
    onChange(next); // 이벤트 핸들러에서 직접 호출
  }
}
```

이벤트가 발생한 위치(handleClick)에서 부모에게 알리는 것이 자연스럽다.

## Effect가 실제로 필요한 경우

- 브라우저 API와 동기화: `document.title`, `addEventListener`, `IntersectionObserver`
- 외부 데이터 구독: WebSocket, EventSource, Redux store
- 네트워크 요청: 컴포넌트가 나타날 때 데이터를 가져와야 할 때
- DOM 직접 조작: 애니메이션, 포커스 관리, 서드파티 위젯 초기화

---

**지난 글:** [useReducer — 복잡한 상태 로직을 컴포넌트 밖으로](/posts/react-usereducer/)

**다음 글:** [Effect 경쟁 조건 — 오래된 응답 처리](/posts/react-effect-race-conditions/)

<br>
읽어주셔서 감사합니다. 😊
