---
title: "WebSocket API 완전 이해"
description: "WebSocket 연결 수립(HTTP Upgrade), readyState 상태 머신, send()와 바이너리 전송, bufferedAmount 흐름 제어, 지수 백오프 재연결, 서브프로토콜, Heartbeat 패턴까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "WebSocket", "실시간", "양방향", "TCP", "네트워크", "채팅", "재연결"]
featured: false
draft: false
---

[지난 글](/posts/net-eventsource-sse/)에서 SSE로 서버에서 클라이언트로 단방향 스트림을 구성하는 방법을 살펴봤습니다. 이번에는 **양방향 전이중 통신**을 제공하는 **WebSocket API**를 정리합니다. 실시간 채팅, 협업 도구, 멀티플레이어 게임, 금융 틱 피드에 사용되는 프로토콜입니다.

---

## WebSocket이란

WebSocket은 **HTTP Upgrade 핸드셰이크**를 거쳐 확립되는 지속적인 TCP 연결입니다. 한 번 연결되면 서버와 클라이언트가 **동시에 양방향**으로 메시지를 주고받을 수 있습니다. HTTP의 요청-응답 모델과 달리 서버가 먼저 메시지를 보낼 수 있습니다.

```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: <hash>
```

이 핸드셰이크 이후 TCP 연결은 WebSocket 프레임 형식으로 전환됩니다.

---

## 연결 수립과 readyState

![WebSocket 연결 상태 머신](/assets/posts/net-websocket-lifecycle.svg)

```js
const ws = new WebSocket('wss://api.example.com/ws');
// wss:// = TLS 위 WebSocket (프로덕션 필수)
// ws://  = 평문 (로컬 개발용)

console.log(ws.readyState); // 0: CONNECTING

ws.onopen = (event) => {
  console.log(ws.readyState); // 1: OPEN
  ws.send(JSON.stringify({ type: 'hello' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('수신:', msg);
};

ws.onerror = (event) => {
  // 에러는 항상 onclose 직전에 발생
  console.error('WebSocket error');
};

ws.onclose = (event) => {
  console.log(ws.readyState); // 3: CLOSED
  console.log('code:', event.code, 'reason:', event.reason);
};
```

`readyState` 값: `CONNECTING(0)` → `OPEN(1)` → `CLOSING(2)` → `CLOSED(3)`. `OPEN` 상태에서만 `send()`가 작동합니다.

---

## 메시지 전송

```js
// 텍스트 (JSON 직렬화)
ws.send(JSON.stringify({ type: 'chat', text: '안녕' }));

// ArrayBuffer (바이너리)
const buffer = new ArrayBuffer(4);
new DataView(buffer).setInt32(0, 42);
ws.send(buffer);

// Blob (파일 전송)
const file = fileInput.files[0];
ws.send(file);

// 수신 측 바이너리 타입 설정 (기본값: 'blob')
ws.binaryType = 'arraybuffer'; // 또는 'blob'
ws.onmessage = ({ data }) => {
  if (data instanceof ArrayBuffer) {
    const view = new DataView(data);
    console.log(view.getInt32(0));
  }
};
```

---

## bufferedAmount — 흐름 제어

![WebSocket 실전 패턴](/assets/posts/net-websocket-patterns.svg)

`ws.bufferedAmount`는 아직 전송되지 않은 큐의 바이트 수를 나타냅니다. 높은 빈도로 `send()`를 호출하면 메모리가 무한정 늘어날 수 있습니다.

```js
function throttledSend(ws, data) {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > 16 * 1024) {
    // 16KB 이상 쌓여 있으면 전송 건너뜀
    return;
  }
  ws.send(data);
}

// 게임 상태 60fps 전송 예시
setInterval(() => {
  throttledSend(ws, JSON.stringify(getGameState()));
}, 1000 / 60);
```

---

## 지수 백오프 재연결

WebSocket은 SSE와 달리 자동 재연결이 없습니다. 직접 구현해야 합니다.

