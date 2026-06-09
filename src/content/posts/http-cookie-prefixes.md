---
title: "쿠키 보안 프리픽스 완전 정복 — __Host- 와 __Secure-"
description: "__Host-와 __Secure- 쿠키 프리픽스의 요구사항, 동작 원리, 쿠키 이름 인젝션 공격 방어, 브라우저 지원 현황까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["쿠키프리픽스", "__Host쿠키", "__Secure쿠키", "쿠키보안", "쿠키인젝션", "CSRF방어"]
featured: false
draft: false
---

[지난 글](/posts/http-cookie-attributes/)에서 Secure, HttpOnly, SameSite 속성을 살펴봤다. 이번 글에서는 쿠키 속성이 올바르게 설정됐는지를 **브라우저 수준에서 강제하는 쿠키 프리픽스**를 완전히 해설한다.

## 쿠키 이름 인젝션 공격

쿠키 프리픽스가 등장한 배경을 이해하려면 **쿠키 이름 인젝션(Cookie Name Injection)** 공격을 알아야 한다.

시나리오: `api.example.com`과 `attacker.example.com`이 있다.

```
1. api.example.com은 세션 쿠키를 설정:
   Set-Cookie: sessionId=safe_value; Secure; HttpOnly; Path=/

2. 공격자가 attacker.example.com에서 동일한 이름의 쿠키를 설정:
   Set-Cookie: sessionId=malicious_value; Domain=example.com; Path=/

3. 브라우저가 api.example.com에 요청할 때:
   Cookie: sessionId=malicious_value  ← 공격자 값!
            (또는 두 값이 모두 전송되어 파싱 혼란)
```

이처럼 서브도메인이나 다른 경로에서 **같은 이름의 쿠키를 덮어쓸 수 있다.** 서버는 Cookie 헤더를 받았을 때 이 쿠키가 Secure/HttpOnly로 설정된 것인지 알 방법이 없다.

쿠키 프리픽스는 브라우저가 **쿠키를 저장하기 전에** 프리픽스 규칙을 강제함으로써 이 공격을 차단한다.

## __Secure- 프리픽스

`__Secure-`로 시작하는 쿠키는 반드시 **Secure 속성**을 포함해야 한다. 그렇지 않으면 브라우저가 쿠키 저장을 **거부**한다.

```http
# 올바른 사용: Secure 속성 포함
Set-Cookie: __Secure-sessionId=abc; Secure; HttpOnly; SameSite=Lax

# 위반: Secure 없음 → 브라우저가 무시
Set-Cookie: __Secure-sessionId=abc; HttpOnly
```

![쿠키 보안 프리픽스](/assets/posts/http-cookie-prefixes-rules.svg)

### __Secure- 요구사항 정리

1. 쿠키 이름이 `__Secure-`로 시작해야 함
2. **Secure 속성이 반드시 포함**되어야 함

이것뿐이다. Domain, Path는 자유롭게 설정 가능하다.

```python
# 올바른 예
response.set_cookie(
    "__Secure-token",
    value=token,
    secure=True,        # 필수
    httponly=True,
    samesite="strict"
)

# 잘못된 예: HTTP 환경에서 설정 시도
# 브라우저가 Secure 없는 __Secure- 쿠키를 무시
response.set_cookie(
    "__Secure-token",
    value=token
    # secure=True 누락 → 브라우저 거부
)
```

## __Host- 프리픽스

`__Host-`는 더 강력하다. 세 가지 조건을 **모두** 충족해야 한다.

```http
# 올바른 사용
Set-Cookie: __Host-csrf=xyz; Secure; HttpOnly; Path=/

# 위반 1: Domain 있음 → 거부
Set-Cookie: __Host-csrf=xyz; Secure; Domain=example.com; Path=/

# 위반 2: Path가 / 아님 → 거부
Set-Cookie: __Host-csrf=xyz; Secure; Path=/api

# 위반 3: Secure 없음 → 거부
Set-Cookie: __Host-csrf=xyz; Path=/
```

### __Host- 요구사항 정리

