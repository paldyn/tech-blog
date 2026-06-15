---
title: "Server-Sent Events — 서버에서 흘려보내는 이벤트"
description: "text/event-stream 위에서 동작하는 SSE의 이벤트 형식, EventSource API, 자동 재연결과 Last-Event-ID 재개, WebSocket과의 비교, HTTP/2 다중화와 프록시 버퍼링 주의점까지 단방향 실시간 푸시를 실전 중심으로 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["SSE", "EventSource", "text/event-stream", "실시간", "WebSocket비교", "HTTP2", "프록시버퍼링"]
featured: false
draft: false
---

[지난 글](/posts/http-graphql-over-http/)에서 단일 엔드포인트 위로 질의를 보내는 GraphQL을 봤다. 그 글이 "클라이언트가 원하는 것을 정확히 요청하는" 방향의 이야기였다면, 이번 글은 반대 방향 — **서버가 클라이언트에게 먼저, 계속 말을 거는** 패턴이다. 알림이 도착하고, 시세가 갱신되고, LLM이 토큰을 한 글자씩 뱉어내는 그 모든 화면 뒤에는 서버에서 클라이언트로 흐르는 단방향 스트림이 있다. 그 가장 단순하고 HTTP 친화적인 형태가 바로 **Server-Sent Events(SSE)**다.

SSE는 거창한 새 프로토콜이 아니다. 그냥 **닫지 않고 계속 흘려보내는 HTTP 응답** 하나다. 응답의 `Content-Type`을 `text/event-stream`으로 선언하고, 정해진 텍스트 형식으로 이벤트를 줄줄이 써 내려가면 끝이다. 브라우저는 표준 `EventSource` API 한 줄로 이 스트림을 구독한다.

## text/event-stream — 무엇이 다른가

일반 응답은 본문을 다 보내고 연결을 정리한다. SSE 응답은 본문을 **끝내지 않는다**. 서버는 응답을 열어 둔 채로 이벤트가 생길 때마다 한 조각씩 써 보내고, 클라이언트는 그 조각들을 도착하는 대로 이벤트로 파싱한다. 핵심 헤더는 세 가지다.

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

`text/event-stream`은 "이건 SSE 스트림"이라는 신호이고, `Cache-Control: no-cache`는 중간 캐시가 스트림을 통째로 저장·재생하지 못하게 막는다. 본문은 [HTTP 스트리밍](/posts/http-streaming/)과 같은 메커니즘(청크 전송) 위에서 흘러가지만, SSE는 그 위에 **이벤트 단위의 약속된 텍스트 문법**을 얹은 것이라는 점이 다르다.

## 이벤트 형식 — 줄과 빈 줄의 문법

SSE 본문은 사람이 읽을 수 있는 텍스트다. 문법은 의외로 단순하다. 각 줄은 `필드이름: 값` 형태이고, **빈 줄 하나가 이벤트의 끝**을 의미한다.

![SSE 이벤트 스트림 형식](/assets/posts/http-sse-stream-format.svg)

쓸 수 있는 필드는 네 가지다.

- `data:` — 실제 페이로드. 한 이벤트에 `data:` 줄을 여러 개 쓰면 줄바꿈으로 이어진 하나의 본문이 된다.
- `event:` — 이벤트 타입 이름. 생략하면 기본값 `message`다. 클라이언트는 타입별로 따로 구독할 수 있다.
- `id:` — 이벤트 ID. 클라이언트는 마지막으로 받은 ID를 기억한다(재연결 재개에 쓰인다).
- `retry:` — 재연결 대기 시간(밀리초). 끊겼을 때 얼마 뒤 다시 붙을지에 대한 서버의 권고다.

실제 스트림은 이렇게 생겼다. 한 줄로 `:`로 시작하는 줄은 주석이며, 보통 연결 유지(heartbeat)용으로 쓴다.

```text
: 이 줄은 주석 — keep-alive ping

id: 1
event: price
data: {"symbol":"AAPL","price":42100}

id: 2
event: alert
data: 임계치를 돌파했습니다

retry: 5000
id: 3
data: 첫 줄
data: 둘째 줄

```

