---
title: "HTTP 인증 — Basic과 Bearer"
description: "HTTP 인증 프레임워크의 401 challenge-response 구조와 Basic·Bearer 두 스킴의 동작, 보안 특성, 401과 403의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["HTTP인증", "Basic인증", "Bearer토큰", "Authorization헤더", "WWWAuthenticate", "RFC6750", "401과403"]
featured: false
draft: false
---

[지난 글](/posts/http-3-quic-deep/)에서 QUIC이 전송 계층에서 어떻게 보안과 성능을 동시에 챙기는지 살펴봤다. 전송이 암호화되어도 "이 요청을 보낸 주체가 누구인가"라는 질문은 여전히 애플리케이션 계층의 몫이다. HTTP는 이 질문에 답하기 위한 표준 인증 프레임워크를 가지고 있고, 그 위에서 동작하는 가장 기본적인 두 스킴이 **Basic**과 **Bearer**다. 이번 글에서는 인증의 뼈대인 challenge-response 구조부터 두 스킴의 차이, 그리고 자주 헷갈리는 401과 403의 구분까지 차근히 정리한다.

## HTTP 인증 프레임워크 — challenge와 response

HTTP 인증은 한쪽이 일방적으로 자격을 들이미는 구조가 아니다. 서버가 먼저 "여기는 인증이 필요하고, 이런 방식으로 자격을 증명해라"라고 알려주고(challenge), 클라이언트가 그에 맞춰 자격을 담아 응답하는(response) 왕복 구조다.

핵심 헤더는 두 개다.

- **`WWW-Authenticate`** — 서버가 `401 Unauthorized` 응답에 담아 보내는 challenge. 어떤 인증 스킴을 요구하는지, 그리고 보호 영역(realm)이 무엇인지 알린다.
- **`Authorization`** — 클라이언트가 challenge에 맞춰 자격증명을 담아 다시 보내는 요청 헤더.

![HTTP 인증 challenge-response 흐름을 보여주는 시퀀스 다이어그램](/assets/posts/http-auth-basic-bearer-challenge.svg)

흐름을 글로 풀면 이렇다. 클라이언트가 자격증명 없이 보호된 자원을 요청하면, 서버는 `401`과 함께 `WWW-Authenticate: Basic realm="api"` 같은 challenge를 돌려준다. 클라이언트는 이 응답을 보고 어떤 스킴이 필요한지 알게 되고, 자격증명을 `Authorization` 헤더에 담아 같은 요청을 다시 보낸다. 서버가 자격을 검증해 통과하면 비로소 `200 OK`와 함께 자원을 내려준다.

```http
GET /account HTTP/1.1
Host: example.com

HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="api"
```

이 프레임워크 자체는 "스킴 이름 + 자격 문자열"이라는 형식만 정의한다. `Basic`이냐 `Bearer`냐는 그 형식을 채우는 구체적인 규칙일 뿐이다.

## realm — 보호 영역의 이름

`WWW-Authenticate`에 붙는 `realm`은 동일한 자격증명이 통하는 보호 영역의 이름이다. 예컨대 `realm="admin"`과 `realm="api"`는 서로 다른 영역이며, 브라우저는 realm 단위로 입력받은 자격증명을 기억하고 재사용한다.

realm은 사용자에게 "지금 어느 구역에 로그인하는가"를 알려주는 라벨이기도 하다. 브라우저 기본 인증 팝업에 표시되는 문구가 바로 이 realm 값이다. 다만 realm은 인증의 경계를 구분하는 식별자일 뿐, 그 자체로 보안 기능을 하지는 않는다.

## Basic 스킴 — 가장 단순한 형태

Basic 인증은 이름 그대로 가장 단순하다. 사용자 이름과 비밀번호를 콜론으로 이어 붙인 `user:pass` 문자열을 **base64로 인코딩**해 그대로 전송한다.

```http
Authorization: Basic dXNlcjpwYXNzd29yZA==
```

