---
title: "HTTP 인증 스킴 심화 — Digest부터 WWW-Authenticate까지"
description: "WWW-Authenticate·Authorization 헤더 구조, IANA 등록 스킴, Digest 인증의 nonce·qop 동작 원리와 한계, 여러 challenge 선택, 보안 고려까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["HTTP인증", "Digest인증", "WWWAuthenticate", "인증스킴", "nonce", "ProxyAuthenticate", "토큰68"]
featured: false
draft: false
---

[지난 글](/posts/http-authentication-basic-bearer/)에서 Basic과 Bearer 두 가지 기본 인증 스킴을 살펴봤다. 이번 글에서는 그 두 스킴이 올라타는 **인증 프레임워크 자체**를 깊게 파헤친다. HTTP 인증은 사실 특정 스킴에 묶인 기능이 아니라, `WWW-Authenticate`와 `Authorization` 헤더가 만드는 challenge-response 골격 위에서 여러 스킴이 플러그인처럼 동작하는 확장 가능한 체계다. Digest가 왜 설계됐고 왜 거의 사라졌는지, 서버가 여러 스킴을 동시에 제시할 때 클라이언트가 무엇을 고르는지, realm과 token68 문법이 무엇인지까지 RFC 9110 기준으로 정리한다.

## 인증은 헤더 4종으로 굴러간다

HTTP 인증의 전체 그림은 단 네 개의 헤더로 요약된다. 서버가 보호된 리소스에 인증 없는 요청을 받으면 `401 Unauthorized`와 함께 `WWW-Authenticate` 헤더로 **challenge**를 보낸다. 클라이언트는 자격 증명을 만들어 `Authorization` 헤더에 담아 재요청한다. 프록시 단계에서 인증이 필요하면 `407 Proxy Authentication Required`와 `Proxy-Authenticate` / `Proxy-Authorization` 쌍이 똑같은 역할을 한다.

![HTTP 인증 헤더 맵 — 401 vs 407, 서버 challenge와 클라이언트 credential 흐름](/assets/posts/http-auth-schemes-headers.svg)

여기서 가장 자주 헷갈리는 지점이 **401 vs 407**이다. 둘 다 "인증이 필요하다"는 뜻이지만 주체가 다르다.

- **401 + `WWW-Authenticate`**: origin 서버 자신이 요청자를 인증하려 한다. credential은 `Authorization`에 담겨 end-to-end로 전달된다.
- **407 + `Proxy-Authenticate`**: 중간 프록시가 인증을 요구한다. credential은 `Proxy-Authorization`에 담기며 **hop-by-hop**이라 다음 홉으로 전달되지 않는다.

네 번째 헤더인 `Authentication-Info`는 인증 성공 후 `2xx` 응답에 동봉되어 서버가 다음 라운드용 `nextnonce`나 상호 인증용 `rspauth` 같은 후속 정보를 클라이언트에 돌려줄 때 쓴다. 주로 Digest 인증에서 등장한다.

## challenge와 credential의 문법

`WWW-Authenticate` 헤더 값은 하나 이상의 challenge로 구성되고, 각 challenge는 `scheme` 토큰 뒤에 token68 형태이거나 쉼표로 구분된 `parameter=value` 목록이 온다.

```http
WWW-Authenticate: Basic realm="Access to staging"
WWW-Authenticate: Bearer realm="api", error="invalid_token"
WWW-Authenticate: Digest realm="api",
    qop="auth", nonce="dcd98b7102dd2f0e", algorithm=SHA-256
```

- **`realm`**: 보호 공간(protection space)을 식별하는 문자열. 같은 origin 안에서도 realm이 다르면 별개의 자격 증명 영역이다. 사용자에게 "어느 영역에 로그인하는지" 알려주는 라벨 역할을 한다.
- **token68**: `Bearer eyJ...`처럼 파라미터 목록 대신 한 덩어리 토큰을 쓰는 문법. 이름은 허용 문자 집합(A-Z a-z 0-9 `-._~+/`와 끝의 `=` 패딩) 68가지에서 왔다. Base64/Base64url 토큰을 그대로 싣기 위한 형식이다.

`Authorization` 헤더도 같은 문법을 따른다. Basic은 token68(`Basic dXNlcjpwYXNz`), Bearer도 token68, Digest는 파라미터 목록을 쓴다.

## IANA 등록 스킴 개요

인증 스킴은 IANA의 "HTTP Authentication Schemes" 레지스트리에 등록된다. 주요 스킴은 다음과 같다.

| 스킴 | 핵심 | 비고 |
|---|---|---|
| `Basic` | `base64(user:pass)` | 평문 수준, HTTPS 필수 |
| `Bearer` | OAuth 2.0 액세스 토큰 | 현대 API의 사실상 표준 |
| `Digest` | nonce 기반 해시 다이제스트 | 거의 사용 안 됨 |
| `Negotiate` | SPNEGO(Kerberos/NTLM) | 윈도우 도메인 환경 |
| `HOBA` | 공개키 서명 기반 | 채택 거의 없음 |
| `SCRAM-SHA-256` | salted challenge-response | 주로 DB/SASL에서 |

`Negotiate`는 SPNEGO를 통해 Kerberos 티켓이나 NTLM을 실어 윈도우 기업망 SSO에 쓰인다. `HOBA`(HTTP Origin-Bound Auth)는 비밀번호 대신 공개키 서명을 쓰자는 제안이고, `SCRAM`은 PostgreSQL·MongoDB 같은 곳의 SASL 메커니즘으로 더 유명하다. 실무 웹에서는 사실상 Bearer가 지배적이다.

## Digest 인증 — 왜 만들었고 왜 안 쓰나

