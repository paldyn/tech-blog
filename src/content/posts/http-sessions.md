---
title: "HTTP 세션 관리 완전 정복 — 쿠키 세션, Redis, JWT 비교"
description: "HTTP 세션의 구현 원리, 서버 측 세션 저장소(메모리·Redis·DB), 세션 고정 공격 방어, JWT와의 비교까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["HTTP세션", "세션관리", "세션고정공격", "Redis세션", "JWT비교", "무상태인증"]
featured: false
draft: false
---

[지난 글](/posts/http-cookie-prefixes/)에서 쿠키 보안 프리픽스를 살펴봤다. 이번 글에서는 쿠키를 활용해 HTTP의 무상태성을 극복하는 **세션 관리**의 전 과정을 완전히 해설한다.

## HTTP 무상태성과 세션의 필요성

HTTP는 각 요청이 이전 요청과 독립적인 **무상태(Stateless)** 프로토콜이다. 이 설계는 서버 확장성에는 유리하지만, "로그인한 사용자만 접근"처럼 상태를 기억해야 하는 기능에는 추가 메커니즘이 필요하다.

세션은 **서버가 클라이언트 상태를 저장하고, 클라이언트는 상태를 식별하는 ID만 보유**하는 패턴이다.

```
전통 세션:
  클라이언트 → 로그인 → 서버: 상태 저장, ID 반환
  클라이언트: ID 저장(쿠키) → 다음 요청에 ID 전송
  서버: ID로 상태 조회 → 요청 처리
```

## 세션 기반 인증 흐름

![세션 기반 인증 흐름](/assets/posts/http-sessions-flow.svg)

### 1. 세션 ID 생성

세션 ID는 **암호학적 랜덤**으로 생성해야 한다. 예측 가능한 ID는 세션 하이재킹의 표적이 된다.

```python
import secrets
import hashlib
import time

# 올바른 방법: 암호학적 랜덤
session_id = secrets.token_urlsafe(32)  # 256비트 랜덤

# 잘못된 방법: 예측 가능
import random
session_id = str(random.randint(0, 1000000))  # 절대 금지
session_id = hashlib.md5(str(time.time()).encode()).hexdigest()  # 금지
```

### 2. 세션 저장소

세션 데이터를 어디에 저장하느냐에 따라 아키텍처가 달라진다.

```python
# 방법 1: 서버 메모리 (단일 서버용)
sessions = {}

def create_session(user_id: str) -> str:
    session_id = secrets.token_urlsafe(32)
    sessions[session_id] = {
        "user_id": user_id,
        "created_at": time.time(),
        "last_active": time.time()
    }
    return session_id

# 방법 2: Redis (분산 환경 권장)
import redis

r = redis.Redis(host='localhost', port=6379, decode_responses=True)
SESSION_TTL = 3600  # 1시간

def create_session_redis(user_id: str) -> str:
    session_id = secrets.token_urlsafe(32)
    r.setex(
        f"session:{session_id}",
        SESSION_TTL,
        json.dumps({"user_id": user_id})
    )
    return session_id

def get_session_redis(session_id: str) -> dict | None:
    data = r.get(f"session:{session_id}")
    if data:
        r.expire(f"session:{session_id}", SESSION_TTL)  # TTL 갱신
        return json.loads(data)
    return None
```

## 세션 고정 공격 (Session Fixation)

가장 중요한 세션 보안 취약점이다.

```
공격 과정:
1. 공격자가 서버에서 유효한 세션 ID를 얻음 (로그인 전)
2. 공격자가 피해자에게 해당 세션 ID로 접속하도록 유도
   (URL 파라미터, 링크 삽입 등)
3. 피해자가 로그인하면 서버는 기존 세션 ID를 유지
4. 공격자는 알고 있는 세션 ID로 피해자의 세션에 접근
```

방어: **로그인 성공 후 반드시 새 세션 ID를 발급**한다.

