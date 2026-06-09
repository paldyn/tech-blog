---
title: "HTTP 쿠키 완전 정복 — Set-Cookie와 Cookie 헤더"
description: "HTTP 쿠키의 탄생 배경, Set-Cookie/Cookie 헤더 문법, 세션·영구 쿠키 구분, 쿠키 범위(Domain·Path) 제어까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["HTTP쿠키", "SetCookie", "Cookie헤더", "세션쿠키", "영구쿠키", "쿠키범위"]
featured: false
draft: false
---

[지난 글](/posts/http-accept-headers/)에서 Accept 헤더 패밀리를 살펴봤다. 이번 글에서는 HTTP의 상태 비저장 문제를 해결하는 **쿠키(Cookie)** 메커니즘을 처음부터 완전히 해설한다.

## 왜 쿠키가 필요한가

HTTP는 설계상 **무상태(Stateless)** 프로토콜이다. 각 요청은 독립적이며 서버는 이전 요청을 기억하지 않는다. 덕분에 서버가 단순해지고 확장성이 높아지지만, "로그인 상태 유지" 같은 기본 기능을 구현하려면 별도 메커니즘이 필요하다.

1994년 넷스케이프의 루 몬툴리(Lou Montulli)가 쇼핑 카트 상태를 유지하기 위해 **쿠키**를 발명했다. 현재는 RFC 6265bis에서 표준화됐다.

## Set-Cookie 헤더

서버가 클라이언트에 쿠키를 설정하려면 **Set-Cookie** 헤더를 사용한다.

```http
Set-Cookie: name=value[; attribute1][; attribute2]...
```

![쿠키 동작 흐름](/assets/posts/http-cookies-flow.svg)

### 기본 예시

```http
# 이름과 값 (필수)
Set-Cookie: userId=12345

# URL 인코딩이 필요한 값
Set-Cookie: username=John%20Doe

# 따옴표로 감싸기 (공백 포함 시)
Set-Cookie: description="Hello World"
```

**쿠키 이름**은 ASCII 문자여야 하며 `=`, `;`, `,`, 공백, 제어문자는 포함할 수 없다. **쿠키 값**도 특수문자는 URL 인코딩해야 한다. 값이 없는 빈 쿠키(`name=`)는 유효하다.

여러 쿠키를 설정하려면 **Set-Cookie 헤더를 반복**한다.

```http
Set-Cookie: sessionId=abc123; HttpOnly; Secure
Set-Cookie: theme=dark; Max-Age=86400; Path=/
Set-Cookie: lang=ko; Domain=.example.com
```

## Cookie 헤더

클라이언트(브라우저)는 해당 도메인과 경로 범위에 맞는 쿠키를 모아 **Cookie** 헤더로 전송한다.

```http
GET /page HTTP/1.1
Host: www.example.com
Cookie: sessionId=abc123; theme=dark; lang=ko
```

Cookie 헤더에는 **이름=값 쌍만** 전송한다. 만료 시간, Secure, HttpOnly 등 속성은 브라우저 내부에서만 사용하고 서버로 전송하지 않는다. 쌍들은 세미콜론과 공백으로 구분한다.

![쿠키 구성 요소](/assets/posts/http-cookies-structure.svg)

## 쿠키 생명주기

### 세션 쿠키 (Session Cookie)

Expires나 Max-Age를 **지정하지 않은** 쿠키다. 브라우저 세션이 끝나면(탭 닫기가 아닌 브라우저 전체 종료 시) 삭제된다.

```http
Set-Cookie: sessionId=abc123; Path=/; HttpOnly
```

단, 브라우저 "세션 복원" 기능 때문에 실제로는 브라우저를 닫아도 세션 쿠키가 살아있는 경우가 많다. 진정한 세션 종료가 필요하면 서버 측에서 세션을 무효화해야 한다.

### 영구 쿠키 (Persistent Cookie)

Expires 또는 Max-Age를 **지정한** 쿠키다.

```http
# Expires: 절대 날짜 (GMT)
Set-Cookie: remember=true; Expires=Thu, 01 Jan 2027 00:00:00 GMT

# Max-Age: 상대 초 (더 권장)
Set-Cookie: preference=dark; Max-Age=2592000   # 30일

# 즉시 삭제 (로그아웃)
Set-Cookie: sessionId=deleted; Max-Age=0; Path=/
```

