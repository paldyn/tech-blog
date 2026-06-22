---
title: "WebSocket — 양방향 실시간 통신"
description: "WebSocket은 한 번 연결을 열어 두고 서버와 클라이언트가 양방향으로 메시지를 주고받는 프로토콜입니다. 요청-응답 HTTP의 한계, HTTP Upgrade 핸드셰이크, Java 11 java.net.http의 WebSocket과 Listener 콜백 모델을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-23"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "WebSocket", "실시간", "네트워크", "비동기"]
featured: false
draft: false
---

[지난 글](/posts/java-http-client-11/)에서 Java 11의 현대적 `HttpClient`로 HTTP 요청을 보내는 법을 익혔습니다. 그런데 HTTP에는 구조적인 한계가 하나 있습니다. 언제나 **클라이언트가 먼저 요청해야** 서버가 응답한다는 점입니다. 서버에서 발생한 새 소식 — 채팅 메시지, 실시간 알림, 주식 시세 — 을 클라이언트에게 곧장 밀어줄 방법이 없습니다. 이 한계를 정면으로 해결하는 프로토콜이 WebSocket입니다. 이번 글에서는 양방향 실시간 통신을 가능하게 하는 WebSocket을, 자바 표준 API로 살펴봅니다.

## HTTP의 한계 — 서버가 먼저 말할 수 없다

HTTP는 철저히 요청-응답 모델입니다. 클라이언트가 요청을 보내면 서버가 응답하고, 그 한 번의 교환이 끝나면 대화도 끝납니다. 서버에 새로운 정보가 생겨도, 클라이언트가 다시 물어보기 전까지는 전달할 길이 없습니다.

![요청-응답 HTTP vs 상시 연결 WebSocket](/assets/posts/java-websocket-vs-http.svg)

과거에는 이 한계를 우회하려고 클라이언트가 짧은 주기로 계속 물어보는 **폴링(polling)** 을 썼습니다. 하지만 폴링은 불필요한 요청을 끝없이 만들고, 새 소식이 생긴 순간과 그것을 받는 순간 사이에 지연이 생깁니다. WebSocket은 이 문제를 근본적으로 다시 설계합니다. 연결을 **한 번 열어 두고 계속 유지** 하면서, 양쪽 누구든 필요할 때 먼저 메시지를 보낼 수 있게 합니다.

## HTTP Upgrade로 시작하는 연결

WebSocket이 영리한 점은 완전히 새로운 연결 방식을 만들지 않고, **기존 HTTP 연결을 빌려 시작** 한다는 것입니다. 클라이언트가 평범한 HTTP 요청에 `Upgrade: websocket` 헤더를 담아 보내면, 서버가 `101 Switching Protocols`로 화답하며 그 연결을 WebSocket으로 전환합니다.

이 핸드셰이크가 끝나면 같은 TCP 연결이 더 이상 요청-응답이 아니라, 양방향으로 메시지(프레임)를 자유롭게 흘려보내는 통로가 됩니다. HTTP를 통해 시작하기 때문에 기존 웹 인프라(포트 80/443, 프록시 등)와 잘 어울린다는 실용적 장점도 있습니다. 핸드셰이크는 처음 한 번뿐이고, 그 뒤로는 연결이 닫힐 때까지 자유로운 양방향 대화가 이어집니다.

## 자바 표준 WebSocket API

WebSocket 역시 Java 11의 `java.net.http` 패키지에 표준으로 들어 있습니다. 별도 라이브러리 없이 `HttpClient`에서 곧장 WebSocket 연결을 열 수 있습니다.

```java
import java.net.http.*;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();

WebSocket ws = client.newWebSocketBuilder()
        .buildAsync(URI.create("wss://echo.example.com"), new MyListener())
        .join();   // 핸드셰이크 완료까지 대기

ws.sendText("안녕, 서버", true);   // 메시지 전송
```

