---
title: "키 교환 프로토콜: Diffie-Hellman과 ECDH의 동작 원리"
description: "Diffie-Hellman 키 교환의 수학적 원리, ECDH로의 발전, TLS 1.3 핸드셰이크에서의 ECDHE 활용, 완전 순방향 비밀성(PFS) 개념을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["Diffie-Hellman", "ECDH", "키교환", "TLS", "PFS", "순방향비밀성", "암호화"]
featured: false
draft: false
---

[지난 글](/posts/websec-rsa-ecc/)에서 RSA와 ECC의 공개키 암호화 원리를 살펴봤다. 두 당사자가 처음 만날 때 어떻게 안전하게 공유 비밀을 만들 수 있을까? 이번 글에서는 **키 교환(Key Exchange) 프로토콜**의 핵심인 Diffie-Hellman과 ECDH를 다룬다.

## 키 교환 문제

안전한 통신을 하려면 대칭 암호화(AES)의 키를 공유해야 한다. 하지만 처음 만나는 두 당사자가 안전한 채널 없이 키를 교환할 수 있을까? 1976년 Diffie와 Hellman이 이 역설적 문제를 해결하는 프로토콜을 발표했다. 비밀 정보를 **공개 채널에서 교환하지 않고도** 양측이 같은 비밀을 공유할 수 있다.

![Diffie-Hellman 키 교환 프로토콜](/assets/posts/websec-key-exchange-dh.svg)

## Diffie-Hellman (DH): 수학적 원리

DH의 핵심은 **이산 로그 문제(Discrete Logarithm Problem)**다. `g^a mod p`를 계산하기는 쉽지만, 결과값에서 `a`를 역산하기는 매우 어렵다.

```python
# DH 키 교환 Python 구현 (개념 이해용)

# 공개 파라미터 (미리 합의, 누구나 알아도 됨)
p = 23  # 실제로는 2048 bit 이상 소수
g = 5   # 생성원

# Alice의 비밀값
a = 6  # 절대 공개 안 함
A = pow(g, a, p)  # A = g^a mod p = 5^6 mod 23 = 8  (공개)

# Bob의 비밀값
b = 15  # 절대 공개 안 함
B = pow(g, b, p)  # B = g^b mod p = 5^15 mod 23 = 19  (공개)

# 공개 채널에서 A와 B 교환 (도청자가 봐도 무방)

# Alice가 계산하는 공유 비밀
S_alice = pow(B, a, p)  # B^a mod p = 19^6 mod 23 = 2

# Bob이 계산하는 공유 비밀
S_bob = pow(A, b, p)    # A^b mod p = 8^15 mod 23 = 2

# S_alice == S_bob == 2
# 수학적 원리: B^a = (g^b)^a = g^(ab) = (g^a)^b = A^b (mod p)
print(S_alice == S_bob)  # True
```

도청자 Eve는 `g, p, A, B`를 알더라도 이산 로그 문제를 풀어야 `a`나 `b`를 구할 수 있다. 2048 bit 소수를 사용하면 현대 컴퓨터로는 불가능한 계산량이다.

### DH 취약점: MITM 공격

DH는 **인증(Authentication)**을 제공하지 않는다. 중간자(Mallory)가 Alice와 Bob 사이에서 각각 별도의 DH 교환을 수행하면 양쪽을 속일 수 있다.

```
Alice ←→ Mallory ←→ Bob
  (DH1)         (DH2)
```

이 문제를 해결하려면 **인증**이 필요하다 — 서버 인증서(TLS) 또는 사전 공유 키(PSK)가 그 역할을 한다.

## ECDH: 타원곡선 적용

ECDH(Elliptic Curve Diffie-Hellman)는 DH의 이산 로그 문제를 타원곡선 위의 점 연산으로 대체한다. 훨씬 짧은 키로 동등한 보안 강도를 제공한다.