**Max-Age가 Expires보다 우선**한다. 서버와 클라이언트의 시계 동기화 문제 때문에 Max-Age를 사용하는 게 더 안전하다.

쿠키를 삭제하려면 동일한 이름, 동일한 Path와 Domain으로 `Max-Age=0`을 설정하면 된다.

## 쿠키 범위 제어

### Domain 속성

쿠키를 어떤 도메인에 전송할지 지정한다.

```http
# Domain 미지정: 정확히 현재 도메인만 (서브도메인 미포함)
Set-Cookie: sid=abc

# 현재 도메인 + 모든 서브도메인
Set-Cookie: sid=abc; Domain=example.com
# → example.com, sub.example.com, deep.sub.example.com 모두 전송
```

Domain에 **점(.) 접두사**는 RFC 6265에서 공식적으로 사용하지 않지만, 많은 서버가 호환성을 위해 여전히 사용한다. 현재 브라우저는 `Domain=example.com`과 `Domain=.example.com`을 동일하게 처리한다.

**보안 주의**: Domain을 너무 넓게 설정하면 의도치 않은 서브도메인에도 민감한 쿠키가 전송된다. 세션 쿠키는 Domain을 생략하거나 최소 범위로 설정하라.

### Path 속성

쿠키를 어떤 URL 경로에 전송할지 지정한다.

```http
Set-Cookie: admin_sid=xyz; Path=/admin
# → /admin, /admin/users, /admin/settings 에 전송
# → /, /public, /user 에는 전송 안 함

Set-Cookie: general=abc; Path=/
# → 모든 경로에 전송 (기본값과 동일)
```

Path의 경계는 **경로 구성요소** 단위다. `Path=/admin`은 `/administrator`에는 **전송되지 않는다.**

Path는 보안 경계로는 사용할 수 없다. 같은 오리진의 JavaScript는 Path와 무관하게 쿠키를 읽을 수 있다(HttpOnly 없을 때).

## 실무 예시

### 로그인/로그아웃 구현

```python
from fastapi import FastAPI, Response, Cookie, HTTPException
import secrets

app = FastAPI()
sessions = {}  # 실제로는 Redis 사용

@app.post("/login")
async def login(response: Response, username: str, password: str):
    if not verify_password(username, password):
        raise HTTPException(status_code=401)
    
    # 새 세션 ID 생성 (암호학적 랜덤)
    session_id = secrets.token_urlsafe(32)
    sessions[session_id] = {"user": username}
    
    response.set_cookie(
        key="sessionId",
        value=session_id,
        max_age=3600,
        path="/",
        secure=True,      # HTTPS만
        httponly=True,    # JS 접근 차단
        samesite="lax"    # CSRF 방어
    )
    return {"status": "logged in"}

@app.post("/logout")
async def logout(response: Response, sessionId: str = Cookie(None)):
    if sessionId:
        sessions.pop(sessionId, None)
    response.delete_cookie("sessionId", path="/")
    return {"status": "logged out"}
```

### 쿠키 크기 제한

```
브라우저 쿠키 제한:
- 단일 쿠키 최대 4KB
- 도메인당 쿠키 수: 일반적으로 50개
- 도메인당 총 쿠키 크기: 약 4KB × 50 = 200KB
```

쿠키에 대용량 데이터를 저장하면 모든 요청에 해당 크기가 추가되어 성능이 저하된다. **식별자(ID)만 쿠키에 저장하고, 실제 데이터는 서버 측에** 보관하는 패턴을 사용하라.

### 서드파티 쿠키의 종말

```
퍼스트파티 쿠키: 방문 중인 도메인이 설정
서드파티 쿠키: 다른 도메인(광고, 트래킹)이 설정

Chrome: 2024년부터 서드파티 쿠키 단계적 차단
Firefox, Safari: 이미 서드파티 쿠키 기본 차단
```

서드파티 쿠키 없이 동작하도록 설계해야 한다. 대안으로 First-Party Sets, Privacy Sandbox 기술(Topics API, CHIPS)이 표준화 중이다.

---

**지난 글:** [Accept 헤더 패밀리 완전 해설](/posts/http-accept-headers/)

**다음 글:** [쿠키 속성 완전 정복 — Secure, HttpOnly, SameSite](/posts/http-cookie-attributes/)

<br>
읽어주셔서 감사합니다. 😊
