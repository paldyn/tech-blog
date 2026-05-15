---
title: "Server-Sent Events · EventSource 완전 이해"
description: "Server-Sent Events(SSE)와 EventSource API의 연결 흐름, text/event-stream 형식, 커스텀 이벤트 타입, Last-Event-ID 재연결, 인증 처리, WebSocket과의 비교까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "SSE", "EventSource", "Server-Sent Events", "스트리밍", "실시간", "HTTP", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/net-streams-readable/)에서 ReadableStream의 내부 구조와 파이프 패턴을 살펴봤습니다. 이번에는 **Server-Sent Events(SSE)**를 정리합니다. SSE는 서버가 클라이언트에게 데이터를 단방향으로 실시간 푸시하는 가장 단순한 방법으로, 실시간 알림·대시보드·LLM 스트리밍 응답에 폭넓게 사용됩니다.

---

## SSE vs WebSocket — 선택 기준

SSE는 HTTP 위에서 동작하는 **단방향 서버 → 클라이언트** 스트림입니다. WebSocket은 양방향이지만 별도 프로토콜(ws://)을 사용합니다.

| 항목 | SSE | WebSocket |
|------|-----|-----------|
| 방향 | 서버 → 클라이언트 | 양방향 |
| 프로토콜 | HTTP/1.1, HTTP/2 | ws:// / wss:// |
| 자동 재연결 | 브라우저 내장 | 직접 구현 |
| 인증 | 쿠키·헤더 자연 지원 | 핸드셰이크 시 한 번 |
| 메시지 형식 | 텍스트 전용 | 텍스트 + 바이너리 |
| 적합 사례 | 알림·피드·LLM | 채팅·게임·협업 |

실시간 채팅처럼 클라이언트도 데이터를 자주 보내야 하면 WebSocket, 서버에서만 데이터를 보내는 구조라면 SSE가 더 단순합니다.

---

## EventSource 연결 흐름

![Server-Sent Events 연결 흐름](/assets/posts/net-eventsource-sse-lifecycle.svg)

클라이언트가 `new EventSource(url)`을 생성하면 브라우저가 해당 URL로 `GET` 요청을 보냅니다. `Accept: text/event-stream` 헤더가 자동으로 붙습니다. 서버는 `Content-Type: text/event-stream`으로 응답하며, 연결을 닫지 않고 이벤트를 계속 전송합니다. 연결이 끊기면 브라우저가 **자동으로 재연결**합니다(`retry` 필드로 간격 조절).

---

## 서버 이벤트 텍스트 형식

SSE 메시지는 `field: value\n` 형식의 텍스트이며, **빈 줄**(`\n\n`)이 이벤트 구분자입니다.

```
data: {"temperature": 24.5}

event: alert
id: 101
data: {"level":"warn","msg":"high temp"}

retry: 5000
```

- `data`: 이벤트 페이로드. 여러 줄이면 자동으로 `\n`으로 합쳐집니다.
- `event`: 이벤트 이름. 생략하면 `message` 이벤트로 처리됩니다.
- `id`: `Last-Event-ID` 값. 재연결 시 이 값을 헤더로 보내 누락 이벤트를 처리할 수 있습니다.
- `retry`: 재연결 대기 시간(ms).
- `:` (콜론으로 시작): 주석 — 30초마다 보내면 연결 타임아웃을 방지합니다.

---

## 클라이언트 구현

![EventSource 사용 패턴](/assets/posts/net-eventsource-sse-patterns.svg)

```js
const es = new EventSource('/stream');

es.onopen = () => {
  console.log('연결됨, readyState:', es.readyState); // 1 = OPEN
};

es.onmessage = (event) => {
  // event: message 타입의 기본 핸들러
  const data = JSON.parse(event.data);
  console.log('id:', event.lastEventId, 'data:', data);
};

// 커스텀 이벤트 타입
es.addEventListener('alert', (event) => {
  showAlert(JSON.parse(event.data));
});

es.onerror = (event) => {
  if (es.readyState === EventSource.CLOSED) {
    console.log('연결 종료됨');
  }
  // CONNECTING(0): 자동 재연결 중
};

// 명시적 종료
es.close(); // readyState → CLOSED(2)
```

`readyState`는 `CONNECTING(0)`, `OPEN(1)`, `CLOSED(2)` 세 가지입니다. `onerror` 후 자동 재연결 중이면 `readyState === CONNECTING`입니다.

---

## Last-Event-ID로 누락 이벤트 복구

```js
// 서버 측 (Node.js 예시)
app.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const lastId = Number(req.headers['last-event-id'] ?? 0);
  // lastId 이후 누락된 이벤트를 재전송
  replayFrom(lastId, res);

  const interval = setInterval(() => {
    const id = nextId();
    res.write(`id: ${id}\ndata: ${JSON.stringify(getData())}\n\n`);
  }, 1000);

  req.on('close', () => clearInterval(interval));
});
```

재연결 시 브라우저가 `Last-Event-ID` 요청 헤더를 자동으로 포함합니다. 서버가 이 값을 읽어 놓친 이벤트를 재전송하면 **완전한 연속성**을 보장합니다.

---

## 인증 처리

EventSource는 기본적으로 쿠키를 포함합니다. 쿠키 인증을 사용하면 별도 처리 없이 동작합니다. Bearer 토큰처럼 헤더가 필요한 경우 EventSource 자체로는 불가능하므로, Fetch + ReadableStream 조합을 사용합니다.

```js
// 헤더 인증이 필요한 경우: Fetch Streams 활용
async function connectSSE(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const reader = res.body
    .pipeThrough(new TextDecoderStream())
    .getReader();

  for await (const chunk of readLines(reader)) {
    parseSSELine(chunk);
  }
}
```

라이브러리 `@microsoft/fetch-event-source`가 이 패턴을 추상화해 줍니다.

---

## HTTP/2와 멀티플렉싱

HTTP/1.1에서는 브라우저당 도메인 연결이 최대 6개로 제한되어, SSE 연결이 많으면 리소스를 소진합니다. **HTTP/2**를 사용하면 단일 TCP 연결 위에서 스트림을 멀티플렉싱하므로 제한이 사라집니다. 프로덕션 SSE 엔드포인트는 반드시 HTTP/2 서버에서 제공하세요.

---

## LLM 스트리밍 응답 패턴

OpenAI·Anthropic API의 스트리밍 응답은 SSE를 사용합니다.

```js
const es = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: userInput }),
});

const reader = es.body.pipeThrough(new TextDecoderStream()).getReader();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += value;

  const lines = buffer.split('\n');
  buffer = lines.pop(); // 마지막 미완성 줄 보존

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const payload = line.slice(6);
      if (payload === '[DONE]') return;
      appendToken(JSON.parse(payload).delta);
    }
  }
}
```

---

**지난 글:** [Streams API · ReadableStream 완전 이해](/posts/net-streams-readable/)

**다음 글:** [WebSocket API 완전 이해](/posts/net-websocket/)

<br>
읽어주셔서 감사합니다. 😊
