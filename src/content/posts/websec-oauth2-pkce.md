---
title: "OAuth 2.0 PKCE: 공개 클라이언트 보안"
description: "PKCE(Proof Key for Code Exchange)의 작동 원리를 설명하고, SPA와 모바일 앱에서 인가 코드 가로채기 공격을 방어하는 완전한 구현 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["OAuth2", "PKCE", "SPA보안", "모바일보안", "인가코드", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-oauth2/)에서 OAuth 2.0 Authorization Code Flow의 기본과 보안 포인트를 다뤘다. 그런데 SPA(Single Page Application)나 모바일 앱은 `client_secret`을 안전하게 보관할 수 없다. 이 경우 **PKCE(Proof Key for Code Exchange)**가 필수다.

## PKCE가 필요한 이유

전통적인 Authorization Code Flow에서 `code`를 토큰으로 교환할 때 `client_secret`이 필요하다. 이 비밀값은 서버 측에서만 보관 가능하다. 그런데:

- **SPA**: 브라우저에서 실행되어 소스 코드가 모두 공개
- **모바일 앱**: 앱 패키지 리버스 엔지니어링으로 추출 가능

이런 **공개 클라이언트**에서는 `client_secret` 대신 PKCE를 사용한다. PKCE는 RFC 7636에 정의되어 있으며, 현재는 **모든 클라이언트 유형에서 사용 권장**된다.

![PKCE 흐름](/assets/posts/websec-oauth2-pkce-flow.svg)

## PKCE 작동 원리

```
code_verifier  →  SHA256  →  BASE64URL  =  code_challenge
(랜덤 비밀값)                              (공개 전송)
```

1. 클라이언트가 `code_verifier` 생성 (랜덤 43~128자)
2. `code_challenge = BASE64URL(SHA256(code_verifier))` 계산
3. 인가 요청 시 `code_challenge`만 전송 (verifier는 메모리에 보관)
4. 인가 코드 수신 후 토큰 교환 시 `code_verifier` 제출
5. 서버가 `SHA256(verifier) == challenge` 검증

공격자가 `code`를 가로챠도 `code_verifier`를 알 수 없으니 토큰 교환이 불가능하다.

## 구현

![PKCE 구현 코드](/assets/posts/websec-oauth2-pkce-code.svg)

### 서버 측 Python 구현 (전체 흐름)

```python
import secrets
import hashlib
import base64
from urllib.parse import urlencode

def generate_pkce():
    """PKCE verifier/challenge 쌍 생성"""
    verifier = secrets.token_urlsafe(64)  # 86자
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge

async def start_oauth_pkce(request: Request):
    """PKCE 인가 요청 시작"""
    verifier, challenge = generate_pkce()
    state = secrets.token_urlsafe(32)
    
    # 세션에 안전하게 보관
    request.session["pkce_verifier"] = verifier
    request.session["oauth_state"] = state
    
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",  # SHA256 사용
    }
    return RedirectResponse(f"{AUTHORIZATION_ENDPOINT}?{urlencode(params)}")

async def oauth_pkce_callback(code: str, state: str, request: Request):
    """PKCE 콜백: verifier로 토큰 교환"""
    # state 검증
    if not secrets.compare_digest(state, request.session["oauth_state"]):
        raise HTTPException(400, "Invalid state")
    
    verifier = request.session.pop("pkce_verifier")
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(TOKEN_URL, data={
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,  # verifier 제출 (secret 대신)
        })
    return resp.json()
```

### 클라이언트 측 JavaScript (SPA)

```javascript
// 브라우저에서 직접 PKCE 생성
async function generatePKCE() {
  const verifier = crypto.randomUUID().replace(/-/g, '') +
                   crypto.randomUUID().replace(/-/g, '');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return { verifier, challenge };
}

async function startLogin() {
  const { verifier, challenge } = await generatePKCE();
  const state = crypto.randomUUID();
  
  // 메모리(sessionStorage)에만 저장 — localStorage 금지
  sessionStorage.setItem('pkce_verifier', verifier);
  sessionStorage.setItem('oauth_state', state);
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  
  window.location.href = `${AUTHORIZATION_ENDPOINT}?${params}`;
}
```

## method=S256 강제

`code_challenge_method=plain`은 challenge가 verifier 그대로라 보안 효과가 없다. 반드시 `S256`을 사용하고, 서버도 `plain` 방식을 거부해야 한다.

```python
# 서버 측 검증
def verify_pkce(code_verifier: str, stored_challenge: str, method: str):
    if method != "S256":
        raise ValueError("S256 방식만 허용")
    
    digest = hashlib.sha256(code_verifier.encode()).digest()
    computed = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    
    if not secrets.compare_digest(computed, stored_challenge):
        raise ValueError("PKCE 검증 실패")
```

## 보안 체크리스트

- [ ] 모든 공개 클라이언트(SPA, 앱)에 PKCE 적용
- [ ] `code_challenge_method=S256` 강제 (plain 거부)
- [ ] `code_verifier` 메모리에만 보관 (localStorage 금지)
- [ ] 서버 측에서 `plain` method 명시적 거부
- [ ] 가능하면 서버 클라이언트도 PKCE 사용 (RFC 9700 권장)

---

**지난 글:** [OAuth 2.0 완전 이해](/posts/websec-oauth2/)

**다음 글:** [OpenID Connect: 인증 레이어 추가](/posts/websec-openid-connect/)

<br>
읽어주셔서 감사합니다. 😊
