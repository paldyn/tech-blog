---
title: "TLS/HTTPS: 핸드셰이크 동작 원리와 보안 설정 완전 가이드"
description: "TLS 1.3 핸드셰이크 상세 흐름, TLS 1.2와의 차이, BEAST·POODLE·LOGJAM·Heartbleed 공격과 대응책, nginx/Apache 보안 설정, HSTS·OCSP Stapling·0-RTT를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["TLS", "HTTPS", "핸드셰이크", "TLS1.3", "HSTS", "BEAST", "POODLE", "Heartbleed", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-key-management-rotation/)에서 암호화 키 생명주기 관리를 살펴봤다. 이번 글에서는 웹 보안의 핵심 프로토콜 **TLS(Transport Layer Security)**의 동작 원리, 실무 보안 설정, 역사적 취약점과 대응책을 다룬다.

## TLS가 제공하는 세 가지 보장

HTTPS는 단순히 "자물쇠 아이콘"이 아니다. TLS는 세 가지 핵심 보안 속성을 제공한다:

1. **기밀성(Confidentiality)**: AES-GCM으로 내용 암호화 — 도청 불가
2. **무결성(Integrity)**: AEAD의 인증 태그 — 변조 감지
3. **인증(Authentication)**: 서버 인증서로 신원 확인 — 위장 방지

```bash
# HTTPS 연결 상세 정보 확인
curl -vI https://example.com 2>&1 | grep -E "SSL|TLS|cipher|certificate"

# 보안 헤더 확인
curl -sI https://example.com | grep -E "Strict|X-Frame|Content-Security"
```

## TLS 1.3 핸드셰이크 동작

![TLS 1.3 핸드셰이크 흐름](/assets/posts/websec-tls-handshake.svg)

TLS 1.3은 1.2 대비 두 가지 큰 개선을 이뤘다: **1 RTT** (1.2는 2 RTT)와 취약한 암호화 옵션 제거.

```python
# TLS 연결 정보 확인 (Python)
import ssl
import socket

def get_tls_info(hostname: str, port: int = 443) -> dict:
    ctx = ssl.create_default_context()
    with socket.create_connection((hostname, port), timeout=10) as sock:
        with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
            return {
                'version': ssock.version(),           # TLSv1.3
                'cipher': ssock.cipher(),             # (name, version, bits)
                'compression': ssock.compression(),  # None이 올바름
                'session_reused': ssock.session_reused()
            }

info = get_tls_info('example.com')
print(f"TLS 버전: {info['version']}")
print(f"Cipher: {info['cipher'][0]}")  # TLS_AES_256_GCM_SHA384
```

### TLS 1.3 cipher suite

TLS 1.3은 cipher suite를 5개로 줄이고 모두 AEAD(인증된 암호화)다:

```
TLS_AES_256_GCM_SHA384        ✅ 권장 (256 bit 보안)
TLS_AES_128_GCM_SHA256        ✅ 허용 (128 bit 보안)
TLS_CHACHA20_POLY1305_SHA256  ✅ 모바일/임베디드 최적
TLS_AES_128_CCM_SHA256        ⚠ 일반 용도엔 GCM 선호
TLS_AES_128_CCM_8_SHA256      ⚠ 저사양 IoT용만
```

TLS 1.2의 문제는 수십 개의 cipher suite 중 취약한 것들이 포함됐다는 점이다.

## 실전 TLS 보안 설정

### nginx

```nginx
# /etc/nginx/snippets/tls-security.conf

# TLS 버전 제한
ssl_protocols TLSv1.2 TLSv1.3;

# TLS 1.2용 cipher (TLS 1.3은 자동 최적 선택)
ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;  # TLS 1.3에서는 off 권장

# ECDHE 곡선
ssl_ecdh_curve X25519:P-256:P-384;

# DH 파라미터 (TLS 1.2 DHE 사용 시)
ssl_dhparam /etc/nginx/dhparam.pem;  # openssl dhparam -out dhparam.pem 4096

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
ssl_trusted_certificate /etc/ssl/chain.pem;

# 세션 재사용
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;  # PFS 보장 위해 off 권장

# 보안 헤더
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

```bash
# DH 파라미터 생성 (최초 1회, 시간 걸림)
openssl dhparam -out /etc/nginx/dhparam.pem 4096

