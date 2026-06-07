---
title: "CSPRNG: 암호학적으로 안전한 난수 생성의 원리와 실무"
description: "PRNG와 CSPRNG의 차이, OS 엔트로피 풀 동작 원리, 언어별 CSPRNG API, 부팅 직후 엔트로피 부족 문제, 보안 토큰·키·솔트 생성 시 반드시 CSPRNG를 써야 하는 이유를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["CSPRNG", "난수생성", "엔트로피", "암호화키", "secrets", "보안토큰", "urandom"]
featured: false
draft: false
---

[지난 글](/posts/websec-certificates-chain-of-trust/)에서 PKI와 인증서 체인을 살펴봤다. 이번 글에서는 암호화 시스템 전체의 보안이 의존하는 숨은 기반 — **암호학적으로 안전한 난수 생성기(CSPRNG)**를 다룬다.

## 왜 난수 생성이 보안에 중요한가?

암호학의 핵심 가정 중 하나는 **비밀 값이 예측 불가능해야 한다**는 것이다. AES 키, RSA 소수, ECDH 비밀값, 솔트, 세션 ID, CSRF 토큰 — 이 모든 것이 예측 불가능한 난수로부터 시작된다.

예측 가능한 난수를 사용한 실제 보안 사고:

- **2008 Debian OpenSSL 사건**: 패치 실수로 PID만 시드로 사용 → 전세계 SSH 키 32,768가지 중 하나 → 대규모 키 재생성
- **2012 Android Bitcoin 지갑**: java.util.Random 사용 → 같은 k로 ECDSA 서명 → 비밀키 추출, 수천 BTC 도난
- **PHP rand() 예측**: 타임스탬프를 시드로 사용하는 코드에서 비밀번호 재설정 토큰 예측

![PRNG vs CSPRNG](/assets/posts/websec-csprng-overview.svg)

## PRNG vs CSPRNG

일반 PRNG(Pseudo-Random Number Generator)는 수학적 수열로 난수처럼 보이는 숫자를 생성한다. 통계적으로는 무작위처럼 보이지만, **시드를 알면 모든 출력을 예측할 수 있다**.

```python
import random

# PRNG: 시드 고정 시 완전히 예측 가능
random.seed(42)
print([random.randint(0, 100) for _ in range(5)])
# [1, 0, 81, 14, 3]

random.seed(42)  # 같은 시드
print([random.randint(0, 100) for _ in range(5)])
# [1, 0, 81, 14, 3]  # 항상 동일!

# 실제 공격: 타임스탬프로 시드 유추
import time
# 1밀리초 단위로 탐색하면 몇 초 내 일치
```

CSPRNG는 두 가지 추가 속성을 가진다:
1. **다음 비트 예측 불가**: 출력 비트열을 보고 다음 비트를 1/2 이상 확률로 예측하는 다항 시간 알고리즘이 없다
2. **이전 상태 역산 불가**: 현재 상태가 노출돼도 과거 출력을 복원할 수 없다

## OS 엔트로피 풀

![OS 엔트로피 풀 흐름](/assets/posts/websec-csprng-entropy.svg)

현대 OS는 하드웨어의 비결정론적 사건들(키보드 타이밍, 네트워크 인터럽트, 메모리 접근 패턴 등)을 수집해 **엔트로피 풀**을 유지한다.

```bash
# Linux 엔트로피 상태 확인
cat /proc/sys/kernel/random/entropy_avail  # 현재 엔트로피 양 (bits)
cat /proc/sys/kernel/random/poolsize      # 풀 크기

# /dev/random vs /dev/urandom
# /dev/random: 엔트로피 부족 시 블로킹 (실무에서 거의 사용 안 함)
# /dev/urandom: 블로킹 없음, 초기화 후 CSPRNG로 동작 (권장)

# Linux 3.17+ getrandom(2) syscall (권장)
python3 -c "import os; print(os.urandom(32).hex())"
```

### 부팅 직후 엔트로피 부족

컨테이너, VM, 클라우드 인스턴스는 부팅 직후 엔트로피가 충분하지 않을 수 있다. AWS Nitro, GCP 등은 하드웨어 RNG를 제공하므로 상대적으로 안전하다.

```bash
# 컨테이너 환경에서 엔트로피 확인
cat /proc/sys/kernel/random/entropy_avail

# haveged 설치 (CPU 아키텍처 이벤트 수집)
apt install haveged
systemctl enable haveged

# Intel RDRAND 지원 확인 (CPU 내장 CSPRNG)
grep -m1 rdrand /proc/cpuinfo
```

## 언어별 CSPRNG API

### Python

