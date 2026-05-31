---
title: "JWT 보안: 올바른 사용법과 취약점"
description: "JWT(JSON Web Token)의 구조와 검증 원리를 설명하고, alg:none 공격, 알고리즘 혼동, 약한 서명 키 등 주요 취약점과 방어 방법을 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["JWT", "JSON웹토큰", "토큰보안", "alg혼동공격", "RefreshToken"]
featured: false
draft: false
---

[지난 글](/posts/websec-session-hijacking/)에서 세션 기반 인증의 취약점을 다뤘다. 최근에는 세션 쿠키 대신 **JWT(JSON Web Token)**을 인증 수단으로 사용하는 경우가 많다. JWT는 강력하지만, 잘못 구현하면 심각한 보안 취약점이 생긴다.

## JWT란 무엇인가

JWT는 세 부분(Header, Payload, Signature)을 점(`.`)으로 연결한 Base64URL 인코딩 문자열이다. **Payload는 암호화가 아닌 Base64URL 인코딩**이다. 누구나 디코딩해서 내용을 볼 수 있다.

![JWT 구조와 검증 흐름](/assets/posts/websec-jwt-security-structure.svg)

## 안전한 JWT 발급

```python
import jwt
import secrets
from datetime import datetime, timedelta, timezone

JWT_SECRET = os.environ["JWT_SECRET"]  # 256비트 이상
JWT_ALGORITHM = "HS256"

def create_access_token(user_id: str, roles: list[str]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "roles": roles,
        "iat": now,
        "exp": now + timedelta(minutes=15),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
```

![JWT 주요 취약점과 방어](/assets/posts/websec-jwt-security-vulnerabilities.svg)

## 주요 취약점과 방어

### ① alg:none 공격

```python
# 취약: alg를 토큰에서 그대로 사용
# token_data = jwt.decode(token, key)  # 절대 금지

# 안전: 알고리즘 명시적 화이트리스트
token_data = jwt.decode(
    token,
    key=JWT_SECRET,
    algorithms=["HS256"],  # "none" 포함 불가
)
```

### ② 약한 서명 키

```python
# 나쁜 예
JWT_SECRET = "secret123"  # 절대 금지

# 좋은 예: 256비트 이상 무작위
import secrets
JWT_SECRET = secrets.token_hex(32)  # 생성 후 환경 변수에 저장
```

## 토큰 검증 함수

```python
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def verify_token(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["exp", "sub", "iat"]},
        )
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

## 로그아웃: 토큰 취소

```python
import uuid

def create_token_with_jti(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "jti": str(uuid.uuid4()),
        "exp": datetime.utcnow() + timedelta(minutes=15),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def logout(token: str):
    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    jti = payload["jti"]
    ttl = int(payload["exp"] - time.time()) + 10
    await redis.setex(f"jwt_blacklist:{jti}", ttl, "1")
```

## JWT vs 세션 쿠키

| 기준 | JWT | 세션 쿠키 |
|------|-----|-----------|
| 서버 상태 | Stateless | Stateful |
| 수평 확장 | 용이 | Redis 등 필요 |
| 즉각 취소 | 어려움 | 즉시 가능 |
| 보안 구현 복잡도 | 높음 | 낮음 |

일반적인 웹 앱은 세션 쿠키가 더 단순하고 안전하다. API 서버나 마이크로서비스에서 여러 서버 간 인증이 필요할 때 JWT가 유용하다.

---

**지난 글:** [세션 하이재킹(Session Hijacking) 완전 정복](/posts/websec-session-hijacking/)

<br>
읽어주셔서 감사합니다. 😊
