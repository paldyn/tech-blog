---
title: "해싱 vs 암호화: 언제 무엇을 쓸까"
description: "단방향 해시 함수와 양방향 암호화의 근본적 차이, 비밀번호 저장에 암호화 대신 해싱을 써야 하는 이유, MD5/SHA-1/SHA-256/bcrypt/Argon2 알고리즘 선택 기준을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["해싱", "암호화", "비밀번호해싱", "bcrypt", "Argon2", "SHA256", "단방향함수"]
featured: false
draft: false
---

[지난 글](/posts/websec-symmetric-vs-asymmetric/)에서 대칭·비대칭 암호화의 차이와 TLS의 하이브리드 구조를 살펴봤다. 이번 글에서는 암호학에서 자주 혼동되는 **해싱(Hashing)과 암호화(Encryption)**의 근본적 차이를 명확히 하고, 각 상황에서 올바른 선택을 한다.

## 핵심 차이: 단방향 vs 양방향

![해싱 vs 암호화: 핵심 차이](/assets/posts/websec-hashing-vs-encryption-diff.svg)

**해싱**은 임의 크기의 입력을 고정 크기의 다이제스트(digest)로 변환하는 단방향 함수다. 수학적으로 역방향 계산이 불가능하다 — 다이제스트에서 원본을 복구할 수 없다.

**암호화**는 키를 사용해 데이터를 변환하는 양방향 함수다. 같은 키(대칭) 또는 쌍(비대칭)으로 원본을 복구할 수 있다.

## 비밀번호는 반드시 해싱

가장 흔한 보안 실수 중 하나는 비밀번호를 암호화해서 저장하는 것이다.

```python
# ❌ 잘못된 방식 — 비밀번호를 암호화로 저장
def wrong_store_password(password: str) -> bytes:
    # AES로 암호화 — 키가 있으면 복구 가능!
    return encrypt(SECRET_KEY, password.encode())

# ❌ 더 나쁜 방식 — 평문 저장
def terrible_store_password(password: str) -> str:
    return password  # 데이터베이스 침해 시 즉시 전체 유출

# ✅ 올바른 방식 — 비밀번호를 단방향 해싱
def correct_store_password(password: str) -> str:
    import bcrypt
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt(rounds=12)
    ).decode('utf-8')
```

**왜 암호화가 아닌 해싱인가?**

비밀번호는 복호화할 필요가 없다. 로그인 시 사용자가 입력한 비밀번호를 다시 해싱해서 저장된 해시와 비교하면 된다. 암호화로 저장하면 키가 유출되는 순간 전체 비밀번호 데이터베이스가 위험해진다.

## 알고리즘 선택 가이드

![해시 함수 알고리즘 선택 가이드](/assets/posts/websec-hashing-use-cases.svg)

### MD5, SHA-1: 절대 금지

```python
# ❌ MD5 — 충돌 알려짐, 레인보우 테이블로 역추적 가능
import hashlib
h = hashlib.md5(b"password123").hexdigest()
# 1초도 안 걸려 역추적 가능

# ❌ SHA-1 — SHAttered 공격(2017)으로 충돌 데모됨
h = hashlib.sha1(b"password123").hexdigest()
```

MD5와 SHA-1은 **속도가 매우 빠르다** — 이것이 비밀번호 해싱에서는 치명적인 단점이다. GPU로 초당 수백억 개의 해시를 계산할 수 있어 무차별 대입 공격이 현실적으로 가능하다.

### SHA-256/384/512: 파일 무결성에 사용

```python
import hashlib

# 파일 무결성 검증 — SHA-256 적합
def verify_file_integrity(filepath: str, expected_hash: str) -> bool:
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest() == expected_hash

# HMAC으로 메시지 인증 코드 생성 (API 요청 서명 등)
import hmac
mac = hmac.new(SECRET_KEY, message, hashlib.sha256).hexdigest()
```

SHA-256은 파일 무결성 검증, SRI 해시, 디지털 서명의 해시 단계에 적합하다. 그러나 **비밀번호 해싱에는 사용하면 안 된다** — 너무 빠르기 때문이다.

### bcrypt: 비밀번호 해싱 표준

bcrypt는 의도적으로 느리게 설계되어 있다. `cost factor`(작업량)를 조절해 하드웨어 발전에 맞춰 속도를 조절할 수 있다.

```python
import bcrypt

def hash_password(password: str) -> str:
    # cost=12: 약 0.2~0.5초 (권장 최솟값)
    # cost=14: 약 1초 (보안 민감 환경)
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(
        password.encode('utf-8'),
        hashed.encode('utf-8')
    )

# 사용
hashed = hash_password("myP@ssword123!")
assert verify_password("myP@ssword123!", hashed)  # True
assert not verify_password("wrongpassword", hashed)  # False
```

bcrypt는 salt를 자동으로 생성해 포함하므로 같은 비밀번호도 매번 다른 해시가 생성된다. 레인보우 테이블 공격이 원천 차단된다.

**한계**: 최대 72바이트 입력 제한이 있다. 긴 비밀번호는 앞 72바이트만 처리된다.

### Argon2id: 현재 최고 표준

2015년 Password Hashing Competition(PHC) 우승 알고리즘이다. bcrypt보다 강력한 이유는 **메모리 집약적**이라 GPU 병렬 처리에 저항성이 있다.

```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher(
    time_cost=2,        # 반복 횟수
    memory_cost=65536,  # 메모리 사용량 (KB) = 64MB
    parallelism=2       # 병렬 스레드
)

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(stored_hash: str, password: str) -> bool:
    try:
        return ph.verify(stored_hash, password)
    except VerifyMismatchError:
        return False

# 재해싱 필요 여부 확인 (설정 변경 후)
def login_and_update(stored_hash: str, password: str) -> str | None:
    if not verify_password(stored_hash, password):
        return None
    if ph.check_needs_rehash(stored_hash):
        return hash_password(password)  # 새 해시 반환
    return stored_hash
```

### scrypt: Argon2의 대안

Node.js 내장 crypto 모듈이 scrypt를 지원한다.

```javascript
const { scrypt, randomBytes } = require('node:crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(32);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
```

## 언제 무엇을 쓸 것인가

| 용도 | 권장 알고리즘 |
|---|---|
| 비밀번호 저장 | Argon2id (우선) / bcrypt |
| API 요청 서명 (HMAC) | HMAC-SHA256 |
| 파일 무결성 검증 | SHA-256 / SHA-384 |
| 디지털 서명 내 해시 | SHA-256 이상 |
| TLS 인증서 서명 | SHA-256 이상 |
| ❌ 절대 금지 | MD5, SHA-1 (모든 보안 용도) |

---

**지난 글:** [대칭 암호화 vs 비대칭 암호화](/posts/websec-symmetric-vs-asymmetric/)

**다음 글:** [AES 운용 모드: ECB·CBC·GCM의 보안 차이](/posts/websec-aes-modes/)

<br>
읽어주셔서 감사합니다. 😊
