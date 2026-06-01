---
title: "OpenID Connect: OAuth 2.0 위에 인증 레이어 추가"
description: "OpenID Connect(OIDC)가 OAuth 2.0과 다른 점을 설명하고, ID Token 검증, nonce 리플레이 공격 방어, JWKS 공개키 갱신 등 실무 구현을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["OpenIDConnect", "OIDC", "IDToken", "OAuth2", "소셜로그인", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-oauth2-pkce/)에서 PKCE로 공개 클라이언트를 보호하는 방법을 다뤘다. OAuth 2.0은 인가(Authorization) 프레임워크이고 **인증이 아니다**. 사용자가 누구인지 확인하려면 OAuth 2.0 위에 **OpenID Connect(OIDC)**를 얹어야 한다.

## OAuth 2.0과 OIDC의 차이

"Google로 로그인" 기능을 OAuth 2.0만으로 구현하면 Access Token으로 사용자 정보 API를 호출해야 한다. 하지만 이 방식은 표준이 없어 프로바이더마다 다르다. OIDC는 이를 표준화한다.

![OpenID Connect vs OAuth 2.0](/assets/posts/websec-openid-connect-flow.svg)

OIDC의 핵심 추가 사항:
- `scope`에 `openid` 추가
- **ID Token** (JWT) 발급 — 사용자 신원 정보 포함
- `/userinfo` 엔드포인트 표준화
- Discovery 문서 (`/.well-known/openid-configuration`)

## ID Token 완전 검증

ID Token을 검증하지 않거나 부분적으로만 검증하면 심각한 취약점이 생긴다.

```python
import httpx
from jose import jwt, JWTError

# 1. Discovery에서 JWKS URI 가져오기
async def get_jwks():
    async with httpx.AsyncClient() as client:
        discovery = await client.get(
            f"{ISSUER_URL}/.well-known/openid-configuration"
        )
        jwks_uri = discovery.json()["jwks_uri"]
        jwks = await client.get(jwks_uri)
        return jwks.json()
```

![ID Token 검증 코드](/assets/posts/websec-openid-connect-code.svg)

```python
async def verify_id_token(id_token: str, nonce: str) -> dict:
    jwks = await get_jwks()
    
    try:
        claims = jwt.decode(
            id_token,
            jwks,
            algorithms=["RS256"],  # 알고리즘 고정
            audience=CLIENT_ID,    # aud 클레임 검증
            issuer=ISSUER_URL,     # iss 클레임 검증
        )
    except JWTError as e:
        raise ValueError(f"ID Token 검증 실패: {e}")
    
    # nonce 검증 (리플레이 공격 방어)
    if claims.get("nonce") != nonce:
        raise ValueError("nonce 불일치")
    
    # at_hash 검증 (Access Token과 바인딩 확인)
    # (생략 가능하나 권장)
    
    return claims
```

## 리플레이 공격 방어: nonce

같은 ID Token을 재사용하는 리플레이 공격을 막기 위해 `nonce`를 사용한다.

```python
import secrets

async def start_oidc_login(request: Request):
    nonce = secrets.token_urlsafe(32)
    state = secrets.token_urlsafe(32)
    
    request.session["oidc_nonce"] = nonce
    request.session["oauth_state"] = state
    
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",  # openid 필수
        "state": state,
        "nonce": nonce,  # 리플레이 방어
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return RedirectResponse(f"{AUTHORIZATION_ENDPOINT}?{urlencode(params)}")
```

## 토큰 교환 후 ID Token 처리

```python
async def oidc_callback(code: str, state: str, request: Request):
    # state, nonce 세션에서 가져오기
    if not secrets.compare_digest(state, request.session.pop("oauth_state", "")):
        raise HTTPException(400, "Invalid state")
    nonce = request.session.pop("oidc_nonce", "")
    
    # 토큰 교환
    tokens = await exchange_code_for_tokens(code)
    
    # ID Token 검증
    user_info = await verify_id_token(tokens["id_token"], nonce)
    
    # sub 클레임으로 사용자 식별 (email은 변경 가능)
    user_id = f"{user_info['iss']}|{user_info['sub']}"
    
    # 세션 생성 (ID Token 자체를 세션에 저장하지 말 것)
    request.session["user_id"] = user_id
    request.session["email"] = user_info.get("email")
    
    return RedirectResponse("/dashboard")
```

## 흔한 실수

### 1. aud 클레임 미검증

```python
# 위험: audience 검증 없음
claims = jwt.decode(id_token, jwks, algorithms=["RS256"])

# 올바름: audience 명시
claims = jwt.decode(id_token, jwks, algorithms=["RS256"], audience=CLIENT_ID)
```

다른 앱의 ID Token이 내 앱에서 유효한 것처럼 받아들여질 수 있다.

### 2. sub 대신 email로 사용자 식별

```python
# 위험: email은 변경 가능
user_id = claims["email"]

# 올바름: iss+sub 조합은 불변
user_id = f"{claims['iss']}|{claims['sub']}"
```

### 3. JWKS 캐싱 미갱신

인가 서버는 주기적으로 키를 교체한다. 캐시 TTL을 1시간 이하로 설정하고, 키 검증 실패 시 즉시 갱신해야 한다.

```python
import functools
import time

_jwks_cache = {"keys": None, "expires": 0}

async def get_jwks_cached():
    if time.time() > _jwks_cache["expires"]:
        _jwks_cache["keys"] = await fetch_jwks()
        _jwks_cache["expires"] = time.time() + 3600  # 1시간 TTL
    return _jwks_cache["keys"]
```

## 보안 체크리스트

- [ ] `scope`에 `openid` 포함
- [ ] ID Token의 `iss`, `aud`, `exp` 모두 검증
- [ ] `nonce` 생성 및 검증 (리플레이 방어)
- [ ] 사용자 식별에 `sub` 사용 (`email` 금지)
- [ ] JWKS 주기적 갱신 (캐시 TTL ≤ 1시간)
- [ ] ID Token을 API 인증에 직접 사용 금지

---

**지난 글:** [OAuth 2.0 PKCE](/posts/websec-oauth2-pkce/)

**다음 글:** [다중 인증(MFA) 완전 구현](/posts/websec-multi-factor-auth/)

<br>
읽어주셔서 감사합니다. 😊
