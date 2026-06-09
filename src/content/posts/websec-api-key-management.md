---
title: "API 키 관리: 생성·저장·스코프·로테이션·폐기 전략 완전 가이드"
description: "CSPRNG 기반 API 키 생성, SHA-256 해시 저장, 스코프 설계, IP 화이트리스트, 자동 로테이션, 침해 감지 시 즉시 폐기, GitHub Secret Scanning 연동을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["API키", "키관리", "CSPRNG", "스코프", "로테이션", "SecretScanning", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-api-rate-limiting/)에서 Rate Limiting으로 API 키 남용을 제한하는 방법을 살펴봤다. 이번 글에서는 API 키 자체의 생명주기 — 생성부터 폐기까지 — 를 안전하게 관리하는 전략을 다룬다. API 키는 사용자 비밀번호보다 더 강력한 접근 권한을 가지는 경우가 많지만, 관리는 훨씬 소홀한 경우가 많다.

## API 키 vs JWT vs OAuth2

언제 API 키를 사용하는가? API 키는 **서버 간 통신**(S2S), 파트너 통합, CI/CD 파이프라인, CLI 도구에 적합하다. 브라우저 기반 사용자 인증에는 OAuth2/JWT가 더 적합하다. API 키는 특정 사용자가 아닌 **클라이언트 애플리케이션**을 인증한다는 점에서 다르다.

![API 키 생명주기 관리](/assets/posts/websec-api-key-lifecycle.svg)

## 안전한 API 키 생성

API 키는 반드시 암호학적으로 안전한 난수 생성기(CSPRNG)를 사용해야 한다. `Math.random()`, `rand()`, 타임스탬프 기반 값은 예측 가능하다.

```python
import secrets
import hashlib
import hmac
from datetime import datetime

def generate_api_key(prefix: str = "sk_live") -> tuple[str, str]:
    """
    Returns: (plain_key, hashed_key)
    plain_key: 사용자에게 1회 표시 후 버림
    hashed_key: DB에 저장
    """
    # 32바이트 = 256비트 엔트로피 (64자 hex)
    raw = secrets.token_bytes(32)
    plain_key = f"{prefix}_{raw.hex()}"

    # SHA-256으로 해시 — 단방향이므로 유출되어도 원본 복구 불가
    hashed = hashlib.sha256(plain_key.encode()).hexdigest()

    return plain_key, hashed

# 검증
def verify_api_key(provided_key: str, stored_hash: str) -> bool:
    # hmac.compare_digest로 타이밍 공격 방지
    expected = hashlib.sha256(provided_key.encode()).hexdigest()
    return hmac.compare_digest(expected, stored_hash)
```

`hmac.compare_digest`는 **타이밍 공격**을 막는다. 일반 `==` 비교는 처음 다른 문자에서 즉시 반환해 응답 시간 차이로 올바른 키를 추측할 수 있다.

## DB 스키마 설계

```sql
CREATE TABLE api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    name        VARCHAR(100) NOT NULL,             -- "Production Server", "CI Pipeline"
    key_hash    VARCHAR(64) NOT NULL UNIQUE,        -- SHA-256 hex
    key_prefix  VARCHAR(20) NOT NULL,               -- "sk_live_a1b2..." (앞 12자)
    scopes      TEXT[] NOT NULL DEFAULT '{}',       -- ["read:orders", "write:invoices"]
    ip_whitelist INET[],                            -- NULL = 모든 IP 허용
    last_used_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,                        -- NULL = 만료 없음
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ                         -- NULL = 활성
);

CREATE INDEX ON api_keys (key_hash);                -- 인증 시 빠른 조회
CREATE INDEX ON api_keys (user_id, revoked_at);     -- 사용자별 활성 키 조회
```

`key_prefix`는 키의 앞 12자를 저장해 사용자가 "어떤 키를 사용했는지" 구분할 수 있게 한다. 원본은 저장하지 않지만 키 식별은 가능하다.

## 스코프 설계

![API 키 스코프 설계와 보안 속성](/assets/posts/websec-api-key-scopes.svg)

