---
title: "HTTP 보안 기초: 웹 보안의 기반이 되는 프로토콜 이해"
description: "HTTP/HTTPS의 보안 관련 구조를 깊이 이해합니다. 요청/응답 구조, HTTP 메서드 보안, 상태 코드 활용, 쿠키 속성, 주요 보안 헤더까지 웹 보안의 기반 지식을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["HTTP", "HTTPS", "TLS", "보안헤더", "쿠키", "웹보안기초"]
featured: false
draft: false
---

[지난 글](/posts/websec-common-attack-types/)에서 웹 공격의 전체 지도를 그렸다. 이제 그 모든 공격과 방어의 무대가 되는 **HTTP 프로토콜**을 보안 관점에서 깊이 이해해보자. HTTP를 모르고는 웹 보안을 논할 수 없다. 쿠키가 어떻게 전송되는지, 헤더가 어떤 역할을 하는지, HTTPS가 무엇을 보호하는지 — 이 기반 지식 위에 이후 모든 공격과 방어 기법이 쌓인다.

## HTTP의 무상태성(Statelessness)과 보안

HTTP는 본질적으로 **무상태(Stateless)** 프로토콜이다. 각 요청은 독립적이며 서버는 이전 요청을 기억하지 않는다. 이 특성이 보안에 중요한 함의를 갖는다.

```text
무상태 HTTP의 보안 함의

문제: 서버가 사용자를 식별할 수 없음
해결책들:
  → 쿠키 (Cookie): 브라우저에 상태 저장
  → 세션 (Session): 서버에 상태 저장, 쿠키로 ID 교환
  → JWT: 서명된 토큰으로 상태를 클라이언트에 위임
  → URL 파라미터: (보안상 최악 — 로그에 기록됨)

각 방법은 다른 보안 위협을 가짐
```

## HTTP 요청 구조와 보안 취약점

![HTTP 요청/응답 구조와 보안](/assets/posts/websec-http-security-basics-flow.svg)

```http
POST /api/login HTTP/1.1
Host: example.com
Content-Type: application/json
Origin: https://example.com
Cookie: session=abc123
User-Agent: Mozilla/5.0 ...

{"username": "alice", "password": "secret"}
```

각 부분은 공격 벡터가 될 수 있다.

```text
HTTP 요청 보안 분석
├── URL/경로: 경로 순회 공격(../), 인젝션
├── 쿼리 파라미터: XSS, SQLi, 민감 정보 로그 노출
├── 헤더
│   ├── Host: 호스트 헤더 인젝션
│   ├── Origin: CORS 검증 대상
│   ├── Referer: 민감 URL 노출
│   ├── Cookie: 세션 하이재킹
│   └── X-Forwarded-For: IP 스푸핑 (신뢰 금지)
└── 바디: SQLi, 역직렬화, 파일 업로드 공격
```

## HTTPS: TLS의 보안 보장 범위

HTTPS는 TLS(Transport Layer Security)를 통해 세 가지를 보장한다.

```text
TLS 보장 범위
✅ 기밀성: 전송 데이터 암호화 (도청 불가)
✅ 무결성: MAC으로 변조 탐지 (수정 불가)
✅ 인증:   서버 인증서로 서버 신원 확인

TLS가 보장하지 않는 것
❌ 서버 측 취약점 (SQLi, XSS는 TLS와 무관)
❌ 브라우저 측 공격 (XSS는 HTTPS에서도 발생)
❌ 인증된 사용자의 악의적 행동
```

```bash
# TLS 버전 및 설정 확인
openssl s_client -connect example.com:443 -tls1_3

# 취약한 설정 탐지
nmap --script ssl-enum-ciphers -p 443 example.com

# 보안 설정 테스트 (SSL Labs)
# https://www.ssllabs.com/ssltest/
```

## HTTP 메서드와 보안

```python
# RESTful API에서 HTTP 메서드의 보안 의미
HTTP_METHODS = {
    "GET": {
        "idempotent": True,
        "safe": True,  # 서버 상태 변경 없음
        "log_risk": "URL 파라미터가 로그에 기록됨 — 민감 정보 금지",
        "csrf_risk": "낮음 (단순 조회만)"
    },
    "POST": {
        "idempotent": False,
        "safe": False,
        "csrf_risk": "높음 — CSRF 토큰 필수",
        "injection_risk": "바디 내용 파싱 — 검증 필수"
    },
    "PUT/PATCH": {
        "idempotent": True,
        "safe": False,
        "auth_required": "강한 인증·인가 필수",
    },
    "DELETE": {
        "idempotent": True,
        "safe": False,
        "idor_risk": "높음 — 객체 소유자 확인 필수",
    }
}
```

## 쿠키 보안 속성

쿠키는 세션 관리의 핵심이지만 잘못 설정하면 심각한 취약점이 된다.

```http
# 안전한 쿠키 설정
Set-Cookie: session=abc123;
  HttpOnly;         # JS에서 접근 불가 → XSS로 쿠키 탈취 방지
  Secure;           # HTTPS에서만 전송
  SameSite=Strict;  # 크로스 사이트 요청에서 전송 안 함 → CSRF 방지
  Path=/;
  Domain=example.com;
  Max-Age=3600      # 1시간 후 만료
```

```python
# Django에서 보안 쿠키 설정
SESSION_COOKIE_HTTPONLY = True   # 기본값 True, 확인 필수
SESSION_COOKIE_SECURE = True     # HTTPS 환경에서만
SESSION_COOKIE_SAMESITE = 'Strict'
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
```

## 핵심 보안 응답 헤더

```http
HTTP/1.1 200 OK
# 필수 보안 헤더들

# HTTPS 강제 (1년 + 서브도메인 + 프리로드)
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# XSS 방어 — 스크립트 소스 허용 목록
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123'

# 클릭재킹 방지
X-Frame-Options: DENY

# MIME 타입 스니핑 방지
X-Content-Type-Options: nosniff

# Referrer 정보 제한
Referrer-Policy: strict-origin-when-cross-origin

# 권한 정책
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## HTTP 상태 코드와 보안

![HTTP 상태 코드와 보안](/assets/posts/websec-http-security-basics-methods.svg)

특히 중요한 보안 관련 패턴:

```python
# ❌ 계정 존재 여부 노출
if not user_exists(email):
    return {"error": "이메일이 존재하지 않습니다"}, 404
if not check_password(password):
    return {"error": "비밀번호가 틀렸습니다"}, 401

# ✅ 계정 열거(Account Enumeration) 방지
# 성공·실패 메시지 동일화 + 응답 시간 동일화
import time

def login(email, password):
    start = time.time()
    user = get_user(email)
    is_valid = user and verify_password(password, user.password_hash)

    # 응답 시간을 항상 동일하게 (타이밍 공격 방지)
    elapsed = time.time() - start
    if elapsed < 0.1:
        time.sleep(0.1 - elapsed)

    if not is_valid:
        return {"error": "이메일 또는 비밀번호가 올바르지 않습니다"}, 401
    return create_session(user)
```

HTTP는 단순해 보이지만 보안 관점에서 보면 수십 가지 공격 벡터가 숨어 있다. 헤더, 쿠키, 메서드, 상태 코드 하나하나가 올바르게 사용될 때 웹 보안의 기반이 단단해진다. 다음 글부터는 이 기반 위에서 구체적인 보안 헤더들을 하나씩 깊이 살펴본다.

---

**지난 글:** [웹 공격 유형 총정리: 주요 공격의 작동 원리](/posts/websec-common-attack-types/)

<br>
읽어주셔서 감사합니다. 😊