1. 쿠키 이름이 `__Host-`로 시작해야 함
2. **Secure 속성 필수**
3. **Domain 속성 금지** (현재 호스트에만 고정)
4. **Path=/ 필수** (사이트 전체 범위)

Domain을 지정하지 않으면 쿠키는 정확히 현재 호스트(서브도메인 없이)에만 전송된다. `api.example.com`에서 설정한 `__Host-csrf`는 `www.example.com`에는 전송되지 않는다.

### __Host- 방어 효과

```
공격 시나리오: attacker.example.com에서 쿠키 인젝션 시도

일반 쿠키:
Set-Cookie: sessionId=bad; Domain=.example.com  → 성공, api.example.com에 전송

__Host- 쿠키:
Set-Cookie: __Host-sessionId=bad; Secure; Path=/
→ Domain 없이 설정됨 → attacker.example.com에만 존재
→ api.example.com에 이 쿠키가 전송되지 않음

또한: 서버에서 Cookie: __Host-sessionId=...를 받으면
Secure + Path=/ + Domain 없이 설정된 것이 브라우저에서 보장됨
```

## 보안 강도 비교

![쿠키 보안 레이어](/assets/posts/http-cookie-prefixes-security.svg)

```python
# 실무 보안 쿠키 설정 예시

# 1단계: 기본 (Secure + HttpOnly + SameSite)
response.set_cookie(
    "sessionId", value, 
    secure=True, httponly=True, samesite="lax"
)

# 2단계: __Secure- 추가 (HTTPS 강제 검증)
response.set_cookie(
    "__Secure-sessionId", value,
    secure=True, httponly=True, samesite="lax"
)

# 3단계: __Host- 최고 보안 (호스트 고정)
response.set_cookie(
    "__Host-sessionId", value,
    path="/",
    secure=True, httponly=True, samesite="lax"
    # domain 미지정 (지정 금지)
)
```

## 브라우저 지원

| 브라우저 | __Secure- | __Host- |
|----------|-----------|---------|
| Chrome 49+ | ✓ | ✓ |
| Firefox 50+ | ✓ | ✓ |
| Safari 13.1+ | ✓ | ✓ |
| Edge 79+ | ✓ | ✓ |
| IE | ✗ | ✗ |

IE를 고려한 레거시 환경이 아니라면 모든 현대 브라우저가 지원한다.

## 서버 사이드 검증

쿠키 프리픽스는 **브라우저가 저장 규칙을 강제**하지만, 서버도 이를 검증하는 것이 좋은 방어 심층(defense in depth)이다.

```python
from fastapi import Cookie, HTTPException

async def get_session(
    session_id: str = Cookie(None, alias="__Host-sessionId")
):
    """
    __Host- 쿠키는 브라우저가 Secure + Path=/ + Domain없음을 보장.
    서버는 이름 패턴을 확인해 위조 가능성을 줄인다.
    """
    if session_id is None:
        raise HTTPException(status_code=401)
    
    # 프리픽스 이름 검증 (추가 방어)
    if not hasattr(request.cookies, '__Host-sessionId'):
        raise HTTPException(status_code=401)
    
    return validate_session(session_id)
```

## CSRF 방어에서의 역할

```http
# Double Submit Cookie 패턴에 __Host- 적용
Set-Cookie: __Host-csrfToken=random123; Secure; Path=/

# POST 요청 시 쿠키 값과 헤더 값 비교
POST /api/action HTTP/1.1
Cookie: __Host-csrfToken=random123
X-CSRF-Token: random123
```

`__Host-` 프리픽스로 CSRF 토큰 쿠키를 설정하면, 공격자가 서브도메인에서 이 쿠키를 덮어쓸 수 없다. Double Submit Cookie 패턴의 보안이 강화된다.

---

**지난 글:** [쿠키 속성 완전 정복 — Secure, HttpOnly, SameSite](/posts/http-cookie-attributes/)

**다음 글:** [HTTP 세션 관리 완전 정복](/posts/http-sessions/)

<br>
읽어주셔서 감사합니다. 😊
