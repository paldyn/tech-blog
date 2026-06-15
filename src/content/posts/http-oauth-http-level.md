---
title: "OAuth 2.0을 HTTP 레벨에서 보기"
description: "OAuth 2.0을 추상 개념이 아니라 실제 주고받는 HTTP 요청·응답으로 추적하며, Authorization Code + PKCE 흐름의 각 단계와 토큰 교환을 해부합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["OAuth", "PKCE", "AuthorizationCode", "BearerToken", "RefreshToken", "인가", "HTTP"]
featured: false
draft: false
---

[지난 글](/posts/http-authentication-schemes-deep/)에서 `WWW-Authenticate`와 Digest 같은 HTTP 자체 인증 스킴을 다뤘다. 그런데 "구글로 로그인", "깃허브로 로그인" 버튼을 누를 때 일어나는 일은 그 스킴들과 다르다. 여기서 등장하는 것이 **OAuth 2.0**이다. OAuth는 흔히 추상적인 다이어그램으로 설명되지만, 본질은 결국 **여러 번의 HTTP 요청과 응답**이다. 이번 글에서는 개념어를 최소화하고, 브라우저와 서버 사이를 실제로 오가는 메시지를 따라가며 OAuth를 읽어 본다.

## OAuth는 인증이 아니라 인가 위임이다

가장 먼저 못 박을 것. OAuth 2.0은 **인증(authentication)** 프로토콜이 아니라 **인가(authorization) 위임** 프로토콜이다. "당신이 누구인가"를 증명하는 게 아니라, "이 앱이 당신을 대신해 어떤 자원에 접근해도 되는가"에 대한 **동의를 위임**받는 절차다.

예를 들어 사진 인쇄 서비스가 "당신의 구글 포토를 읽게 해 주세요"라고 요청하면, 사용자는 구글에 로그인한 뒤 "읽기 권한만 허용"에 동의한다. 인쇄 서비스는 사용자의 구글 비밀번호를 절대 보지 못한다. 대신 **제한된 권한을 가진 토큰**을 받는다. 이것이 위임의 핵심이다.

## 네 개의 역할

HTTP 메시지를 보기 전에 누가 주고받는지부터 정리하자.

```
Resource Owner   자원의 주인 (= 사용자)
Client           자원에 접근하려는 앱 (사진 인쇄 서비스)
Authorization    동의를 받고 토큰을 발급하는 서버
  Server         (구글 계정 서버)
Resource Server  실제 자원을 가진 API 서버 (구글 포토 API)
```

OAuth의 모든 메시지는 이 넷 사이에서 오간다. Client는 Authorization Server에서 토큰을 받고, 그 토큰을 들고 Resource Server에 접근한다.

## Authorization Code + PKCE 흐름 전체

오늘날 웹·모바일·SPA에서 권장되는 표준 흐름은 **Authorization Code Grant**이며, 여기에 가로채기 공격을 막는 **PKCE**(Proof Key for Code Exchange)를 더한다. 전체 HTTP 메시지 순서는 다음과 같다.

![Authorization Code + PKCE 흐름의 HTTP 메시지 순서](/assets/posts/http-oauth-authcode-flow.svg)

핵심은 **코드(code)와 토큰(token)을 분리**한다는 점이다. 브라우저(프런트 채널)로는 한 번 쓰고 버리는 단기 `code`만 흐르고, 실제 `access_token`은 서버 간(백 채널) 통신으로만 교환된다. 토큰이 URL이나 브라우저 히스토리에 노출되지 않는다.

## 1단계: authorize 리다이렉트

사용자가 "로그인" 버튼을 누르면, Client는 사용자의 브라우저를 Authorization Server의 `/authorize`로 보낸다. 이때 모든 정보는 **쿼리 파라미터**로 실린다.

```http
GET /authorize?response_type=code
  &client_id=s6BhdRkqt3
  &redirect_uri=https://app.example.com/callback
  &scope=read%20profile
  &state=xyz123
  &code_challenge=E9Melhoa...
  &code_challenge_method=S256 HTTP/1.1
Host: auth.example.com
```

각 파라미터의 의미는 다음과 같다.

- `response_type=code` — Authorization Code 흐름을 요청한다는 선언.
- `client_id` — 어느 앱인지 식별. 공개값이다.
- `redirect_uri` — 결과를 돌려받을 주소. **사전 등록된 값과 정확히 일치**해야 한다.
- `scope` — 요청하는 권한 범위(예: `read profile`).
- `state` — CSRF 방지용 난수. 콜백에서 그대로 돌아왔는지 검증한다.
- `code_challenge` — PKCE용 값. Client가 만든 `code_verifier`를 SHA-256 해시한 것.