Digest는 Basic의 치명적 약점, 즉 비밀번호가 네트워크에 base64로 거의 평문 노출된다는 문제를 풀기 위해 나왔다. 핵심 아이디어는 **비밀번호를 직접 보내지 않고, 비밀번호를 안다는 사실만 해시로 증명**하는 challenge-response다.

![Digest 인증 흐름 — 서버 nonce 발급, 클라이언트 다이제스트 계산, 서버 검증과 replay 방지](/assets/posts/http-auth-schemes-digest.svg)

흐름은 세 단계다. 먼저 서버가 `401`과 함께 일회성 난수 `nonce`를 발급한다. 클라이언트는 다음을 계산한다.

```text
A1       = H(username:realm:password)
A2       = H(method:requestURI)
response = H(A1:nonce:nc:cnonce:qop:A2)
```

여기서 `H`는 `algorithm`이 지정한 해시(레거시 `MD5`, 권장 `SHA-256`)다. 계산한 `response` 다이제스트를 `Authorization: Digest ...`에 담아 보내면, 서버는 저장해 둔 비밀번호로 같은 계산을 수행해 일치 여부를 검증한다. 비밀번호 자체는 한 번도 회선을 타지 않는다.

**replay 방지**는 세 요소의 조합으로 이뤄진다. 서버가 매번 다른 `nonce`를 주고, 클라이언트가 `cnonce`(client nonce)를 더하며, `nc`(nonce-count)를 매 요청마다 증가시킨다. 따라서 공격자가 가로챈 `response`를 그대로 재전송해도 `nc`가 어긋나 거부된다. `qop=auth-int`를 쓰면 본문까지 해시에 포함해 무결성도 보장한다.

그런데도 Digest는 현장에서 거의 자취를 감췄다. 이유는 다음과 같다.

- **HTTPS가 전제를 무너뜨린다.** TLS가 보편화되면서 "평문 비밀번호 노출 방지"라는 Digest의 존재 이유가 약해졌다. HTTPS 위에서는 Basic + Bearer로 충분하다.
- **서버가 평문 동등 비밀번호를 알아야 한다.** 검증하려면 `H(user:realm:pass)`를 계산할 수 있어야 하므로, 서버는 비밀번호 평문이나 그와 동등한 값을 보관해야 한다. bcrypt 같은 단방향 해시 저장 관행과 충돌한다.
- **MD5 약점과 구현 복잡성.** 기본 알고리즘이 오래도록 MD5였고, `qop`·`nc`·`cnonce` 상태 관리가 까다로워 구현·운영 부담이 크다.
- **현대 인증 흐름과 안 맞는다.** SSO, 토큰 만료/갱신, 스코프 같은 OAuth 2.0 요구사항을 표현할 수 없다.

결국 "TLS로 채널을 보호하고 그 위에 Bearer 토큰을 얹는" 모델이 Digest의 자리를 대체했다.

## 여러 challenge를 동시에 줄 때

서버는 한 응답에 여러 스킴을 제시해 클라이언트가 가장 강한 것을 고르게 할 수 있다. `WWW-Authenticate`를 여러 줄로 보내거나 쉼표로 이어 붙인다.

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Digest realm="api", qop="auth",
    nonce="abc123", algorithm=SHA-256
WWW-Authenticate: Basic realm="api"
```

클라이언트는 자신이 지원하는 스킴 중 **가장 안전한 것을 선택**해야 한다(RFC 9110 권고). 위 예시라면 Digest가 가능한 클라이언트는 Digest를, 아니면 Basic으로 떨어진다. 같은 Digest라도 `algorithm`이 `SHA-256`과 `MD5`로 둘 다 제시되면 SHA-256을 우선한다. 주의할 점은 challenge 파싱이 까다롭다는 것인데, 파라미터 값에 쉼표가 들어가면 challenge 경계와 헷갈릴 수 있어 견고한 파서가 필요하다.

## 보안 고려 — 스킴별 한계와 HTTPS 전제

모든 HTTP 인증 스킴의 대전제는 **전송 계층 보안(HTTPS)**이다. 스킴별로 짚으면 다음과 같다.

- **Basic**: base64는 인코딩일 뿐 암호화가 아니다. HTTPS 없이는 비밀번호가 사실상 평문이다. 반드시 TLS 위에서만.
- **Bearer**: 토큰을 가진 자가 곧 권한자(bearer)다. 토큰이 유출되면 그대로 도용되므로 짧은 만료, 스코프 제한, `Authorization` 헤더 전송(URL 쿼리에 절대 싣지 않기)이 중요하다.
- **Digest**: replay는 막지만 서버의 비밀번호 보관 방식 문제와 MD5 약점이 남는다. TLS가 있다면 굳이 선택할 이유가 적다.
- **공통**: 인증 응답은 캐시되지 않도록 주의하고, realm·nonce를 통한 정보 노출을 최소화하며, 다운그레이드 공격(강한 스킴 무력화 후 약한 스킴 유도)을 경계해야 한다.

요약하면, HTTP 인증은 헤더 4종이 만드는 challenge-response 프레임워크이고, 그 위에서 Basic·Bearer·Digest·Negotiate 등이 플러그인처럼 동작한다. Digest는 TLS 이전 시대의 영리한 해법이었지만, 오늘날의 정답은 "HTTPS로 채널을 지키고 그 위에 토큰 기반 인증을 얹는 것"이다.

---

**지난 글:** [HTTP 인증 — Basic과 Bearer](/posts/http-authentication-basic-bearer/)

**다음 글:** [OAuth 2.0을 HTTP 레벨에서 보기](/posts/http-oauth-http-level/)

<br>
읽어주셔서 감사합니다. 😊
