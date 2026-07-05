---
title: "JWT — jjwt로 토큰 기반 인증 구현하기"
description: "JWT(JSON Web Token)의 구조와 토큰 기반 인증의 원리를 이해하고, jjwt 라이브러리로 토큰을 발급·검증하는 코드를 작성합니다. 서명 알고리즘 선택, 만료·클레임 검증, alg=none 공격 방어 등 실무에서 반드시 지켜야 할 보안 원칙을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-07-05"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "보안", "JWT", "jjwt", "인증", "토큰"]
featured: false
draft: false
---

[지난 글](/posts/java-tls-keystore/)에서 TLS로 전송 구간을 보호하는 방법을 다뤘다. 전송이 안전해졌으니 이제 "이 요청을 보낸 사람이 누구인가"를 판단하는 인증 계층으로 올라간다. 현대 웹·모바일 API에서 가장 널리 쓰이는 무상태 인증 방식이 **JWT(JSON Web Token)** 다. 이번 글에서는 JWT의 구조를 이해하고, Java 생태계의 표준 라이브러리인 **jjwt** 로 토큰을 발급·검증하는 코드를 작성한다.

## JWT의 구조

JWT는 점(`.`)으로 구분된 세 조각의 Base64URL 문자열이다. 각 조각은 헤더·페이로드·서명이다.

![JWT의 3부분 구조](/assets/posts/java-jwt-jjwt-structure.svg)

여기서 가장 중요한 개념 하나. **페이로드는 암호화가 아니라 서명일 뿐이다.** Base64는 인코딩이지 암호화가 아니므로 누구나 페이로드를 디코딩해 내용을 볼 수 있다. 서명이 보장하는 것은 오직 무결성 — "이 토큰이 발급 이후 변조되지 않았다"는 사실뿐이다. 따라서 비밀번호나 주민번호 같은 민감 정보를 페이로드에 넣으면 안 된다.

## 왜 무상태 인증인가

전통적인 세션 방식은 서버가 세션 저장소에 로그인 상태를 보관하고, 클라이언트는 세션 ID만 들고 다닌다. JWT는 반대다. 서버가 서명한 토큰 안에 사용자 정보를 담아 클라이언트에게 넘기고, 서버는 아무것도 저장하지 않는다.

![JWT 기반 인증 흐름](/assets/posts/java-jwt-jjwt-flow.svg)

이후 모든 요청에서 클라이언트는 `Authorization: Bearer <JWT>` 헤더로 토큰을 보내고, 서버는 **서명만 검증** 하면 된다. 세션 저장소가 필요 없으니 수평 확장이 쉽고, 마이크로서비스 간에도 토큰 하나로 신원을 전달할 수 있다. 대신 발급된 토큰을 서버가 즉시 무효화하기 어렵다는 트레이드오프가 있다(그래서 만료 시간을 짧게 두고 리프레시 토큰을 함께 쓴다).

## jjwt로 토큰 발급하기

`io.jsonwebtoken:jjwt` 는 Java에서 가장 널리 쓰이는 JWT 라이브러리다. HS256(대칭)으로 서명하는 예를 보자. 비밀키는 알고리즘이 요구하는 최소 길이(HS256은 256비트=32바이트)를 만족해야 한다.

```java
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

// 256비트 이상 비밀키 (실무에선 환경변수·KeyStore에서 로드)
SecretKey key = Keys.hmacShaKeyFor(secretBytes); // 32바이트 이상

Instant now = Instant.now();
String jwt = Jwts.builder()
        .subject("u42")                         // sub 클레임
        .issuer("paldyn-auth")                  // iss 클레임
        .claim("role", "ADMIN")                 // 커스텀 클레임
        .issuedAt(Date.from(now))               // iat
        .expiration(Date.from(now.plus(15, ChronoUnit.MINUTES))) // exp
        .signWith(key)                          // 서명
        .compact();
```

만료 시간(`exp`)을 반드시 설정한다. 만료가 없는 토큰은 유출되면 영원히 유효해 매우 위험하다. 액세스 토큰은 15분~1시간처럼 짧게, 재발급용 리프레시 토큰은 별도로 관리한다.

## 토큰 검증하기

검증은 발급보다 더 중요하다. 서명 검증 실패, 만료, 변조를 모두 잡아내야 한다. jjwt는 파싱 과정에서 이 검증을 예외로 처리한다.

```java
import io.jsonwebtoken.*;

try {
    Jws<Claims> jws = Jwts.parser()
            .verifyWith(key)          // 서명 검증에 사용할 키를 명시
            .requireIssuer("paldyn-auth") // iss 불일치 시 예외
            .build()
            .parseSignedClaims(token); // 서명·만료 자동 검증

    Claims claims = jws.getPayload();
    String userId = claims.getSubject();
    String role = claims.get("role", String.class);
    // 인가 로직에 활용
} catch (ExpiredJwtException e) {
    // 만료된 토큰 → 401 + 재발급 유도
} catch (JwtException e) {
    // 서명 불일치·변조·형식 오류 → 401
}
```

`parseSignedClaims` 는 서명이 일치하지 않거나 `exp` 가 지났으면 예외를 던진다. **직접 페이로드를 디코딩해 신뢰하면 절대 안 된다.** 반드시 라이브러리의 검증 경로를 거쳐야 한다.

## 반드시 피해야 할 보안 함정

JWT는 잘못 쓰면 오히려 큰 구멍이 된다. 실무에서 반복되는 취약점은 다음과 같다.

| 함정 | 문제 | 방어 |
|------|------|------|
| `alg: none` 허용 | 서명 없는 토큰을 유효로 처리 | 허용 알고리즘을 명시적으로 고정 |
| 약한 비밀키 | 짧거나 추측 가능한 키는 무차별 대입에 뚫림 | 256비트 이상 랜덤 키 |
| 만료 미설정 | 유출 토큰이 영구 유효 | `exp` 필수, 짧은 수명 |
| 민감 정보 저장 | 페이로드는 누구나 열람 가능 | 식별자·역할만, 비밀 금지 |
| 검증 없이 신뢰 | 클라이언트가 조작한 클레임 사용 | 항상 서명 검증 후 사용 |

특히 **`alg: none` 공격** 은 고전적이다. 공격자가 헤더의 알고리즘을 `none` 으로 바꾸고 서명을 비우면, 검증을 느슨하게 구현한 서버는 이를 통과시킨다. jjwt 최신 버전은 기본적으로 이를 거부하지만, 검증 시 `verifyWith(key)` 로 기대하는 키를 명시해 방어를 이중으로 걸어두는 것이 안전하다.

## 정리

- JWT는 **헤더·페이로드·서명** 세 조각으로 구성되며, 페이로드는 암호화가 아니라 서명일 뿐이다.
- 서버가 상태를 저장하지 않는 **무상태 인증** 으로 확장성이 좋지만, 즉시 무효화가 어렵다는 트레이드오프가 있다.
- jjwt로 발급할 때 **`exp` 만료를 필수** 로 두고, 검증할 때 **서명·발급자·만료** 를 모두 확인한다.
- `alg: none`, 약한 키, 민감 정보 저장 같은 함정을 피한다.

다음 글에서는 인증을 통과한 요청이 보내오는 **입력 데이터를 안전하게 검증** 하는 방법을 다룬다.

---

**지난 글:** [TLS와 KeyStore — Java 전송 구간 보안](/posts/java-tls-keystore/)

**다음 글:** [입력 검증 — 신뢰할 수 없는 데이터 다루기](/posts/java-input-validation/)

<br>
읽어주셔서 감사합니다. 😊
