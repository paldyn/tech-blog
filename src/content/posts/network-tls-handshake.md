---
title: "TLS 핸드셰이크 완전 분석 — ClientHello부터 Finished까지"
description: "TLS 1.3의 1-RTT 핸드셰이크 전체 메시지 흐름, HKDF 키 파생 구조, TLS 1.2와의 차이, 그리고 0-RTT Early Data를 단계별로 해부합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 1
type: "knowledge"
category: "Network"
tags: ["TLS", "핸드셰이크", "TLS1.3", "HKDF", "키교환", "네트워크", "보안"]
featured: false
draft: false
---

[지난 글](/posts/network-tls-ssl-overview/)에서 TLS/SSL의 전체 개요를 살펴봤습니다. 이번 글에서는 TLS 핸드셰이크가 내부적으로 어떻게 작동하는지, 특히 TLS 1.3의 1-RTT 흐름을 메시지 단위로 해부해봅니다.

## 핸드셰이크가 필요한 이유

HTTPS 연결이 열리면 클라이언트와 서버는 처음 만나는 낯선 사이입니다. 이 둘이 안전하게 데이터를 주고받으려면 세 가지를 합의해야 합니다.

1. **어떤 암호 알고리즘을 쓸 것인가** (암호 스위트 협상)
2. **서버(혹은 클라이언트)가 진짜인가** (인증서 검증)
3. **공통 비밀 키를 어떻게 만들 것인가** (키 교환)

이 세 가지를 몇 번의 왕복 메시지로 처리하는 과정이 바로 **핸드셰이크**입니다.

## TLS 1.3 핸드셰이크 (1-RTT)

TLS 1.3은 TLS 1.2의 2-RTT 구조를 1-RTT로 줄이는 데 성공했습니다.

![TLS 1.3 핸드셰이크 흐름](/assets/posts/network-tls-handshake-flow.svg)

### 1단계: ClientHello

클라이언트가 연결을 시작합니다.

```
ClientHello:
  - TLS 버전: TLS 1.3 (legacy_version=0x0303)
  - 클라이언트 랜덤값: 32바이트
  - supported_versions: [TLS 1.3, TLS 1.2]
  - supported_groups: [X25519, P-256, P-384]
  - key_share: X25519 공개키 (즉시 포함 ← TLS 1.3의 핵심)
  - signature_algorithms: [ecdsa_secp256r1_sha256, rsa_pss_rsae_sha256]
  - server_name: "example.com" (SNI)
```

TLS 1.3의 결정적인 변화는 **ClientHello에 `key_share`를 즉시 포함**한다는 점입니다. TLS 1.2는 ServerHello를 보고 나서야 키 교환 정보를 보낼 수 있었지만, 1.3은 예상 가능한 그룹의 키를 미리 보내 1번의 왕복을 절약합니다.

### 2단계: ServerHello

서버가 응답합니다.

```
ServerHello:
  - 선택된 암호 스위트: TLS_AES_256_GCM_SHA384
  - 서버 랜덤값: 32바이트
  - key_share: X25519 서버 공개키
  (이 시점에서 양측은 ECDHE로 shared secret 계산 완료)
```

서버는 ClientHello의 key_share와 자신의 개인키로 **ECDHE shared secret**을 계산합니다. 이 시점부터 서버 측 핸드셰이크 키가 만들어집니다.

### 3단계: 암호화된 서버 메시지

ServerHello 이후의 메시지는 **모두 암호화**됩니다.

```
{EncryptedExtensions}  ← 서버 확장(ALPN, SNI 등)
{Certificate}          ← 서버 X.509 인증서
{CertificateVerify}    ← 서버 개인키로 핸드셰이크 내용 서명
{Finished}             ← HMAC으로 핸드셰이크 무결성 확인
```

TLS 1.2와 달리 서버 인증서조차 암호화됩니다. 도청자는 어떤 인증서가 사용됐는지조차 알 수 없습니다.

### 4단계: 클라이언트 Finished

클라이언트가 서버 인증서를 검증하고 Finished를 보냅니다.

