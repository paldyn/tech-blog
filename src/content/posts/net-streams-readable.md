---
title: "Streams API · ReadableStream 완전 이해"
description: "Streams API의 ReadableStream 구조, 내부 큐와 backpressure 메커니즘, pipeThrough·pipeTo 파이프 체인, for-await-of 소비 패턴, fetch response.body 스트리밍까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Streams API", "ReadableStream", "backpressure", "pipeThrough", "pipeTo", "비동기", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/net-fetch-abort/)에서 AbortController로 fetch를 취소하는 방법을 살펴봤습니다. 이번에는 **Streams API**의 핵심인 **ReadableStream**을 정리합니다. 대용량 데이터를 한 번에 메모리에 올리지 않고 청크 단위로 처리하는 스트리밍 패턴은 네트워크 응답, 파일 I/O, 데이터 변환 파이프라인 모두에 걸쳐 중요합니다.

---

## 왜 Streams인가

`fetch()`는 `Response.json()` 또는 `Response.text()`를 호출하면 **전체 응답을 버퍼링**한 후 반환합니다. 응답이 100 MB라면 메모리에 100 MB가 올라갑니다. Streams API를 사용하면 데이터가 도착하는 즉시 청크 단위로 처리하여 메모리 사용량을 일정하게 유지할 수 있습니다.

```js
// 전체 버퍼링 (❌ 대용량에 부적합)
const text = await response.text();

// 스트리밍 소비 (✅)
for await (const chunk of response.body) {
  process(chunk); // Uint8Array
}
```

---

## ReadableStream 구조

![ReadableStream 구조](/assets/posts/net-streams-readable-anatomy.svg)

ReadableStream은 **세 레이어**로 구성됩니다.

**Source (UnderlyingSource)**: 실제 데이터를 공급하는 객체. `start()`, `pull()`, `cancel()` 훅으로 제어합니다. `pull()`은 내부 큐가 비어 있고 소비자가 데이터를 요구할 때 호출됩니다.

**내부 큐**: 청크를 임시 보관합니다. `highWaterMark`로 크기를 설정하고, `desiredSize`가 0 이하가 되면 소스에 신호를 보내 데이터 공급을 억제합니다(**backpressure**).

**Reader (ReadableStreamDefaultReader)**: `getReader()`로 획득하며, `read()` → `Promise<{value, done}>` 형태로 청크를 하나씩 꺼냅니다. 스트림은 한 번에 하나의 Reader에만 **locked**됩니다.

---

## 커스텀 ReadableStream 생성

```js
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('첫 번째 청크');
    controller.enqueue('두 번째 청크');
    controller.close(); // 스트림 종료
  },
  pull(controller) {
    // 큐가 비어 소비자가 요청할 때 추가 데이터 공급
    // controller.desiredSize: 큐의 여유 공간
  },
  cancel(reason) {
    // 소비자가 cancel() 호출 시 정리 작업
    console.log('취소됨:', reason);
  }
}, { highWaterMark: 2 }); // 큐 최대 2청크
```

`controller.enqueue()`로 데이터를 큐에 넣고, `controller.close()`로 스트림을 완료 상태로 전환합니다. `controller.error(err)`를 호출하면 오류 상태로 전환됩니다.

---

## getReader()로 수동 소비

```js
const reader = stream.getReader();
try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log('청크:', value);
  }
} finally {
  reader.releaseLock(); // 반드시 해제
}
```

`releaseLock()`을 호출하지 않으면 스트림이 영구적으로 locked 상태가 됩니다. `try/finally` 패턴으로 항상 락을 해제하세요.

---

## for-await-of 소비 (권장)

Node.js 16+와 브라우저 최신 버전에서 ReadableStream은 **async iterable**을 구현합니다.

```js
for await (const chunk of response.body) {
  // chunk: Uint8Array (raw bytes)
  console.log(chunk.byteLength, 'bytes');
}
```

