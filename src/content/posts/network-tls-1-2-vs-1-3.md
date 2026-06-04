---
title: "TLS 1.2 vs TLS 1.3 — 무엇이 달라졌는가?"
description: "TLS 1.3이 1.2에서 제거한 취약 기능(RSA 키 교환, RC4, CBC, 재협상, 압축)과 추가된 개선(1-RTT, 0-RTT, FS 필수화, 암호화된 인증서)을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["TLS", "TLS1.2", "TLS1.3", "보안", "프로토콜", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-tls-handshake/)에서 TLS 1.3 핸드셰이크 흐름을 자세히 살펴봤습니다. 이번 글에서는 TLS 1.2와 1.3이 구체적으로 어디가 다른지, 그리고 왜 1.2의 특정 기능들이 제거됐는지 설명합니다.

## TLS 버전 역사 요약

TLS는 Netscape의 SSL을 기반으로 IETF가 표준화한 프로토콜입니다.

```
SSL 2.0 (1995)  ← 심각한 취약점, 완전 폐기
SSL 3.0 (1996)  ← POODLE 공격, RFC 7568로 금지
TLS 1.0 (1999)  ← BEAST 공격, 2021년 공식 폐기
TLS 1.1 (2006)  ← 2021년 공식 폐기
TLS 1.2 (2008)  ← 현재 여전히 사용 중 (점진적 폐기 권고)
TLS 1.3 (2018)  ← 현재 권장 버전
```

## 핸드셰이크 RTT 비교

가장 눈에 띄는 차이는 핸드셰이크 왕복 횟수입니다.

![TLS 1.2 vs 1.3 핸드셰이크 비교](/assets/posts/network-tls-1-2-vs-1-3-compare.svg)

TLS 1.2는 서버가 어떤 키 교환 방식을 쓸지 알려준 후에야 클라이언트가 키 교환 데이터를 보낼 수 있어 최소 **2-RTT**가 필요합니다. TLS 1.3은 ClientHello에 미리 key_share를 포함해 **1-RTT**로 줄였습니다.

## 기능 변경 상세 비교

![TLS 1.2 vs 1.3 기능 비교](/assets/posts/network-tls-1-2-vs-1-3-features.svg)

### 제거된 기능들

**RSA 정적 키 교환 제거 (핵심)**

TLS 1.2까지는 RSA로 키 교환이 가능했습니다. 클라이언트가 서버 공개키로 `pre_master_secret`을 암호화해 보내는 방식입니다.

```
TLS 1.2 RSA 방식 (취약):
Client → [RSA 암호화된 pre_master_secret] → Server

문제: 서버 개인키가 나중에 유출되면
     과거 모든 트래픽을 복호화 가능!
     (Forward Secrecy 없음)
```

TLS 1.3은 RSA를 **인증 전용**으로만 허용하고, 키 교환은 ECDHE/DHE만 사용합니다. 이로써 Forward Secrecy가 강제됩니다.

**취약 암호 스위트 제거**

```
제거된 알고리즘:
  - RC4: 편향 공격 취약 (RFC 7465)
  - 3DES: Sweet32 공격 (64비트 블록)
  - DES: 1990년대 이후 실질적으로 사용 불가
  - EXPORT 암호: 의도적으로 약화된 수출용
  - MD5, SHA-1 기반 MAC
  - CBC 모드 대칭키 (Lucky13, BEAST 공격)
```

**TLS 압축 제거**

TLS 1.2는 레코드 레이어에서 데이터를 압축할 수 있었습니다. 그러나 이는 **CRIME 공격**에 취약합니다. 공격자가 요청에 데이터를 삽입하고 압축 크기 변화를 관찰해 비밀 값을 추측하는 방식입니다.

```python
# CRIME 공격 원리 (의사코드)
# 압축은 반복 문자열을 줄임
for c in '0123456789abcdef..':
    payload = f"guess={c}secret_token=ABC..."
    if compressed_size(payload) < min_size:
        token = c  # 같은 문자가 있으면 더 많이 압축됨
```

**재협상(Renegotiation) 제거**

TLS 1.2는 기존 연결 안에서 새로운 핸드셰이크를 수행해 키를 교체할 수 있었습니다. 이는 구현 복잡성을 높이고 취약점의 원인이 됐습니다(CVE-2009-3555). TLS 1.3은 재협상을 완전히 제거하고 `KeyUpdate` 메시지로 대체했습니다.

```
TLS 1.3 키 갱신:
Client → KeyUpdate (update_requested) → Server
Server → KeyUpdate (not_requested) ← Server
(새 앱 트래픽 키 파생, 핸드셰이크 없음)
```

**ChangeCipherSpec 메시지 제거**

TLS 1.2의 ChangeCipherSpec은 "이후부터 암호화 사용" 신호였지만 실제로는 no-op에 가까웠습니다. TLS 1.3은 이를 제거했습니다(레거시 미들박스 호환용으로 허용은 됩니다).

### 추가된 기능들

**0-RTT Early Data**

PSK로 재연결 시 첫 요청을 Finished 전에 보낼 수 있습니다. 재전송 공격 주의가 필요합니다.

**인증서 암호화**

TLS 1.2에서 Certificate 메시지는 평문이었습니다. TLS 1.3은 ServerHello 이후를 모두 암호화해 어떤 인증서가 사용됐는지 도청자가 알 수 없습니다.

**더 강화된 Key Schedule**

HKDF를 사용해 키 파생 과정이 체계적으로 정의됩니다.

## 서버 설정에서 TLS 버전 제어

```nginx
# Nginx: TLS 1.3만 허용 (최고 보안)
ssl_protocols TLSv1.3;

# 또는 1.2와 1.3 동시 지원 (호환성 고려)
ssl_protocols TLSv1.2 TLSv1.3;

# TLS 1.3 전용 암호 스위트
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
```

```bash
# 현재 서버의 TLS 버전 확인
nmap --script ssl-enum-ciphers -p 443 example.com

# OpenSSL로 TLS 1.2 강제 연결 테스트
openssl s_client -connect example.com:443 -tls1_2
# Connection failure가 나오면 1.2 비활성화됨
```

## 마이그레이션 권고사항

| 상황 | 권장 |
|------|------|
| 신규 서비스 | TLS 1.3만 |
| 운영 중 서비스 | TLS 1.2 + 1.3 (구형 클라 지원) |
| IoT / 구형 장비 | TLS 1.2 (1.3 미지원 장비 있음) |
| 금융/의료 | TLS 1.3 전환 필수화 (규정 추세) |

2021년 3월 IETF는 RFC 8996으로 TLS 1.0, 1.1을 공식 폐기했습니다. 2024년부터 주요 CA와 브라우저는 TLS 1.2 순차 비권장을 진행 중입니다.

---

**지난 글:** [TLS 핸드셰이크 완전 분석](/posts/network-tls-handshake/)

**다음 글:** [TLS 암호화 스위트 해부 — 키 교환부터 MAC까지](/posts/network-tls-cipher-suites/)

<br>
읽어주셔서 감사합니다. 😊
