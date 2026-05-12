---
title: "[Nexacro N] WebSocket으로 실시간 서버 연동"
description: "Nexacro N HTML5 런타임에서 브라우저 네이티브 WebSocket API를 활용해 실시간 양방향 통신을 구현하는 방법, Dataset 연동 패턴, 재연결 처리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "websocket", "실시간", "양방향통신", "Dataset", "onmessage"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-cache-disable/)에서 HTTP 캐시 비활성화 전략을 살펴봤다. 이번에는 주기적 트랜잭션 폴링 없이 서버가 데이터를 즉시 푸시할 수 있는 WebSocket 연동 방법을 다룬다. Nexacro N은 HTML5 런타임에서 동작하므로 브라우저의 네이티브 `WebSocket` API를 스크립트에서 직접 사용할 수 있다.

## WebSocket과 Nexacro N

Nexacro N의 스크립트 환경은 HTML5 런타임에서 실행되는 JavaScript이기 때문에 `window.WebSocket`을 포함한 표준 브라우저 API에 접근할 수 있다. 별도 컴포넌트나 플러그인 없이 `new WebSocket(url)`만으로 연결을 맺을 수 있다.

아래는 연결 수립부터 종료까지의 생명주기 다이어그램이다.

![WebSocket 연결 생명주기](/assets/posts/nexacro-n-websocket-lifecycle.svg)

주의할 점은 Nexacro Studio의 스크립트 에디터에서 `WebSocket`을 입력하면 자동완성이 지원되지 않을 수 있다는 것이다. IDE 경고를 무시하고 런타임에서 정상 동작함을 확인한 뒤 사용하면 된다.

## 기본 연결 구현

```javascript
var ws = null;

function fn_wsConnect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket("wss://example.com/ws");

  ws.onopen = function() {
    trace("WebSocket 연결 완료");
    ws.send(JSON.stringify({ type: "SUBSCRIBE", room: "stock" }));
  };

  ws.onmessage = function(event) {
    var data = JSON.parse(event.data);
    var row = this.ds_rt.addRow();
    this.ds_rt.setColumn(row, "TIME",  data.time);
    this.ds_rt.setColumn(row, "VALUE", data.value);
  }.bind(this);

  ws.onerror = function(event) {
    trace("WebSocket 오류 발생");
  };

  ws.onclose = function(event) {
    trace("WebSocket 종료: code=" + event.code);
    ws = null;
  };
}
```

`onmessage` 콜백 안에서 `this`가 Nexacro Form 인스턴스를 가리키도록 `.bind(this)`를 반드시 붙여야 한다. 그렇지 않으면 `ds_rt.addRow()`를 찾을 수 없어 런타임 오류가 발생한다.

## Dataset 연동 패턴

![WebSocket Dataset 연동 코드](/assets/posts/nexacro-n-websocket-code.svg)

실시간 수신 데이터를 Grid와 연결된 Dataset에 누적하려면 `addRow()`로 행을 추가하고 `setColumn()`으로 각 컬럼을 채운다. 데이터가 너무 많이 쌓이면 성능이 저하되므로 최대 행 수를 제한하는 로직을 함께 구현한다.

```javascript
function fn_appendWsData(data) {
  var MAX_ROWS = 200;
  if (this.ds_rt.rowcount >= MAX_ROWS) {
    this.ds_rt.deleteRow(0);  // 가장 오래된 행 제거
  }
  var row = this.ds_rt.addRow();
  this.ds_rt.setColumn(row, "TIME",  data.time);
  this.ds_rt.setColumn(row, "PRICE", data.price);
  this.ds_rt.setColumn(row, "VOLUME", data.volume);
}
```

## 재연결 처리

네트워크 순단이나 서버 재시작으로 연결이 끊길 수 있다. `onclose` 핸들러에서 지수 백오프(Exponential Backoff) 패턴으로 재연결을 시도한다.

```javascript
var wsRetryDelay = 1000;  // 초기 1초

function fn_wsReconnect() {
  trace("재연결 시도... (" + wsRetryDelay + "ms 후)");
  var self = this;
  setTimeout(function() {
    self.fn_wsConnect();
  }, wsRetryDelay);
  wsRetryDelay = Math.min(wsRetryDelay * 2, 30000); // 최대 30초
}

// onclose 핸들러에서 호출
ws.onclose = function(event) {
  if (event.code !== 1000) {  // 정상 종료가 아닌 경우
    this.fn_wsReconnect();
  }
  ws = null;
}.bind(this);
```

폼이 닫히거나 사용자가 다른 메뉴로 이동할 때는 `ws.close(1000)`을 명시적으로 호출해 정상 종료를 알려야 한다.

## 폼 생명주기와 연동

```javascript
// 폼 로드 시 연결
function Form_onload(obj, e) {
  this.fn_wsConnect();
}

// 폼 언로드 시 연결 해제
function Form_onunload(obj, e) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close(1000, "form closed");
  }
  ws = null;
}
```

폼 언로드 시 정리하지 않으면 WebSocket 연결이 백그라운드에서 계속 유지되어 메모리 누수와 불필요한 서버 부하가 발생한다.

## SSL/TLS 적용

운영 환경에서는 반드시 `wss://` (WebSocket Secure)를 사용해야 한다. HTTPS 페이지에서 `ws://`를 사용하면 브라우저가 Mixed Content 오류로 차단한다.

## 서버 구현 참고

Spring Boot 기반 서버는 `@EnableWebSocket`과 `WebSocketHandler`를 구현한다. 클라이언트 수가 많으면 STOMP over WebSocket(`spring-websocket` + SockJS)을 고려해 채널 구독 패턴으로 확장성을 높인다.

---

**지난 글:** [트랜잭션 캐시 비활성화 전략](/posts/nexacro-n-cache-disable/)

**다음 글:** [SSE(Server-Sent Events) 실시간 수신](/posts/nexacro-n-sse/)

<br>
읽어주셔서 감사합니다. 😊
