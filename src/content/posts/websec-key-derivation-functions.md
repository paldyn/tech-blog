---
title: "키 유도 함수: PBKDF2·bcrypt·scrypt·Argon2 완전 비교"
description: "비밀번호 해싱 전용 키 유도 함수(KDF) PBKDF2, bcrypt, scrypt, Argon2id의 내부 동작, GPU 공격 저항성, OWASP 권장 파라미터, 실무 구현을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["KDF", "Argon2", "bcrypt", "PBKDF2", "scrypt", "비밀번호해싱", "메모리경화"]
featured: false
draft: false
---

[지난 글](/posts/websec-hmac/)에서 HMAC으로 메시지 무결성과 인증을 보장하는 방법을 살펴봤다. 이번 글에서는 비밀번호를 안전하게 저장하는 핵심 기술인 **키 유도 함수(KDF: Key Derivation Function)**를 다룬다.

## 왜 SHA-256으로 비밀번호를 해싱하면 안 되나?

SHA-256은 빠르다 — 그게 문제다. 현대 GPU는 초당 수십억 개의 SHA-256 해시를 계산한다. 데이터베이스가 유출되면 공격자는 GPU 팜을 이용해 수백만 개의 비밀번호를 순식간에 복원할 수 있다.

```python
# ❌ 절대 금지: 단순 해시
import hashlib
password_hash = hashlib.sha256(password.encode()).hexdigest()
# GPU: 초당 10억+ 해시 → 8자리 비밀번호 수분 내 크랙

# ❌ 더 나쁨: 솔트 없는 해시
# → 레인보우 테이블 공격 가능

# ❌ 잘못된 솔트: 예측 가능한 값
salt = username  # 안됨 — 공격자가 미리 계산 가능

# ✅ 올바른 방향: 의도적으로 느린 KDF + 랜덤 솔트
```

비밀번호 해싱 전용 KDF는 **의도적으로 느리게** 설계된다. 합법적인 사용자는 한 번만 실행하므로 수십~수백 밀리초의 지연은 허용되지만, 공격자의 대규모 병렬 공격은 실현 불가능해진다.

## 4가지 KDF 비교

![비밀번호 KDF 비교](/assets/posts/websec-kdf-comparison.svg)

### PBKDF2 (Password-Based Key Derivation Function 2)

```python
import hashlib
import os

def pbkdf2_hash(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode(),
        salt,
        iterations=600_000  # OWASP 2023 권장: SHA-256 기준 600,000
    )
    return f"$pbkdf2$600000${salt.hex()}${dk.hex()}"
```

PBKDF2는 NIST SP 800-132 표준이자 FIPS 승인 알고리즘이라 규제 환경(정부, 금융)에서 선호된다. 하지만 메모리를 거의 사용하지 않아 GPU 병렬 공격에 취약하다.

### bcrypt

```python
import bcrypt

def bcrypt_hash(password: str) -> bytes:
    salt = bcrypt.gensalt(rounds=12)  # cost factor: 12 (OWASP 권장)
    return bcrypt.hashpw(password.encode(), salt)

def bcrypt_verify(password: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(password.encode(), hashed)

# bcrypt의 한계: 최대 72바이트만 처리
# 73자 이상은 뒤가 잘림 → 긴 비밀번호 false match 가능
# 해결: bcrypt 전 SHA-256 해싱 (정규화)
import hashlib, base64

def bcrypt_hash_safe(password: str) -> bytes:
    # 72바이트 한계 우회
    normalized = base64.b64encode(hashlib.sha256(password.encode()).digest())
    return bcrypt.hashpw(normalized, bcrypt.gensalt(rounds=12))
```

bcrypt는 30년 가까이 사용된 검증된 알고리즘이다. 하지만 72바이트 입력 한계, 4KB 고정 메모리 사용, 최대 31 라운드 제한이 있다.

### Argon2 (권장)

2015년 Password Hashing Competition(PHC) 우승자. 메모리 경화(memory-hard)로 GPU 공격을 가장 효과적으로 막는다.

```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

# OWASP 권장 파라미터 (2023)
ph = PasswordHasher(
    time_cost=3,        # 이터레이션 횟수
    memory_cost=65536,  # 64 MB (단위: KB)
    parallelism=4,      # 병렬 스레드
    hash_len=32,        # 출력 해시 길이
    salt_len=16         # 솔트 길이
)

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(stored_hash: str, input_password: str) -> bool:
    try:
        ph.verify(stored_hash, input_password)
        return True
    except VerifyMismatchError:
        return False

def needs_rehash(stored_hash: str) -> bool:
    return ph.check_needs_rehash(stored_hash)
```

Argon2는 세 가지 변형이 있다:
- **Argon2d**: GPU 공격 저항 최강, 사이드채널 공격에 취약 (데이터베이스 해싱에 부적합)
- **Argon2i**: 사이드채널 안전, GPU 저항 약간 낮음
- **Argon2id**: d+i 하이브리드 — **실무 권장**

## 비밀번호 저장 완전 흐름

![비밀번호 저장 및 검증 흐름](/assets/posts/websec-kdf-flow.svg)

```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import logging

ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)

class PasswordService:
    def register(self, user_id: str, plaintext: str) -> str:
        """비밀번호 해싱 후 저장"""
        return ph.hash(plaintext)  # 솔트 자동 생성, 해시에 내장

    def login(self, stored_hash: str, input_password: str) -> bool:
        """로그인 검증 + 자동 재해싱"""
        try:
            ph.verify(stored_hash, input_password)
            # 파라미터가 업그레이드됐으면 재해싱 (다음 로그인 시 강화 반영)
            if ph.check_needs_rehash(stored_hash):
                new_hash = ph.hash(input_password)
                self._update_hash_in_db(new_hash)
            return True
        except VerifyMismatchError:
            return False
        except Exception as e:
            logging.error(f"Password verification error: {e}")
            return False
```

## 일반 키 유도: HKDF

비밀번호 해싱이 아닌 **암호화 키 유도**에는 HKDF(HMAC-based KDF)를 사용한다.

```python
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
import os

def derive_encryption_key(
    shared_secret: bytes,
    context: bytes,
    length: int = 32
) -> bytes:
    """ECDH 공유 비밀에서 AES 키 유도"""
    salt = os.urandom(32)
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=length,
        salt=salt,
        info=context
    )
    return hkdf.derive(shared_secret)

# 사용 예
aes_key = derive_encryption_key(
    shared_secret=ecdh_shared_secret,
    context=b"file-encryption-key-v1"
)
```

## OWASP 2023 권장 파라미터 요약

| KDF | 파라미터 | 목표 시간 |
|-----|---------|----------|
| Argon2id | m=64MB, t=3, p=4 | ~500ms |
| bcrypt | cost=12 | ~300ms |
| scrypt | N=32768, r=8, p=1 | ~300ms |
| PBKDF2-SHA256 | 600,000 iterations | ~500ms |

로그인 지연이 허용되는 환경이라면 파라미터를 더 강하게 설정해도 된다. 파라미터는 하드웨어 업그레이드와 함께 주기적으로 재검토해야 한다.

---

**지난 글:** [HMAC: 해시 기반 메시지 인증 코드](/posts/websec-hmac/)

**다음 글:** [디지털 서명: RSA·ECDSA·EdDSA의 동작 원리](/posts/websec-digital-signatures/)

<br>
읽어주셔서 감사합니다. 😊
