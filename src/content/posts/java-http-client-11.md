---
title: "Java 11 HttpClient — 현대적인 HTTP 클라이언트"
description: "Java 11에 표준으로 들어온 HttpClient는 빌더 기반 API, HTTP/2 지원, 동기·비동기 호출을 모두 갖춘 현대적 HTTP 클라이언트입니다. HttpClient·HttpRequest·HttpResponse의 역할, BodyHandlers, send와 sendAsync의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-23"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "HttpClient", "Java11", "HTTP", "비동기"]
featured: false
draft: false
---

[지난 글](/posts/java-http-url-connection/)에서 전통적인 `HttpURLConnection`의 장황함과 비직관적인 API를 살펴봤습니다. 그 불편함은 오랫동안 자바 개발자들이 외부 라이브러리에 의존하게 만든 원인이었습니다. 마침내 Java 11은 표준 라이브러리에 완전히 새로 설계한 `java.net.http.HttpClient`를 들여왔습니다. 빌더 패턴, HTTP/2, 비동기 호출까지 갖춘 이 API는 외부 라이브러리 없이도 현대적인 HTTP 통신을 가능하게 합니다. 이번 글에서 그 사용법을 정리합니다.

## 세 객체로 나뉜 명확한 역할

새 `HttpClient`의 설계 철학은 역할 분리입니다. 호출하는 주체, 요청 명세, 응답을 세 개의 별도 객체로 나눴습니다.

![HttpClient — 세 객체로 나뉜 명확한 역할](/assets/posts/java-http-client-11-pipeline.svg)

`HttpClient`는 **한 번 만들어 재사용** 하는 호출 엔진입니다. 연결 풀, 설정, 스레드 풀을 내부에 들고 있으므로 요청마다 새로 만들지 않고 애플리케이션 전역에서 공유하는 것이 좋습니다. `HttpRequest`는 URL·메서드·헤더·본문을 담은 **불변 요청 명세** 로, 빌더로 조립합니다. `HttpResponse<T>`는 상태 코드·헤더·본문을 담은 응답이며, 본문의 타입 `T`는 우리가 지정합니다. 설정과 실행이 뒤섞였던 `HttpURLConnection`과 비교하면 책임이 훨씬 깔끔하게 나뉘어 있습니다.

## 기본 GET 요청

코드로 보면 그 명료함이 바로 드러납니다.

```java
import java.net.http.*;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();   // 재사용할 클라이언트

HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create("https://api.example.com/users"))
        .header("Accept", "application/json")
        .timeout(Duration.ofSeconds(5))
        .GET()
        .build();

HttpResponse<String> response =
        client.send(request, HttpResponse.BodyHandlers.ofString());

System.out.println(response.statusCode());
System.out.println(response.body());
```

`HttpURLConnection`의 장황함과 비교해 보면 차이가 분명합니다. 오류 스트림을 따로 읽을 필요도 없고, 상태 코드가 무엇이든 `response.body()`로 본문을 일관되게 읽습니다. 빌더로 요청을 조립하므로 헤더를 여러 개 추가하거나 타임아웃을 거는 것도 메서드 체이닝으로 자연스럽습니다.

## BodyHandlers — 본문을 어떤 타입으로 받을까

`send`의 두 번째 인자인 `BodyHandler`는 응답 본문을 **어떤 형태로 받을지** 를 결정합니다. 이것이 `HttpResponse<T>`의 타입 `T`를 정합니다.

```java
// 문자열로
HttpResponse<String> r1 =
    client.send(req, HttpResponse.BodyHandlers.ofString());

// 파일로 바로 저장
HttpResponse<Path> r2 =
    client.send(req, HttpResponse.BodyHandlers.ofFile(Path.of("out.json")));

// 바이트 배열로
HttpResponse<byte[]> r3 =
    client.send(req, HttpResponse.BodyHandlers.ofByteArray());
```