두 번째 이벤트는 `data:` 값에 JSON이 아니라 그냥 텍스트를 담았고, 세 번째 이벤트는 `data:` 두 줄이 `"첫 줄\n둘째 줄"` 하나로 합쳐진다. 각 블록 사이의 빈 줄이 경계라는 점만 지키면 된다.

## EventSource — 클라이언트 한 줄

브라우저 쪽 소비는 놀랄 만큼 짧다. `EventSource` 객체를 만들면 연결, 파싱, 재연결을 모두 알아서 처리한다.

```javascript
const es = new EventSource('/api/stream');

// event: 필드가 없는(기본 message) 이벤트
es.onmessage = (e) => {
  console.log('received:', e.data);
};

// event: price 인 이벤트만 따로 구독
es.addEventListener('price', (e) => {
  const tick = JSON.parse(e.data);
  render(tick.symbol, tick.price);
});

// 네트워크 오류 — 브라우저가 알아서 재연결을 시도한다
es.onerror = (err) => {
  console.warn('connection issue', es.readyState);
};

// 더 받을 필요가 없으면 명시적으로 닫는다
// es.close();
```

`e.data`는 항상 문자열이므로, JSON을 보냈다면 `JSON.parse`로 풀어 써야 한다. 인증이 필요하면 같은 도메인의 쿠키가 자동으로 실리고, 교차 출처라면 `new EventSource(url, { withCredentials: true })`로 자격 증명을 함께 보낼 수 있다.

## 자동 재연결과 Last-Event-ID

SSE의 가장 큰 실전 미덕은 **재연결이 표준에 내장**돼 있다는 점이다. 연결이 끊기면 브라우저는 `retry:`로 받은 시간(기본 약 3초) 뒤에 같은 URL로 자동 재접속한다. 개발자가 재시도 루프를 직접 짤 필요가 없다.

게다가 끊기기 전에 마지막으로 받은 `id:` 값을 브라우저가 기억하고 있다가, 재접속 요청에 `Last-Event-ID` 헤더로 자동으로 실어 보낸다.

```http
GET /api/stream HTTP/1.1
Last-Event-ID: 2
```

서버는 이 헤더를 보고 "이 클라이언트는 2번까지 받았으니 3번부터 보내면 된다"고 판단해 **누락 없이 이어서** 스트림을 재개할 수 있다. 단, 이건 서버가 ID별 위치를 복원해 줄 때만 동작한다. ID를 발급만 하고 재개 로직을 구현하지 않으면 재연결은 되지만 그사이 이벤트는 유실된다.

## WebSocket·롱 폴링과의 비교

실시간 통신이라고 하면 흔히 WebSocket을 먼저 떠올리지만, 둘은 푸는 문제가 다르다. 선택의 기준은 단순하다 — **방향성**이다.

![SSE vs WebSocket vs 롱 폴링](/assets/posts/http-sse-vs-websocket.svg)

SSE는 **서버→클라 단방향**이다. 그래서 그냥 HTTP 응답이고, 별도 프로토콜 업그레이드가 없다. 기존 HTTP 인프라 — 인증, 쿠키, 압축, 리버스 프록시, 로드 밸런서, HTTP/2 다중화 — 가 그대로 적용된다. 데이터는 UTF-8 텍스트만 다룬다.

WebSocket은 `ws://`로의 프로토콜 업그레이드 핸드셰이크를 거쳐 **양방향(full-duplex)** 채널을 연다. 텍스트와 바이너리를 모두 보내고, 클라이언트도 서버에 자유롭게 보낸다. 대신 재연결은 직접 구현해야 하고, HTTP 인프라와 자연스럽게 어울리지 않는 부분이 생긴다.

롱 폴링은 둘 다 어려운 환경의 폴백이다. 요청을 보내고 응답이 올 때까지 서버가 붙잡고 있다가, 응답을 받으면 곧바로 다음 요청을 또 보낸다. 매번 요청·연결 오버헤드가 붙는다.

