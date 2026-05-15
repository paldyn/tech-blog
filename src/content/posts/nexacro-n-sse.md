---
title: "[Nexacro N] SSE(Server-Sent Events) 실시간 수신"
description: "Nexacro N에서 EventSource API를 이용해 서버 푸시 알림, 실시간 로그, 진행률을 단방향으로 수신하는 SSE 구현 방법과 Dataset 연동 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "SSE", "EventSource", "서버푸시", "실시간", "알림"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-websocket/)에서 양방향 WebSocket 연동을 다뤘다. 서버에서 클라이언트로만 데이터를 밀어주면 되는 시나리오—알림, 실시간 로그, 배치 진행률—에는 구현이 훨씬 단순한 SSE(Server-Sent Events)가 더 적합하다. HTTP 인프라를 그대로 사용하고 브라우저가 자동 재연결을 처리해주기 때문이다.

## SSE vs WebSocket

두 기술은 목적이 다르다. WebSocket이 양방향 실시간 채널이라면, SSE는 서버가 클라이언트에게 지속적으로 이벤트를 스트리밍하는 단방향 파이프다.

![SSE vs WebSocket 비교표](/assets/posts/nexacro-n-sse-vs-websocket.svg)

서버 쪽에서도 SSE는 단순 HTTP 엔드포인트로 구현할 수 있어 Nginx, 기존 Spring MVC 필터, 프록시 등 기존 인프라를 변경할 필요가 없다는 장점이 있다.

## 기본 연결 구현

Nexacro N은 HTML5 런타임이므로 `EventSource` API를 바로 사용할 수 있다.

```javascript
var evtSrc = null;

function fn_sseConnect() {
  evtSrc = new EventSource("/sse/alerts");

  // 기본 메시지 수신 (event: 생략된 경우)
  evtSrc.onmessage = function(event) {
    var row = this.ds_notify.addRow();
    this.ds_notify.setColumn(row, "MSG",  event.data);
    this.ds_notify.setColumn(row, "TIME",
      new Date().toLocaleTimeString());
  }.bind(this);

  // 커스텀 이벤트 구독 (event: PRICE)
  evtSrc.addEventListener("PRICE",
    fn_onPrice.bind(this));

  evtSrc.onerror = function() {
    trace("SSE 오류 — 브라우저 자동 재연결 대기");
  };
}

function fn_sseClose() {
  if (evtSrc) { evtSrc.close(); evtSrc = null; }
}
```

`EventSource`는 연결이 끊기면 브라우저가 자동으로 재연결을 시도한다(`Retry` 헤더로 간격 조정 가능). 이 점이 WebSocket과 가장 큰 차이다.

## Dataset 연동 패턴

![EventSource Dataset 연동 코드](/assets/posts/nexacro-n-sse-code.svg)

수신 데이터는 JSON 문자열로 전달되는 경우가 많다. `event.data`를 파싱해 Dataset에 넣는다.

```javascript
function fn_onPrice(event) {
  var data = JSON.parse(event.data);
  var row = this.ds_price.addRow();
  this.ds_price.setColumn(row, "STOCK", data.stock);
  this.ds_price.setColumn(row, "PRICE", data.price);
  this.ds_price.setColumn(row, "CHANGE", data.change);
}
```

## 서버 구현 (Spring Boot)

Spring의 `SseEmitter`를 사용하면 SSE 스트림을 쉽게 구현할 수 있다.

```java
// Spring Boot SSE 엔드포인트 예시
@GetMapping(value = "/sse/alerts",
    produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter getAlerts() {
  SseEmitter emitter = new SseEmitter(0L); // 무한 타임아웃
  sseService.addEmitter(emitter);
  return emitter;
}
```

서버에서 이벤트를 보낼 때는 `emitter.send(SseEmitter.event().name("PRICE").data(json))`처럼 이벤트 이름과 데이터를 함께 전송한다. 클라이언트는 `addEventListener("PRICE", handler)`로 해당 이벤트만 구독한다.

## 폼 생명주기 연동

```javascript
function Form_onload(obj, e) {
  this.fn_sseConnect();
}

function Form_onunload(obj, e) {
  this.fn_sseClose();
}
```

폼이 닫힐 때 `evtSrc.close()`를 호출하지 않으면 SSE 연결이 브라우저 세션 내에서 계속 유지된다. 서버의 Emitter 목록에도 dead connection이 쌓이므로 반드시 정리해야 한다.

## CORS 설정

SSE 엔드포인트를 다른 도메인에서 요청할 경우 서버에서 `Access-Control-Allow-Origin` 헤더를 설정해야 한다. 자격증명(쿠키/헤더)이 필요하면 `EventSource` 생성 시 두 번째 인자로 `{ withCredentials: true }`를 전달한다.

```javascript
evtSrc = new EventSource("/sse/alerts",
  { withCredentials: true });
```

## 진행률 표시 응용

장시간 배치 작업의 진행률을 ProgressBar 컴포넌트로 표시하는 전형적인 사용 사례다.

```javascript
evtSrc.addEventListener("PROGRESS", function(e) {
  var pct = parseInt(e.data);
  this.ProgressBar00.value = pct;
  if (pct >= 100) this.fn_sseClose();
}.bind(this));
```

배치 완료 이벤트를 수신하면 `evtSrc.close()`로 연결을 닫아 서버 자원을 해제한다.

---

**지난 글:** [WebSocket으로 실시간 서버 연동](/posts/nexacro-n-websocket/)

**다음 글:** [CRUD 패턴 설계와 표준 구조](/posts/nexacro-n-crud-pattern/)

<br>
읽어주셔서 감사합니다. 😊
