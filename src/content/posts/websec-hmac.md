---
title: "HMAC: 해시 기반 메시지 인증 코드의 원리와 활용"
description: "HMAC의 내부 구조(이중 해시), 길이 확장 공격 방어 원리, API 서명·JWT·웹훅 검증·TOTP 등 실무 사용 사례, 타이밍 공격 방어법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["HMAC", "MAC", "메시지인증", "SHA256", "API서명", "웹훅", "TOTP", "무결성"]
featured: false
draft: false
---

[지난 글](/posts/websec-key-exchange/)에서 Diffie-Hellman과 ECDH로 두 당사자가 공유 비밀을 만드는 방법을 살펴봤다. 그렇다면 공유한 키로 메시지가 **변조되지 않았음**을 어떻게 증명할까? 이번 글에서는 무결성과 인증을 동시에 제공하는 **HMAC(Hash-based Message Authentication Code)**을 다룬다.

## MAC이란 무엇인가?

단순 해시(SHA-256 등)는 무결성을 검증한다 — 데이터가 변조되지 않았는지 확인할 수 있다. 하지만 **인증**은 제공하지 않는다. 공격자가 메시지와 해시를 모두 교체하면 수신자는 알아챌 수 없다.

**MAC(Message Authentication Code)**은 비밀 키를 사용해 무결성과 인증을 동시에 제공한다. 키 없이는 유효한 MAC을 만들 수 없다.

```python
import hashlib

# ❌ 단순 해시: 인증 없음
digest = hashlib.sha256(message).hexdigest()
# 공격자도 같은 계산 가능 — 위조 탐지 불가

# ✅ HMAC: 키 있어야 생성 가능
import hmac
mac = hmac.new(secret_key, message, hashlib.sha256).hexdigest()
# 키 없으면 유효한 MAC 생성 불가 → 위조 탐지 가능
```

## HMAC의 내부 구조

HMAC은 단순히 `HASH(key + message)`가 아니다. 이 naive한 방식은 **길이 확장 공격(Length Extension Attack)**에 취약하기 때문이다.

![HMAC 내부 구조](/assets/posts/websec-hmac-structure.svg)

HMAC은 이중 해시 구조로 길이 확장 공격을 원천 차단한다:

```python
# HMAC 수동 구현 (이해용)
def hmac_sha256(key: bytes, message: bytes) -> bytes:
    block_size = 64  # SHA-256 블록 크기

    # 키를 블록 크기로 맞춤
    if len(key) > block_size:
        key = hashlib.sha256(key).digest()
    key = key.ljust(block_size, b'\x00')

    # ipad, opad 상수
    ipad = bytes([0x36] * block_size)
    opad = bytes([0x5c] * block_size)

    # XOR 연산
    k_ipad = bytes(a ^ b for a, b in zip(key, ipad))
    k_opad = bytes(a ^ b for a, b in zip(key, opad))

    # 이중 해시
    inner = hashlib.sha256(k_ipad + message).digest()
    outer = hashlib.sha256(k_opad + inner).digest()
    return outer

# 표준 라이브러리 사용 (실무에서는 항상 이 방식)
import hmac, hashlib
result = hmac.new(key, message, hashlib.sha256).digest()
```

### 왜 이중 해시인가? — 길이 확장 공격

SHA-256, MD5 등 Merkle-Damgård 구조 해시 함수는 `HASH(K ∥ M)` 형태에서 **길이 확장 공격**에 취약하다.

```
공격자가 알고 있는 것:
- H(K ∥ M) 값
- M의 길이 (K 길이 모름)

공격자가 할 수 있는 것:
- K 없이도 H(K ∥ M ∥ padding ∥ M') 계산 가능
- 즉, 원본 M 뒤에 M' 추가한 유효한 MAC 위조 가능!
```

HMAC의 외부 해시가 이를 막는다. `H(K_opad ∥ inner)`에서 inner 뒤에 공격자가 데이터를 추가해도 K_opad와 XOR된 키 없이는 외부 해시를 다시 계산할 수 없다.

## 실무 활용 사례

![HMAC 주요 사용 사례](/assets/posts/websec-hmac-usecases.svg)

### 1. Webhook 서명 검증

GitHub, Stripe, Slack 등 주요 서비스가 채택하는 방식이다.

