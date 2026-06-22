---
title: "HttpURLConnection — 표준 라이브러리로 HTTP 호출하기"
description: "HttpURLConnection은 외부 의존성 없이 HTTP를 호출하는 자바의 전통적 API입니다. HTTP 메시지의 구조, openConnection부터 응답 읽기까지의 4단계, GET·POST 호출법, 그리고 이 API의 오래된 불편함과 Java 11 HttpClient로의 전환 배경을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-23"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "HTTP", "HttpURLConnection", "네트워크", "REST"]
featured: false
draft: false
---

[지난 글](/posts/java-server-socket/)에서 소켓으로 서버를 여는 법까지 봤습니다. 소켓은 강력하지만 너무 저수준입니다. 실무에서 우리가 정말 자주 하는 일은 "어떤 주소로 HTTP 요청을 보내고 응답을 받는 것"인데, 이를 위해 매번 소켓을 열고 HTTP 메시지를 직접 조립할 수는 없습니다. 자바는 이 흔한 작업을 위해 표준 라이브러리에 `HttpURLConnection`을 오래전부터 담아 두었습니다. 이번 글에서는 외부 라이브러리 없이 HTTP를 호출하는 이 전통적 API를 살펴봅니다.

## HTTP는 소켓 위의 텍스트 약속

`HttpURLConnection`을 이해하려면 먼저 HTTP가 무엇인지 한 겹 벗겨 봐야 합니다. HTTP는 거창한 무엇이 아니라, **TCP 소켓 위로 주고받는 약속된 형식의 텍스트 메시지** 입니다. 요청은 "시작줄 + 헤더들 + 빈 줄 + 본문" 구조이고, 응답도 "상태줄 + 헤더들 + 빈 줄 + 본문" 구조입니다.

![HTTP는 소켓 위를 흐르는 텍스트 메시지다](/assets/posts/java-http-url-connection-message.svg)

이론적으로는 지난 글의 소켓만으로도 이 텍스트를 직접 써서 보내고 응답을 파싱할 수 있습니다. 하지만 헤더 처리, 청크 인코딩, 리다이렉트, 연결 재사용 같은 세부 사항이 만만치 않습니다. `HttpURLConnection`은 바로 이 텍스트 메시지의 조립과 해석을 대신해 주는, HTTP에 특화된 한 단계 높은 추상화입니다.

## 호출의 4단계

`HttpURLConnection`을 쓰는 흐름은 항상 비슷한 4단계를 따릅니다. 먼저 `URL`에서 연결 객체를 열고, 요청을 설정하고, 실제로 연결해 전송하고, 응답을 읽습니다.

![HttpURLConnection — 호출의 4단계](/assets/posts/java-http-url-connection-flow.svg)

여기서 가장 헷갈리기 쉬운 지점은 **언제 실제 통신이 일어나는가** 입니다. `openConnection()`은 아직 네트워크를 건드리지 않고 설정용 객체만 만듭니다. 메서드·헤더·타임아웃 같은 설정은 이 시점에 모두 끝내야 합니다. 실제 요청은 `getResponseCode()`나 `getInputStream()`을 호출하는 순간 발생합니다. 그래서 "연결 후 설정"은 불가능하고, 항상 "설정 후 연결" 순서를 지켜야 합니다.

## GET 요청

가장 단순한 GET 요청부터 보겠습니다.

```java
import java.net.HttpURLConnection;
import java.net.URI;

URI uri = URI.create("https://api.example.com/users");
HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();

conn.setRequestMethod("GET");
conn.setRequestProperty("Accept", "application/json");
conn.setConnectTimeout(3000);
conn.setReadTimeout(5000);

int status = conn.getResponseCode();   // 이 순간 실제 요청 전송
try (var in = new BufferedReader(
                  new InputStreamReader(conn.getInputStream()))) {
    String body = in.lines().collect(Collectors.joining("\n"));
    System.out.println(status + " : " + body);
}
conn.disconnect();
```