```python
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey

# Alice ECDH 키 쌍 생성
alice_private = X25519PrivateKey.generate()
alice_public = alice_private.public_key()

# Bob ECDH 키 쌍 생성
bob_private = X25519PrivateKey.generate()
bob_public = bob_private.public_key()

# 공개키 교환 (네트워크 전송)
alice_public_bytes = alice_public.public_bytes_raw()
bob_public_bytes = bob_public.public_bytes_raw()

# 각자 공유 비밀 계산
shared_secret_alice = alice_private.exchange(
    X25519PrivateKey.from_private_bytes(b'').public_key().__class__.from_public_bytes(bob_public_bytes)
)
# 실제 코드:
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PublicKey
shared_alice = alice_private.exchange(X25519PublicKey.from_public_bytes(bob_public_bytes))
shared_bob = bob_private.exchange(X25519PublicKey.from_public_bytes(alice_public_bytes))

assert shared_alice == shared_bob  # 동일한 공유 비밀
```

### 공유 비밀을 세션 키로 변환

ECDH로 얻은 공유 비밀을 **그대로 암호화 키로 사용하면 안 된다**. 균일한 분포가 아닐 수 있고, 키 길이도 맞지 않을 수 있다. 반드시 KDF를 통해 세션 키를 유도해야 한다.

```python
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
import os

# 공유 비밀에서 AES 키 유도
def derive_session_key(shared_secret: bytes, salt: bytes = None) -> bytes:
    if salt is None:
        salt = os.urandom(32)
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,          # AES-256 키 길이
        salt=salt,
        info=b'session-key-v1'
    )
    return hkdf.derive(shared_secret)

session_key = derive_session_key(shared_alice)
# → 이 32바이트를 AES-GCM 키로 사용
```

## TLS 1.3의 ECDHE 키 교환

![TLS 1.3 ECDHE 핸드셰이크](/assets/posts/websec-key-exchange-ecdh.svg)

TLS 1.3은 **ECDHE(Ephemeral ECDH)**를 기본 키 교환 방식으로 채택했다. "Ephemeral"이 핵심이다.

```bash
# 서버 TLS 설정 확인 (nginx)
openssl s_client -connect example.com:443 -tls1_3 2>&1 | grep -E "Protocol|Cipher|Server Temp Key"

# 좋은 출력 예시:
# Protocol  : TLSv1.3
# Cipher    : TLS_AES_256_GCM_SHA384
# Server Temp Key: X25519, 253 bits  ← 임시 EC 키 사용 = PFS 보장
```

### 완전 순방향 비밀성 (PFS: Perfect Forward Secrecy)

ECDHE의 핵심 장점이다. 매 연결마다 새로운 임시 키 쌍을 생성하기 때문에, 나중에 서버의 장기 비밀키가 노출되더라도 **과거 통신의 암호를 복호화할 수 없다**.

```
# PFS 없는 구 방식 (정적 RSA 키 교환)
Client → [RSA로 암호화된 세션 키] → Server
# 서버 비밀키 노출 시: 저장된 모든 과거 트래픽 복호화 가능

# PFS 있는 ECDHE
Client ← [임시 EC 공개키] → Server (매 연결마다 새로 생성)
# 비밀키 노출돼도 이미 지워진 임시 키는 복원 불가 → 과거 세션 안전
```

```python
# nginx ECDHE 설정
# /etc/nginx/nginx.conf
"""
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_ecdh_curve X25519:P-256:P-384;
ssl_prefer_server_ciphers off;  # TLS 1.3에서는 off 권장
"""
```

## 실무 적용 체크리스트

```bash
# 1. TLS 설정에서 ECDHE 강제
# ❌ 금지: RSA 키 교환 (PFS 없음)
ssl_ciphers RSA-AES256-GCM-SHA384;  # PFS 없음

# ✅ 권장
ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

# 2. 취약한 DH 파라미터 교체
# Logjam 공격 방어: 1024 bit DH 파라미터 사용 금지
openssl dhparam -out /etc/nginx/dhparam.pem 4096

# 3. PFS 상태 확인
sslyze --tlsv1_3 example.com
```

DH/ECDH 키 교환을 이해하면 TLS가 왜 안전한지, 왜 서버 비밀키가 노출돼도 과거 통신은 안전한지를 명확하게 이해할 수 있다. 다음 글에서는 데이터 무결성을 보장하는 HMAC을 살펴본다.

---

**지난 글:** [RSA vs ECC: 공개키 암호화 알고리즘 완전 비교](/posts/websec-rsa-ecc/)

**다음 글:** [HMAC: 해시 기반 메시지 인증 코드](/posts/websec-hmac/)

<br>
읽어주셔서 감사합니다. 😊
