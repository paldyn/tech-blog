---
title: "RSA vs ECC: 공개키 암호화 알고리즘 완전 비교"
description: "RSA와 ECC(타원곡선 암호)의 수학적 기반, 키 길이별 보안 강도, 성능 차이, 실제 사용 사례를 비교하고 안전한 구현 시 주의점을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["RSA", "ECC", "타원곡선암호", "공개키암호화", "ECDSA", "디지털서명", "암호화"]
featured: false
draft: false
---

[지난 글](/posts/websec-aes-modes/)에서 대칭 암호화 AES의 운용 모드를 살펴봤다. 이번 글에서는 공개키(비대칭) 암호화의 양대 산맥인 **RSA**와 **ECC(Elliptic Curve Cryptography)**를 비교하며, 실무에서 어떤 알고리즘을 선택해야 하는지 살펴본다.

## 공개키 암호화란?

대칭 암호화는 암호화와 복호화에 **같은 키**를 사용한다. 하지만 처음 만나는 두 당사자가 안전하게 키를 공유하려면 어떻게 해야 할까? 공개키 암호화는 이 문제를 수학적 단방향 함수로 해결한다.

- **공개키(Public Key)**: 누구에게나 공개. 암호화 또는 서명 검증에 사용
- **비밀키(Private Key)**: 소유자만 보관. 복호화 또는 서명 생성에 사용

공개키로 암호화된 메시지는 **대응하는 비밀키로만** 복호화할 수 있다. 이 비대칭성이 안전한 키 교환과 디지털 서명의 기반이다.

![RSA vs ECC 비교](/assets/posts/websec-rsa-ecc-comparison.svg)

## RSA: 소인수분해의 어려움

RSA는 1977년 발표된 공개키 암호화의 원조다. 핵심 아이디어는 단순하다: **두 큰 소수의 곱은 쉽게 계산되지만, 그 역과정(소인수분해)은 현실적으로 불가능하다**.

```python
# RSA 키 생성 과정 (개념 설명용)
from sympy import randprime, mod_inverse

def rsa_keygen(bits=2048):
    p = randprime(2**(bits//2 - 1), 2**(bits//2))  # 큰 소수 p
    q = randprime(2**(bits//2 - 1), 2**(bits//2))  # 큰 소수 q
    n = p * q                                        # 공개 모듈러스
    phi_n = (p - 1) * (q - 1)                       # 오일러 파이 함수
    e = 65537                                        # 공개 지수 (관례적으로 사용)
    d = mod_inverse(e, phi_n)                        # 비밀 지수
    public_key = (e, n)
    private_key = (d, n)
    return public_key, private_key

# 암호화: C = M^e mod n
# 복호화: M = C^d mod n
```

RSA 키 길이와 보안 강도의 관계:

| 키 길이 | 보안 강도 | 권장 용도 |
|---------|-----------|-----------|
| 1024 bit | ❌ 취약 | 사용 금지 |
| 2048 bit | 112 bit | 단기 용도만 |
| 3072 bit | 128 bit | 2030년까지 |
| 4096 bit | 140 bit | 장기 권장 |

### RSA 구현 시 주의점

RSA의 수학적 안전성과 별개로 **구현 방식**에서 취약점이 자주 발생한다.

```python
# ❌ 위험: 패딩 없는 교과서적 RSA
ciphertext = pow(plaintext, e, n)  # Bleichenbacher 공격에 취약

# ✅ 안전: OAEP 패딩 사용 (암호화)
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives import hashes

private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048
)
ciphertext = private_key.public_key().encrypt(
    plaintext,
    padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None
    )
)
```

## ECC: 타원곡선 위의 점 연산

ECC는 타원곡선 위의 점들이 이루는 군(group) 구조를 활용한다. 타원곡선은 `y² = x³ + ax + b (mod p)` 형태이며, 이 위의 점 덧셈 연산은 쉽지만 **역산(이산 로그 문제)**은 현실적으로 불가능하다.

```python
# ECC 키 쌍 생성 (Python cryptography 라이브러리)
from cryptography.hazmat.primitives.asymmetric import ec

# P-256 곡선 사용 (NIST 표준, 128 bit 보안 강도)
private_key = ec.generate_private_key(ec.SECP256R1())
public_key = private_key.public_key()

# ECDSA 서명 생성
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec

signature = private_key.sign(
    message,
    ec.ECDSA(hashes.SHA256())
)

# ECDSA 서명 검증
public_key.verify(signature, message, ec.ECDSA(hashes.SHA256()))
```

