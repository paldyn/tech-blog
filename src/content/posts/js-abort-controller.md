---
title: "AbortController — 비동기 작업 취소"
description: "AbortController와 AbortSignal을 이용해 fetch 요청, 커스텀 비동기 작업, 타임아웃을 정교하게 취소하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "AbortController", "AbortSignal", "fetch", "취소", "타임아웃", "비동기"]
featured: false
draft: false
---

[지난 글](/posts/js-concurrency-limit/)에서 동시 실행 수를 제한하는 방법을 살펴봤습니다. 이번에는 진행 중인 비동기 작업을 **취소**하는 메커니즘인 `AbortController`를 다룹니다. 사용자가 페이지를 벗어나거나, 새 검색어를 입력하거나, 타임아웃이 만료됐을 때 불필요한 요청을 중단할 수 있습니다.

## AbortController의 구조

`AbortController`는 두 가지 핵심 요소로 구성됩니다.

```js
const controller = new AbortController();
const signal = controller.signal; // AbortSignal 객체

console.log(signal.aborted); // false

controller.abort('사용자 취소'); // 이유(reason) 전달 가능
console.log(signal.aborted); // true
console.log(signal.reason);  // '사용자 취소'
```

`controller.abort()`를 호출하면 `signal.aborted`가 `true`로 바뀌고, `signal`을 구독하는 모든 작업에 `abort` 이벤트가 발생합니다. signal을 여러 작업에 넘겨두면, 한 번의 `abort()`로 모두를 취소할 수 있습니다.

![AbortController — 신호 전파 구조](/assets/posts/js-abort-controller-flow.svg)

## fetch 취소

`fetch`는 두 번째 인자에 `{ signal }`을 받습니다. `abort()`가 호출되면 fetch는 즉시 `AbortError`를 throw합니다.

```js
const controller = new AbortController();

// 버튼 클릭 시 취소
btn.addEventListener('click', () => controller.abort());

try {
  const res = await fetch('/api/data', { signal: controller.signal });
  const data = await res.json();
  render(data);
} catch (e) {
  if (e.name === 'AbortError') {
    console.log('요청 취소됨');
  } else {
    throw e; // 네트워크 에러 등은 재통
  }
}
```

## 타임아웃 구현

`AbortController` + `setTimeout`으로 타임아웃을 구현할 수 있습니다.

```js
async function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`요청 타임아웃 (${ms}ms)`);
    }
    throw e;
  }
}
```

ES2022부터는 `AbortSignal.timeout(ms)`를 사용하면 더 간결합니다.

```js
const res = await fetch(url, {
  signal: AbortSignal.timeout(5000),
});
// DOMException: The operation was aborted (TimeoutError)
```

![fetch 취소와 타임아웃 패턴](/assets/posts/js-abort-controller-fetch.svg)

## 여러 신호 조합 — AbortSignal.any()

사용자가 수동으로 취소하거나 타임아웃이 만료되면 취소하고 싶을 때, `AbortSignal.any()`로 신호를 합칠 수 있습니다(Node.js 20+, 최신 브라우저).

```js
const userCtrl = new AbortController();
cancelBtn.addEventListener('click', () => userCtrl.abort('user'));

const combined = AbortSignal.any([
  userCtrl.signal,
  AbortSignal.timeout(10_000),
]);

const res = await fetch('/api/data', { signal: combined });
// 버튼 클릭 OR 10초 경과 시 취소
```

## 커스텀 비동기 작업 취소

`fetch` 뿐 아니라 직접 만든 비동기 로직에도 signal을 적용할 수 있습니다.

```js
async function processItems(items, signal) {
  for (const item of items) {
    signal.throwIfAborted(); // 취소 상태면 AbortError throw

    await heavyProcess(item);
  }
}

const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 3000);

try {
  await processItems(largeList, ctrl.signal);
} catch (e) {
  if (e.name === 'AbortError') console.log('3초 내 처리 중단');
}
```

`signal.throwIfAborted()`는 `signal.aborted`가 `true`면 `AbortError`를 throw합니다. 루프나 체크포인트마다 호출해서 빠르게 취소에 반응할 수 있습니다.

## React — 컴포넌트 언마운트 시 취소

```js
useEffect(() => {
  const ctrl = new AbortController();

  fetchUser(id, ctrl.signal)
    .then(setUser)
    .catch(e => {
      if (e.name !== 'AbortError') setError(e);
    });

  return () => ctrl.abort(); // 언마운트 또는 id 변경 시 취소
}, [id]);
```

이 패턴은 컴포넌트가 언마운트된 뒤 상태를 업데이트하려는 오래된 응답을 차단합니다.

## 이벤트 구독으로 취소 감지

signal의 `abort` 이벤트를 직접 구독할 수도 있습니다.

```js
signal.addEventListener('abort', () => {
  console.log('취소됨:', signal.reason);
  cleanup();
}, { once: true });
```

`{ once: true }` 옵션으로 이벤트 리스너가 한 번만 실행되게 합니다.

## 정리

| API | 설명 |
|-----|------|
| `controller.abort(reason?)` | 신호 발생 (이유 전달 가능) |
| `signal.aborted` | 취소 여부 확인 |
| `signal.reason` | 취소 이유 (ES2022) |
| `signal.throwIfAborted()` | 취소 상태면 AbortError |
| `AbortSignal.timeout(ms)` | 타임아웃 신호 생성 |
| `AbortSignal.any(signals)` | 복수 신호 OR 합성 |

---

**지난 글:** [동시성 제한 — Promise Pool과 p-limit](/posts/js-concurrency-limit/)

**다음 글:** [비동기 큐와 세마포어 — 흐름 제어 패턴](/posts/js-async-queue-semaphore/)

<br>
읽어주셔서 감사합니다. 😊
