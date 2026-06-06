---
title: "AES 운용 모드: ECB·CBC·GCM의 보안 차이"
description: "AES 블록 암호화의 세 가지 운용 모드(ECB·CBC·GCM)의 동작 방식, ECB의 패턴 노출 문제, CBC의 패딩 오라클 취약점, GCM의 AEAD 특성, Nonce 재사용 금지 규칙을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["AES", "운용모드", "ECB", "CBC", "GCM", "AEAD", "암호화구현"]
featured: false
draft: false
---

[지난 글](/posts/websec-hashing-vs-encryption/)에서 해싱과 암호화의 차이, 비밀번호 해싱 알고리즘을 살펴봤다. 이번 글에서는 대칭 암호화의 표준인 AES(Advanced Encryption Standard)를 사용할 때 **운용 모드(Mode of Operation)** 선택이 보안에 얼마나 큰 영향을 미치는지 알아본다.

## AES 블록 암호화와 운용 모드

AES는 128비트(16바이트) 블록 단위로 데이터를 암호화한다. 평문이 16바이트보다 길면 여러 블록으로 나눠 처리해야 하는데, 이때 블록들을 어떻게 연결할지 정하는 것이 **운용 모드**다.

```
평문 (32바이트) = [블록1: 16바이트] + [블록2: 16바이트]
```

모드 선택이 잘못되면 암호화 자체는 동작하지만 심각한 보안 취약점이 생긴다.

## ECB: 절대 사용하지 않을 모드

ECB(Electronic Codebook)는 각 블록을 독립적으로 암호화한다.

```python
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

# ❌ ECB 사용 예 — 절대 따라하지 말 것
key = b'\x00' * 32  # AES-256
cipher = Cipher(algorithms.AES(key), modes.ECB(), backend=default_backend())
encryptor = cipher.encryptor()

block1 = encryptor.update(b'Hello, World!   ')  # 16바이트 패딩
block2 = encryptor.update(b'Hello, World!   ')  # 같은 평문
encryptor.finalize()

# block1 == block2 → 패턴이 그대로 노출!
print(block1 == block2)  # True
```

**ECB 펭귄 문제**: 같은 평문 블록은 항상 같은 암호문 블록이 된다. 이미지를 ECB로 암호화하면 원본 이미지의 윤곽이 그대로 보인다. 데이터 패턴이 암호문에서 노출된다.

![AES 운용 모드 비교](/assets/posts/websec-aes-modes-comparison.svg)

## CBC: 레거시 모드 — GCM으로 대체 필요

CBC(Cipher Block Chaining)는 이전 블록의 암호문과 XOR 연산 후 암호화해 패턴을 숨긴다.

```python
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import os

# CBC 암호화 (레거시 — 새 시스템에서는 GCM 사용)
key = os.urandom(32)       # AES-256
iv = os.urandom(16)        # 16바이트 IV (Initialization Vector)

cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
encryptor = cipher.encryptor()

# PKCS#7 패딩 필요 (블록 크기의 배수로 맞춤)
from cryptography.hazmat.primitives import padding
padder = padding.PKCS7(128).padder()
padded = padder.update(plaintext) + padder.finalize()
ct = encryptor.update(padded) + encryptor.finalize()
```

CBC의 치명적 약점은 **무결성 검증이 없다**는 것이다. 공격자가 암호문을 조작하면 복호화 시 쓰레기 값이 나오지만 에러 메시지에서 패딩 정보가 유출될 수 있다. 이것이 **PKCS#7 패딩 오라클 공격(Padding Oracle Attack)**이다. POODLE(2014), BEAST(2011) 등의 실제 공격이 이 취약점을 이용했다.

## GCM: 현재 표준 — AEAD 모드

GCM(Galois/Counter Mode)은 CTR 모드 암호화와 GHASH 인증을 결합한 **AEAD(Authenticated Encryption with Associated Data)** 모드다.

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