응답을 문자열로 받을지, 파일로 곧장 저장할지, 바이트 배열이나 스트림으로 받을지를 호출 지점에서 선택합니다. 큰 파일을 내려받을 때 메모리에 전부 올리지 않고 곧장 파일로 흘려보낼 수 있다는 점이 특히 유용합니다.

## POST와 본문 전송

본문을 보내는 일도 `BodyPublishers`로 대칭적으로 표현됩니다. 받는 쪽이 `BodyHandlers`라면, 보내는 쪽은 `BodyPublishers`입니다.

```java
HttpRequest post = HttpRequest.newBuilder()
        .uri(URI.create("https://api.example.com/users"))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString("{\"name\":\"홍길동\"}"))
        .build();

HttpResponse<String> res =
        client.send(post, HttpResponse.BodyHandlers.ofString());
```

문자열뿐 아니라 파일(`ofFile`), 바이트 배열(`ofByteArray`) 등을 본문으로 보낼 수 있어, GET과 POST가 동일한 빌더 흐름으로 일관되게 다뤄집니다.

## 동기와 비동기 — 한 클라이언트로 둘 다

새 API의 가장 큰 진전 중 하나는 **비동기 호출** 을 표준으로 지원한다는 점입니다. `send()`는 응답이 올 때까지 호출 스레드를 블로킹하지만, `sendAsync()`는 즉시 `CompletableFuture`를 돌려주고 응답은 나중에 콜백으로 처리합니다.

![동기 send vs 비동기 sendAsync](/assets/posts/java-http-client-11-sync-async.svg)

```java
client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
      .thenApply(HttpResponse::body)
      .thenAccept(System.out::println)
      .exceptionally(e -> { e.printStackTrace(); return null; });

System.out.println("요청을 보내고 즉시 다음 일을 한다");
```

`sendAsync`는 호출 즉시 반환되므로 메인 흐름이 막히지 않습니다. 응답이 도착하면 `thenApply`·`thenAccept`로 연결한 처리가 이어지고, 오류는 `exceptionally`로 다룹니다. 앞선 동시성 편에서 배운 `CompletableFuture`가 그대로 활용되는 것입니다. 여러 URL을 동시에 호출하고 결과를 모으는 작업도 `CompletableFuture.allOf`로 자연스럽게 표현됩니다.

## HTTP/2와 그 너머

새 `HttpClient`는 **HTTP/2를 기본 지원** 합니다. 별도 설정 없이도 서버가 HTTP/2를 지원하면 그 프로토콜로 통신하고, 그렇지 않으면 자동으로 HTTP/1.1로 떨어집니다. 연결 다중화 덕분에 같은 서버로의 여러 요청이 하나의 연결을 효율적으로 공유합니다. 빌더에서 `version(HttpClient.Version.HTTP_2)`로 명시할 수도 있습니다. 이처럼 현대 프로토콜 지원이 라이브러리 안에 녹아 있다는 점이 구식 `HttpURLConnection`과의 결정적 차이입니다.

## 정리

Java 11의 `HttpClient`는 빌더 기반의 명료한 API로, 호출자(`HttpClient`)·요청(`HttpRequest`)·응답(`HttpResponse<T>`)의 역할을 깔끔히 분리했습니다. `BodyHandlers`로 응답을, `BodyPublishers`로 요청 본문을 다루며, `send`로 동기 호출을, `sendAsync`로 `CompletableFuture` 기반 비동기 호출을 같은 클라이언트에서 선택할 수 있습니다. HTTP/2를 기본 지원하므로, 이제 외부 라이브러리 없이도 현대적인 HTTP 통신이 가능합니다. 지금까지는 요청-응답의 단발성 통신을 봤다면, 다음 글에서는 연결을 열어 둔 채 양방향으로 메시지를 주고받는 WebSocket을 살펴봅니다.

---

**지난 글:** [HttpURLConnection — 표준 라이브러리로 HTTP 호출하기](/posts/java-http-url-connection/)

**다음 글:** [WebSocket — 양방향 실시간 통신](/posts/java-websocket/)

<br>
읽어주셔서 감사합니다. 😊
