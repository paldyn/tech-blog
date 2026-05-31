---
title: "세션 고정(Session Fixation) 공격과 방어"
description: "세션 고정 공격의 원리를 단계별로 설명하고, 로그인 후 세션 재생성으로 방어하는 방법을 다룹니다. 취약한 코드와 안전한 코드를 비교하며 실전 구현법을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 8
type: "knowledge"
category: "Security"
tags: ["세션고정", "SessionFixation", "세션보안", "세션재생성", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-session-management/)에서 세션의 생명 주기와 쿠키 보안 속성을 살펴봤다. 이번에는 세션 관련 취약점 중 비교적 덜 알려져 있지만 심각한 영향을 미치는 **세션 고정(Session Fixation)** 공격을 다룬다.

## 세션 고정이란

세션 고정은 공격자가 미리 알고 있는 세션 ID를 피해자가 사용하도록 유도한 뒤, 피해자가 로그인하면 그 세션을 탈취하는 공격이다. 핵심 문제는 **로그인 성공 후에도 기존 세션 ID를 그대로 유지**하는 서버 동작에 있다.

![세션 고정 공격 흐름](/assets/posts/websec-session-fixation-attack.svg)

## 방어: 세션 재생성

```python
import secrets
import redis.asyncio as redis
import json, time

async def secure_login(username: str, password: str,
                       old_session_id: str | None, response):
    user = await authenticate(username, password)
    if user is None:
        return None

    r = redis.Redis()

    # 1. 기존 세션 즉시 삭제
    if old_session_id:
        await r.delete(f"session:{old_session_id}")

    # 2. 새 세션 ID 생성 (CSPRNG)
    new_session_id = secrets.token_hex(32)

    # 3. 새 세션 데이터 저장
    session_data = {
        "user_id": str(user.id),
        "created_at": time.time(),
    }
    await r.setex(
        f"session:{new_session_id}",
        1800,
        json.dumps(session_data),
    )

    # 4. 새 세션 ID 쿠키 설정
    response.set_cookie(
        "session_id", new_session_id,
        httponly=True, secure=True, samesite="strict"
    )
    return user
```

![세션 고정 방어 코드 비교](/assets/posts/websec-session-fixation-defense.svg)

## 취약한 코드 vs 안전한 코드

```python
# 취약: 로그인 후 세션 ID 미변경
def vulnerable_login(request):
    session = request.session
    user = authenticate(...)
    if user:
        session["user_id"] = user.id  # 기존 세션 ID 그대로!
        # 공격자가 미리 알고 있던 SID로 세션 탈취 가능

# 안전: 로그인 후 세션 재생성
async def secure_login_v2(req, resp):
    old_sid = req.cookies.get("session_id")
    user = authenticate(...)
    if user:
        await sessions.delete(old_sid)  # 기존 삭제
        new_sid = await sessions.create(user.id)  # 새 생성
        resp.set_cookie("session_id", new_sid,
                        httponly=True, secure=True, samesite="strict")
```

## 세션 재생성이 필요한 4가지 상황

1. **로그인 성공** — 가장 중요
2. **권한 상승** — 일반 → 관리자
3. **역할 변경** — 역할 추가/제거 후
4. **비밀번호 변경** — 계정 보안 변경 후

URL에 세션 ID를 포함하는 관행도 완전히 제거해야 한다. URL은 로그, 히스토리, 리퍼러에 그대로 노출된다.

---

**지난 글:** [세션 관리의 핵심 원칙](/posts/websec-session-management/)

**다음 글:** [세션 하이재킹(Session Hijacking) 완전 정복](/posts/websec-session-hijacking/)

<br>
읽어주셔서 감사합니다. 😊
