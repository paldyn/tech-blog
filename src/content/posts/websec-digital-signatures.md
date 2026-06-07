---
title: "디지털 서명: RSA-PSS·ECDSA·Ed25519 동작 원리와 취약점"
description: "디지털 서명의 서명-검증 흐름, 인증·무결성·부인방지 속성, RSA-PSS·ECDSA·Ed25519 알고리즘 비교, ECDSA 난수 재사용 취약점과 Ed25519 권장 이유를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["디지털서명", "RSA-PSS", "ECDSA", "Ed25519", "EdDSA", "서명검증", "부인방지"]
featured: false
draft: false
---

[지난 글](/posts/websec-key-derivation-functions/)에서 KDF로 비밀번호를 안전하게 저장하는 방법을 살펴봤다. 이번 글에서는 **디지털 서명(Digital Signature)**을 다룬다. 디지털 서명은 공개키 암호화를 역방향으로 활용해 인증, 무결성, 부인 방지를 동시에 제공한다.

## 디지털 서명 vs HMAC

둘 다 메시지 인증에 사용하지만 근본적인 차이가 있다.

| | HMAC | 디지털 서명 |
|---|---|---|
| 키 타입 | 대칭 (공유 비밀) | 비대칭 (공개키/비밀키) |
| 서명자 | 키 공유 당사자 모두 가능 | 비밀키 소유자만 |
| 검증자 | 키 공유 당사자만 | 누구나 (공개키로) |
| 부인 방지 | ❌ 없음 | ✅ 있음 |

계약서 서명, 코드 서명, 공개 인증서처럼 **서명자가 누구인지 제3자도 검증해야 하는 경우**에는 디지털 서명이 필요하다.

## 서명 생성 · 검증 흐름

![디지털 서명 생성 및 검증 흐름](/assets/posts/websec-digital-signatures-flow.svg)

디지털 서명은 **메시지 전체를 암호화하지 않는다**. 메시지 해시에만 서명해 효율적으로 동작한다.

```python
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding, PublicFormat, PrivateFormat, NoEncryption
)

# 키 생성
private_key = Ed25519PrivateKey.generate()
public_key = private_key.public_key()

# 키 직렬화 (저장/전송용)
priv_bytes = private_key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
pub_bytes = public_key.public_bytes(Encoding.Raw, PublicFormat.Raw)

# 서명 생성
message = b"Transfer 1000 USD to account 12345"
signature = private_key.sign(message)  # 64 bytes
print(f"Signature: {signature.hex()}")

# 서명 검증
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature

pub_key = Ed25519PublicKey.from_public_bytes(pub_bytes)
try:
    pub_key.verify(signature, message)
    print("✅ 서명 유효")
except InvalidSignature:
    print("❌ 서명 무효 — 위조 또는 변조")
```

## 알고리즘 비교

![디지털 서명 알고리즘 비교](/assets/posts/websec-digital-signatures-algorithms.svg)

### RSA-PSS

RSA-PKCS#1 v1.5 서명(레거시)과 달리 RSA-PSS는 랜덤 솔트를 포함해 보안이 강화됐다.

```python
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes

private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

# RSA-PSS 서명
signature = private_key.sign(
    message,
    padding.PSS(
        mgf=padding.MGF1(hashes.SHA256()),
        salt_length=padding.PSS.MAX_LENGTH
    ),
    hashes.SHA256()
)

# 검증
private_key.public_key().verify(
    signature, message,
    padding.PSS(
        mgf=padding.MGF1(hashes.SHA256()),
        salt_length=padding.PSS.MAX_LENGTH
    ),
    hashes.SHA256()
)
```

### ECDSA — 난수 재사용 취약점

ECDSA는 서명 생성 시 **반드시 유일한 난수 k**를 사용해야 한다. 같은 k를 두 번 사용하면 비밀키가 수학적으로 복원된다.

```python
# ❌ ECDSA 난수 재사용 → 비밀키 누출
# Sony PS3가 이 버그로 비밀키 공개됨 (2010)
# 비트코인 안드로이드 지갑도 동일 문제로 수천 BTC 도난 (2013)

# 실제 공격 수식:
# 두 메시지 M1, M2에 같은 k 사용 시:
# s1 = k^(-1)(H(M1) + r*d) mod n
# s2 = k^(-1)(H(M2) + r*d) mod n
# → d (비밀키) = (s1*H(M2) - s2*H(M1)) / (s2 - s1) * r^(-1) mod n

# ✅ RFC 6979: 결정론적 ECDSA (k를 비밀키와 메시지 해시로 확정 생성)
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes

# cryptography 라이브러리는 RFC 6979 자동 적용
private_key = ec.generate_private_key(ec.SECP256R1())
signature = private_key.sign(message, ec.ECDSA(hashes.SHA256()))
```

### Ed25519 — 현대 표준

Ed25519(EdDSA on Curve25519)는 난수 의존성이 없고, 빠르고, 구현이 안전하다.

```bash
# SSH 키 생성 - Ed25519 권장
ssh-keygen -t ed25519 -C "user@example.com"

# 레거시 RSA와 크기 비교
# Ed25519 공개키: 68 bytes (base64)
# RSA-4096 공개키: ~800 bytes (base64)
```

## JWT 서명 알고리즘 선택

JWT에서 서명 알고리즘 선택은 보안에 직결된다.

```python
import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

private_key = Ed25519PrivateKey.generate()
public_key = private_key.public_key()

# ✅ EdDSA (Ed25519) — 가장 권장
payload = {"sub": "user123", "role": "admin"}
token = jwt.encode(payload, private_key, algorithm="EdDSA")
decoded = jwt.decode(token, public_key, algorithms=["EdDSA"])

# ✅ ES256 (ECDSA P-256) — 광범위한 지원
from cryptography.hazmat.primitives.asymmetric import ec
ec_private = ec.generate_private_key(ec.SECP256R1())
token = jwt.encode(payload, ec_private, algorithm="ES256")

# ⚠ HS256 (HMAC) — 대칭 키, 마이크로서비스 간 공유 키 문제
# ❌ 절대 금지: alg="none" 허용 설정
```

## 코드 서명과 TLS 인증서

디지털 서명은 소프트웨어 배포와 HTTPS 인증서의 핵심이다.

```bash
# GPG로 파일 서명
gpg --detach-sign --armor release.tar.gz  # release.tar.gz.asc 생성

# 서명 검증
gpg --verify release.tar.gz.asc release.tar.gz

# X.509 인증서 서명 알고리즘 확인
openssl x509 -in cert.pem -text -noout | grep "Signature Algorithm"
# 권장: ecdsa-with-SHA256 또는 sha256WithRSAEncryption
# 구식: sha1WithRSAEncryption (사용 금지)

# CSR 생성 (ECDSA P-256)
openssl ecparam -genkey -name prime256v1 -noout -out server.key
openssl req -new -key server.key -out server.csr
```

---

**지난 글:** [키 유도 함수: PBKDF2·bcrypt·scrypt·Argon2 비교](/posts/websec-key-derivation-functions/)

**다음 글:** [인증서와 신뢰 체인: PKI와 CA의 동작 원리](/posts/websec-certificates-chain-of-trust/)

<br>
읽어주셔서 감사합니다. 😊
