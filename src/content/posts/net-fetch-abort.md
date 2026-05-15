---
title: "Fetch 취소 · AbortController 완전 이해"
description: "AbortController·AbortSignal로 fetch를 취소하는 방법, AbortSignal.timeout()·any() 정적 메서드, React useEffect 클린업 패턴, 취소 가능한 비동기 함수 설계까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "AbortController", "AbortSignal", "Fetch", "취소", "비동기", "React"]
featured: false
draft: false
---

[지난 글](/posts/net-fetch-master/)에서 Fetch API의 전반적인 사용법을 살펴봤습니다. 이번에는 진행 중인 요청을 취소하는 **AbortController**와 **AbortSignal**을 정리합니다. 타임아웃 처리, 검색 자동완성 debounce, React 컴포넌트 언마운트 시 요청 정리에 필수적입니다.

---

## 왜 취소가 필요한가

진행 중인 fetch를 취소하지 않으면 두 가지 문제가 발생합니다.

1. **메모리 누수·상태 오염**: 언마운트된 React 컴포넌트의 fetch가 완료되면 `setState`를 호출해 에러가 발생하거나 이전 응답이 새 컴포넌트를 덮어씁니다.
2. **경쟁 상태(Race Condition)**: 검색창에서 빠르게 타이핑하면 여러 요청이 동시에 나가고, 나중에 보낸 요청이 먼저 돌아올 수 있습니다. 이전 요청을 취소해야 안전합니다.

---

## AbortController 기본

```js
const controller = new AbortController();
const { signal } = controller;

// signal 상태
console.log(signal.aborted); // false (초기)
console.log(signal.reason);  // undefined (초기)

// fetch에 signal 전달
const promise = fetch('/api/data', { signal });

// 요청 취소
controller.abort(); // 기본 reason: DOMException { name: 'AbortError' }
controller.abort('사용자 취소'); // 커스텀 reason

// 이후
console.log(signal.aborted); // true
console.log(signal.reason);  // '사용자 취소'
```

![AbortController 구조와 흐름](/assets/posts/net-fetch-abort-controller.svg)

---

## AbortError 처리

```js
async function fetchData(url) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort('timeout'), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('요청 취소됨:', err.message, '이유:', controller.signal.reason);
      return null;
    }
    throw err; // 다른 에러는 상위로 전파
  } finally {
    clearTimeout(timerId);
  }
}
```

`AbortError`는 정상적인 취소이므로 사용자에게 에러로 보여주지 않습니다. `err.name === 'AbortError'`로 구분하세요.

---

## AbortSignal.timeout() — 타임아웃 간소화

```js
// 기존 방식
const controller = new AbortController();
const id = setTimeout(() => controller.abort(), 5000);
fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));

// ✅ AbortSignal.timeout() — 한 줄로 해결 (Chrome 103+, Firefox 100+)
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

타임아웃 시 발생하는 에러는 `TimeoutError`(`err.name === 'TimeoutError'`)입니다. `AbortError`와 구분됩니다.

---

## React useEffect 패턴

![React에서의 취소 패턴](/assets/posts/net-fetch-abort-patterns.svg)

`useEffect`의 cleanup 함수에서 `controller.abort()`를 호출하면 컴포넌트 언마운트나 의존성 변경 시 자동으로 이전 요청을 취소합니다.

```js
import { useState, useEffect } from 'react';

function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();

    fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then(setResults)
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err);
      });

    return () => controller.abort(); // query가 바뀌면 이전 요청 취소
  }, [query]);

  return <ul>{results.map((r) => <li key={r.id}>{r.name}</li>)}</ul>;
}
```

---

## AbortSignal.any() — 여러 signal 합성

여러 신호 중 하나라도 abort되면 발동합니다.

```js
const userController = new AbortController(); // 사용자가 수동 취소
const timeoutSignal = AbortSignal.timeout(10_000); // 10초 타임아웃

const combined = AbortSignal.any([userController.signal, timeoutSignal]);

const res = await fetch('/api/data', { signal: combined });
// 사용자 취소 또는 10초 타임아웃 중 먼저 발생하는 것으로 취소
```

---

## signal.addEventListener — 취소 감지

signal의 `abort` 이벤트를 구독해 취소 시 자원을 정리할 수 있습니다.

```js
async function streamWithCleanup(url, signal) {
  const ws = new WebSocket(url);

  signal.addEventListener('abort', () => {
    ws.close(1000, 'Aborted');
  });

  return new Promise((resolve, reject) => {
    ws.onmessage = (e) => resolve(e.data);
    ws.onerror = reject;
  });
}
```

---

## 취소 가능한 비동기 함수 설계

`signal`을 함수 인자로 받아 내부 비동기 작업에 전파하는 패턴입니다.

```js
async function processItems(items, signal) {
  for (const item of items) {
    signal.throwIfAborted(); // abort됐으면 즉시 AbortError throw
    await processItem(item, signal); // 내부 fetch 등에도 signal 전달
  }
}

const controller = new AbortController();
processItems(largeList, controller.signal)
  .catch((err) => {
    if (err.name === 'AbortError') console.log('처리 중단');
    else throw err;
  });

// 3초 후 중단
setTimeout(() => controller.abort(), 3000);
```

`signal.throwIfAborted()`는 signal이 이미 abort된 경우 즉시 `AbortError`를 던집니다. 루프·재귀 함수에서 중간중간 체크하는 데 유용합니다.

---

## 정리

| API | 용도 |
|-----|------|
| `new AbortController()` | 취소 컨트롤러 생성 |
| `controller.abort(reason)` | 취소 신호 발송 |
| `controller.signal` | fetch 등에 전달할 신호 |
| `AbortSignal.timeout(ms)` | 타임아웃 신호 생성 |
| `AbortSignal.any([...])` | 복수 신호 합성 |
| `signal.throwIfAborted()` | 루프 내 조기 중단 체크 |
| `signal.addEventListener('abort', fn)` | 취소 시 정리 작업 |

---

**지난 글:** [Fetch API 완전 이해](/posts/net-fetch-master/)

<br>
읽어주셔서 감사합니다. 😊