```python
from fastapi import FastAPI, Response, Cookie, HTTPException
import secrets

app = FastAPI()

@app.post("/login")
async def login(response: Response, 
                username: str, password: str,
                old_session: str = Cookie(None, alias="sessionId")):
    if not authenticate(username, password):
        raise HTTPException(status_code=401)
    
    # 기존 세션 삭제 (세션 고정 방어)
    if old_session:
        delete_session(old_session)
    
    # 새 세션 ID 발급 (핵심!)
    new_session_id = secrets.token_urlsafe(32)
    create_session(new_session_id, username)
    
    response.set_cookie(
        "__Host-sessionId", new_session_id,
        path="/", secure=True, httponly=True, samesite="lax"
    )
    return {"status": "ok"}
```

## 세션 타임아웃

두 가지 타임아웃을 함께 구현한다.

```python
import time

MAX_IDLE_TIME = 1800      # 30분 비활성
MAX_SESSION_TIME = 86400  # 24시간 절대 만료

def validate_session(session_id: str) -> dict | None:
    session = get_session(session_id)
    if not session:
        return None
    
    now = time.time()
    
    # 절대 만료 확인
    if now - session['created_at'] > MAX_SESSION_TIME:
        delete_session(session_id)
        return None
    
    # 유휴 타임아웃 확인
    if now - session['last_active'] > MAX_IDLE_TIME:
        delete_session(session_id)
        return None
    
    # 활성 시간 갱신
    session['last_active'] = now
    update_session(session_id, session)
    return session
```

## 세션 vs JWT 비교

![세션 관리 방식 비교](/assets/posts/http-sessions-comparison.svg)

### JWT(JSON Web Token)의 장단점

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiIxMjM0NTYiLCJuYW1lIjoiSm9obiIsImlhdCI6MTY5MH0.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

JWT는 `헤더.페이로드.서명` 구조다. 서버가 상태를 저장하지 않아(Stateless) 수평 확장이 쉽다.

```python
import jwt
from datetime import datetime, timedelta

SECRET_KEY = "production-secret-must-be-long-and-random"

def create_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1),
        "jti": secrets.token_urlsafe(16)  # 고유 ID (재사용 방지용)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def verify_jwt(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
```

**JWT 주의사항**:
- payload는 Base64 인코딩이지 암호화가 아니다. 민감 정보 포함 금지.
- 서버에서 즉시 무효화 불가. TTL이 짧아야 한다(15-60분).
- Refresh Token과 함께 사용해 UX와 보안을 균형 맞춰야 한다.
- `alg: none` 공격 방어: 알고리즘을 서버에서 명시적으로 검증해야 한다.

### 선택 가이드

```
단일 서버 · 소규모 앱:
  → 서버 메모리 세션 (간단, 즉시 무효화)

다중 서버 · 중간 규모:
  → Redis 세션 (분산 공유, 즉시 무효화, TTL 관리)

마이크로서비스 · 대규모:
  → JWT (Stateless) + Refresh Token 패턴
  → Access Token: 짧은 TTL(15-60분)
  → Refresh Token: Redis에 저장, 긴 TTL(7-30일)

모바일 앱:
  → JWT + Refresh Token (앱 재시작 후에도 로그인 유지)
```

## OWASP 세션 관리 핵심 권장사항

```
1. 세션 ID: 최소 128비트 암호학적 랜덤
2. 쿠키: Secure + HttpOnly + SameSite=Lax + __Host-
3. 로그인 후: 반드시 새 세션 ID 발급 (세션 고정 방어)
4. 로그아웃: 서버에서 세션 완전 삭제
5. 타임아웃: 유휴(30분) + 절대(24시간) 이중 구현
6. HTTPS: 세션 전송은 항상 암호화
7. 재인증: 민감 작업(비번 변경, 결제) 전 재인증 요구
```

---

**지난 글:** [쿠키 보안 프리픽스 완전 정복](/posts/http-cookie-prefixes/)

**다음 글:** [Cache-Control 완전 정복 — 캐시 지시어 해설](/posts/http-cache-control/)

<br>
읽어주셔서 감사합니다. 😊
