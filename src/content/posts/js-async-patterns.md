---
title: "비동기 패턴 — 병렬, 순차, 재시도, 타임아웃"
description: "실전에서 자주 마주치는 비동기 처리 패턴들을 정리합니다. 병렬 실행, 순차 실행, 재시도 로직, 타임아웃, 요청 취소까지 async/await와 Promise를 조합하는 방법을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-04-24"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "비동기패턴", "Promise", "async", "await", "병렬처리", "재시도", "타임아웃"]
featured: false
draft: false
---

지난 두 글에서 Promise와 async/await의 기본 동작을 살펴봤습니다. 이번 글은 실전입니다. 실제 코드에서 비동기를 다루다 보면 "이걸 어떻게 구현하지?" 싶은 패턴들을 반복해서 마주칩니다. 여러 요청을 동시에 보내고 싶다, 실패하면 다시 시도하고 싶다, 오래 걸리면 포기하고 싶다 — 이런 패턴들을 체계적으로 정리합니다.

---

## 병렬 vs 순차 — 기본 선택

모든 비동기 패턴의 출발점은 이 질문입니다: **이 작업들이 서로 독립적인가, 의존적인가?**

독립적이면 병렬로, 의존적이면 순차로 실행해야 합니다.

![순차 실행 vs 병렬 실행 — 시간 비교](/assets/posts/js-async-patterns-parallel.svg)

세 개의 API를 각각 1초씩 걸린다면, 순차 실행은 3초, 병렬 실행은 1초입니다. 실무에서 "느린 페이지"의 상당수는 독립적인 요청들을 순차로 처리하는 코드 때문입니다.

```js
// 순차: A가 끝나야 B 시작, B가 끝나야 C 시작
const a = await fetchA();
const b = await fetchB();
const c = await fetchC();

// 병렬: A, B, C 동시 시작
const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()]);
```

중요한 뉘앙스: `Promise.all`에서 하나라도 실패하면 전체가 reject됩니다. 실패해도 나머지는 계속 처리하고 싶다면 `Promise.allSettled`를 씁니다.

---

## Promise 조합자 선택 가이드

![Promise 조합자 — 4가지 비교](/assets/posts/js-async-patterns-combinators.svg)

네 가지 조합자의 선택 기준을 정리하면 이렇습니다.

**Promise.all** — 전부 성공해야 의미가 있을 때. 예: 대시보드에 필요한 모든 데이터. 하나라도 없으면 화면을 그릴 수 없는 경우.

**Promise.allSettled** — 각 결과를 개별 처리해야 할 때. 예: 여러 파일을 업로드할 때 일부 실패해도 성공한 것은 처리하고 실패 목록을 별도 표시.

**Promise.race** — 가장 빠른 응답만 필요하거나, 타임아웃을 구현할 때. 예: 두 CDN 중 먼저 응답하는 것 사용, 3초 내 응답이 없으면 오류 처리.

**Promise.any** — 여러 소스 중 하나라도 성공하면 되는 경우. 예: 여러 미러 서버 중 아무거나 응답한 것 사용.

---

## 배치 병렬 처리 — 동시성 제한

`Promise.all`로 1000개의 요청을 동시에 보내면 서버나 네트워크에 부담이 됩니다. 동시 처리 수를 제한하는 패턴이 필요합니다.

```js
async function batchRun(tasks, concurrency = 5) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((t) => t()));
    results.push(...batchResults);
  }
  return results;
}
```

이 패턴은 tasks 배열을 `concurrency` 크기씩 잘라서 배치 단위로 실행합니다. 각 배치는 병렬이지만, 다음 배치는 이전 배치가 완전히 끝나야 시작합니다. 완전한 병렬도 완전한 순차도 아닌, 제어된 병렬입니다.

더 정교한 구현이 필요하다면 p-limit 같은 라이브러리를 쓰는 것이 낫습니다. 세마포어 방식으로 정확히 N개의 작업이 동시에 실행되도록 보장합니다.

---

## 순차 처리 — reduce로 Promise 체인 만들기

배열의 각 항목을 순서대로 처리하면서 결과를 누적해야 할 때, `reduce`로 Promise 체인을 만드는 패턴이 있습니다.

```js
async function processSequential(items) {
  return items.reduce(
    (chainPromise, item) =>
      chainPromise.then((results) =>
        process(item).then((result) => [...results, result])
      ),
    Promise.resolve([])
  );
}
```

보기엔 복잡하지만, 각 항목을 이전 Promise가 완료된 후에야 처리합니다. 현대적인 코드에서는 `for...of` + `await`가 더 읽기 쉬워 선호됩니다.

```js
async function processSequential(items) {
  const results = [];
  for (const item of items) {
    results.push(await process(item));
  }
  return results;
}
```

---

## 재시도 패턴

네트워크 요청은 일시적으로 실패할 수 있습니다. 몇 번 재시도하는 패턴은 실무에서 필수입니다.

