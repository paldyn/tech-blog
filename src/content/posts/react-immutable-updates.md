---
title: "불변성 업데이트 패턴"
description: "React가 상태 변경을 어떻게 감지하는지, 직접 mutation이 왜 UI를 업데이트하지 않는지, 그리고 객체와 배열을 불변으로 업데이트하는 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["React", "불변성", "immutable", "상태 업데이트", "Immer"]
featured: false
draft: false
---

[지난 글](/posts/react-functional-updates/)에서 함수형 업데이트로 클로저 함정을 피하는 방법을 살펴봤습니다. 이번에는 한 걸음 더 나아가 React가 **왜 불변성(immutability)을 요구하는지**, 그리고 객체와 배열 상태를 안전하게 업데이트하는 실전 패턴을 알아봅니다.

---

## React의 변경 감지 방식

React는 `setState`가 호출될 때 이전 상태와 새 상태를 **얕은 참조 비교(Object.is)**로 비교합니다.

```javascript
Object.is(prevState, nextState)
// true  → "변경 없음" → 리렌더 생략
// false → "변경 있음" → 리렌더 실행
```

객체와 배열은 **참조(메모리 주소)**로 비교됩니다. 내부 값이 달라도 같은 객체를 수정하면 참조가 같으므로 React는 변경을 감지하지 못합니다.

![불변성 개념: 직접 수정 vs 새 객체 생성](/assets/posts/react-immutable-updates-concept.svg)

---

## 객체 불변 업데이트

**스프레드 연산자(`...`)**를 사용해 새 객체를 만드는 것이 기본 패턴입니다.

```jsx
const [user, setUser] = useState({ name: 'Alice', age: 25, city: 'Seoul' });

// 필드 하나 업데이트
setUser(prev => ({ ...prev, age: 26 }));

// 여러 필드 동시 업데이트
setUser(prev => ({ ...prev, name: 'Bob', age: 30 }));
```

### 중첩 객체 업데이트

중첩된 객체는 각 레벨을 별도로 펼쳐야 합니다.

```jsx
const [user, setUser] = useState({
  name: 'Alice',
  address: { city: 'Seoul', district: 'Gangnam' },
});

// address.city만 변경
setUser(prev => ({
  ...prev,
  address: {
    ...prev.address,   // 기존 address 복사
    city: 'Busan',     // city만 덮어씀
  },
}));
```

중첩이 깊어지면 코드가 장황해집니다. 이때 **Immer** 라이브러리를 사용하면 mutation 문법으로 불변 업데이트를 작성할 수 있습니다.

---

## 배열 불변 업데이트

배열은 `push`, `splice`, `sort` 같은 원본 변경 메서드 대신, 새 배열을 반환하는 메서드를 씁니다.

```jsx
const [items, setItems] = useState([
  { id: 1, text: '리액트 공부', done: false },
  { id: 2, text: '운동하기', done: false },
]);

// 항목 추가
setItems(prev => [...prev, { id: 3, text: '독서', done: false }]);

// 항목 제거
setItems(prev => prev.filter(item => item.id !== 2));

// 항목 수정 (id=1을 done으로)
setItems(prev =>
  prev.map(item =>
    item.id === 1 ? { ...item, done: true } : item
  )
);

// 정렬 (sort는 원본 변경 — 반드시 복사 후)
setItems(prev => [...prev].sort((a, b) => a.text.localeCompare(b.text)));
```

![객체와 배열 불변 업데이트 패턴](/assets/posts/react-immutable-updates-patterns.svg)

---

## 자주 하는 실수

```jsx
// ❌ push — 원본 배열 변경
setItems(prev => {
  prev.push(newItem); // prev 변경됨
  return prev;        // 같은 참조 반환 → 리렌더 없음
});

// ❌ 직접 수정 후 setUser
const handleChange = e => {
  user.name = e.target.value; // 직접 수정
  setUser(user);              // 같은 참조 → 리렌더 없음
};

// ✓ 새 객체 반환
const handleChange = e => {
  setUser(prev => ({ ...prev, name: e.target.value }));
};
```

---

## Immer: mutation처럼 쓰는 불변 업데이트

중첩이 깊거나 복잡한 업데이트가 많다면 **Immer**가 코드를 크게 단순화합니다.

```bash
npm install immer use-immer
```

```jsx
import { useImmer } from 'use-immer';

function App() {
  const [user, updateUser] = useImmer({
    name: 'Alice',
    address: { city: 'Seoul', district: 'Gangnam' },
  });

  const handleCityChange = city => {
    updateUser(draft => {
      draft.address.city = city; // mutation처럼 작성
    });
    // 내부적으로 불변 업데이트 수행
  };
}
```

`draft`는 원본의 프록시로, 직접 수정하면 Immer가 새 불변 객체를 만들어 반환합니다.

---

## 불변성 체크리스트

- [ ] `setX(state)` 호출 시 `state`가 **새로운 객체/배열** 참조인가
- [ ] 객체 필드 업데이트 시 `{ ...prev, key: value }` 패턴 사용
- [ ] 배열 추가: `[...prev, item]`
- [ ] 배열 제거: `prev.filter(...)`
- [ ] 배열 수정: `prev.map(...)`
- [ ] 배열 정렬: `[...prev].sort(...)`

---

**지난 글:** [함수형 업데이트: 이전 상태를 안전하게 읽는 법](/posts/react-functional-updates/)

**다음 글:** [파생 상태와 계산된 값](/posts/react-derived-state/)

<br>
읽어주셔서 감사합니다. 😊
