---
title: "비동기 큐와 세마포어 — 흐름 제어 패턴"
description: "AsyncQueue와 Semaphore를 직접 구현하며 비동기 흐름 제어의 원리를 이해합니다. Promise 체인으로 순차 실행을 보장하고, 뮤텍스로 임계 구역을 보호하는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "AsyncQueue", "Semaphore", "Mutex", "비동기", "흐름제어", "Promise"]
featured: false
draft: false
---

[지난 글](/posts/js-abort-controller/)에서 비동기 작업을 취소하는 방법을 살펴봤습니다. 이번에는 작업 **순서와 동시성**을 정밀하게 제어하는 `AsyncQueue`와 `Semaphore` 패턴을 직접 구현합니다.

## AsyncQueue — 순차 실행 보장

여러 비동기 작업을 큐에 넣으면 순서대로 하나씩 실행됩니다. 동시에 여러 곳에서 같은 자원에 접근할 때 순서를 보장해야 하는 상황에 유용합니다.

가장 우아한 구현은 `#tail` Promise 체인을 이용하는 방식입니다.

```js
class AsyncQueue {
  #tail = Promise.resolve();
  #size = 0;

  enqueue(fn) {
    this.#size++;
    const result = this.#tail
      .then(fn)
      .finally(() => this.#size--);
    // 에러가 체인을 끊지 않도록 catch
    this.#tail = result.catch(() => {});
    return result;
  }

  get size() { return this.#size; }
}
```

새 작업은 항상 `this.#tail.then(fn)`으로 이전 작업 완료 후에 시작됩니다. 에러가 발생해도 `catch(() => {})`로 `#tail`을 살려두기 때문에 다음 작업은 정상적으로 실행됩니다.

![비동기 큐 — AsyncQueue 흐름](/assets/posts/js-async-queue-pattern.svg)

```js
const queue = new AsyncQueue();

// 동시에 enqueue해도 순차 실행됨
const [a, b, c] = await Promise.all([
  queue.enqueue(() => fetchA()),
  queue.enqueue(() => fetchB()),
  queue.enqueue(() => fetchC()),
]);
// fetchA → fetchB → fetchC 순으로 실행
```

![AsyncQueue 구현 — Promise 체인 패턴](/assets/posts/js-async-semaphore-code.svg)

## Semaphore — 동시성 한도 제어

`Semaphore`는 동시에 실행할 수 있는 작업 수를 제한합니다. `AsyncQueue`가 limit=1인 Semaphore라고 볼 수 있습니다.

```js
class Semaphore {
  #queue = [];
  #running = 0;
  #limit;

  constructor(limit) {
    this.#limit = limit;
  }

  async run(fn) {
    if (this.#running >= this.#limit) {
      await new Promise(resolve => this.#queue.push(resolve));
    }
    this.#running++;
    try {
      return await fn();
    } finally {
      this.#running--;
      this.#queue.shift()?.();
    }
  }
}
```

`run()` 메서드 하나로 세마포어를 통과한 뒤 작업을 실행합니다. `finally`에서 실행 카운트를 줄이고, 대기 중인 다음 작업의 resolve를 호출합니다.

```js
const sem = new Semaphore(3);

const results = await Promise.all(
  urls.map(url => sem.run(() => fetch(url).then(r => r.json())))
);
```

## Mutex — 단독 접근 보호

`Mutex`(mutual exclusion)는 동시에 오직 하나의 작업만 임계 구역에 진입하게 합니다. `Semaphore(1)`과 동일하지만, **잠근 쪽만 해제**할 수 있다는 차이가 있습니다.

```js
class Mutex {
  #locked = false;
  #queue = [];

  lock() {
    if (!this.#locked) {
      this.#locked = true;
      return Promise.resolve();
    }
    return new Promise(resolve => this.#queue.push(resolve));
  }

  unlock() {
    const next = this.#queue.shift();
    if (next) next();
    else this.#locked = false;
  }
}
```

대표적인 사용 사례는 공유 상태를 읽고 쓰는 작업을 직렬화하는 것입니다.

```js
const mutex = new Mutex();
let sharedCounter = 0;

async function increment() {
  await mutex.lock();
  try {
    const current = await readCounter();
    await writeCounter(current + 1);
    sharedCounter = current + 1;
  } finally {
    mutex.unlock();
  }
}

// 동시에 10번 호출해도 정확히 10 증가
await Promise.all(Array.from({ length: 10 }, increment));
```

## 생산자-소비자 패턴

비동기 큐와 이벤트 기반 흐름 제어를 결합하면 생산자-소비자 패턴을 구현할 수 있습니다.

```js
class Channel {
  #buffer = [];
  #waiters = [];

  send(value) {
    const waiter = this.#waiters.shift();
    if (waiter) waiter(value);
    else this.#buffer.push(value);
  }

  receive() {
    if (this.#buffer.length > 0) {
      return Promise.resolve(this.#buffer.shift());
    }
    return new Promise(resolve => this.#waiters.push(resolve));
  }
}

const ch = new Channel();

// 생산자 (별도 실행)
setInterval(() => ch.send({ event: 'data', ts: Date.now() }), 100);

// 소비자
while (true) {
  const item = await ch.receive();
  await process(item);
}
```

## 언제 무엇을 써야 하나

| 패턴 | 특징 | 적합한 상황 |
|------|------|------------|
| `AsyncQueue` | 순차, limit=1 | DB 쓰기 순서 보장, 단일 자원 접근 |
| `Semaphore` | 동시 N개 제한 | API 요청 제한, 파일 I/O |
| `Mutex` | 단독 접근 | 공유 상태 읽기-쓰기 직렬화 |
| `p-limit` | Semaphore 라이브러리 | 간단한 동시성 제한 |

JavaScript는 단일 스레드이므로 진정한 경쟁 조건(race condition)은 없습니다. 하지만 `await` 사이에 다른 마이크로태스크가 끼어들 수 있어서, 비동기 코드에서는 여전히 순서 제어가 필요합니다.

## 정리

- `AsyncQueue`: tail Promise 체인으로 순차 실행. 구현이 단순하고 에러에도 안전
- `Semaphore`: 동시 실행 수 제한. `finally`에서 반드시 슬롯 반환
- `Mutex`: 임계 구역 단독 접근 보장
- 외부 라이브러리보다 직접 구현하면 동작을 완전히 이해하고 제어할 수 있음

---

**지난 글:** [AbortController — 비동기 작업 취소](/posts/js-abort-controller/)

**다음 글:** [throw와 try/catch/finally — 에러 전파의 기초](/posts/js-throw-try-catch/)

<br>
읽어주셔서 감사합니다. 😊