내부적으로 `getReader()`와 `read()` 루프를 감싸며, 루프 종료 시 자동으로 `releaseLock()`합니다. 수동 관리보다 훨씬 안전합니다.

---

## 파이프 체인: pipeThrough · pipeTo

![Streams 파이프 패턴](/assets/posts/net-streams-readable-patterns.svg)

```js
const response = await fetch('/large-data.json.gz');

await response.body
  .pipeThrough(new DecompressionStream('gzip'))
  .pipeThrough(new TextDecoderStream())
  .pipeTo(new WritableStream({
    write(chunk) {
      console.log(chunk); // 디코딩된 텍스트 조각
    }
  }));
```

`pipeThrough(transformStream)`은 `ReadableStream`을 반환하므로 체이닝이 가능합니다. `pipeTo(writableStream)`은 `Promise<void>`를 반환하며 파이프 완료를 기다립니다. 파이프는 **backpressure를 자동으로 전파**합니다 — WritableStream이 느리면 ReadableStream의 pull도 자동으로 느려집니다.

---

## TransformStream 직접 구현

```js
const upperCaseTransform = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk.toUpperCase());
  },
  flush(controller) {
    // 스트림 종료 전 마지막 처리
  }
});

const result = readable
  .pipeThrough(upperCaseTransform);
```

`TransformStream`은 `.readable`(ReadableStream)과 `.writable`(WritableStream)을 모두 노출합니다. `pipeThrough()`는 내부적으로 이 두 속성을 사용합니다.

---

## fetch 응답 스트리밍 실전

```js
async function streamJSON(url, onChunk) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body
    .pipeThrough(new TextDecoderStream())
    .getReader();

  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      onChunk(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}
```

스트리밍 LLM 응답(OpenAI, Claude API)은 이 패턴을 그대로 사용합니다. 청크가 도착할 때마다 UI를 업데이트하는 **스트리밍 채팅 UI**의 기본 구조입니다.

---

## tee(): 스트림 분기

```js
const [branch1, branch2] = response.body.tee();

// branch1: 로깅용, branch2: 실제 처리용
branch1.pipeTo(logStream);
branch2.pipeThrough(new TextDecoderStream())
       .pipeTo(processStream);
```

`tee()`는 ReadableStream을 두 독립 스트림으로 분기합니다. 원본 스트림은 더 이상 사용할 수 없습니다. 두 브랜치 중 느린 쪽에 맞춰 backpressure가 작동합니다.

---

## Backpressure 원리

```js
const slow = new ReadableStream({
  pull(controller) {
    // desiredSize > 0 일 때만 pull 호출됨
    console.log('남은 큐 여유:', controller.desiredSize);
    controller.enqueue(generateData());
  }
}, { highWaterMark: 1 });
```

`highWaterMark`를 1로 설정하면 큐에 청크가 1개 쌓이는 순간 `pull` 호출이 멈춥니다. 소비자가 `read()`를 호출해 큐가 비워지면 다시 `pull`이 호출됩니다. 이 메커니즘이 **생산자-소비자 속도 차이를 자동으로 조율**합니다.

---

## 브라우저 지원 및 Node.js

| 환경 | ReadableStream | for-await-of | pipeThrough |
|------|--------------|--------------|-------------|
| Chrome 43+ | ✅ | ✅ (89+) | ✅ (35+) |
| Firefox 65+ | ✅ | ✅ | ✅ |
| Safari 10.1+ | ✅ | ✅ (14.1+) | ✅ |
| Node.js | ✅ (18+, global) | ✅ | ✅ |

Node.js에서는 `node:stream/web`에서 `ReadableStream`을 임포트하거나 Node 18+에서 전역으로 사용할 수 있습니다.

---

**지난 글:** [Fetch 취소 · AbortController 완전 이해](/posts/net-fetch-abort/)

**다음 글:** [Server-Sent Events · EventSource 완전 이해](/posts/net-eventsource-sse/)

<br>
읽어주셔서 감사합니다. 😊
