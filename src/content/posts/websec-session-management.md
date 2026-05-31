---
title: "세션 관리의 핵심 원칙"
description: "웹 세션의 생명 주기와 보안 원칙을 설명합니다. 세션 ID 생성, 쿠키 보안 속성(HttpOnly·Secure·SameSite), 세션 타임아웃, 로그아웃 처리, Redis 기반 세션 저장소 구현까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["세션관리", "SessionManagement", "HttpOnly", "SameSite", "쿠키보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-brute-force-defense/)에서 로그인 자체를 보호하는 방법을 알아봤다. 로그인에 성공한 이후에는 **세션(Session)**이 사용자를 식별하는 수단이 된다. 세션이 탈취되면 로그인 과정 전체가 무의미해진다.

## 세션 ID 생성 원칙

세션 ID는 반드시 **암호학적으로 안전한 의사 난수 생성기(CSPRNG)**로 생성해야 한다.

```python
import secrets

# 좋은 예: secrets 모듈 사용 (CSPRNG)
session_id = secrets.token_hex(32)  # 256비트 = 64자리 16진수

# 나쁜 예: random 모듈 (예측 가능) — 절대 금지
import random
bad_id = str(random.randint(0, 999999))
```

![세션 생명 주기와 보안 포인트](/assets/posts/websec-session-management-lifecycle.svg)

## 쿠키 보안 속성

```python
response.set_cookie(
    key="session_id",
    value=session_id,
    httponly=True,      # JavaScript 접근 차단 (XSS 완화)
    secure=True,        # HTTPS에서만 전송 (중간자 공격 방지)
    samesite="strict",  # CSRF 방어
    max_age=1800,       # 30분 후 만료
    path="/",
)
```

## Redis 기반 세션 저장소

```python
import redis.asyncio as redis
import json, secrets, time

class SessionStore:
    def __init__(self):
        self.redis = redis.Redis()
        self.timeout = 1800

    async def create(self, user_id: str) -> str:
        session_id = secrets.token_hex(32)
        data = {
            "user_id": user_id,
            "created_at": time.time(),
            "last_access": time.time(),
        }
        await self.redis.setex(
            f"session:{session_id}",
            self.timeout,
            json.dumps(data),
        )
        return session_id

    async def get(self, session_id: str) -> dict | None:
        raw = await self.redis.get(f"session:{session_id}")
        if raw is None:
            return None
        await self.redis.expire(f"session:{session_id}", self.timeout)
        return json.loads(raw)

    async def delete(self, session_id: str):
        await self.redis.delete(f"session:{session_id}")
```

![세션 관리 구현 코드](/assets/posts/websec-session-management-code.svg)

## 로그아웃 처리

```python
async def logout(session_id: str, response):
    await session_store.delete(session_id)  # 서버에서 삭제 (필수)
    response.delete_cookie("session_id")
    response.set_cookie("session_id", "", max_age=0, httponly=True)
```

로그아웃은 서버와 클라이언트 양쪽에서 처리해야 한다. 서버에서만 삭제하면 다른 기기에서 쿠키가 만료 전까지 남을 수 있다.

---

**지난 글:** [무차별 대입 공격 방어 전략](/posts/websec-brute-force-defense/)

**다음 글:** [세션 고정(Session Fixation) 공격과 방어](/posts/websec-session-fixation/)

<br>
읽어주셔서 감사합니다. 😊
