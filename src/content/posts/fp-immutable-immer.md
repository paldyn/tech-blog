---
title: "Immer와 Immutable.js — 불변 데이터 구조 라이브러리"
description: "Immer의 produce와 Proxy 기반 Copy-on-Write 원리, curried producer 패턴, Immutable.js의 영속 자료구조와 구조 공유 메커니즘을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Immer", "Immutable.js", "불변성", "FP", "Redux", "상태관리"]
featured: false
draft: false
---

[지난 글](/posts/fp-ramda-lodash-fp/)에서 Ramda와 lodash/fp를 살펴봤습니다. 이번에는 불변 데이터를 다루는 두 전문 라이브러리, **Immer** 와 **Immutable.js** 를 비교합니다.

## Immer — 가변처럼 쓰고 불변으로 반환

Immer의 핵심 아이디어는 단순합니다. `produce` 안에서 **draft를 가변처럼 수정하면, Immer가 불변 결과물을 만들어 반환**합니다.

![Immer produce — Copy-on-Write 원리](/assets/posts/fp-immutable-immer-produce.svg)

```js
import { produce } from 'immer';

const state = {
  user: { name: 'Alice', age: 30 },
  todos: [{ id: 1, text: 'buy milk', done: false }]
};

const nextState = produce(state, draft => {
  draft.user.age = 31;
  draft.todos[0].done = true;
  draft.todos.push({ id: 2, text: 'code', done: false });
});

// state는 변경되지 않음
console.log(state.user.age);      // 30
console.log(nextState.user.age);  // 31

// 변경된 경로의 참조만 새로 생성
console.log(state.user === nextState.user);   // false (변경됨)
console.log(state.todos === nextState.todos); // false (변경됨)
```

## Proxy 기반 Copy-on-Write

Immer는 내부적으로 **ES6 Proxy**를 사용합니다. `produce`에 전달된 `draft`는 원본의 Proxy입니다.

1. draft에 접근할 때는 원본 데이터를 읽습니다.
2. draft를 수정하면 해당 노드가 **얕은 복사**됩니다(Copy-on-Write).
3. `produce`가 끝나면 변경된 경로만 새 객체로, 나머지는 원본 참조를 공유합니다.

덕분에 `state.other === nextState.other`처럼 변경되지 않은 부분은 동일 참조를 유지해 메모리를 절약하고 React 렌더링 최적화(참조 동일성 비교)에도 유리합니다.

## curried producer

`produce`를 함수 하나만 넘기면 **재사용 가능한 업데이터 함수**가 됩니다.

```js
// curried producer — 리듀서 패턴에 적합
const increment = produce((draft, amount = 1) => {
  draft.count += amount;
});

const state1 = { count: 0 };
const state2 = increment(state1);      // { count: 1 }
const state3 = increment(state2, 5);  // { count: 6 }

// Redux 리듀서
const todosReducer = produce((draft, action) => {
  switch (action.type) {
    case 'ADD_TODO':
      draft.push({ id: Date.now(), text: action.payload, done: false });
      break;
    case 'TOGGLE_TODO':
      const todo = draft.find(t => t.id === action.id);
      if (todo) todo.done = !todo.done;
      break;
  }
}, []);
```

## Immer와 배열

일반 배열 메서드를 draft에서 그대로 사용할 수 있습니다.

```js
const nextState = produce(state, draft => {
  // push, splice, sort 등 모두 사용 가능
  draft.items.push({ id: 4, name: 'new' });
  draft.items.splice(1, 1);
  draft.items.sort((a, b) => a.name.localeCompare(b.name));

  // 필터링 — 새 배열 반환 방식
  return { ...draft, items: draft.items.filter(i => i.active) };
  // 또는 draft를 직접 수정
  draft.items = draft.items.filter(i => i.active);
});
```

## Immutable.js — 영속 자료구조

Immutable.js는 **영속 자료구조(Persistent Data Structure)** 를 제공합니다. Hash Array Mapped Trie(HAMT) 알고리즘으로 수정 시 변경된 부분만 새 노드를 만들고 나머지는 공유합니다.

![Immutable.js vs Immer 비교](/assets/posts/fp-immutable-immer-immutablejs.svg)

```js
import { Map, List, fromJS } from 'immutable';

const map1 = Map({ a: 1, b: 2, c: 3 });
const map2 = map1.set('b', 50);

console.log(map1.get('b')); // 2 — 원본 불변
console.log(map2.get('b')); // 50 — 새 Map

// 깊은 업데이트
const nested = fromJS({ user: { address: { city: 'Seoul' } } });
const updated = nested.setIn(['user', 'address', 'city'], 'Busan');

// JS 변환
updated.toJS(); // { user: { address: { city: 'Busan' } } }
```

## Immutable.js 주의사항

Immutable.js 객체는 일반 JavaScript 객체가 아닙니다.

```js
const map = Map({ a: 1 });

// 일반 객체처럼 접근 불가
map.a;      // undefined — 틀림
map.get('a'); // 1 — 올바름

// JSON.stringify 불가 — toJS() 먼저
JSON.stringify(map);        // "{}" — 의도와 다름
JSON.stringify(map.toJS()); // '{"a":1}' — 올바름

// 비교는 equals()
map === Map({ a: 1 });      // false — 참조 비교
map.equals(Map({ a: 1 })); // true — 값 비교
```

이러한 차이 때문에 외부 라이브러리(axios, fetch, Redux DevTools)와 통합 시 `toJS()`가 빈번히 필요합니다. 번들 크기도 ~16KB(gzip)로 Immer(~3KB)보다 큽니다.

## 선택 기준

2024년 기준으로 대부분의 프로젝트에서는 **Immer가 표준** 선택입니다.

- **Immer**: 기존 JS 코드와 완벽 호환, 작은 번들, Redux Toolkit 기본 내장, TypeScript 완전 지원
- **Immutable.js**: 수백만 개 항목의 초대형 컬렉션, 구조 공유를 최대화해야 할 때, 함수형 DB나 Undo/Redo 히스토리 관리

```js
// Redux Toolkit은 Immer를 내장
import { createSlice } from '@reduxjs/toolkit';

const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment(state) { state.value++; },       // 직접 수정 OK
    decrement(state) { state.value--; },
    addBy(state, action) { state.value += action.payload; }
  }
});
```

## 정리

Immer는 기존 JavaScript 코드 스타일을 유지하면서 불변성을 얻는 가장 실용적인 방법입니다. Immutable.js는 진정한 영속 자료구조가 필요한 특수 상황을 위한 선택입니다. 새 프로젝트라면 Immer부터 시작하세요.

---

**지난 글:** [Ramda와 lodash/fp — 함수형 유틸리티 라이브러리](/posts/fp-ramda-lodash-fp/)

**다음 글:** [Option/Result 타입 — 함수형 에러 처리](/posts/fp-option-result/)

<br>
읽어주셔서 감사합니다. 😊
