---
title: "TLS와 KeyStore — Java 전송 구간 보안"
description: "Java에서 TLS로 전송 구간을 보호하는 방법을 다룹니다. TLS 핸드셰이크의 흐름, KeyStore와 TrustStore의 차이, keytool로 인증서를 관리하는 법, JSSE로 HTTPS 클라이언트를 구성하고 인증서 검증을 올바르게 다루는 실전 코드를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-07-05"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "보안", "TLS", "SSL", "KeyStore", "JSSE"]
featured: false
draft: false
---

[지난 글](/posts/java-cryptography-jca/)에서 JCA로 해시·대칭·비대칭 암호를 다뤘다. 이 암호 기술이 실제 네트워크에서 데이터를 지키는 방식이 **TLS(Transport Layer Security)** 다. 이번 글에서는 Java의 JSSE(Java Secure Socket Extension)로 전송 구간을 암호화하는 원리와, 그 중심에 있는 **KeyStore·TrustStore** 를 다룬다. `https://`로 시작하는 모든 통신 뒤에는 이 메커니즘이 있다.

## TLS는 무엇을 해결하는가

평문으로 데이터를 주고받으면 세 가지 위험에 노출된다. 중간자가 내용을 엿보고(기밀성 상실), 변조하고(무결성 상실), 심지어 서버인 척 위장(인증 실패)할 수 있다. TLS는 핸드셰이크 과정에서 이 셋을 한꺼번에 해결한다.

![TLS 핸드셰이크 흐름](/assets/posts/java-tls-keystore-handshake.svg)

핵심은 2번과 3번 단계다. 서버는 자신의 **인증서(공개키가 담긴)** 를 보내고, 클라이언트는 그 인증서가 신뢰할 수 있는 CA(인증기관)가 서명한 것인지 검증한다. 검증에 통과해야만 이후 키 교환으로 넘어가 세션 키를 합의하고, 그때부터 모든 데이터는 대칭 암호로 보호된다. 지난 글에서 본 비대칭 암호(인증서 서명 검증·키 교환)와 대칭 암호(실제 데이터 보호)가 여기서 함께 쓰인다.

## KeyStore와 TrustStore

Java에서 인증서와 키를 다룰 때 가장 헷갈리는 지점이 이 두 저장소의 구분이다. 이름이 비슷하지만 담는 것과 역할이 정반대다.

![KeyStore vs TrustStore](/assets/posts/java-tls-keystore-stores.svg)

**KeyStore** 는 내 개인키와 인증서를 담아 "나는 누구인가"를 증명한다. 서버가 자신을 인증할 때 쓰며, 개인키가 들어 있으므로 절대 유출되면 안 된다. 반면 **TrustStore** 는 신뢰하는 CA의 인증서(공개키만)를 담아 "상대를 믿을지"를 판단한다. JVM은 이미 주요 CA를 담은 기본 TrustStore(`$JAVA_HOME/lib/security/cacerts`)를 갖고 있어서, 공개 웹사이트에 HTTPS로 접속할 때는 별도 설정이 필요 없다.

## keytool로 인증서 관리하기

JDK에 포함된 `keytool` 로 KeyStore를 만들고 인증서를 다룰 수 있다. 현대 Java에서는 독점 형식인 JKS 대신 표준 **PKCS12** 형식을 권장한다.

```bash
# PKCS12 KeyStore에 자체 서명 키 쌍 생성 (개발용)
keytool -genkeypair -alias myserver \
  -keyalg RSA -keysize 2048 -validity 365 \
  -storetype PKCS12 -keystore server.p12 \
  -dname "CN=localhost, OU=Dev, O=PALDYN, C=KR"

# 저장된 항목 확인
keytool -list -v -keystore server.p12 -storetype PKCS12

# 상대방 인증서를 TrustStore에 신뢰 항목으로 추가
keytool -importcert -alias partner \
  -file partner.crt -keystore truststore.p12 -storetype PKCS12
```

운영 환경에서는 자체 서명 인증서 대신 Let's Encrypt 같은 CA가 발급한 인증서를 써야 브라우저와 클라이언트가 경고 없이 신뢰한다.

## JSSE로 HTTPS 통신하기

Java 11부터는 표준 `HttpClient` 가 기본적으로 TLS를 처리한다. 대부분의 경우 아무 설정 없이도 안전하게 동작한다.

```java
import java.net.http.*;
import java.net.URI;
import javax.net.ssl.SSLContext;

// 기본 SSLContext는 JVM의 cacerts TrustStore를 사용
HttpClient client = HttpClient.newBuilder()
        .sslContext(SSLContext.getDefault())  // 명시 안 해도 동일
        .build();

HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create("https://api.example.com/data"))
        .build();

HttpResponse<String> response =
        client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.statusCode());
```

사설 CA나 자체 서명 인증서를 신뢰해야 한다면, 커스텀 TrustStore를 로드해 `SSLContext` 를 구성한다.

```java
import javax.net.ssl.*;
import java.security.KeyStore;
import java.io.FileInputStream;

KeyStore trustStore = KeyStore.getInstance("PKCS12");
try (var in = new FileInputStream("truststore.p12")) {
    trustStore.load(in, "changeit".toCharArray());
}

TrustManagerFactory tmf =
        TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
tmf.init(trustStore);

SSLContext ctx = SSLContext.getInstance("TLS");
ctx.init(null, tmf.getTrustManagers(), null);

HttpClient client = HttpClient.newBuilder().sslContext(ctx).build();
```

## 절대 하면 안 되는 것: 인증서 검증 우회

개발 중 인증서 오류를 만나면, 검색 결과에서 "모든 인증서를 신뢰하는 TrustManager"를 복사해 붙이고 싶은 유혹에 빠진다. 이것은 TLS의 인증 기능을 통째로 무력화하는 것으로, 중간자 공격에 완전히 노출된다.

```java
// ❌ 절대 금지 — TLS를 무력화하는 코드
TrustManager[] trustAll = new TrustManager[] {
    new X509TrustManager() {
        public void checkClientTrusted(X509Certificate[] c, String a) {}
        public void checkServerTrusted(X509Certificate[] c, String a) {} // 아무 검증도 안 함!
        public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
    }
};
// 이 코드가 운영에 배포되면 https는 http만큼 안전하지 않다
```

올바른 해법은 검증을 끄는 게 아니라, **필요한 인증서를 TrustStore에 정식으로 추가하는 것** 이다. 개발용 자체 서명 인증서라도 위의 `keytool -importcert` 로 TrustStore에 넣으면 검증을 유지한 채 통신할 수 있다.

## 정리

- TLS는 핸드셰이크에서 **인증서 검증 → 키 합의 → 암호화 통신** 순으로 기밀성·무결성·인증을 한 번에 확보한다.
- **KeyStore**(내 개인키, "나를 증명")와 **TrustStore**(신뢰 CA, "상대를 판단")는 역할이 정반대다.
- `keytool` 로 PKCS12 저장소를 관리하고, 운영에서는 CA 발급 인증서를 쓴다.
- 인증서 검증을 우회하는 "trust-all" 코드는 TLS를 무력화하므로 절대 배포하지 않는다.

다음 글에서는 애플리케이션 계층의 인증·인가에서 널리 쓰이는 **JWT** 를 jjwt 라이브러리로 다룬다.

---

**지난 글:** [JCA — Java 암호화 아키텍처](/posts/java-cryptography-jca/)

**다음 글:** [JWT — jjwt로 토큰 기반 인증 구현하기](/posts/java-jwt-jjwt/)

<br>
읽어주셔서 감사합니다. 😊