여기서 가장 자주 오해하는 지점이 base64다. **base64는 암호화가 아니라 인코딩**이다. 누구나 즉시 디코딩해 원본 `user:password`를 복원할 수 있다. 따라서 Basic 인증은 반드시 **HTTPS 위에서만** 사용해야 한다. 평문 HTTP로 보내는 순간 비밀번호가 사실상 노출된다.

또 하나의 약점은 **무상태 반복 전송**이다. HTTP는 상태가 없으므로, Basic 인증을 쓰는 클라이언트는 모든 요청마다 같은 `Authorization` 헤더를 반복해서 실어 보낸다. 즉 원본 비밀번호가 매 요청마다 네트워크를 오간다. 한 번이라도 채널이 뚫리면 비밀번호 그 자체가 탈취되며, 비밀번호를 바꾸기 전까지는 자격이 계속 유효하다는 점도 위험을 키운다.

## Bearer 스킴 — 토큰을 권한의 증표로

Bearer 인증은 RFC 6750에서 정의하며, 비밀번호 대신 **토큰**을 전송한다. 형식은 간단하다.

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

`Bearer`는 영어로 "소지자"라는 뜻이다. 이름이 말해주듯, **토큰을 가진 자가 곧 권한을 가진 자**로 간주된다. 서버는 토큰을 검증해 그것이 유효하면 요청을 허용한다. 토큰이 어떤 사용자에게 발급되었는지, 어떤 권한 범위를 갖는지는 토큰 자체 혹은 서버 측 저장소가 결정한다.

이 "소지자 = 권한자" 모델은 강력하지만 그만큼 토큰 탈취가 곧바로 권한 탈취로 이어진다는 약점을 갖는다. 그래서 Bearer 토큰은 두 가지 방어를 전제로 한다.

- **짧은 만료(TTL)** — 토큰에 짧은 수명을 두면, 탈취되더라도 공격자가 쓸 수 있는 시간이 제한된다. 만료된 토큰은 갱신(refresh) 절차로 재발급한다.
- **HTTPS 필수** — Basic과 마찬가지로 토큰은 평문에 가깝게 전송되므로 전송 구간 암호화가 반드시 필요하다.

Basic과 비교하면 결정적 차이는 "노출되는 대상"이다. Basic이 탈취되면 원본 비밀번호가 새지만, Bearer가 탈취되면 새는 것은 만료될 토큰 하나다. 피해 범위와 지속 시간을 설계로 제한할 수 있다는 점이 Bearer가 현대 API 인증의 표준이 된 이유다.

![Basic과 Bearer 스킴을 자격증명 형태·상태성·만료·탈취 위험·사용 맥락으로 비교한 표](/assets/posts/http-auth-basic-bearer-compare.svg)

## 401 vs 403 — 자주 헷갈리는 두 상태 코드

마지막으로 인증을 다룰 때 반드시 구분해야 하는 두 상태 코드를 정리한다.

- **`401 Unauthorized`** — "당신이 누구인지 모르겠다." 인증이 필요하거나, 제시한 자격증명이 유효하지 않은 경우다. 이름과 달리 실제로는 *인증(authentication)* 실패를 뜻한다. `401`은 반드시 `WWW-Authenticate` 헤더와 함께 와야 하며, 이는 클라이언트에게 어떤 방식으로 인증하라는 challenge다.
- **`403 Forbidden`** — "당신이 누구인지는 알겠는데, 이 자원에 접근할 권한이 없다." 즉 인증은 통과했지만 *인가(authorization)*에 실패한 경우다. 자격증명을 다시 보내봐야 결과는 같으므로, `403`에는 challenge를 붙이지 않는다.

요약하면 401은 "증명하라", 403은 "증명했지만 허용 안 된다"다. 이미 로그인한 사용자가 관리자 전용 페이지에 접근하면 401이 아니라 403이 맞다.

---

**지난 글:** [QUIC 심화 — 0-RTT, 연결 마이그레이션, 패킷 구조](/posts/http-3-quic-deep/)

**다음 글:** [HTTP 인증 스킴 심화 — Digest부터 WWW-Authenticate까지](/posts/http-authentication-schemes-deep/)

<br>
읽어주셔서 감사합니다. 😊