# TLS 설정 검증
nginx -t
sslyze --regular example.com
testssl.sh example.com
```

### Apache

```apache
# /etc/apache2/sites-available/example.conf
<VirtualHost *:443>
    SSLEngine on
    SSLProtocol -all +TLSv1.2 +TLSv1.3
    SSLCipherSuite ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
    SSLHonorCipherOrder off
    SSLOpenSSLConfCmd Curves X25519:P-256
    SSLUseStapling on
    SSLStaplingCache shmcb:/tmp/ssl_stapling(128000)
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
</VirtualHost>
```

## TLS 주요 공격과 대응

![TLS 주요 공격 유형](/assets/posts/websec-tls-attacks.svg)

### HSTS (HTTP Strict Transport Security)

HSTS는 브라우저에게 "이 도메인은 항상 HTTPS로만 접속하라"고 지시한다.

```python
# Python Flask HSTS 설정
from flask import Flask
from flask_talisman import Talisman

app = Flask(__name__)

# Talisman이 HSTS 등 보안 헤더 자동 추가
Talisman(
    app,
    strict_transport_security=True,
    strict_transport_security_max_age=31536000,    # 1년
    strict_transport_security_include_subdomains=True,
    strict_transport_security_preload=True,
    force_https=True
)
```

```bash
# HSTS Preload 등록 (hstspreload.org)
# 요건: max-age >= 1년, includeSubDomains, preload 포함
# → 브라우저에 하드코딩되어 최초 HTTP 연결도 차단

# HSTS 제거가 필요할 때: max-age=0으로 설정 후 브라우저 캐시 만료까지 기다려야
# → Preload 목록 등록 후 제거는 수개월 소요 — 신중하게 결정
```

## 0-RTT Early Data 보안

TLS 1.3의 0-RTT는 성능을 높이지만 재전송 공격(Replay Attack)에 취약하다.

```python
# ❌ 0-RTT에 절대 허용하면 안 되는 요청
# - 결제, 이체, 주문
# - 상태를 변경하는 모든 POST/PUT/DELETE

# ✅ 0-RTT 허용 가능한 요청
# - GET /products  (읽기 전용, 멱등성 있음)
# - GET /news

# nginx에서 0-RTT 안전하게 처리
# ssl_early_data on;
# 서버에서 Early-Data 헤더 확인
"""
location /api/payment {
    # Early-Data 헤더 있으면 425 Too Early 반환
    if ($http_early_data) { return 425; }
    proxy_pass http://backend;
}
"""
```

## TLS 등급 검사 도구

```bash
# SSL Labs (온라인)
# https://www.ssllabs.com/ssltest/

# sslyze (오프라인 CLI)
pip install sslyze
sslyze --regular --certinfo example.com

# testssl.sh (bash 스크립트)
./testssl.sh --full example.com

# 주요 평가 항목:
# - 프로토콜 버전 (SSLv2/3, TLS 1.0/1.1 비활성화)
# - Cipher suite (취약한 것 제거)
# - 인증서 체인 완성도
# - HSTS 설정
# - OCSP Stapling
# - Forward Secrecy (PFS)
# - Heartbleed, BEAST, POODLE, FREAK, LOGJAM, DROWN 등 취약점
```

TLS 설정은 한 번 하고 끝이 아니다. 새로운 취약점이 발견되면 빠르게 대응해야 하고, 인증서는 주기적으로 갱신해야 한다. Mozilla SSL Configuration Generator(ssl-config.mozilla.org)를 참고하면 웹 서버별 최신 권장 설정을 손쉽게 얻을 수 있다.

---

**지난 글:** [키 관리와 순환: 암호화 키 생명주기](/posts/websec-key-management-rotation/)

<br>
읽어주셔서 감사합니다. 😊