`setConnectTimeout`/`setReadTimeout`을 지정한 점에 주목하세요. 타임아웃을 설정하지 않으면 응답이 없는 서버에 무한정 매달릴 수 있으므로, 네트워크 호출에서는 거의 필수입니다. 응답을 다 읽으면 `disconnect()`로 정리합니다.

## POST 요청 — 본문 보내기

본문을 함께 보내는 POST는 한 가지 단계가 더 필요합니다. `setDoOutput(true)`로 출력을 켜고, 연결의 출력 스트림에 본문을 써 넣는 것입니다.

```java
HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
conn.setRequestMethod("POST");
conn.setRequestProperty("Content-Type", "application/json");
conn.setDoOutput(true);                // 본문을 보내겠다는 선언

String json = "{\"name\":\"홍길동\"}";
try (var os = conn.getOutputStream()) {
    os.write(json.getBytes(StandardCharsets.UTF_8));
}

int status = conn.getResponseCode();
System.out.println("응답 코드: " + status);
```

`getOutputStream()`에 본문을 쓰는 동안 요청 라인과 헤더가 함께 준비되고, `getResponseCode()`에서 전송이 마무리됩니다. 출력 스트림을 닫지 않으면 본문이 끝까지 전송되지 않을 수 있으므로 `try-with-resources`로 닫는 것이 안전합니다.

## 오류 응답을 읽는 함정

`HttpURLConnection`에는 초보자가 자주 빠지는 함정이 하나 있습니다. 응답 코드가 200대일 때는 `getInputStream()`으로 본문을 읽지만, **4xx·5xx 오류일 때 `getInputStream()`을 호출하면 `IOException`이 발생** 합니다. 오류 응답의 본문은 `getErrorStream()`으로 읽어야 합니다.

```java
int status = conn.getResponseCode();
InputStream stream = (status >= 400)
        ? conn.getErrorStream()      // 오류 본문은 여기서
        : conn.getInputStream();     // 정상 본문은 여기서
```

이런 비대칭적인 동작은 API가 직관적이지 않다는 점을 잘 보여줍니다. 상태 코드에 따라 스트림을 골라 읽어야 한다는 사실을 모르면, 오류 응답의 메시지를 영영 보지 못한 채 예외만 마주하게 됩니다.

## 왜 이제는 잘 쓰지 않을까

`HttpURLConnection`은 외부 의존성 없이 동작한다는 큰 장점이 있지만, API가 1990년대 설계 그대로라 여러모로 불편합니다. 설정과 실행이 뒤섞여 있고, 오류 스트림 처리가 비직관적이며, 비동기 호출이나 HTTP/2를 지원하지 않습니다. 한 번의 요청을 보내는 데에도 장황한 코드가 필요합니다. 이런 불편함 때문에 오랫동안 많은 프로젝트가 Apache HttpClient나 OkHttp 같은 외부 라이브러리를 써 왔고, 마침내 자바도 Java 11에서 현대적인 `HttpClient`를 표준에 들였습니다.

## 정리

`HttpURLConnection`은 외부 의존성 없이 HTTP를 호출하는 자바의 전통적 API로, HTTP라는 텍스트 메시지의 조립·해석을 대신해 줍니다. `openConnection`으로 연결 객체를 열어 설정을 끝낸 뒤 `getResponseCode`/`getInputStream`에서 실제 통신이 일어나며, POST는 `setDoOutput(true)`와 출력 스트림으로 본문을 보냅니다. 오류 응답은 `getErrorStream`으로 읽어야 한다는 함정이 있고, 전반적으로 API가 장황하고 구식이라 오늘날에는 권장되지 않습니다. 다음 글에서는 이 불편함을 해소하기 위해 등장한 Java 11의 현대적 `HttpClient`를 살펴봅니다.

---

**지난 글:** [ServerSocket — 자바로 서버를 여는 법](/posts/java-server-socket/)

**다음 글:** [Java 11 HttpClient — 현대적인 HTTP 클라이언트](/posts/java-http-client-11/)

<br>
읽어주셔서 감사합니다. 😊