```python
import hmac
import hashlib

def verify_github_webhook(payload: bytes, signature_header: str, secret: str) -> bool:
    """GitHub Webhook 서명 검증"""
    if not signature_header.startswith('sha256='):
        return False

    received = signature_header[7:]  # 'sha256=' 제거
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    # 반드시 compare_digest 사용 — 타이밍 공격 방어
    return hmac.compare_digest(expected, received)

# Flask 예시
from flask import request, abort

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Hub-Signature-256', '')
    if not verify_github_webhook(request.data, signature, WEBHOOK_SECRET):
        abort(403)
    process_payload(request.json)
    return 'OK'
```

### 2. JWT HS256 서명

```python
import base64
import json
import hmac
import hashlib

def jwt_hs256_sign(payload: dict, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}

    def b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

    header_b64 = b64url(json.dumps(header, separators=(',', ':')).encode())
    payload_b64 = b64url(json.dumps(payload, separators=(',', ':')).encode())
    signing_input = f"{header_b64}.{payload_b64}".encode()

    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{b64url(signature)}"

# 검증
def jwt_hs256_verify(token: str, secret: str) -> dict:
    header_b64, payload_b64, sig_b64 = token.split('.')
    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    received = base64.urlsafe_b64decode(sig_b64 + '==')
    if not hmac.compare_digest(expected, received):
        raise ValueError("Invalid signature")
    return json.loads(base64.urlsafe_b64decode(payload_b64 + '=='))
```

### 3. TOTP (Time-based One-Time Password)

Google Authenticator 등 OTP 앱의 기반 기술이다.

```python
import hmac
import hashlib
import time
import struct

def generate_totp(secret: bytes, digits: int = 6, interval: int = 30) -> str:
    """RFC 6238 TOTP 구현"""
    # 현재 타임스텝 (30초 단위)
    counter = int(time.time()) // interval

    # HMAC-SHA1(시크릿, 카운터)
    counter_bytes = struct.pack('>Q', counter)
    mac = hmac.new(secret, counter_bytes, hashlib.sha1).digest()

    # 동적 잘라내기
    offset = mac[-1] & 0x0F
    code = struct.unpack('>I', mac[offset:offset + 4])[0]
    code &= 0x7FFFFFFF  # 최상위 비트 제거
    return str(code % (10 ** digits)).zfill(digits)
```

## 타이밍 공격과 `compare_digest`

HMAC 검증에서 `==` 비교를 사용하면 **타이밍 공격(Timing Attack)**에 취약하다.

```python
# ❌ 위험: 문자열 비교는 첫 불일치 위치에서 즉시 반환
if received_mac == expected_mac:  # 시간 차이로 일치 길이 유추 가능

# ✅ 안전: 전체를 동일 시간에 비교
import hmac
if hmac.compare_digest(received_mac, expected_mac):  # 항상 동일 시간
```

공격자는 응답 시간 차이를 수천 번 측정해 예상 MAC과 수신 MAC이 몇 바이트나 일치하는지 알아낼 수 있다. `compare_digest`는 항상 동일한 시간이 걸리도록 XOR 비교를 수행해 이를 방어한다.

## HMAC 알고리즘 선택

```python
import hmac
import hashlib

# 권장 순서
hmac.new(key, msg, hashlib.sha256)   # ✅ 범용 — HMAC-SHA256
hmac.new(key, msg, hashlib.sha384)   # ✅ 고보안 요구시
hmac.new(key, msg, hashlib.sha512)   # ✅ 고보안 요구시

# 레거시 — 무결성 용도라면 피할 것
hmac.new(key, msg, hashlib.sha1)     # ⚠ TOTP는 RFC 6238로 SHA1 명시
hmac.new(key, msg, hashlib.md5)      # ❌ 사용 금지
```

HMAC-SHA256이 가장 널리 사용된다. SHA-1은 TOTP 같이 표준에 명시된 경우에만 사용한다. SHA-256 이상이면 현재로서 충분히 안전하다.

---

**지난 글:** [키 교환 프로토콜: Diffie-Hellman과 ECDH](/posts/websec-key-exchange/)

**다음 글:** [키 유도 함수: PBKDF2·bcrypt·Argon2·scrypt 비교](/posts/websec-key-derivation-functions/)

<br>
읽어주셔서 감사합니다. 😊
