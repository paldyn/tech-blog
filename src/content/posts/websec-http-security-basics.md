---
title: "HTTP 프로토콜과 보안 기초"
description: "HTTP/HTTPS 요청·응답 구조, 보안 헤더, 메서드별 특성, 상태 코드의 보안 의미를 이해하고 안전한 HTTP 통신을 구성하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["HTTP", "HTTPS", "보안헤더", "TLS", "쿠키보안", "HTTP메서드"]
featured: false
draft: false
---

[지난 글](/posts/websec-common-attack-types/)에서 웹 공격 유형 전체를 조망했다. 이번 글에서는 웹의 근간인 HTTP 프로토콜을 보안 관점에서 살펴본다. HTTP를 깊이 이해하면 XSS, CSRF, 세션 탈취 등 수많은 공격이 왜 가능한지, 어디서 막아야 하는지가 명확해진다.

## HTTP의 특성과 보안 함의

HTTP는 **무상태(Stateless)** 프로토콜이다. 각 요청은 독립적이어서 서버는 이전 요청을 기억하지 않는다. 이 때문에 쿠키, 세션, JWT 같은 상태 관리 메커니즘이 필요하고, 이것들이 공격의 대상이 된다.

HTTP는 **평문(Plaintext)** 프로토콜이다. HTTPS 없이 전송된 모든 데이터는 네트워크 경로 어디서든 도청, 변조, 주입이 가능하다. 2024년 기준 전체 웹 트래픽의 95% 이상이 HTTPS로 전환됐지만, 내부 네트워크에서 HTTP를 쓰는 경우가 여전히 많다.

![HTTP 요청/응답 구조와 보안 포인트](/assets/posts/websec-http-security-basics-flow.svg)

## 보안 관련 HTTP 헤더

### 요청 헤더 (공격자가 조작 가능)

HTTP 요청 헤더는 클라이언트가 설정한다. 즉, 공격자가 임의로 조작할 수 있다.

```http
GET /api/profile HTTP/1.1
Host: api.example.com
Cookie: session=eyJhbGc...       # 탈취 가능
Authorization: Bearer eyJhbGc... # 탈취 가능
Referer: https://evil.com        # 위조 가능
X-Forwarded-For: 127.0.0.1      # IP 스푸핑 가능
Origin: https://legitimate.com   # CORS 우회 시도
```

**핵심**: `X-Forwarded-For`, `Referer`, `Origin` 헤더를 보안 결정의 유일한 근거로 삼으면 안 된다. 이 헤더들은 참고 자료일 뿐, 공격자가 쉽게 위조할 수 있다.

### 응답 헤더 (서버가 설정해야 할 것들)

응답 헤더는 서버가 제어한다. 보안 헤더를 올바르게 설정하면 많은 공격 클래스를 브라우저 레벨에서 차단할 수 있다.

```http
HTTP/1.1 200 OK
# HTTPS 강제 (HTTP로 접근 시 HTTPS로 리다이렉트)
Strict-Transport-Security: max-age=31536000; includeSubDomains

# XSS 방지: 허용된 출처에서만 스크립트 로드
Content-Security-Policy: default-src 'self'; script-src 'self'

# MIME 타입 스니핑 방지
X-Content-Type-Options: nosniff

# 클릭재킹 방지
X-Frame-Options: DENY

# 참조자 정보 제한
Referrer-Policy: strict-origin-when-cross-origin

# 쿠키: 3개 플래그 필수
Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Lax
```

## 쿠키 보안 플래그

쿠키는 세션 관리의 핵심이자 공격의 주요 대상이다. 세 가지 플래그가 필수다.

```python
# Flask 예시
from flask import Flask, make_response
import secrets

app = Flask(__name__)

@app.route("/login", methods=["POST"])
def login():
    # 인증 처리 후
    session_token = secrets.token_hex(32)
    response = make_response({"status": "ok"})
    response.set_cookie(
        "session",
        session_token,
        httponly=True,   # JS에서 document.cookie로 접근 불가 → XSS 방어
        secure=True,     # HTTPS에서만 전송 → 도청 방어
        samesite="Lax",  # 크로스 사이트 요청 시 쿠키 전송 제한 → CSRF 방어
        max_age=3600,    # 1시간 후 만료
    )
    return response
```

**HttpOnly**: JavaScript의 `document.cookie`로 쿠키를 읽지 못하게 한다. XSS로 스크립트를 주입해도 세션 쿠키를 탈취할 수 없다.

**Secure**: HTTPS 연결에서만 쿠키를 전송한다. 평문 HTTP로 접속하면 쿠키가 전송되지 않는다.

**SameSite**: `Strict`은 모든 크로스 사이트 요청에서 쿠키 제외, `Lax`는 GET 외 크로스 사이트 요청에서 제외, `None`은 항상 전송(Secure와 함께만). `Lax`가 대부분의 경우 적절한 균형이다.

## HTTP 메서드와 보안

![HTTP 메서드 특성과 보안 주의사항](/assets/posts/websec-http-security-basics-methods.svg)

**멱등성(Idempotency)**: 같은 요청을 여러 번 보내도 결과가 같아야 한다. GET, PUT, DELETE는 멱등해야 한다. POST는 멱등하지 않으므로 중복 제출 방지가 필요하다.

**안전성(Safety)**: 서버 상태를 변경하지 않아야 한다. GET, HEAD, OPTIONS만 안전하다. 안전한 메서드로 부수 효과(데이터 변경)를 일으키면 CSRF 공격에 취약해진다.

```python
# 잘못된 설계: GET으로 상태 변경 (CSRF에 취약)
@app.route("/delete-account")  # GET 요청으로 계정 삭제
def delete_account():
    # 공격자가 <img src="/delete-account"> 하나로 삭제 가능
    current_user.delete()

# 올바른 설계: POST + CSRF 토큰
@app.route("/delete-account", methods=["POST"])
@csrf_protect
def delete_account():
    current_user.delete()
```

## HTTPS: HTTP + TLS

HTTPS는 HTTP 위에 TLS(Transport Layer Security) 계층을 추가한다. TLS는 세 가지를 보장한다.

**암호화**: 전송 중인 데이터를 제3자가 읽을 수 없다. TLS 1.3부터 핸드셰이크 시간도 대폭 줄었다.

**서버 인증**: 접속한 서버가 진짜 그 서버인지 인증서로 검증한다. 가짜 서버로의 연결을 방지한다.

**무결성**: 전송 중 데이터가 변조되면 연결이 즉시 끊긴다.

```nginx
# Nginx HTTPS 설정 (보안 강화)
server {
    listen 443 ssl;
    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    # TLS 1.2 미만 비활성화
    ssl_protocols TLSv1.2 TLSv1.3;

    # 강한 암호 스위트만
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # HSTS (HTTP 접속을 HTTPS로 강제)
    add_header Strict-Transport-Security "max-age=31536000" always;
}
```

HTTP의 구조를 이해하면 공격이 왜 가능한지가 보인다. 쿠키가 JS에서 읽힌다는 사실이 XSS의 파급력을 만들고, 크로스 오리진 요청에 쿠키가 자동으로 포함된다는 사실이 CSRF를 가능하게 한다. 다음 글부터는 인증과 인가를 다루면서 이 기반 위에서 어떻게 사용자 신원을 확인하는지 살펴본다.

---

**지난 글:** [주요 웹 공격 유형 한눈에 보기](/posts/websec-common-attack-types/)

**다음 글:** [인증과 인가의 차이](/posts/websec-authentication-vs-authorization/)

<br>
읽어주셔서 감사합니다. 😊