정리하면 이렇다.

- 알림, 피드, 시세, 진행률, LLM 토큰 스트림처럼 **서버가 일방적으로 밀어 주면 되는** 경우 → SSE.
- 채팅, 게임, 협업 편집처럼 **클라이언트도 자주, 즉시 서버로 보내야** 하는 경우 → WebSocket.

## HTTP/1.1 연결 수 제한과 HTTP/2 다중화

SSE를 HTTP/1.1에서 쓸 때 잘 알려진 함정이 있다. 브라우저는 **호스트(origin)당 동시 연결 수를 약 6개로 제한**한다. SSE 연결 하나는 그 자리를 계속 점유하므로, 같은 도메인에서 SSE 스트림 몇 개를 동시에 열면 나머지 일반 요청(이미지, API 호출 등)이 그 한도에 막혀 줄을 서게 된다. 여러 탭을 켜면 문제는 더 빨리 드러난다.

[HTTP/2](/posts/http-2-multiplexing/)로 올라가면 이 제약이 사라진다. HTTP/2는 하나의 TCP 연결 위에서 수많은 스트림을 **다중화**하므로, SSE 스트림이 연결 한 칸을 통째로 잡아먹지 않는다. 같은 연결 위에서 SSE와 다른 요청이 나란히 흐른다. 실무에서 SSE를 쓴다면 HTTP/2 이상에서 서비스하는 것이 사실상의 기본 권장이다.

## 프록시·버퍼링 주의점

SSE가 "분명히 보냈는데 클라이언트에 안 도착한다"면, 코드보다 **중간 버퍼**를 먼저 의심해야 한다. 리버스 프록시(특히 nginx 기본 설정)는 응답을 모아 두었다가 한꺼번에 전달하는 버퍼링을 켜 두는 경우가 많다. 그러면 서버가 이벤트를 흘려보내도 프록시 안에 고여 있다가 연결이 닫힐 때야 쏟아진다 — 실시간성이 통째로 사라진다.

nginx라면 SSE 경로에서 버퍼링을 꺼야 한다.

```nginx
location /api/stream {
    proxy_pass http://app;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding on;
}
```

추가로 신경 쓸 지점이 몇 가지 더 있다.

- **압축**: gzip이 출력을 모았다가 압축하느라 버퍼링과 같은 증상을 만들 수 있다. SSE 응답은 압축을 끄는 편이 안전하다.
- **유휴 타임아웃**: 프록시·로드 밸런서가 일정 시간 트래픽이 없으면 연결을 끊는다. `:` 주석 줄을 주기적으로 보내는 heartbeat로 연결을 살려 둔다.
- **응답 플러시**: 애플리케이션 서버에서 이벤트를 쓴 직후 명시적으로 flush 해야 출력 버퍼에 고이지 않는다.

## 정리

- SSE는 새 프로토콜이 아니라 `text/event-stream`으로 선언된 **닫히지 않는 HTTP 응답**이다.
- 형식은 `data:`·`event:`·`id:`·`retry:` 필드와 **빈 줄로 끊는 이벤트 블록**으로 끝난다. 소비는 `EventSource` 한 줄.
- 자동 재연결과 `Last-Event-ID`가 표준에 내장돼 있어, 서버가 재개를 지원하면 끊겨도 누락 없이 이어진다.
- 서버→클라 단방향이면 SSE, 양방향 잦은 교신이면 WebSocket — 기준은 방향성이다.
- HTTP/1.1의 연결 수 제한은 **HTTP/2 다중화**로 푼다. 그리고 안 보일 땐 코드보다 **프록시 버퍼링·압축**을 먼저 의심하라.

---

**지난 글:** [GraphQL over HTTP — 단일 엔드포인트의 설계](/posts/http-graphql-over-http/)

**다음 글:** [웹훅(Webhook) — 역방향 HTTP 콜백](/posts/http-webhooks/)

<br>
읽어주셔서 감사합니다. 😊
