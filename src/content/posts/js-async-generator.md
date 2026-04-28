---
title: "비동기 제너레이터"
description: "async function*와 for await...of로 비동기 데이터 스트림을 우아하게 처리하는 비동기 제너레이터의 동작 원리와 실전 패턴을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "비동기 제너레이터", "async generator", "for await...of", "스트리밍"]
featured: false
draft: false
---

[지난 글](/posts/js-generator-functions/)에서 제너레이터로 실행을 일시 정지·재개하는 법을 배웠습니다. 이번에는 `async function*`와 `for await...of`를 결합한 **비동기 제너레이터(Async Generator)** 를 다룹니다. 동기 제너레이터가 값을 `yield`한다면, 비동기 제너레이터는 **Promise를 `await`한 결과**를 `yield`합니다.

## 동기 vs 비동기 제너레이터

```javascript
// 동기 제너레이터 — next()는 { value, done }을 즉시 반환
function* sync() {
  yield 1;
  yield 2;
}
const s = sync();
s.next(); // { value: 1, done: false }

// 비동기 제너레이터 — next()는 Promise<{ value, done }>을 반환
async function* async_() {
  yield await fetch('/api/a').then(r => r.json());
  yield await fetch('/api/b').then(r => r.json());
}
const a = async_();
await a.next(); // Promise → { value: {...}, done: false }
```

비동기 제너레이터 안에서는 `await`과 `yield`를 모두 쓸 수 있습니다. `async function*` 선언이 두 기능을 하나로 합칩니다.

![비동기 제너레이터 동작 원리](/assets/posts/js-async-generator-concept.svg)

## for await...of

비동기 이터러블은 `for await...of`로 소비합니다. 동기 `for...of`가 `[Symbol.iterator]()`를 호출하듯, `for await...of`는 `[Symbol.asyncIterator]()`를 호출합니다.

```javascript
async function* everySecond() {
  let count = 0;
  while (count < 5) {
    await new Promise(r => setTimeout(r, 1000));
    yield count++;
  }
}

// for await...of로 소비
async function main() {
  for await (const value of everySecond()) {
    console.log(value); // 0 (1초 후), 1 (2초 후), ...
  }
}

main();
```

루프 본문이 실행되는 동안 다음 `next()`는 호출되지 않습니다. 백프레셔(backpressure)가 자연스럽게 구현됩니다.

## API 페이지네이션

비동기 제너레이터가 가장 빛나는 사례는 **페이지네이션 API 스트리밍**입니다. 전체 데이터를 한 번에 메모리에 올리지 않고 페이지 단위로 처리합니다.

```javascript
async function* fetchAllPages(baseUrl) {
  let url = baseUrl;

  while (url) {
    const res  = await fetch(url);
    const data = await res.json();

    yield data.items;             // 한 페이지씩 반환
    url = data.nextPage ?? null;  // 다음 페이지 URL (없으면 종료)
  }
}

async function processAllPosts() {
  for await (const page of fetchAllPages('/api/posts')) {
    for (const post of page) {
      await saveToDatabase(post); // 한 페이지씩 처리
    }
  }
}
```

전체 데이터를 배열에 담지 않으므로 수백만 건의 데이터도 일정한 메모리로 처리할 수 있습니다.

![비동기 제너레이터 페이지네이션 패턴](/assets/posts/js-async-generator-pagination.svg)

## 파일 청크 읽기 (Node.js)

Node.js Readable 스트림을 비동기 이터러블로 소비할 수 있습니다.

```javascript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

async function* readLines(filepath) {
  const rl = createInterface({
    input: createReadStream(filepath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    yield line;
  }
}

// 대용량 로그 파일을 줄 단위로 처리
async function countErrors(filepath) {
  let count = 0;
  for await (const line of readLines(filepath)) {
    if (line.includes('ERROR')) count++;
  }
  return count;
}
```

## Readable Stream → AsyncIterable

Web Streams API의 `ReadableStream`도 비동기 이터러블입니다.

```javascript
async function* streamToLines(stream) {
  const reader  = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer) yield buffer;
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 마지막 불완전한 줄은 보관
      for (const line of lines) yield line;
    }
  } finally {
    reader.releaseLock();
  }
}

// 서버에서 스트리밍 응답 처리
const res = await fetch('/api/stream');
for await (const line of streamToLines(res.body)) {
  console.log(line);
}
```

## 에러 처리

비동기 제너레이터에서도 `try/finally`로 자원을 해제하고 에러를 처리합니다.

```javascript
async function* withCleanup() {
  const connection = await openDB();
  try {
    const rows = await connection.query('SELECT * FROM logs');
    for (const row of rows) {
      yield row;
    }
  } finally {
    await connection.close(); // for await...of가 break되거나 오류 발생 시에도 실행
  }
}

// break로 조기 종료해도 finally 실행됨
for await (const row of withCleanup()) {
  if (row.level === 'FATAL') break; // connection.close() 호출됨
}
```

`for await...of`에서 `break`하거나 예외가 발생하면 제너레이터의 `return()` 메서드가 호출되고 `finally` 블록이 실행됩니다.

## AsyncIterator 프로토콜 직접 구현

제너레이터 없이 `[Symbol.asyncIterator]()`를 직접 구현할 수도 있습니다.

```javascript
const asyncRange = {
  from: 1,
  to: 5,
  [Symbol.asyncIterator]() {
    let current = this.from;
    const last = this.to;
    return {
      async next() {
        await new Promise(r => setTimeout(r, 200));
        if (current <= last) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      }
    };
  }
};

for await (const n of asyncRange) {
  console.log(n); // 1~5 (200ms 간격)
}
```

## ReadableStream 통합과 미래

Node.js 18+와 최신 브라우저에서 `ReadableStream`은 기본적으로 `[Symbol.asyncIterator]`를 구현합니다. `fetch` 응답의 `body`를 그대로 `for await...of`로 소비할 수 있어 비동기 제너레이터 패턴이 점점 표준화되고 있습니다.

비동기 제너레이터는 페이지네이션, 스트리밍, 이벤트 스트림 등 비동기 데이터 흐름을 명확하게 표현하는 강력한 도구입니다. 다음 글에서는 변수가 어디서 접근 가능한지를 결정하는 **스코프 체인(Scope Chain)** 을 살펴봅니다.

---

**지난 글:** [제너레이터 함수](/posts/js-generator-functions/)

**다음 글:** [스코프 체인](/posts/js-scope-chain/)

<br>
읽어주셔서 감사합니다. 😊
