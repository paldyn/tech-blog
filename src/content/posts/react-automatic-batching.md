---
title: "자동 배칭(Automatic Batching): React 18"
description: "React 18에서 도입된 자동 배칭이 무엇인지, React 17과의 차이, setTimeout·Promise·네이티브 이벤트에서도 배칭이 되는 이유, 그리고 flushSync로 배칭을 우회하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["React", "배칭", "React 18", "flushSync", "성능 최적화"]
featured: false
draft: false
---

[지난 글](/posts/react-state-colocation/)에서 state를 올바른 위치에 배치하는 방법을 살펴봤습니다. 이번에는 React가 여러 `setState` 호출을 하나의 리렌더로 묶는 **배칭(Batching)** 메커니즘, 그리고 React 18에서 이것이 어떻게 자동화되었는지 알아봅니다.

---

## 배칭이란

이벤트 핸들러에서 `setState`를 세 번 호출해도 컴포넌트가 세 번 리렌더되지 않습니다. React는 한 이벤트 안의 모든 `setState` 호출을 모아 **마지막에 한 번만** 리렌더합니다.

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  function handleClick() {
    setCount(c => c + 1);  // 즉시 리렌더 X
    setName('Alice');       // 즉시 리렌더 X
    setCount(c => c + 1);  // 즉시 리렌더 X
    // 여기서 한 번만 리렌더 — 최종 결과: count+2, name='Alice'
  }
}
```

---

## React 17: 이벤트 핸들러 안에서만 배칭

React 17까지는 배칭이 React의 합성 이벤트 핸들러 안에서만 동작했습니다. `setTimeout`, `Promise.then`, `fetch.then` 같은 비동기 콜백 안에서는 각 `setState`마다 리렌더가 발생했습니다.

```jsx
// React 17: 비동기 콜백 안에서는 배칭 없음
function handleClick() {
  fetch('/api/data').then(res => res.json()).then(data => {
    setData(data);     // 리렌더 1회
    setLoading(false); // 리렌더 2회 — 불필요한 중간 렌더링
  });
}
```

이는 성능 문제이자 예상치 못한 중간 상태 노출(loading=true인데 data가 있는 상태 등)의 원인이었습니다.

![자동 배칭: React 17 vs React 18](/assets/posts/react-automatic-batching-concept.svg)

---

## React 18: 자동 배칭 (Automatic Batching)

React 18은 `createRoot()`를 사용할 때, **어떤 컨텍스트에서든** 자동으로 배칭합니다.

```javascript
// React 18 진입점
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<App />);
```

이제 `setTimeout`, `Promise`, `async/await`, `fetch` 콜백, 커스텀 이벤트 등 모든 곳에서 배칭이 자동 적용됩니다.

```jsx
// React 18: 비동기 콜백도 배칭
async function handleSubmit() {
  const data = await api.save(form);
  setIsLoading(false);   // 배칭
  setData(data);         // 배칭
  setError(null);        // 배칭
  // → 리렌더 1번만 발생
}
```

---

## flushSync: 배칭 우회

드물게 `setState` 직후 DOM이 즉시 업데이트되어야 하는 경우(스크롤 위치 계산, 애니메이션 시작점 측정 등)에는 `flushSync`로 배칭을 우회할 수 있습니다.

```jsx
import { flushSync } from 'react-dom';

function handleAddMessage(text) {
  flushSync(() => {
    setMessages(prev => [...prev, { id: Date.now(), text }]);
  }); // 이 시점에서 DOM이 즉시 업데이트됨

  // DOM 업데이트 후 스크롤 위치 계산 가능
  listRef.current.lastChild.scrollIntoView();
}
```

![flushSync: 배칭 우회 사용 케이스](/assets/posts/react-automatic-batching-flushsync.svg)

`flushSync`는 성능 비용이 있으므로 꼭 필요한 경우에만 사용합니다.

---

## 배칭과 관련된 오해

### "배칭 때문에 state가 즉시 반영되지 않는다"

맞습니다. 하지만 이는 버그가 아니라 의도된 동작입니다. 함수형 업데이트(`prev => ...`)를 쓰면 배칭 안에서도 항상 최신 값을 받습니다.

```jsx
function handleClick() {
  setCount(prev => prev + 1); // prev = 현재 큐의 최신값
  setCount(prev => prev + 1); // prev = 앞의 결과 (정확)
  // 결과: +2 (올바름)
}
```

### "비동기 함수에서 setState 순서가 보장되는가"

같은 이벤트 루프 틱 안에서는 `setState` 호출 순서가 보장됩니다. `await` 이후의 코드는 새로운 태스크이므로 그 전후가 다른 배치로 묶일 수 있습니다.

---

## React 17에서 수동 배칭 (레거시 코드용)

React 17이나 구버전을 사용하는 코드베이스에서 비동기 배칭이 필요하다면 `unstable_batchedUpdates`를 사용합니다.

```jsx
import { unstable_batchedUpdates } from 'react-dom';

fetch('/api').then(data => {
  unstable_batchedUpdates(() => {
    setData(data);
    setLoading(false);
  }); // 이 안에서 배칭
});
```

React 18로 마이그레이션하면 이 코드가 불필요해집니다.

---

**지난 글:** [상태 배치(State Colocation): 상태는 쓰는 곳에](/posts/react-state-colocation/)

**다음 글:** [제어 컴포넌트와 폼 처리](/posts/react-forms-controlled-inputs/)

<br>
읽어주셔서 감사합니다. 😊
