---
title: "HTTPS 완전 정복 — HTTP에 TLS를 더하면"
description: "HTTPS의 동작 원리(TCP+TLS+HTTP), HTTP에서 HTTPS 리다이렉트, HSTS, Certificate Transparency, OCSP Stapling, CAA 레코드 설정까지 실무 위주로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["HTTPS", "TLS", "HSTS", "CAA", "OCSP", "웹보안", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-certificates-pki/)에서 인증서와 PKI를 살펴봤습니다. 이제 HTTP와 TLS가 결합해 만들어지는 **HTTPS**를 전체 흐름과 함께 정리합니다. HTTPS는 단순히 "HTTP + 암호화"가 아니라, 여러 보안 메커니즘이 협력하는 체계입니다.

## HTTPS = TCP + TLS + HTTP

HTTPS 연결이 열리는 과정은 세 단계로 나뉩니다.

![HTTPS 전체 흐름](/assets/posts/network-https-flow.svg)

```
Phase 1: TCP 3-Way Handshake (포트 443)
  클라이언트 → SYN → 서버
  서버 → SYN-ACK → 클라이언트
  클라이언트 → ACK → 서버
  (일반 TCP와 동일, 약 0.5 RTT)

Phase 2: TLS 핸드셰이크
  TLS 1.3: 1-RTT (총 연결 비용 1.5 RTT)
  TLS 1.2: 2-RTT (총 연결 비용 2.5 RTT)

Phase 3: 암호화된 HTTP 통신
  GET /path HTTP/1.1 Host: example.com
  → TLS 레코드로 암호화되어 전송
```

## HTTP → HTTPS 전환

### 서버 리다이렉트

```nginx
# Nginx: HTTP를 HTTPS로 리다이렉트
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name example.com;
    # ...
}
```

```apache
# Apache: HTTPS 리다이렉트
<VirtualHost *:80>
    ServerName example.com
    Redirect permanent / https://example.com/
</VirtualHost>
```

### 리다이렉트의 첫 번째 요청 문제

301 리다이렉트 방식은 **최초 HTTP 요청**이 평문으로 나가는 문제가 있습니다.

```
공격자가 최초 HTTP 요청을 가로챌 수 있음:
  클라이언트 → http://bank.com → [공격자 MITM]
  공격자 → 응답 조작 (리다이렉트 없이 가짜 페이지)
```

이 문제를 해결하는 것이 **HSTS**입니다.

## HSTS (HTTP Strict Transport Security)

```nginx
# Nginx HSTS 설정
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

HSTS가 작동하는 방식:

```
최초 방문 (HTTPS): 서버 응답에 HSTS 헤더 포함
브라우저: "example.com은 max-age=31536000초 동안 HTTPS만 사용"

이후 방문 (HTTP 시도):
  브라우저: HTTP 요청 자체를 HTTPS로 업그레이드 (서버에 전혀 안 감)
  → MITM 불가능
```

**preload**를 추가하면 [hstspreload.org](https://hstspreload.org)에 등록해 브라우저에 미리 내장된 목록에 도메인을 추가할 수 있습니다. 최초 방문부터 HTTPS만 허용됩니다.

## HTTPS 보안 강화 메커니즘

![HTTPS 보안 강화 메커니즘](/assets/posts/network-https-hsts.svg)

### Certificate Transparency (CT)

모든 공인 CA는 발급한 인증서를 공개 CT 로그에 기록해야 합니다.

```bash
# 도메인의 인증서 CT 로그 검색
# crt.sh 웹 서비스 이용
curl -s "https://crt.sh/?q=example.com&output=json" | \
  python3 -c "
import sys,json
certs = json.load(sys.stdin)
for c in certs[:5]:
    print(c['not_before'][:10], c['common_name'])
"
```

크롬 브라우저는 CT 로그에 없는 인증서를 신뢰하지 않습니다(`ERR_CERTIFICATE_TRANSPARENCY_REQUIRED`).

### CAA (Certification Authority Authorization)

DNS 레코드로 이 도메인의 인증서를 발급할 수 있는 CA를 제한합니다.

```bash
# CAA 레코드 설정 (DNS zone file)
example.com. CAA 0 issue "letsencrypt.org"
example.com. CAA 0 issue "digicert.com"
example.com. CAA 0 issuewild ";"    # 와일드카드 발급 금지
example.com. CAA 0 iodef "mailto:security@example.com"

# 확인
dig CAA example.com
```

### OCSP Stapling

```nginx
# Nginx OCSP Stapling (TLS 1.3 포함)
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/nginx/ca-chain.pem;
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 3s;

# 확인
openssl s_client -connect example.com:443 -status \
  < /dev/null 2>/dev/null \
  | grep -A 20 "OCSP Response"
```

## 완성된 Nginx HTTPS 설정

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name example.com;

    # 인증서
    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # TLS 버전 및 암호 스위트
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;

    # 세션 재개
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/example.com/chain.pem;
    resolver 1.1.1.1 valid=300s;

    # 보안 헤더
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## HTTPS 설정 검증

```bash
# SSL Labs 등급 체크 (웹)
# https://www.ssllabs.com/ssltest/

# 명령줄로 빠른 검증
testssl.sh example.com

# TLS 버전·암호 스위트 확인
nmap --script ssl-enum-ciphers -p 443 example.com

# curl로 인증서 상세 확인
curl -v --insecure https://example.com 2>&1 | grep -E "(SSL|TLS|cert)"

# HSTS 헤더 확인
curl -I https://example.com | grep -i strict
```

## HTTP/3 시대의 HTTPS

HTTP/3는 TCP 대신 UDP 기반 QUIC을 사용합니다.

```
HTTP/1.1: TCP (80/443) → TLS → HTTP
HTTP/2:   TCP (443) → TLS → HTTP/2
HTTP/3:   UDP (443) → QUIC(TLS 1.3 내장) → HTTP/3
```

포트 443을 UDP로도 열어야 하며, `Alt-Svc` 헤더로 클라이언트에게 알립니다.

```nginx
# Nginx HTTP/3 (quic) 지원
listen 443 quic reuseport;
add_header Alt-Svc 'h3=":443"; ma=86400';
```

---

**지난 글:** [인증서와 PKI — X.509, CA 체인, 신뢰 구축](/posts/network-certificates-pki/)

**다음 글:** [방화벽 완전 정복 — 패킷 필터링부터 NGFW까지](/posts/network-firewalls/)

<br>
읽어주셔서 감사합니다. 😊
