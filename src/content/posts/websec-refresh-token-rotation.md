---
title: "Refresh Token Rotation: 탈취 감지와 자동 갱신"
description: "Refresh Token Rotation 전략의 원리를 설명하고, 재사용 탐지(Reuse Detection)로 토큰 탈취를 감지하는 완전한 구현 방법을 Python 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["RefreshToken", "TokenRotation", "재사용탐지", "JWT", "인증보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-token-security/)에서 Access Token은 메모리에, Refresh Token은 HttpOnly Cookie에 저장하는 패턴을 다뤘다. 그런데 Refresh Token 자체가 탈취되면 어떻게 될까? **Refresh Token Rotation**은 이 문제를 감지하는 핵심 기법이다.

## Rotation이란

Refresh Token을 사용할 때마다 **즉시 폐기하고 새 토큰을 발급**하는 전략이다. 매번 새 토큰으로 교체하기 때문에 이전 토큰은 단 한 번만 유효하다.

- **기존 방식**: Refresh Token을 반복 사용 → 탈취되어도 모름
- **Rotation**: 사용 즉시 무효화 → 재사용 시 탐지 가능

![Refresh Token Rotation 흐름](/assets/posts/websec-refresh-token-rotation-flow.svg)

## 재사용 탐지(Reuse Detection)의 핵심

Rotation의 진짜 가치는 **탐지**에 있다. 토큰을 훔친 공격자가 먼저 사용했다면:

1. 공격자가 `RT_old` → 서버가 `RT_new` 발급, `RT_old` 사용 처리
2. 정상 클라이언트가 `RT_old` 사용 시도 → 서버: "이미 사용된 토큰!"
3. 서버는 **해당 사용자의 모든 Refresh Token을 즉시 폐기**

이 시점에서 공격자의 `RT_new`도 함께 폐기된다. 결과적으로 양쪽 모두 재인증이 필요해진다. 합법적인 사용자에게는 불편하지만 **공격자도 즉시 차단**된다.

```python
# DB 스키마 설계
CREATE TABLE refresh_tokens (
    id          SERIAL PRIMARY KEY,
    token_hash  VARCHAR(64) UNIQUE NOT NULL,  -- SHA-256 해시 저장
    user_id     UUID NOT NULL,
    parent_hash VARCHAR(64),                   -- 이전 토큰 추적
    used        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW(),
    expires_at  TIMESTAMP NOT NULL
);
```

## 완전한 구현

![Refresh Token Rotation 구현 코드](/assets/posts/websec-refresh-token-rotation-code.svg)

```python
import secrets
import hashlib
from datetime import datetime, timedelta

def issue_refresh_token(user_id: str, db, parent_hash: str = None) -> str:
    """새 Refresh Token 발급 및 DB 저장"""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    db.execute("""
        INSERT INTO refresh_tokens
            (token_hash, user_id, parent_hash, expires_at)
        VALUES (%s, %s, %s, %s)
    """, (token_hash, user_id, parent_hash, datetime.now() + timedelta(days=7)))
    return raw_token  # 해시 아닌 원본 반환 (한 번만 노출)

def rotate_refresh_token(old_raw_token: str, db):
    """Rotation + 재사용 탐지"""
    old_hash = hashlib.sha256(old_raw_token.encode()).hexdigest()
    record = db.query_one(
        "SELECT * FROM refresh_tokens WHERE token_hash = %s", (old_hash,)
    )
    if not record:
        raise ValueError("유효하지 않은 Refresh Token")

    if record["expires_at"] < datetime.now():
        raise ValueError("만료된 Refresh Token")

    if record["used"]:
        # 재사용 탐지 — 탈취 가능성 높음
        db.execute(
            "UPDATE refresh_tokens SET used=TRUE WHERE user_id=%s",
            (record["user_id"],)
        )
        # 사용자에게 알림 (이메일, 앱 푸시 등)
        notify_suspicious_activity(record["user_id"])
        raise SecurityError("Refresh Token 재사용 탐지: 전체 세션 폐기")

    # 정상 처리: 기존 토큰 사용 처리
    db.execute(
        "UPDATE refresh_tokens SET used=TRUE WHERE token_hash=%s", (old_hash,)
    )
    # 새 토큰 발급 (parent_hash로 체인 추적)
    new_token = issue_refresh_token(
        record["user_id"], db, parent_hash=old_hash
    )
    new_access = create_access_token(record["user_id"])
    return new_access, new_token
```

## 토큰 체인 추적

`parent_hash`를 기록하면 토큰 발급 이력을 추적할 수 있다. 재사용 탐지 시 어느 시점에 탈취가 일어났는지 분석할 수 있다.

```sql
-- 토큰 체인 조회 (재사용 탐지 이후 포렌식)
WITH RECURSIVE token_chain AS (
    SELECT * FROM refresh_tokens WHERE token_hash = $1
    UNION ALL
    SELECT rt.* FROM refresh_tokens rt
    JOIN token_chain tc ON rt.parent_hash = tc.token_hash
)
SELECT token_hash, used, created_at FROM token_chain ORDER BY created_at;
```

## 운영 고려사항

### 그레이스 피리어드

네트워크 오류로 클라이언트가 새 토큰을 못 받은 경우를 위해 짧은 유예 시간을 두기도 한다.

```python
GRACE_PERIOD_SECONDS = 30

def rotate_with_grace(old_raw_token: str, db):
    old_hash = hashlib.sha256(old_raw_token.encode()).hexdigest()
    record = db.query_one(...)
    
    if record["used"]:
        # 사용 처리된 지 30초 이내면 동일 응답 재전송 (네트워크 재시도 허용)
        used_ago = (datetime.now() - record["used_at"]).total_seconds()
        if used_ago < GRACE_PERIOD_SECONDS and record["successor_token"]:
            return record["successor_access"], record["successor_token"]
        raise SecurityError("토큰 재사용 탐지")
    # ... 정상 처리
```

### 로그아웃 처리

```python
def logout(user_id: str, current_rt_hash: str, db):
    """현재 세션만 로그아웃"""
    db.execute(
        "UPDATE refresh_tokens SET used=TRUE WHERE token_hash=%s",
        (current_rt_hash,)
    )

def logout_all(user_id: str, db):
    """모든 기기 로그아웃"""
    db.execute(
        "UPDATE refresh_tokens SET used=TRUE WHERE user_id=%s AND used=FALSE",
        (user_id,)
    )
```

## 체크리스트

- [ ] Refresh Token을 DB에 해시로 저장 (원본 저장 금지)
- [ ] 사용 시 즉시 `used=true` 처리
- [ ] 재사용 탐지 시 해당 사용자 전체 토큰 폐기
- [ ] 의심스러운 활동 알림 구현
- [ ] `parent_hash`로 체인 추적
- [ ] 만료된 토큰 주기적 정리 (DB 부담)

---

**지난 글:** [토큰 보안 모범 사례](/posts/websec-token-security/)

**다음 글:** [OAuth 2.0 완전 이해](/posts/websec-oauth2/)

<br>
읽어주셔서 감사합니다. 😊