```python
import secrets
import os

# ✅ 가장 간단한 방법 (Python 3.6+)
token = secrets.token_hex(32)      # 64자 16진수 문자열
token_b = secrets.token_bytes(32)  # 32바이트
token_url = secrets.token_urlsafe(32)  # URL-safe base64

# 범위 내 무작위 정수 (CSPRNG)
otp = secrets.randbelow(1_000_000)  # 6자리 OTP

# 무작위 선택
choices = secrets.choice(['A', 'B', 'C', 'D'])

# 저수준 (암호화 키 등)
aes_key = os.urandom(32)   # AES-256 키
salt = os.urandom(16)       # bcrypt/Argon2 솔트
iv = os.urandom(12)         # AES-GCM IV/Nonce

# ❌ 절대 금지
import random
bad_token = str(random.random())  # PRNG — 보안 용도 사용 금지
```

### JavaScript/Node.js

```javascript
// Node.js (서버 사이드)
const crypto = require('crypto');

// 암호화 키 생성
const aesKey = crypto.randomBytes(32);        // 32 bytes
const token = crypto.randomBytes(32).toString('hex');  // 64자 hex

// 범위 내 정수 (Uint32)
const randomInt = crypto.randomInt(0, 1_000_000);  // 0~999999

// 브라우저 (Web Crypto API)
const array = new Uint8Array(32);
window.crypto.getRandomValues(array);  // CSPRNG

// ❌ 금지
const badToken = Math.random().toString(36);  // PRNG
```

### Java

```java
import java.security.SecureRandom;
import java.util.Base64;

// ✅ SecureRandom 사용 (NativePRNG — OS 엔트로피 사용)
SecureRandom sr = new SecureRandom();

byte[] key = new byte[32];
sr.nextBytes(key);  // AES-256 키

// 세션 ID 생성
byte[] sessionId = new byte[32];
sr.nextBytes(sessionId);
String sessionToken = Base64.getUrlEncoder().withoutPadding()
    .encodeToString(sessionId);

// ❌ 금지
import java.util.Random;
new Random().nextInt();  // PRNG — 예측 가능
```

```go
// Go
package main

import (
    "crypto/rand"
    "encoding/hex"
    "math/big"
)

func GenerateToken() (string, error) {
    b := make([]byte, 32)
    _, err := rand.Read(b)  // crypto/rand — OS CSPRNG
    if err != nil {
        return "", err
    }
    return hex.EncodeToString(b), nil
}

// 범위 내 정수
func RandomInt(max int64) (int64, error) {
    n, err := rand.Int(rand.Reader, big.NewInt(max))
    return n.Int64(), err
}
// ❌ 금지: math/rand (PRNG)
```

## 보안 토큰 생성 실무 패턴

```python
import secrets
import hashlib
import time

class SecureTokenGenerator:
    """보안 토큰 생성 (세션 ID, API 키, 비밀번호 재설정 등)"""

    @staticmethod
    def session_id() -> str:
        """세션 ID: 128 bit 엔트로피"""
        return secrets.token_urlsafe(16)  # 22자

    @staticmethod
    def api_key() -> str:
        """API 키: 256 bit 엔트로피 + 접두사"""
        raw = secrets.token_urlsafe(32)
        return f"sk_{raw}"  # stripe 스타일

    @staticmethod
    def password_reset_token() -> str:
        """비밀번호 재설정: 256 bit, URL-safe"""
        return secrets.token_urlsafe(32)  # 43자

    @staticmethod
    def otp_secret() -> bytes:
        """TOTP 시크릿: 20 bytes (160 bit)"""
        return secrets.token_bytes(20)

    @staticmethod
    def csrf_token() -> str:
        """CSRF 토큰: 128 bit"""
        return secrets.token_hex(16)  # 32자 hex

# 사용
tokens = SecureTokenGenerator()
print(tokens.session_id())     # 세션 쿠키에 저장
print(tokens.api_key())        # DB에 해시만 저장, 한 번만 노출
print(tokens.password_reset_token())  # 만료 시간과 함께 저장
```

## 흔한 실수 모음

```python
# ❌ 1. UUID v4를 보안 토큰으로 사용
import uuid
token = str(uuid.uuid4())
# UUID v4는 6 bit가 고정값 — 실제 엔트로피 122 bit
# 보안적으로는 괜찮지만, secrets가 더 명시적

# ❌ 2. 시간 기반 토큰
token = str(int(time.time() * 1000))  # 타임스탬프 — 1ms 단위 탐색

# ❌ 3. 해시로 예측 가능한 값 처리
token = hashlib.sha256(f"reset:{user_id}:{time.time()}".encode()).hexdigest()
# user_id + 시간 유추 가능 → 토큰 예측 가능

# ✅ 올바른 방법
token = secrets.token_urlsafe(32)  # 끝.
```

---

**지난 글:** [인증서와 신뢰 체인: PKI와 CA](/posts/websec-certificates-chain-of-trust/)

**다음 글:** [저장 데이터·전송 데이터 암호화 전략](/posts/websec-encryption-at-rest-in-transit/)

<br>
읽어주셔서 감사합니다. 😊