```js
class ReconnectingWebSocket {
  #url;
  #delay = 1000;
  #ws = null;

  constructor(url) {
    this.#url = url;
    this.#connect();
  }

  #connect() {
    this.#ws = new WebSocket(this.#url);
    this.#ws.onopen = () => {
      this.#delay = 1000; // 재연결 성공 시 초기화
      this.onopen?.();
    };
    this.#ws.onmessage = (e) => this.onmessage?.(e);
    this.#ws.onclose = ({ code }) => {
      if (code === 1000) return; // 정상 종료는 재연결 안 함
      this.onclose?.();
      setTimeout(() => this.#connect(), this.#delay);
      this.#delay = Math.min(this.#delay * 2, 30_000); // 최대 30초
    };
  }

  send(data) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(data);
    }
  }

  close() { this.#ws?.close(1000, 'user closed'); }
}
```

`CloseEvent.code === 1000`은 정상 종료이므로 재연결하지 않습니다. 네트워크 문제(1006)나 서버 종료(1001)는 재연결이 필요합니다.

---

## Heartbeat (Ping/Pong)

프록시나 방화벽이 유휴 WebSocket 연결을 끊을 수 있습니다. 주기적으로 Ping 메시지를 보내면 연결을 살아있게 유지합니다.

```js
const HEARTBEAT_INTERVAL = 25_000; // 25초

ws.onopen = () => {
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    } else {
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_INTERVAL);
};

ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.type === 'pong') return; // Heartbeat 응답은 무시
  handleMessage(msg);
};
```

브라우저 WebSocket API는 프로토콜 레벨 Ping/Pong 프레임을 직접 보낼 수 없으므로, 애플리케이션 레벨 메시지로 구현합니다.

---

## 서브프로토콜

```js
// 클라이언트에서 서브프로토콜 협상
const ws = new WebSocket('wss://example.com/ws', ['json-rpc', 'graphql-ws']);
ws.onopen = () => {
  console.log('협상된 프로토콜:', ws.protocol); // 'json-rpc' 또는 서버 선택값
};
```

서버는 `Sec-WebSocket-Protocol` 헤더로 지원하는 프로토콜 중 하나를 선택해 응답합니다. GraphQL 구독에는 `graphql-ws`, JSON-RPC에는 `jsonrpc` 서브프로토콜이 표준화되어 있습니다.

---

## 보안 고려사항

**wss:// 사용**: 평문 `ws://`는 중간자 공격에 취약합니다. 프로덕션에서는 반드시 TLS를 사용하세요.

**Origin 검증**: 서버 측에서 `Origin` 헤더를 검증해 CSRF를 방지합니다.

**메시지 크기 제한**: 서버에서 수신 메시지 크기에 상한을 설정하세요. 대용량 메시지는 DoS 벡터가 될 수 있습니다.

**인증**: 핸드셰이크 시 쿠키 또는 URL 파라미터로 토큰을 전달합니다. 연결 후 첫 메시지로 인증 토큰을 보내는 패턴도 널리 사용됩니다.

---

## SSE vs WebSocket 정리

| 항목 | SSE | WebSocket |
|------|-----|-----------|
| 자동 재연결 | 브라우저 내장 | 직접 구현 |
| 서버 부담 | HTTP와 동일 | 지속 연결 관리 |
| 바이너리 | 불가 | 가능 |
| HTTP/2 멀티플렉싱 | 가능 | 불가 |
| 클라이언트→서버 | fetch로 별도 | 동일 연결 |

채팅, 게임, 협업처럼 **양방향 저지연**이 필요하면 WebSocket, 서버 알림·피드처럼 단방향으로 충분하면 SSE를 선택하세요.

---

**지난 글:** [Server-Sent Events · EventSource 완전 이해](/posts/net-eventsource-sse/)

**다음 글:** [WebRTC 개요 · P2P 실시간 통신](/posts/net-webrtc-overview/)

<br>
읽어주셔서 감사합니다. 😊