### 주요 타원곡선 표준

| 곡선 | 별칭 | 키 길이 | 보안 강도 | 특징 |
|------|------|---------|-----------|------|
| P-256 | secp256r1 | 256 bit | 128 bit | NIST 표준, TLS에서 가장 많이 사용 |
| P-384 | secp384r1 | 384 bit | 192 bit | 고보안 요구 환경 |
| X25519 | Curve25519 | 255 bit | 128 bit | 빠르고 안전, TLS 1.3 기본 |
| Ed25519 | - | 255 bit | 128 bit | 서명 전용, SSH 최신 표준 |
| secp256k1 | - | 256 bit | 128 bit | 비트코인, 이더리움 사용 |

X25519/Ed25519는 Bernstein이 설계한 곡선으로, NIST 곡선의 백도어 의혹을 피하고 상수 시간 구현이 더 쉽다.

## 암호화 흐름 비교

![RSA 암호화 복호화 흐름](/assets/posts/websec-rsa-ecc-encryption-flow.svg)

실제 프로토콜에서 RSA와 ECC가 어떻게 사용되는지 이해하는 것이 중요하다.

```python
# ❌ 잘못된 이해: RSA/ECC로 대용량 데이터를 직접 암호화
# 공개키 암호화는 느리고 크기 제한이 있음

# ✅ 실제 패턴: 하이브리드 암호화
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

def hybrid_encrypt(rsa_public_key, plaintext: bytes) -> dict:
    # 1. 임시 AES 키 생성
    aes_key = os.urandom(32)  # AES-256

    # 2. AES로 실제 데이터 암호화
    nonce = os.urandom(12)
    aesgcm = AESGCM(aes_key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)

    # 3. AES 키를 RSA 공개키로 암호화 (키 래핑)
    encrypted_key = rsa_public_key.encrypt(
        aes_key,
        padding.OAEP(padding.MGF1(hashes.SHA256()), hashes.SHA256(), None)
    )
    return {"encrypted_key": encrypted_key, "nonce": nonce, "ciphertext": ciphertext}
```

## RSA vs ECC 실무 선택 가이드

**ECC를 선택해야 하는 경우:**
- TLS/HTTPS 인증서 (P-256 또는 X25519)
- SSH 키 인증 (Ed25519 권장)
- JWT 서명 (ES256, ES384)
- 모바일 앱, IoT 기기 (배터리·성능 제약)

**RSA를 유지해야 하는 경우:**
- 레거시 시스템 호환성이 필요한 경우
- 일부 HSM이나 레거시 라이브러리가 ECC 미지원
- 법적·규제 요구사항으로 RSA 명시된 경우

```bash
# OpenSSL로 각각 키 쌍 생성
# RSA 2048 (구형, 하위 호환용)
openssl genrsa -out rsa_private.pem 2048
openssl rsa -in rsa_private.pem -pubout -out rsa_public.pem

# EC P-256 (권장)
openssl ecparam -genkey -name prime256v1 -noout -out ec_private.pem
openssl ec -in ec_private.pem -pubout -out ec_public.pem

# Ed25519 (SSH 등 서명 전용)
openssl genpkey -algorithm ED25519 -out ed25519_private.pem
```

## 양자 컴퓨터와 미래

RSA와 ECC 모두 Shor 알고리즘을 구현한 양자 컴퓨터 앞에서는 취약하다. NIST는 2024년 **Post-Quantum Cryptography(PQC)** 표준을 확정했다:

- **ML-KEM** (Kyber): 키 캡슐화, 키 교환
- **ML-DSA** (Dilithium): 디지털 서명
- **SLH-DSA** (SPHINCS+): 해시 기반 서명

당장 RSA/ECC를 교체할 필요는 없지만, 민감한 데이터를 장기 보관하는 시스템은 지금부터 PQC 전환 계획을 수립해야 한다. "Harvest Now, Decrypt Later" 공격(지금 암호화된 데이터를 수집해 나중에 양자 컴퓨터로 복호화)을 고려해야 하기 때문이다.

---

**지난 글:** [AES 운용 모드: ECB·CBC·GCM의 보안 차이](/posts/websec-aes-modes/)

**다음 글:** [키 교환 프로토콜: Diffie-Hellman과 ECDH](/posts/websec-key-exchange/)

<br>
읽어주셔서 감사합니다. 😊
