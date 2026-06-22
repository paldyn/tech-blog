---
title: "ServerSocket — 자바로 서버를 여는 법"
description: "ServerSocket은 특정 포트에서 연결을 기다리다 수락하는 서버 측 소켓입니다. bind·accept의 생애주기, accept()가 연결마다 새 Socket을 돌려주는 원리, 연결당 스레드 모델로 여러 클라이언트를 동시에 처리하는 구조까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-23"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "ServerSocket", "네트워크", "서버", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/java-socket-basics/)에서 연결을 거는 클라이언트 쪽 소켓을 살펴봤습니다. 통신에는 반드시 짝이 필요합니다. 누군가 연결을 요청한다면, 그 연결을 **기다렸다가 받아주는** 쪽이 있어야 합니다. 그 역할을 맡는 것이 서버이고, 자바에서 서버를 여는 출발점이 바로 `ServerSocket`입니다. 이번 글에서는 서버 소켓이 어떻게 연결을 받아들이고, 여러 클라이언트를 동시에 다루는지를 정리합니다.

## ServerSocket의 두 가지 일

`java.net.ServerSocket`이 하는 일은 본질적으로 두 가지입니다. 첫째, **특정 포트를 점유**(bind)해서 "이 포트로 오는 연결은 내가 받겠다"고 운영체제에 선언합니다. 둘째, 그 포트로 들어오는 연결 요청을 **수락**(accept)합니다. 클라이언트 소켓이 데이터를 직접 주고받는 것과 달리, `ServerSocket` 자체는 데이터를 주고받지 않습니다. 오로지 연결을 받아들이는 일만 합니다.

```java
import java.net.ServerSocket;
import java.net.Socket;

// 8080 포트를 점유하고 연결을 기다린다
ServerSocket serverSocket = new ServerSocket(8080);
System.out.println("서버 시작, 포트 8080 대기 중...");

Socket client = serverSocket.accept();  // 연결이 올 때까지 멈춰 대기
System.out.println("연결됨: " + client.getRemoteSocketAddress());
```

`new ServerSocket(8080)` 한 줄로 포트 바인딩이 끝납니다. 그다음 `accept()`를 호출하면, 클라이언트가 연결해 올 때까지 그 자리에서 **블로킹** 된 채 기다립니다. 누군가 연결하는 순간 `accept()`가 반환되며, 그 클라이언트와 1:1로 연결된 `Socket` 객체를 돌려줍니다.

## accept()는 연결마다 새 Socket을 만든다

여기서 가장 중요한 개념이 있습니다. `ServerSocket`은 **연결을 받는 창구** 일 뿐이고, 실제 통신은 `accept()`가 돌려준 `Socket`에서 이뤄집니다. 클라이언트가 100명 연결하면 `accept()`는 100번 호출되어 100개의 서로 다른 `Socket`을 만들어 냅니다. 하나의 `ServerSocket`이 여러 개의 개별 연결을 낳는 구조입니다.

![ServerSocket의 생애 — 한 번 열고, 반복해서 수락한다](/assets/posts/java-server-socket-lifecycle.svg)

그래서 서버의 기본 골격은 **무한 루프 안에서 `accept()`를 반복** 하는 모양이 됩니다. 한 연결을 받아 처리하고, 다시 루프 위로 돌아와 다음 연결을 기다리는 것입니다.

```java
try (ServerSocket server = new ServerSocket(8080)) {
    while (true) {
        Socket client = server.accept();          // 다음 연결을 받는다
        var in  = new BufferedReader(
                      new InputStreamReader(client.getInputStream()));
        var out = new PrintWriter(client.getOutputStream(), true);

        String line = in.readLine();
        out.println("echo: " + line);              // 받은 줄을 되돌려 줌
        client.close();
    }
}
```

이 echo 서버는 한 연결에서 한 줄을 받아 그대로 돌려주고 연결을 닫은 뒤, 다음 연결을 받습니다. `ServerSocket`을 `try-with-resources`로 감싸 서버 종료 시 포트가 깔끔히 반환되게 했습니다.

## 문제 — 한 번에 한 명씩만

위 코드에는 숨은 한계가 있습니다. 루프가 한 연결을 처리하는 동안, 그 처리가 끝나기 전까지는 다음 `accept()`로 넘어가지 못합니다. 만약 어떤 클라이언트가 데이터를 천천히 보낸다면, 그 한 명 때문에 뒤이은 모든 클라이언트가 줄을 서서 기다려야 합니다. 한 번에 한 명씩만 응대하는 단일 창구인 셈입니다.

실제 서버는 동시에 수많은 클라이언트를 응대해야 합니다. 가장 직관적인 해법은 **연결을 받자마자 그 처리를 별도의 스레드에 넘기고**, 메인 루프는 곧장 다음 `accept()`로 돌아가는 것입니다.

![연결마다 스레드 하나 — 동시 처리의 고전적 모델](/assets/posts/java-server-socket-thread-per-conn.svg)

```java
try (ServerSocket server = new ServerSocket(8080)) {
    while (true) {
        Socket client = server.accept();
        // 처리는 워커 스레드에 위임, 메인 루프는 즉시 다음 연결로
        new Thread(() -> handle(client)).start();
    }
}
```

이렇게 하면 메인 루프는 연결을 받는 일에만 집중하고, 실제 읽기·쓰기는 각 워커 스레드가 독립적으로 처리합니다. 한 클라이언트가 느리더라도 다른 클라이언트의 응대가 막히지 않습니다.

## 연결당 스레드의 한계와 그 너머

연결당 스레드 모델은 직관적이고 코드도 단순하지만, 연결 수가 수천·수만으로 늘어나면 플랫폼 스레드의 메모리와 컨텍스트 스위칭 비용이 부담이 됩니다. 매번 새 스레드를 만드는 대신 **스레드 풀**(`ExecutorService`)에 작업을 제출하는 것이 한 단계 나은 방법이고, 자바 21의 **가상 스레드** 를 쓰면 연결당 스레드 모델의 단순함을 유지하면서도 수십만 연결까지 감당할 수 있습니다. 이 주제들은 앞선 동시성 편에서 다뤘으니, 여기서는 "서버의 동시성 전략은 결국 `accept()` 이후의 처리를 어떻게 분산하느냐의 문제"라는 큰 그림만 기억하면 됩니다.

## 정리

`ServerSocket`은 특정 포트를 점유해 연결을 기다리다 수락하는 서버 측 소켓으로, `accept()`는 연결이 올 때까지 블로킹되다가 클라이언트와 1:1로 연결된 새 `Socket`을 돌려줍니다. 서버의 기본 골격은 무한 루프에서 `accept()`를 반복하는 모양이며, 한 번에 한 연결만 처리하는 한계를 넘기 위해 연결마다 스레드를 할당하거나 스레드 풀·가상 스레드에 위임합니다. 이로써 소켓 통신의 양쪽 — 연결을 거는 클라이언트와 받는 서버 — 을 모두 살펴봤습니다. 다음 글에서는 이 저수준 소켓 위에 세워진 가장 흔한 응용 프로토콜, HTTP를 표준 라이브러리로 호출하는 `HttpURLConnection`을 다룹니다.

---

**지난 글:** [소켓 기초 — TCP 통신의 출발점](/posts/java-socket-basics/)

**다음 글:** [HttpURLConnection — 표준 라이브러리로 HTTP 호출하기](/posts/java-http-url-connection/)

<br>
읽어주셔서 감사합니다. 😊
