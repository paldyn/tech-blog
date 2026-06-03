---
title: "WebSocket 프로토콜 완전 정복"
description: "HTTP Upgrade 핸드셰이크, WebSocket 프레임 구조, Polling vs SSE vs WebSocket 비교, Node.js 구현 예시"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["WebSocket", "HTTP", "실시간", "프로토콜", "네트워크"]
featured: false
draft: false
---

## WebSocket이란?

HTTP는 요청-응답 모델로 설계되어, 서버가 클라이언트에게 먼저 데이터를 보낼 수 없습니다. WebSocket(RFC 6455)은 **하나의 TCP 연결 위에서 양방향 전이중(Full-Duplex) 통신**을 가능하게 하는 프로토콜입니다.

## 핸드셰이크

![WebSocket 핸드셰이크와 프레임 구조](/assets/posts/network-websocket-protocol-handshake.svg)

WebSocket은 HTTP Upgrade 메커니즘을 사용해 연결을 수립합니다.

**클라이언트 요청 (HTTP GET)**

```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

**서버 응답 (101 Switching Protocols)**

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

`Sec-WebSocket-Accept`는 클라이언트의 Key + GUID를 SHA-1 해시한 값으로, 서버가 WebSocket을 실제로 지원하는지 확인합니다.

## 프레임 구조

WebSocket 메시지는 하나 이상의 **프레임**으로 구성됩니다.

- **FIN** (1bit): 마지막 프레임 여부
- **Opcode** (4bit): 0x1=Text, 0x2=Binary, 0x8=Close, 0x9=Ping, 0xA=Pong
- **MASK** (1bit): 클라이언트→서버는 반드시 1 (XOR 마스킹 필수)
- **Payload Length**: 7bit (≤125), 7+16bit (≤65535), 7+64bit (더 큰 값)

클라이언트가 서버로 보내는 프레임은 반드시 **4바이트 Masking Key로 XOR**해야 합니다. 서버가 클라이언트로 보낼 때는 마스킹 불필요.

## HTTP Polling vs WebSocket vs SSE

![Polling vs WebSocket vs SSE](/assets/posts/network-websocket-protocol-usecases.svg)

| 방식 | 방향 | 연결 | 특징 |
|------|------|------|------|
| Short Polling | 단방향 | 매번 생성 | 단순하나 불필요한 요청 반복 |
| Long Polling | 단방향 | 응답까지 유지 | 지연 개선, 서버 리소스 소모 |
| SSE | 서버→클라이언트 | 지속 | HTTP/1.1 텍스트 스트림, 단방향 |
| WebSocket | 양방향 | 지속 | 완전한 양방향, 낮은 오버헤드 |

## Node.js 구현 예시

```javascript
// 서버 (ws 패키지 사용)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    // 모든 클라이언트에 브로드캐스트
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg.toString());
      }
    });
  });
  ws.send('connected');
});
```

```javascript
// 브라우저 클라이언트
const ws = new WebSocket('wss://example.com/chat');
ws.onmessage = (event) => console.log(event.data);
ws.onopen    = () => ws.send('Hello');
```

## Ping/Pong (연결 유지)

WebSocket은 Ping(0x9) / Pong(0xA) 제어 프레임으로 연결 상태를 확인합니다. 서버가 Ping을 보내면 클라이언트는 자동으로 Pong을 응답해야 합니다. 일정 시간 Pong이 없으면 연결이 끊긴 것으로 간주합니다.

## 서브프로토콜과 확장

- **Sec-WebSocket-Protocol**: 애플리케이션 레벨 프로토콜 협상 (예: `chat`, `stomp`, `graphql-ws`)
- **Sec-WebSocket-Extensions**: 퍼 메시지 압축 (`permessage-deflate`) 등 확장 협상

## 역방향 프록시 설정 (Nginx)

```nginx
location /ws/ {
    proxy_pass         http://backend;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "Upgrade";
    proxy_read_timeout 3600s;
}
```

`proxy_read_timeout`을 충분히 길게 설정하지 않으면 Nginx가 idle 연결을 끊습니다.

---

**이전 글:** [DoH와 DoT: DNS 암호화](/posts/network-doh-dot/)

**다음 글:** [TLS/SSL 개요: HTTPS의 핵심](/posts/network-tls-ssl-overview/)
