---
title: "TLS 암호화 스위트 해부 — 키 교환부터 MAC까지"
description: "TLS 암호 스위트 이름 구조, ECDHE/DHE/RSA 키 교환, AES-GCM/ChaCha20 대칭키, SHA 해시의 역할, 권장·비권장 스위트 목록을 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["TLS", "암호스위트", "AES-GCM", "ECDHE", "ChaCha20", "보안", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-tls-1-2-vs-1-3/)에서 TLS 1.2와 1.3의 차이를 비교했습니다. 이번 글에서는 TLS 통신에서 어떤 알고리즘이 어떤 역할을 하는지, **암호 스위트(Cipher Suite)**를 분해해서 살펴봅니다.

## 암호 스위트란?

TLS 연결 한 개를 안전하게 만들기 위해 여러 종류의 암호 알고리즘이 협력합니다. 이를 하나의 이름으로 묶어 표현한 것이 **암호 스위트**입니다.

```
TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
 │     │      │        │    │     │
 │     │      │        │    │     └─ 해시 (PRF/MAC)
 │     │      │        │    └─────── 모드
 │     │      │        └──────────── 대칭키 암호 + 키 크기
 │     │      └───────────────────── 인증 방식
 │     └──────────────────────────── 키 교환 방식
 └────────────────────────────────── 프로토콜
```

![TLS 암호 스위트 구조 해부](/assets/posts/network-tls-cipher-suites-anatomy.svg)

## 구성 요소별 상세 설명

### 1. 키 교환 (Key Exchange)

클라이언트와 서버가 **공통 비밀(shared secret)**을 안전하게 만드는 과정입니다.

**ECDHE (Elliptic Curve Diffie-Hellman Ephemeral)** — 권장

```
타원곡선 DH + 임시(Ephemeral) 키
  - 세션마다 새 키 쌍 생성
  - 세션 종료 후 키 폐기
  - 결과: Forward Secrecy 보장
  
지원 그룹 (TLS 1.3):
  X25519    ← 최고 권장 (빠름, 안전)
  P-256     ← 널리 지원됨
  P-384     ← 높은 보안 레벨
```

**DHE (Diffie-Hellman Ephemeral)** — 사용 가능

ECDHE보다 느리지만 Forward Secrecy 보장. TLS 1.2에서 RSA 대신 사용.

**RSA 키 교환** — TLS 1.3에서 제거

```
# RSA 키 교환 (비권장, TLS 1.2)
클라이언트: pre_master_secret 생성
          → 서버 공개키로 암호화
          → 전송
서버: 개인키로 복호화
    → pre_master_secret 획득

문제: 서버 개인키 유출 시 과거 트래픽 전체 복호화 가능!
```

### 2. 인증 (Authentication)

서버(또는 클라이언트) 신원을 검증합니다.

| 방식 | 설명 | TLS 1.3 |
|------|------|---------|
| RSA | RSA 인증서 서명 검증 | ✓ (키 교환과 분리) |
| ECDSA | 타원곡선 서명, RSA보다 빠름 | ✓ 권장 |
| Ed25519 | EdDSA, 최신 곡선 | ✓ 권장 |

### 3. 대칭키 암호화 (Bulk Encryption)

핸드셰이크 후 실제 데이터를 암호화합니다.

**AES-256-GCM** — 최고 권장

```python
# AES-GCM 특징 (의사코드)
ciphertext, auth_tag = AES_GCM.encrypt(
    key=session_key,      # 256비트
    nonce=write_iv,       # 12바이트, 매번 증가
    plaintext=data,
    aad=record_header     # 추가 인증 데이터
)
# auth_tag: 복호화 시 무결성 검증
# AEAD: 암호화 + 인증 동시 처리
```

**ChaCha20-Poly1305** — AES 하드웨어 없는 환경 권장

```
ChaCha20: 스트림 암호 (AES보다 SW 구현 빠름)
Poly1305: MAC (무결성 보장)
사용 환경: 모바일, IoT (AES-NI 없는 장치)
```

**AES-128-GCM** vs **AES-256-GCM**

보안 강도 차이는 실제로 무시할 만하지만, 256이 표준 권고입니다. 128은 128비트 보안 레벨, 256은 256비트 보안 레벨로 양자 컴퓨터 위협 대비 256 권장.

### 4. 해시 / PRF (Pseudo-Random Function)

TLS 1.2에서는 키 파생 함수(PRF)와 MAC에 같은 해시를 씁니다. TLS 1.3에서는 HKDF의 해시 알고리즘으로 사용됩니다.

```
SHA-256: 256비트 출력, TLS_AES_128_GCM_SHA256에 사용
SHA-384: 384비트 출력, TLS_AES_256_GCM_SHA384에 사용
SHA-1:   완전 폐기 (충돌 공격 가능)
MD5:     완전 폐기 (충돌 공격 가능)
```

## 권장 vs 비권장 암호 스위트

![권장/비권장 암호 스위트](/assets/posts/network-tls-cipher-suites-list.svg)

```bash
# Nginx 암호 스위트 설정 (TLS 1.2 + 1.3)
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers off;  # TLS 1.3에서는 off 권장

# 서버 지원 스위트 확인
openssl ciphers -v 'ECDHE+AESGCM:ECDHE+CHACHA20' | head -10
```

## TLS 1.3 암호 스위트의 특징

TLS 1.3에서는 암호 스위트 이름 구조가 단순해졌습니다.

```
TLS 1.2: TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
         (키 교환 + 인증 + 대칭키 + 해시 모두 포함)

TLS 1.3: TLS_AES_256_GCM_SHA384
         (대칭키 + 해시만 — 키 교환은 지원 그룹에서 별도 협상)

이유: TLS 1.3은 키 교환을 항상 ECDHE/DHE로 강제하므로
     암호 스위트 이름에서 분리
```

TLS 1.3의 세 가지 필수 암호 스위트:

```
TLS_AES_128_GCM_SHA256          (필수 구현)
TLS_AES_256_GCM_SHA384          (권장)
TLS_CHACHA20_POLY1305_SHA256    (권장)
```

## 암호 스위트 강도 평가

```bash
# SSL Labs 등급 결정에 영향을 주는 요소
# 서버 스캔
sslyze --regular example.com

# 또는
testssl.sh --cipher-per-proto example.com

# 취약 스위트가 활성화된 서버 탐지
nmap --script ssl-enum-ciphers -p 443 192.168.1.1
```

## 마치며

암호 스위트는 TLS 보안의 핵심 구성 요소입니다. ECDHE로 키 교환하고, RSA/ECDSA로 인증하고, AES-GCM 또는 ChaCha20-Poly1305로 데이터를 암호화하는 조합이 현재의 표준입니다. 다음 글에서는 반복 연결의 성능을 높이는 **TLS 세션 재개(Session Resumption)** 메커니즘을 살펴봅니다.

---

**지난 글:** [TLS 1.2 vs TLS 1.3 — 무엇이 달라졌는가?](/posts/network-tls-1-2-vs-1-3/)

**다음 글:** [TLS 세션 재개 — Session ID, Session Ticket, PSK](/posts/network-tls-session-resumption/)

<br>
읽어주셔서 감사합니다. 😊
