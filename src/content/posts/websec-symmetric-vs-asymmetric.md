---
title: "대칭 암호화 vs 비대칭 암호화"
description: "하나의 키를 사용하는 대칭 암호화와 공개키/개인키 쌍을 사용하는 비대칭 암호화의 원리, 성능 차이, 키 교환 문제, TLS에서 두 방식을 결합하는 하이브리드 구조를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 8
type: "knowledge"
category: "Security"
tags: ["암호화", "대칭암호화", "비대칭암호화", "AES", "RSA", "ECC", "TLS", "공개키"]
featured: false
draft: false
---

[지난 글](/posts/websec-hsts/)에서 HSTS로 HTTP 연결을 HTTPS로 강제하는 방법을 살펴봤다. HTTPS의 핵심은 TLS가 제공하는 암호화다. 이번 글에서는 TLS와 현대 암호 시스템의 두 기둥인 **대칭 암호화**와 **비대칭 암호화**를 명확히 이해한다.

## 왜 두 종류의 암호화가 필요한가

직관적으로 생각하면 암호화는 하나의 방식으로 충분할 것 같다. 그러나 대칭과 비대칭 각각의 장단점이 상호 보완적이어서, 현대 시스템은 **두 방식을 결합한 하이브리드 구조**를 사용한다.

![대칭 vs 비대칭 암호화 비교](/assets/posts/websec-symmetric-asymmetric-comparison.svg)

## 대칭 암호화 (Symmetric Encryption)

**같은 키로 암호화하고 같은 키로 복호화**하는 방식이다. 암호화와 복호화 모두 하나의 비밀 키를 사용한다.

```python
# Python AES-256-GCM (대칭 암호화)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

key = os.urandom(32)    # 32바이트 = AES-256
nonce = os.urandom(12)  # 12바이트 nonce

# 암호화
ct = AESGCM(key).encrypt(nonce, b"Hello, World!", b"additional_data")

# 복호화 (같은 key 사용)
pt = AESGCM(key).decrypt(nonce, ct, b"additional_data")
```

### 장점과 단점

- **장점**: 속도가 매우 빠르다. 비대칭 암호화보다 100~1000배 빠르므로 대용량 데이터 암호화에 적합하다.
- **단점**: **키 교환 문제(Key Exchange Problem)**. Alice와 Bob이 공유 키로 통신하려면, 키 자체를 어떻게 안전하게 전달하느냐는 해결이 필요하다. 키를 평문으로 보내면 탈취당하고, 암호화해서 보내려면 또 다른 공유 키가 필요하다 — 닭이 먼저냐 달걀이 먼저냐.

### 대표 알고리즘

| 알고리즘 | 키 길이 | 비고 |
|---|---|---|
| AES-128-GCM | 128비트 | 충분히 안전, 빠름 |
| AES-256-GCM | 256비트 | 권장, 양자컴퓨터 대비 |
| ChaCha20-Poly1305 | 256비트 | 모바일 환경에서 AES보다 빠름 |
| 3DES | 112비트 | 레거시 — 새 시스템에서 사용 금지 |

## 비대칭 암호화 (Asymmetric Encryption)

**공개키(Public Key)로 암호화하고 개인키(Private Key)로만 복호화**하는 방식이다. 또는 개인키로 서명하고 공개키로 검증한다.

```python
# Python RSA 비대칭 암호화 예시
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes

# 키 쌍 생성
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=4096
)
public_key = private_key.public_key()

# 공개키로 암호화 (누구나 가능)
ct = public_key.encrypt(
    b"Secret message",
    padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None
    )
)

# 개인키로만 복호화 (개인키 소유자만 가능)
pt = private_key.decrypt(ct, padding.OAEP(...))
```

### 장점과 단점

- **장점**: 키 교환 문제 해결. 공개키는 누구에게나 배포해도 안전하다. 개인키만 비밀로 유지하면 된다. 디지털 서명으로 인증과 부인 방지도 가능하다.
- **단점**: 대칭에 비해 수백 배 느리다. 수 MB 이상의 대용량 데이터를 직접 비대칭으로 암호화하는 것은 비실용적이다.

### 비대칭 암호화의 두 가지 사용법

![비대칭 암호화의 핵심 사용 사례](/assets/posts/websec-asymmetric-keyexchange.svg)

**① 공개키 암호화 (Key Encapsulation)**: 수신자의 공개키로 암호화 → 수신자의 개인키로만 복호화. 안전한 키 전달에 사용.

**② 디지털 서명**: 서명자의 개인키로 서명 → 서명자의 공개키로 검증. SSL 인증서, JWT, 코드 서명에 사용.

## 하이브리드 암호화: TLS의 접근법

TLS는 두 방식의 장점만 취하는 하이브리드 구조다.

```
TLS 핸드셰이크 단계 (비대칭):
1. 서버가 인증서(공개키 포함) 전송
2. 키 교환으로 세션 키 합의 (ECDH)

데이터 전송 단계 (대칭):
3. 합의된 세션 키로 AES-GCM 암호화
4. 실제 HTTP 데이터 암호화 전송
```

```javascript
// TLS 1.3 핸드셰이크 단순화 흐름
// 1단계: ECDH 키 교환으로 shared secret 생성
const clientKeyPair = crypto.generateKeyPairSync('x25519');
// 서버도 x25519 키 쌍 생성
// ECDH: clientPrivate + serverPublic → sharedSecret

// 2단계: sharedSecret → 세션 키 파생 (HKDF)
// 3단계: AES-256-GCM으로 실제 데이터 암호화
```

## 알고리즘 선택 가이드

### 대칭 암호화
- **신규 시스템**: AES-256-GCM (권장) 또는 ChaCha20-Poly1305
- **절대 금지**: DES, 3DES, RC4, AES-ECB

### 비대칭 암호화
- **TLS 키 교환**: ECDH (P-256 또는 X25519)
- **디지털 서명**: ECDSA (P-256) 또는 Ed25519
- **RSA**: 4096비트 이상만. 신규 시스템에서는 ECC 우선
- **절대 금지**: RSA-1024, DSA

---

**지난 글:** [HSTS: 강제 HTTPS와 Preload의 모든 것](/posts/websec-hsts/)

**다음 글:** [해싱 vs 암호화: 언제 무엇을 쓸까](/posts/websec-hashing-vs-encryption/)

<br>
읽어주셔서 감사합니다. 😊