`buildAsync`는 핸드셰이크를 비동기로 수행하고 `CompletableFuture<WebSocket>`을 돌려줍니다. `wss://`는 TLS로 암호화된 WebSocket으로, HTTP의 `https://`에 대응합니다. 연결이 열린 뒤 `sendText`로 텍스트 메시지를 보냅니다. 마지막 인자 `true`는 "이 메시지가 여기서 완결된다"는 표시입니다.

## 메시지는 콜백으로 들어온다

WebSocket은 언제 메시지가 도착할지 알 수 없으므로, 받는 쪽은 **콜백(이벤트) 기반** 으로 동작합니다. `WebSocket.Listener` 인터페이스를 구현하면, 연결이 열리거나 메시지가 도착하거나 오류·종료가 발생할 때마다 해당 메서드가 자동으로 호출됩니다.

![WebSocket.Listener — 이벤트가 콜백으로 들어온다](/assets/posts/java-websocket-listener.svg)

```java
class MyListener implements WebSocket.Listener {
    @Override
    public void onOpen(WebSocket ws) {
        System.out.println("연결 열림");
        ws.request(1);   // 다음 메시지 1건을 받을 준비
    }

    @Override
    public CompletionStage<?> onText(WebSocket ws, CharSequence data,
                                     boolean last) {
        System.out.println("수신: " + data);
        ws.request(1);   // 다음 메시지를 또 요청
        return null;
    }

    @Override
    public void onError(WebSocket ws, Throwable error) {
        error.printStackTrace();
    }
}
```

여기서 눈여겨볼 것은 `ws.request(1)` 입니다. 자바 WebSocket API는 **요청한 만큼만 메시지를 전달** 하는 흐름 제어(back-pressure)를 갖고 있습니다. `onOpen`과 `onText`에서 다음 메시지를 명시적으로 요청해야, 처리 속도를 넘어선 메시지가 한꺼번에 밀려드는 것을 막을 수 있습니다. 빠르게 도착하는 메시지에 처리기가 압도되지 않도록 설계된 것입니다.

## 언제 WebSocket을 쓰는가

WebSocket이 항상 HTTP보다 나은 것은 아닙니다. 단발성 조회나 일반적인 REST API에는 여전히 HTTP가 단순하고 적합합니다. WebSocket이 빛나는 곳은 **서버가 능동적으로, 그리고 자주** 정보를 밀어줘야 하는 상황입니다. 실시간 채팅, 협업 편집, 라이브 알림, 주식·코인 시세, 온라인 게임처럼 양방향성과 즉시성이 핵심인 영역입니다. 반대로 가끔 한 번 데이터를 가져오는 정도라면 WebSocket의 상시 연결은 과합니다. 연결을 계속 유지하는 비용과 양방향성이 주는 이득을 저울질해 선택하면 됩니다.

## 정리

WebSocket은 HTTP의 요청-응답 한계 — 서버가 먼저 말할 수 없다는 점 — 를 해결하기 위해, 연결을 한 번 열어 두고 양쪽이 자유롭게 메시지를 주고받는 프로토콜입니다. HTTP Upgrade 핸드셰이크로 시작해 같은 연결을 양방향 통로로 전환하며, 자바에서는 Java 11의 `java.net.http`가 `WebSocket`과 `Listener`를 표준으로 제공합니다. 메시지는 콜백으로 들어오고 `request`로 흐름을 제어합니다. 실시간·양방향이 핵심일 때 빛나는 도구입니다. 다음 글에서는 또 다른 통신 방식, 구조화된 데이터를 빠르게 주고받는 RPC 프레임워크 gRPC를 살펴봅니다.

---

**지난 글:** [Java 11 HttpClient — 현대적인 HTTP 클라이언트](/posts/java-http-client-11/)

**다음 글:** [gRPC — 고성능 RPC 프레임워크](/posts/java-grpc/)

<br>
읽어주셔서 감사합니다. 😊