```js
async function withRetry(fn, { retries = 3, delay = 1000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delay * 2 ** attempt));
    }
  }
}

// 사용: 최대 3회 재시도, 지수 백오프(1s, 2s, 4s)
const data = await withRetry(() => fetch("/api/data"), { retries: 3 });
```

**지수 백오프(exponential backoff)**는 재시도 간격을 점점 늘리는 전략입니다. 첫 실패 후 1초, 두 번째 실패 후 2초, 세 번째는 4초를 기다립니다. 서버가 과부하 상태일 때 요청을 계속 쏟아붓지 않기 위해 중요합니다. 여기에 약간의 랜덤성(jitter)을 추가하면 여러 클라이언트가 동시에 재시도하는 문제도 방지할 수 있습니다.

---

## 타임아웃 패턴

요청이 너무 오래 걸리면 포기하는 것도 중요합니다. `Promise.race`로 타임아웃을 구현합니다.

```js
function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${ms}ms 초과`)), ms)
  );
}

async function fetchWithTimeout(url, ms = 5000) {
  return Promise.race([fetch(url), timeout(ms)]);
}
```

`fetch(url)`과 `timeout(ms)` 중 먼저 settle되는 것을 따릅니다. 응답이 타임아웃보다 빠르면 응답이, 타임아웃이 먼저 되면 에러가 나옵니다.

한 가지 주의: `fetch`는 취소되지 않습니다. race에서 timeout이 이기더라도 fetch 요청은 백그라운드에서 계속 진행됩니다. 진짜 요청 취소는 `AbortController`가 필요합니다.

---

## AbortController — 요청 취소

`AbortController`는 fetch를 비롯한 비동기 작업을 실제로 취소하는 표준 API입니다.

```js
const controller = new AbortController();
const { signal } = controller;

// 3초 후 취소
const timerId = setTimeout(() => controller.abort(), 3000);

try {
  const res = await fetch("/api/data", { signal });
  clearTimeout(timerId);
  return await res.json();
} catch (err) {
  if (err.name === "AbortError") {
    console.log("요청이 취소되었습니다");
  } else {
    throw err;
  }
}
```

`signal`을 fetch에 전달하면 `controller.abort()`가 호출될 때 실제로 요청이 취소됩니다. 컴포넌트가 언마운트될 때 진행 중인 요청을 취소하는 React 패턴에서도 `AbortController`가 핵심입니다.

---

## 폴링 패턴

서버가 작업 완료를 알려주지 않고 상태를 직접 물어봐야 할 때 씁니다.

```js
async function pollUntil(checkFn, { interval = 2000, timeout = 30000 } = {}) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const result = await checkFn();
    if (result.done) return result;
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error("타임아웃: 작업이 완료되지 않았습니다");
}

// 사용: 2초마다 확인, 최대 30초
const result = await pollUntil(() => checkJobStatus(jobId));
```

WebSocket이나 Server-Sent Events를 쓸 수 없을 때 폴링이 대안입니다. 간격이 너무 짧으면 서버에 부담이 되고, 너무 길면 사용자 경험이 나빠집니다.

---

## 요청 중복 방지 — 디바운싱과 캐싱

동일한 요청이 짧은 시간 내에 여러 번 발생할 때, 중복 요청을 막는 패턴입니다.

```js
const cache = new Map();

async function fetchOnce(url) {
  if (cache.has(url)) return cache.get(url);

  const promise = fetch(url).then((r) => r.json());
  cache.set(url, promise);

  return promise;
}
```

주목할 점은 Promise 객체 자체를 캐싱한다는 것입니다. 같은 url로 두 번 요청이 오면, 첫 번째 요청의 Promise를 그대로 반환합니다. 요청이 진행 중이어도 완료된 후에도 같은 결과를 반환합니다.

실무에서는 캐시 만료(TTL), 캐시 무효화, stale-while-revalidate 같은 전략이 필요합니다. React Query, SWR 같은 라이브러리가 이런 복잡성을 관리해줍니다.

---

비동기 패턴은 처음에는 복잡해 보이지만, 몇 가지 핵심 패턴을 반복 적용하는 것임을 알 수 있습니다. 병렬이냐 순차냐, 실패 시 재시도냐 포기냐, 동시성을 제한할 것인가 — 이 선택들이 실전 비동기 코드의 품질을 결정합니다. 다음 글에서는 **ES6 대혁신**을 살펴봅니다. JavaScript가 2015년에 어떻게 다른 언어가 되었는지, 그 배경과 핵심 기능들을 한눈에 정리합니다.

---

**지난 글:** [async/await — 비동기를 동기처럼 쓰다](/posts/js-async-await/)

**다음 글:** [객체 패턴 — 단축 프로퍼티부터 프로퍼티 디스크립터까지](/posts/js-object-patterns/)

<br>
읽어주셔서 감사합니다. 😊