스코프를 세분화하면 침해 시 피해 범위가 줄어든다. GitHub는 `repo`, `read:user`, `write:packages` 같은 세분화된 스코프를 사용한다.

```python
# 스코프 검증 미들웨어
from enum import Enum

class Scope(str, Enum):
    READ_ORDERS = "read:orders"
    WRITE_ORDERS = "write:orders"
    READ_USERS = "read:users"
    ADMIN = "admin:*"

def require_scope(required_scope: Scope):
    def decorator(func):
        async def wrapper(*args, api_key: APIKey = Depends(get_api_key), **kwargs):
            if required_scope not in api_key.scopes and Scope.ADMIN not in api_key.scopes:
                raise HTTPException(status_code=403, detail="Insufficient scope")
            return await func(*args, api_key=api_key, **kwargs)
        return wrapper
    return decorator

@app.get("/api/orders")
@require_scope(Scope.READ_ORDERS)
async def list_orders(api_key: APIKey = Depends(get_api_key)):
    ...
```

## 접두사와 GitHub Secret Scanning

Stripe, GitHub, OpenAI 같은 대형 API 공급자는 `sk_live_`, `ghp_`, `sk-` 같은 고유한 접두사를 키에 포함한다. GitHub Secret Scanning과 같은 도구가 저장소에서 이 패턴을 자동 탐지해 공급자에게 알린다. 공급자는 즉시 해당 키를 무효화할 수 있다.

```python
# GitHub Secret Scanning webhook 처리 (사용자 키 자동 무효화)
@app.post("/api/github-secret-scanning")
async def handle_secret_scanning_alert(request: Request):
    # GitHub HMAC 서명 검증
    signature = request.headers.get("Github-Public-Key-Signature")
    # ... 서명 검증 로직 ...

    payload = await request.json()
    for alert in payload:
        key_hash = hashlib.sha256(alert["token"].encode()).hexdigest()
        # 즉시 폐기
        await db.execute(
            "UPDATE api_keys SET revoked_at = NOW() WHERE key_hash = $1",
            key_hash
        )
        # 키 소유자에게 이메일 알림
        await notify_key_owner(key_hash)
```

## 로테이션 전략

```python
# 안전한 키 로테이션 (무중단)
async def rotate_api_key(old_key_id: str, user_id: str) -> dict:
    # 1. 새 키 생성
    new_plain, new_hash = generate_api_key()

    # 2. DB에 신규 키 저장 (아직 구 키는 활성)
    new_key = await db.create_api_key(user_id, new_hash, ...)

    # 3. 구 키 유예 기간 설정 (7일 후 만료)
    await db.set_expiry(old_key_id, expires_at=datetime.now() + timedelta(days=7))

    # 4. 사용자에게 신규 키 + 마이그레이션 안내
    return {
        "new_key": new_plain,  # 1회만 표시
        "old_key_expires_at": (datetime.now() + timedelta(days=7)).isoformat(),
        "message": "7일 이내에 새 키로 교체해 주세요."
    }
```

## 침해 대응: 즉시 폐기

```bash
# 침해된 키 즉시 폐기 API
curl -X DELETE https://api.example.com/api/keys/sk_live_a1b2c3... \
  -H "Authorization: Bearer {admin_token}"

# 모든 키 일괄 폐기 (최악의 경우)
curl -X POST https://api.example.com/api/keys/revoke-all \
  -H "Authorization: Bearer {admin_token}" \
  -d '{"user_id": "user_123", "reason": "suspected_compromise"}'
```

API 키 관리는 "발급하고 끝"이 아니다. 키 인벤토리 정기 감사, 미사용 키 자동 만료, 이상 접근 패턴 모니터링(비정상 시간대 접근, 새로운 IP, 갑작스러운 요청 급증)을 운영 프로세스에 포함해야 한다. Stripe, GitHub, Twilio 같은 성숙한 API 공급자의 키 관리 대시보드를 참고 모델로 삼는 것을 권장한다.

---

**지난 글:** [API Rate Limiting: 토큰 버킷·슬라이딩 윈도우·분산 환경 구현](/posts/websec-api-rate-limiting/)

<br>
읽어주셔서 감사합니다. 😊
