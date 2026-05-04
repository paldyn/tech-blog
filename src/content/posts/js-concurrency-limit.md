---
title: "동시성 제한 — Promise Pool과 p-limit"
description: "비동기 작업을 한꺼번에 쏟아내면 서버가 과부하됩니다. Promise Pool과 Semaphore 패턴으로 동시 실행 수를 제한하는 방법을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Promise", "동시성", "p-limit", "Semaphore", "비동기", "concurrency"]
featured: false
draft: false
---

[지난 글](/posts/js-async-error-handling/)에서 async/await 에러 처리 패턴을 살펴봤습니다. 이번에는 비동기 작업의 **동시 실행 수**를 제어하는 방법을 살펴봅니다. 대량의 API 요청, 파일 처리, DB 쿼리를 다룰 때 반드시 필요한 지식입니다.

## 왜 동시성을 제한해야 하나

`Promise.all(tasks)`는 모든 작업을 즉시 동시에 시작합니다. 100개의 URL을 한 번에 fetch하면 서버에 100개의 연결이 동시에 열립니다. 이는 서버 과부하, 연결 거부(429), 자원 고갈로 이어집니다.

```js
// 위험: 100개 URL을 동시에 요청
const results = await Promise.all(
  urls.map(url => fetch(url)) // 순식간에 100개 연결
);
```

동시성을 3~10개로 제한하면 서버 부하를 줄이고 안정적인 처리가 가능합니다.

## p-limit — 가장 쉬운 방법

`p-limit` 라이브러리는 Promise Pool을 한 줄로 만들어 줍니다.

```js
import pLimit from 'p-limit';

const limit = pLimit(3); // 동시 실행 최대 3개

const tasks = urls.map(url =>
  limit(() => fetch(url).then(r => r.json()))
);

const results = await Promise.all(tasks);
// 내부적으로 최대 3개만 동시 실행, 나머지 큐 대기
```

`limit(fn)` 으로 감싼 함수는 슬롯이 빌 때 자동으로 실행됩니다. 완료되면 다음 대기 작업이 진입합니다.

![Promise Pool — 동시 실행 한도 시각화](/assets/posts/js-concurrency-limit-pool.svg)

## 수동 구현 — Semaphore 패턴

외부 라이브러리 없이 동시성을 제한하려면 Semaphore를 직접 구현할 수 있습니다.

```js
class Semaphore {
  #queue = [];
  #count;
  constructor(limit) { this.#count = limit; }

  acquire() {
    if (this.#count > 0) {
      this.#count--;
      return Promise.resolve();
    }
    return new Promise(resolve => this.#queue.push(resolve));
  }

  release() {
    const next = this.#queue.shift();
    if (next) next();
    else this.#count++;
  }
}
```

사용법은 간단합니다. `acquire()`로 슬롯을 잡고, 작업이 끝나면 `finally` 블록에서 반드시 `release()`를 호출합니다.

```js
const sem = new Semaphore(3);

async function fetchWithLimit(url) {
  await sem.acquire();
  try {
    const res = await fetch(url);
    return await res.json();
  } finally {
    sem.release(); // 에러가 나도 반드시 반환
  }
}

const results = await Promise.all(urls.map(fetchWithLimit));
```

`finally`를 통해 슬롯을 반환하는 것이 핵심입니다. 에러가 발생해도 슬롯이 반환되지 않으면 이후 작업이 영원히 대기 상태에 빠집니다.

![수동 Semaphore 구현 패턴](/assets/posts/js-concurrency-limit-semaphore.svg)

## 배치(Batch) 처리 — 청크 분할

간단한 대안으로 작업을 N개씩 묶어 처리하는 방법도 있습니다.

```js
async function processBatch(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

// 100개 URL을 10개씩 순차 처리
const results = await processBatch(urls, 10, url =>
  fetch(url).then(r => r.json())
);
```

배치 처리는 이해하기 쉽지만, 각 배치가 모두 완료될 때까지 다음 배치가 시작되지 않는 단점이 있습니다. 예를 들어 10개 중 9개가 완료됐어도 마지막 1개를 기다려야 합니다. Promise Pool은 슬롯이 비는 즉시 다음 작업을 투입하므로 더 효율적입니다.

## 실전 예: 파일 업로드 제한

```js
import pLimit from 'p-limit';

async function uploadFiles(files) {
  const limit = pLimit(5); // 동시 업로드 5개

  const upload = async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(`업로드 실패: ${file.name}`);
    return res.json();
  };

  return Promise.all(files.map(f => limit(() => upload(f))));
}
```

## 동시성 제한의 적절한 값

| 대상 | 권장 동시성 |
|------|------------|
| 외부 API (rate limit 있음) | 1~3 |
| 자체 서버 요청 | 5~20 |
| 파일 I/O | CPU 코어 수 |
| DB 쿼리 (커넥션 풀 기반) | 풀 크기 |

적절한 값은 대상 서비스의 rate limit, 서버 스펙, 네트워크 상황에 따라 다릅니다. 프로덕션에서는 반드시 부하 테스트를 통해 최적값을 찾으세요.

## 정리

- `Promise.all`은 즉시 모든 작업을 시작 — 대량 처리에 위험
- `p-limit`으로 동시성을 선언적으로 제한
- Semaphore로 직접 구현 시 `finally`에서 `release()` 필수
- 배치 처리는 간단하지만 Promise Pool보다 비효율적

---

**지난 글:** [async/await 에러 처리 패턴 — try/catch·에러 래핑·fallback](/posts/js-async-error-handling/)

**다음 글:** [AbortController — 비동기 작업 취소](/posts/js-abort-controller/)

<br>
읽어주셔서 감사합니다. 😊
