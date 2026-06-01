---
title: "OAuth 2.0 완전 이해: 흐름과 보안"
description: "OAuth 2.0의 Authorization Code Flow를 단계별로 설명하고, state 파라미터, redirect_uri 검증, Implicit Flow 금지 등 실무 보안 포인트를 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["OAuth2", "인가", "AuthorizationCode", "state파라미터", "소셜로그인", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-refresh-token-rotation/)에서 Refresh Token의 안전한 관리 방법을 다뤘다. 이번에는 현대 웹 인증의 핵심 프레임워크인 **OAuth 2.0**을 보안 관점에서 살펴본다. "구글 로그인", "GitHub으로 로그인" 버튼 뒤에서 OAuth 2.0이 동작하고 있다.

## OAuth 2.0이란

OAuth 2.0은 **인가(Authorization) 프레임워크**다. "인증"이 아니라 "인가"임을 기억하자. 사용자가 자신의 자격증명을 직접 제공하지 않고도 특정 리소스에 대한 접근 권한을 제3자 앱에 위임할 수 있다.

핵심 역할:
- **Resource Owner**: 사용자 (리소스 소유자)
- **Client**: 앱 서버 (리소스에 접근하려는 주체)
- **Authorization Server**: 구글, 깃허브 등 인가 서버
- **Resource Server**: API 서버 (보호된 리소스 제공)

## Authorization Code Flow

가장 안전하고 널리 쓰이는 흐름이다. 핵심은 Access Token이 **브라우저를 통하지 않고** 서버간 백채널로 교환된다는 점이다.

![OAuth 2.0 Authorization Code Flow](/assets/posts/websec-oauth2-flow.svg)

## 보안 취약점과 방어

### 1. state 파라미터 미검증 (CSRF)

state를 검증하지 않으면 공격자가 피해자에게 자신의 인가 코드를 바인딩시킬 수 있다.

```python
import secrets
from fastapi import Request, HTTPException

# 인가 요청 시작
async def start_oauth(request: Request):
    state = secrets.token_urlsafe(32)
    request.session["oauth_state"] = state  # 세션에 저장
    
    auth_url = (
        f"{AUTHORIZATION_ENDPOINT}"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid email profile"
        f"&state={state}"   # CSRF 토큰
    )
    return RedirectResponse(auth_url)
```

![OAuth 2.0 콜백 처리](/assets/posts/websec-oauth2-code.svg)

### 2. redirect_uri 미검증 (인가 코드 탈취)

인가 서버가 `redirect_uri`를 느슨하게 검증하면 공격자가 자신의 도메인으로 코드를 가로챌 수 있다.

```
# 취약: path traversal
허용 등록: https://app.example.com/callback
공격자 요청: https://app.example.com/callback/../evil

# 취약: 하위 도메인
허용 등록: https://app.example.com
공격자 도메인: https://evil.app.example.com (서브도메인 탈취 가능)
```

```python
from urllib.parse import urlparse

ALLOWED_REDIRECT_URIS = {
    "https://app.example.com/auth/callback"
}

def validate_redirect_uri(uri: str) -> bool:
    # 완전 일치 검사 (prefix 검사 금지)
    return uri in ALLOWED_REDIRECT_URIS
```

### 3. Implicit Flow 사용 금지

Implicit Flow는 Access Token을 URL 프래그먼트(`#access_token=...`)로 반환한다. 이는 브라우저 히스토리, Referer 헤더, 자바스크립트로 노출될 수 있어 **RFC 9700에서 사용 금지**됐다.

```
# 사용 금지
response_type=token

# 올바른 방법
response_type=code  (+ PKCE)
```

### 4. 인가 코드 재사용

인가 코드는 단 1회 사용 후 즉시 폐기해야 한다. 서버가 이를 강제하지 않으면 탈취된 코드를 나중에 재사용할 수 있다.

```python
def exchange_code(code: str, db):
    record = db.get_auth_code(code)
    if not record or record["used"]:
        # 코드 재사용 시도 — 발급된 모든 토큰 폐기
        if record:
            revoke_all_tokens_for_code(record, db)
        raise HTTPException(400, "Invalid or used authorization code")
    
    db.mark_code_used(code)  # 즉시 사용 처리
    return issue_tokens(record["user_id"], record["scope"])
```

## 권한 범위(Scope) 최소화

```python
# 불필요한 권한 요청 금지
# 잘못된 예: 모든 권한 요청
scope = "read write delete admin"

# 올바른 예: 필요한 최소 권한만
scope = "read:user email"
```

## OAuth 2.0 보안 체크리스트

- [ ] `state` 파라미터 생성 및 검증 (CSRF 방어)
- [ ] `redirect_uri` 완전 일치 검증
- [ ] 인가 코드 단 1회 사용 후 폐기
- [ ] Implicit Flow 사용 금지
- [ ] `client_secret` 서버 측 보관 (SPA·모바일 앱에 내장 금지)
- [ ] PKCE 적용 (다음 글 참조)
- [ ] Scope 최소화
- [ ] HTTPS 강제 (redirect_uri 포함)

---

**지난 글:** [Refresh Token Rotation 전략](/posts/websec-refresh-token-rotation/)

**다음 글:** [OAuth 2.0 PKCE: 공개 클라이언트 보안](/posts/websec-oauth2-pkce/)

<br>
읽어주셔서 감사합니다. 😊
