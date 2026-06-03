---
title: "TLS/SSL 개요: HTTPS의 핵심"
description: "SSL에서 TLS 1.3까지의 진화, 핸드셰이크 흐름, 인증서 체인, Forward Secrecy, OCSP Stapling, HSTS 완전 정리"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["TLS", "SSL", "HTTPS", "인증서", "암호화", "네트워크"]
featured: false
draft: false
---

## SSL에서 TLS로

SSL(Secure Sockets Layer)은 넷스케이프가 1990년대 중반 개발했습니다. 이후 IETF가 표준화해 TLS(Transport Layer Security)로 발전했고, SSL 2.0/3.0과 TLS 1.0/1.1은 모두 취약점으로 인해 폐기되었습니다. 현재 표준은 **TLS 1.2와 TLS 1.3**입니다.

| 버전 | 연도 | 상태 |
|------|------|------|
| SSL 2.0 | 1995 | 폐기 (RFC 6176) |
| SSL 3.0 | 1996 | 폐기 (POODLE, RFC 7568) |
| TLS 1.0 | 1999 | 폐기 (RFC 8996) |
| TLS 1.1 | 2006 | 폐기 (RFC 8996) |
| TLS 1.2 | 2008 | 사용 가능 |
| TLS 1.3 | 2018 | 권장 |

## TLS 1.3 핸드셰이크

![TLS 1.3 핸드셰이크 흐름](/assets/posts/network-tls-ssl-overview-handshake.svg)

TLS 1.3의 핸드셰이크는 **1-RTT**로 완성됩니다. 이전 TLS 1.2의 2-RTT보다 빠릅니다.

1. **ClientHello**: 지원 cipher suite, key_share(ECDH 공개키), random nonce 전송
2. **ServerHello**: cipher 선택, key_share(서버 ECDH 공개키) 전송
3. **Certificate + CertificateVerify**: 서버 인증서와 개인키 서명
4. **Finished**: 핸드셰이크 MAC 검증
5. 이후 **Application Data**: 도출된 세션 키로 암호화

ECDHE(타원곡선 Diffie-Hellman Ephemeral)를 사용해 **Perfect Forward Secrecy**를 보장합니다. 세션 키는 매 연결마다 새로 생성되어 하나가 노출돼도 다른 세션에 영향을 미치지 않습니다.

### 0-RTT 재연결

이전에 접속했던 서버에는 PSK(Pre-Shared Key)를 사용해 핸드셰이크 없이 첫 패킷에 데이터를 실어 보낼 수 있습니다. 단, **리플레이 공격** 위험이 있어 멱등성 있는 요청에만 사용해야 합니다.

## 인증서 체인

![TLS 인증서 체인과 핵심 개념](/assets/posts/network-tls-ssl-overview-cert.svg)

브라우저는 서버 인증서를 검증하기 위해 **신뢰 체인**을 따라 올라갑니다.

```
End-Entity Cert (example.com)
  → Intermediate CA (Let's Encrypt R3)
    → Root CA (ISRG Root X1)  ← 브라우저에 사전 탑재
```

### 인증서 검증 절차

1. 서버 인증서의 서명이 Intermediate CA 공개키로 유효한지 확인
2. Intermediate CA 인증서의 서명이 Root CA 공개키로 유효한지 확인
3. Root CA가 브라우저 신뢰 저장소에 있는지 확인
4. 인증서 유효기간, SAN(Subject Alternative Name), 폐기 상태(OCSP) 확인

## 핵심 개념

### Perfect Forward Secrecy (PFS)

ECDHE 같은 임시 키 교환을 사용하면 세션 키가 메모리에만 존재하고 디스크에 저장되지 않습니다. 서버 개인키가 유출돼도 과거 캡처한 트래픽을 복호화할 수 없습니다.

### OCSP Stapling

인증서 폐기 확인을 위해 클라이언트가 매번 OCSP 서버에 질의하면 성능 저하와 프라이버시 문제가 있습니다. OCSP Stapling은 **서버가 미리 OCSP 응답을 받아 핸드셰이크에 포함**시키는 방식입니다.

```nginx
ssl_stapling on;
ssl_stapling_verify on;
```

### HSTS (HTTP Strict Transport Security)

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

브라우저가 이 헤더를 받으면 이후 해당 도메인에 대해 **HTTP를 자동으로 HTTPS로 전환**합니다. 최초 방문 시의 다운그레이드 공격을 막기 위해 HSTS Preload List에 등록하는 것이 권장됩니다.

## cipher suite

TLS 1.3에서는 cipher suite를 단순화했습니다.

| TLS 1.3 Cipher Suite | 키 교환 | 인증 | 암호화 | MAC |
|---|---|---|---|---|
| TLS_AES_128_GCM_SHA256 | ECDHE | 인증서 | AES-128-GCM | HKDF-SHA256 |
| TLS_AES_256_GCM_SHA384 | ECDHE | 인증서 | AES-256-GCM | HKDF-SHA384 |
| TLS_CHACHA20_POLY1305_SHA256 | ECDHE | 인증서 | ChaCha20 | HKDF-SHA256 |

## 인증서 발급 및 갱신

```bash
# Let's Encrypt (certbot)
certbot certonly --standalone -d example.com
certbot renew --dry-run

# 인증서 정보 확인
openssl s_client -connect example.com:443 -tls1_3 \
  | openssl x509 -text -noout

# TLS 버전 및 cipher 확인
openssl s_client -connect example.com:443 -tls1_3 2>&1 \
  | grep -E "Protocol|Cipher"
```

## Nginx TLS 강화 설정

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_stapling on;
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=63072000" always;
```

---

**이전 글:** [WebSocket 프로토콜 완전 정복](/posts/network-websocket-protocol/)