```python
# 핸드셰이크 검증 (의사코드)
cert_valid = verify_certificate_chain(server_cert, trusted_cas)
sig_valid  = verify_signature(cert_verify.signature, handshake_hash)
finished_valid = verify_mac(server_finished, handshake_secret)

if cert_valid and sig_valid and finished_valid:
    send(Finished)  # 이제 앱 데이터 전송 가능
```

## HKDF 키 파생 계층

핸드셰이크 과정에서 여러 종류의 키가 필요합니다. TLS 1.3은 이를 HKDF(HMAC-based Key Derivation Function)로 체계적으로 파생합니다.

![TLS 1.3 키 파생 구조](/assets/posts/network-tls-handshake-keys.svg)

```
Early Secret  ──(PSK 재개 시 사용)──
      ↓ + ECDHE Shared Secret
Handshake Secret
      ├── client_handshake_traffic_secret
      └── server_handshake_traffic_secret
      ↓ + 0 (derive master)
Master Secret
      ├── client_application_traffic_secret_0
      ├── server_application_traffic_secret_0
      └── resumption_master_secret (다음 재개 PSK)
```

각 시크릿에서 실제 암호화 키(`write_key`)와 IV(`write_iv`)가 파생됩니다. 핸드셰이크가 끝나면 핸드셰이크 키는 폐기되고, 앱 데이터는 앱 트래픽 키로만 암호화됩니다.

## TLS 1.3 vs TLS 1.2 핸드셰이크

| 항목 | TLS 1.2 | TLS 1.3 |
|------|---------|---------|
| 왕복 수 | 2-RTT | 1-RTT |
| 인증서 암호화 | ✗ | ✓ |
| ChangeCipherSpec | 있음 | 제거 |
| 키 교환 | RSA/DH/ECDH | ECDHE만 (FS 필수) |
| 재개 | Session ID / Ticket | PSK |
| 0-RTT | 미지원 | 지원 (재전송 주의) |

## 0-RTT Early Data

TLS 1.3은 이전 연결에서 발급받은 PSK(Pre-Shared Key)를 이용해 재연결 시 0번의 추가 왕복 없이 앱 데이터를 보낼 수 있습니다.

```
# 0-RTT 활성화 예시 (OpenSSL)
openssl s_client \
  -connect example.com:443 \
  -tls1_3 \
  -early_data /dev/stdin <<< "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"
```

하지만 **0-RTT는 재전송 공격(Replay Attack)에 취약**합니다. 공격자가 캡처한 Early Data를 재전송해 같은 동작을 반복할 수 있기 때문입니다. 따라서 0-RTT는 GET 같은 **멱등(idempotent) 요청에만** 사용해야 하며, 결제·로그인 등의 상태 변경 요청에는 절대 쓰면 안 됩니다.

## 핸드셰이크 디버깅

```bash
# TLS 핸드셰이크 상세 출력
openssl s_client -connect example.com:443 -tls1_3 -msg 2>&1 | head -60

# Wireshark 필터: TLS 핸드셰이크만
tls.handshake

# curl로 TLS 버전 확인
curl -v --tls13-ciphers TLS_AES_256_GCM_SHA384 https://example.com
```

## 마치며

TLS 1.3 핸드셰이크는 ClientHello의 key_share 즉시 전송 덕분에 1-RTT로 완료되며, 모든 핸드셰이크 키가 HKDF로 체계적으로 파생됩니다. 서버 인증서도 암호화되고 RSA 키 교환이 제거되어 Forward Secrecy가 필수화되었습니다. 다음 글에서는 TLS 1.2와 1.3의 구체적인 차이를 더 깊이 비교합니다.

---

**지난 글:** [TLS/SSL 개요: HTTPS의 핵심](/posts/network-tls-ssl-overview/)

**다음 글:** [TLS 1.2 vs TLS 1.3 — 무엇이 달라졌는가?](/posts/network-tls-1-2-vs-1-3/)

<br>
읽어주셔서 감사합니다. 😊