Authorization Server는 사용자에게 로그인 화면과 동의 화면을 보여준다. 여기서 일어나는 사용자 인증(authn)은 OAuth의 일부가 아니라 Authorization Server 내부의 일이다.

## 2단계: code 콜백

사용자가 동의하면, Authorization Server는 브라우저를 다시 Client의 `redirect_uri`로 돌려보낸다. 이때 사용되는 것이 **302 리다이렉트**이고, 발급된 `code`는 다시 쿼리 파라미터로 실린다.

```http
HTTP/1.1 302 Found
Location: https://app.example.com/callback?code=SplxlOBeZQ&state=xyz123
```

Client는 돌아온 `state`가 1단계에서 보낸 값과 같은지 먼저 검증한다. 다르면 공격으로 간주하고 중단한다. 이 `code`는 **수명이 짧고(보통 수십 초) 1회용**이다. 아직 자원에 접근할 수 없는, 토큰으로 바꿀 교환권일 뿐이다.

## 3단계: token endpoint 교환

이제 Client는 `code`를 진짜 토큰으로 바꾼다. 이 요청은 브라우저가 아니라 **Client 서버에서 직접**(back-channel) 보내며, 본문은 `application/x-www-form-urlencoded`다.

![token endpoint 요청과 JSON 응답](/assets/posts/http-oauth-token-exchange.svg)

요청과 응답을 코드로 보면 다음과 같다.

```http
POST /token HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=SplxlOBeZQ
&code_verifier=dBjftJeZ4CVP...
&redirect_uri=https://app.example.com/callback
&client_id=s6BhdRkqt3
```

`code_verifier`가 PKCE의 두 번째 절반이다. Authorization Server는 이 값을 SHA-256 해시해 1단계의 `code_challenge`와 비교한다. 일치해야만 토큰을 내준다. 그래서 누군가 `code`를 가로채도, 원본 `code_verifier`가 없으면 토큰으로 바꿀 수 없다.

응답은 JSON이다.

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "tGzv3JOkF0XG...",
  "scope": "read profile"
}
```

`token_type: Bearer`는 다음 단계에서 토큰을 어떻게 쓸지를 알려준다.

## 4단계: Bearer 토큰으로 자원 접근

이제 Client는 받은 `access_token`을 **`Authorization` 헤더**에 담아 Resource Server에 보낸다. 스킴은 `Bearer`다.

```http
GET /api/me HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOi...
```

"Bearer"는 "소지자"라는 뜻이다. 즉 **이 토큰을 가진 자는 누구든** 권한을 가진다. 그래서 access_token은 비밀번호처럼 다뤄야 하고, 반드시 HTTPS로만 전송해야 한다. Resource Server는 토큰의 유효성과 `scope`를 검증한 뒤 자원을 돌려준다.

## refresh token으로 재발급

`access_token`은 수명이 짧다(`expires_in: 3600` = 1시간). 만료될 때마다 사용자에게 다시 로그인을 시킬 수는 없다. 이때 `refresh_token`을 같은 token endpoint에 보내 새 access_token을 받는다.

```http
POST /token HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=tGzv3JOkF0XG...
&client_id=s6BhdRkqt3
```

응답 형식은 3단계의 토큰 응답과 동일하다. refresh_token은 수명이 길고 강력하므로, access_token보다 더 안전하게 보관해야 한다.

## 정리

OAuth 2.0을 HTTP 레벨에서 보면, 결국 **리다이렉트 두 번과 POST 한 번, 그리고 토큰을 든 자원 요청**으로 요약된다.

- `code`는 프런트 채널, `token`은 백 채널 — 토큰은 브라우저에 노출되지 않는다.
- `state`는 CSRF를, PKCE(`code_challenge` / `code_verifier`)는 코드 가로채기를 막는다.
- `redirect_uri`는 사전 등록값과 정확히 일치해야 한다.
- access_token은 Bearer 자격증명이고, refresh_token으로 재발급한다.
- 그리고 이 모든 것은 인증이 아니라 **제한된 권한의 위임**이다.

다음 글에서는 또 다른 HTTP 본문 포맷인 `multipart/form-data`로 파일 업로드가 실제로 어떻게 인코딩되는지를 들여다본다.

---

**지난 글:** [HTTP 인증 스킴 심화 — Digest부터 WWW-Authenticate까지](/posts/http-authentication-schemes-deep/)

**다음 글:** [multipart/form-data — 파일 업로드의 내부](/posts/http-multipart-form-data/)

<br>
읽어주셔서 감사합니다. 😊
