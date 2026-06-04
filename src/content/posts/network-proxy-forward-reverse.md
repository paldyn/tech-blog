---
title: "프록시 완전 정복 — 포워드 프록시와 리버스 프록시"
description: "포워드 프록시와 리버스 프록시의 차이, 위치와 목적, Nginx 리버스 프록시 설정, SSL Termination, 로드 밸런싱, 투명 프록시와 CONNECT 메서드를 실무 위주로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["프록시", "리버스프록시", "포워드프록시", "Nginx", "로드밸런싱", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-vpn/)에서 VPN의 터널링 원리를 살펴봤습니다. 네트워크 통신에서 클라이언트와 서버 사이에 **중계 역할**을 하는 또 다른 장치가 프록시(Proxy)입니다. 이번 글에서는 포워드 프록시와 리버스 프록시의 차이와 실무 설정을 정리합니다.

## 프록시란?

프록시는 클라이언트와 서버 사이에서 요청을 **대신 처리하는 중간 서버**입니다. 프록시가 어느 쪽에 위치하느냐, 누구를 위해 존재하느냐에 따라 포워드/리버스로 나뉩니다.

## 포워드 프록시 vs 리버스 프록시

![포워드 vs 리버스 프록시 비교](/assets/posts/network-proxy-forward-reverse-compare.svg)

| 항목 | 포워드 프록시 | 리버스 프록시 |
|------|-------------|-------------|
| 위치 | 클라이언트 측 | 서버 측 |
| 설정 주체 | 클라이언트/사용자 | 서버 운영자 |
| 클라이언트 인지 여부 | 인지 (명시적 설정) | 모름 (투명하게 처리) |
| 목적 | 익명성, 필터링, 캐싱 | LB, SSL, 캐싱, WAF |
| 예시 | Squid, 기업 프록시, Tor | Nginx, HAProxy, Cloudflare |

## 포워드 프록시 (Forward Proxy)

### 주요 사용 목적

**1. 클라이언트 IP 숨기기**

```
직접 연결: 클라이언트(1.2.3.4) → 서버 (서버는 1.2.3.4 봄)
프록시 경유: 클라이언트(1.2.3.4) → 프록시(5.6.7.8) → 서버 (서버는 5.6.7.8 봄)
```

**2. 콘텐츠 필터링 (기업 환경)**

```
직원 PC → 포워드 프록시 → 인터넷
  - SNS, 게임 사이트 차단
  - HTTPS 복호화 검사 (SSL Bump)
  - 대역폭 제어
```

**3. 캐싱**

```bash
# Squid 포워드 프록시 설정
# /etc/squid/squid.conf
http_port 3128
cache_mem 256 MB
cache_dir ufs /var/spool/squid 10240 16 256
acl localnet src 192.168.0.0/16
http_access allow localnet
http_access deny all

# 클라이언트에서 프록시 설정 (Linux)
export http_proxy="http://proxy.example.com:3128"
export https_proxy="http://proxy.example.com:3128"
export no_proxy="localhost,127.0.0.1,192.168.0.0/16"
```

### CONNECT 메서드 (HTTPS 터널)

HTTP 프록시를 통해 HTTPS를 연결할 때 CONNECT 메서드를 씁니다.

```
클라이언트 → 프록시:
  CONNECT example.com:443 HTTP/1.1
  Host: example.com:443

프록시 → 클라이언트:
  HTTP/1.1 200 Connection Established

이후: 클라이언트 ↔ 프록시 ↔ example.com (TCP 터널)
      프록시는 내용을 볼 수 없음 (암호화됨)
```

## 리버스 프록시 (Reverse Proxy)

클라이언트는 리버스 프록시가 있다는 사실을 모릅니다. 직접 서버와 통신하는 것처럼 보입니다.

### Nginx 리버스 프록시 설정

![Nginx 리버스 프록시 설정](/assets/posts/network-proxy-forward-reverse-nginx.svg)

**기본 설정**

```nginx
upstream backend {
    server 10.0.0.1:8080 weight=3;  # 트래픽 3배 처리
    server 10.0.0.2:8080;
    server 10.0.0.3:8080 backup;    # 나머지 다운 시만 사용
    keepalive 32;                    # 커넥션 풀
}

server {
    listen 443 ssl;
    http2 on;
    server_name api.example.com;

    location /api/ {
        proxy_pass http://backend/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";           # keepalive 활성화
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 타임아웃
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;

        # 버퍼링
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
    }

    # 정적 파일은 Nginx에서 직접 서빙
    location /static/ {
        alias /var/www/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### SSL Termination

리버스 프록시가 HTTPS를 처리하고 백엔드에는 HTTP로 전달합니다.

```
클라이언트 ──HTTPS──→ [Nginx:443] ──HTTP──→ 백엔드:8080

장점:
  ✓ 백엔드 서버가 TLS 처리 불필요 (CPU 절감)
  ✓ 인증서를 Nginx 하나에서만 관리
  ✓ 백엔드 내부망은 평문 (빠름)

주의:
  내부망도 암호화가 필요하다면 SSL Re-encryption 사용
  (Nginx → 백엔드도 HTTPS)
```

### 로드 밸런싱 알고리즘

```nginx
# Round Robin (기본)
upstream rr {
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
}

# Least Connections (가장 연결 적은 서버)
upstream lc {
    least_conn;
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
}

# IP Hash (같은 클라이언트 → 같은 서버, 세션 유지)
upstream ih {
    ip_hash;
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
}

# Weighted (서버 성능 차이 있을 때)
upstream wt {
    server 10.0.0.1:8080 weight=5;   # 5배 더 처리
    server 10.0.0.2:8080 weight=1;
}
```

### 헬스 체크

```nginx
# Nginx Plus (유료) or nginx_upstream_check_module
upstream backend {
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
    
    # 수동 헬스 체크 (기본 Nginx)
    # 2번 실패 → 30초 제외
    server 10.0.0.3:8080 max_fails=2 fail_timeout=30s;
}
```

## HAProxy 설정 예시

```
# HAProxy 리버스 프록시
frontend web_frontend
    bind *:443 ssl crt /etc/ssl/haproxy.pem
    default_backend web_backend
    http-request set-header X-Forwarded-Proto https

backend web_backend
    balance roundrobin
    option httpchk GET /health
    http-check expect status 200
    server web1 10.0.0.1:8080 check inter 5s rise 2 fall 3
    server web2 10.0.0.2:8080 check inter 5s rise 2 fall 3
```

## 투명 프록시 (Transparent Proxy)

클라이언트 설정 없이 네트워크 수준에서 트래픽을 가로채는 프록시입니다.

```bash
# iptables로 HTTP 트래픽을 Squid로 리다이렉트
iptables -t nat -A PREROUTING \
  -i eth0 \
  -p tcp --dport 80 \
  -j REDIRECT --to-port 3128
```

---

**지난 글:** [VPN 완전 정복 — 터널링과 암호화로 안전한 통신](/posts/network-vpn/)

**다음 글:** [로드 밸런싱 완전 정복](/posts/network-load-balancing/)

<br>
읽어주셔서 감사합니다. 😊