key = os.urandom(32)   # AES-256 키
nonce = os.urandom(12) # 12바이트 (96비트) nonce
aad = b"user_id:12345" # 추가 인증 데이터 (암호화 안 됨, 무결성만)

# 암호화
ct = AESGCM(key).encrypt(nonce, b"Sensitive data", aad)
# ct = 암호문 + 16바이트 인증 태그 (자동 포함)

# 복호화 — 무결성 검증 실패 시 InvalidTag 예외 발생
try:
    pt = AESGCM(key).decrypt(nonce, ct, aad)
except Exception:
    raise ValueError("인증 실패: 데이터 변조 감지")
```

### GCM의 세 가지 장점

1. **암호화 + 무결성 동시 제공**: 별도 MAC 없이 인증 태그로 변조 감지
2. **병렬 처리 가능**: 블록 간 의존성 없어 빠름
3. **AAD 지원**: 암호화하지 않아도 되는 메타데이터(사용자 ID 등)의 무결성도 보장

## GCM의 치명적 주의사항: Nonce 재사용 금지

![AES-GCM 구현 패턴](/assets/posts/websec-aes-gcm-impl.svg)

```python
# ❌ Nonce 재사용 — 치명적 취약점
key = os.urandom(32)
nonce = b'\x00' * 12  # 고정 nonce

ct1 = AESGCM(key).encrypt(nonce, b"Message 1", None)
ct2 = AESGCM(key).encrypt(nonce, b"Message 2", None)

# 같은 key+nonce로 두 메시지를 암호화하면:
# keystream1 == keystream2
# ct1 XOR ct2 = plaintext1 XOR plaintext2
# → 두 평문을 XOR로 비교해 모두 복구 가능
```

같은 키와 nonce 조합을 두 번 사용하면 **키스트림이 동일**하다. 두 암호문을 XOR하면 두 평문의 XOR이 나와 둘 다 복구할 수 있다. 이것은 GCM에서 가장 치명적인 오용 패턴이다.

```python
# ✅ 올바른 패턴: 매번 랜덤 nonce 생성
def encrypt_message(key: bytes, plaintext: bytes) -> dict:
    nonce = os.urandom(12)  # 매번 새로운 랜덤 nonce
    ct = AESGCM(key).encrypt(nonce, plaintext, None)
    return {
        "nonce": nonce.hex(),
        "ciphertext": ct.hex()
    }
```

nonce는 12바이트(96비트)를 무작위로 생성할 때 **생일 역설**에 의해 약 2^48개의 메시지 후 충돌이 발생할 수 있다. 키 하나로 수십억 개 이상의 메시지를 암호화할 경우 키 로테이션이 필요하다.

## Node.js에서 AES-256-GCM

```javascript
const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

function encrypt(key, plaintext, aad = null) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);

  if (aad) cipher.setAAD(Buffer.from(aad));

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag(); // 16바이트 인증 태그

  return { nonce, encrypted, tag };
}

function decrypt(key, { nonce, encrypted, tag }, aad = null) {
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag); // 복호화 전 태그 설정

  if (aad) decipher.setAAD(Buffer.from(aad));

  try {
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final() // 여기서 태그 검증 실패 시 에러
    ]).toString('utf8');
  } catch {
    throw new Error('Decryption failed: authentication tag mismatch');
  }
}
```

## 모드 선택 정리

| 모드 | 권장 여부 | 이유 |
|---|---|---|
| ECB | 절대 금지 | 패턴 노출 |
| CBC | 레거시만 | 패딩 오라클 위험, 별도 MAC 필요 |
| GCM | 권장 | AEAD, 빠름, 무결성 내장 |
| CTR | 조건부 | GCM보다 기능 적음, 무결성 별도 |
| ChaCha20-Poly1305 | 권장 | 모바일/저전력 환경에서 GCM 대안 |

---

**지난 글:** [해싱 vs 암호화: 언제 무엇을 쓸까](/posts/websec-hashing-vs-encryption/)

<br>
읽어주셔서 감사합니다. 😊
