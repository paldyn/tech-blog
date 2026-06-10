---
title: "DDoS 완화: 분산 서비스 거부 공격 방어 전략"
description: "볼류메트릭·프로토콜·L7 애플리케이션 DDoS 공격 유형과 Cloudflare, AWS Shield, Nginx rate limiting, Anycast, BGP 블랙홀 방어 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["DDoS", "Cloudflare", "AWSShield", "RateLimit", "Nginx", "봇방어"]
featured: false
draft: false
---

[지난 글](/posts/websec-sbom/)에서 SBOM 공급망 가시성을 살펴봤다. 이번 글은 가용성을 위협하는 DDoS(Distributed Denial of Service) 공격의 유형별 특성과 다층 방어 전략을 다룬다.

![DDoS 완화 레이어 구조](/assets/posts/websec-ddos-mitigation-layers.svg)

## DDoS 공격 유형

**볼류메트릭 공격(L3/L4)**: 대역폭 포화를 목표로 한다. UDP Amplification(NTP, DNS, Memcached 증폭)이 대표적이며 수백 Gbps~수 Tbps 트래픽을 생성한다. 2018년 GitHub이 1.35 Tbps의 Memcached 증폭 공격을 받았다.

**프로토콜 공격(L4)**: TCP 연결 상태 테이블을 고갈시킨다. SYN Flood는 3-way 핸드셰이크를 완료하지 않아 서버의 half-open 연결 큐를 가득 채운다.

**애플리케이션 공격(L7)**: 적은 트래픽으로 서버 자원을 소모한다. Slowloris는 HTTP 헤더를 아주 천천히 전송해 스레드를 계속 점유한다. HTTP Flood는 합법적으로 보이는 GET/POST를 대량 전송한다.

## Nginx DDoS 완화 설정

![Nginx + Cloudflare DDoS 방어 설정](/assets/posts/websec-ddos-mitigation-config.svg)

```nginx
# nginx.conf — 계층별 방어
http {
    # 요청 속도 제한 (IP당 30req/s, 버스트 10)
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;

    # 동시 연결 제한
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    server {
        # Slowloris 방어: 타임아웃 단축
        client_body_timeout    10s;
        client_header_timeout  10s;
        keepalive_timeout      30s;
        send_timeout           10s;

        # 요청 크기 제한
        client_max_body_size   10m;

        # IP당 동시 연결 10개
        limit_conn addr 10;

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            limit_req_status 429;
        }

        location /login {
            limit_req zone=login burst=5 nodelay;
            limit_req_status 429;
        }
    }
}
```

## AWS Shield + WAF 설정

```python
import boto3

shield = boto3.client("shield", region_name="us-east-1")
wafv2 = boto3.client("wafv2", region_name="ap-northeast-2")

# AWS Shield Advanced 보호 대상 등록
response = shield.create_protection(
    Name="my-alb-protection",
    ResourceArn="arn:aws:elasticloadbalancing:ap-northeast-2:123:loadbalancer/app/my-alb/abc"
)

# WAF Rate Based Rule: IP당 5분에 2000 요청 제한
rate_rule = {
    "Name": "RateLimit2000",
    "Priority": 1,
    "Action": {"Block": {}},
    "Statement": {
        "RateBasedStatement": {
            "Limit": 2000,
            "AggregateKeyType": "IP",
            "ScopeDownStatement": {
                "ByteMatchStatement": {
                    "SearchString": b"/api/",
                    "FieldToMatch": {"UriPath": {}},
                    "TextTransformations": [{"Priority": 0, "Type": "NONE"}],
                    "PositionalConstraint": "STARTS_WITH"
                }
            }
        }
    },
    "VisibilityConfig": {
        "SampledRequestsEnabled": True,
        "CloudWatchMetricsEnabled": True,
        "MetricName": "RateLimit"
    }
}
```

## Cloudflare Workers로 L7 DDoS 방어

```javascript
// cloudflare-worker.js — 요청 핑거프린팅 기반 봇 탐지
export default {
  async fetch(request, env) {
    const ip = request.headers.get("CF-Connecting-IP");
    const ua = request.headers.get("User-Agent") || "";
    const key = `ratelimit:${ip}`;

    // KV Store로 IP별 요청 카운트
    const count = parseInt(await env.KV.get(key) || "0") + 1;
    await env.KV.put(key, String(count), { expirationTtl: 60 });

    if (count > 100) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" }
      });
    }

    // 봇 시그니처 탐지
    const isSuspicious =
      ua === "" ||
      ua.includes("python-requests") ||
      ua.includes("curl/") ||
      request.cf?.botManagement?.score < 30;

    if (isSuspicious) {
      return new Response("Forbidden", { status: 403 });
    }

    return fetch(request);
  }
};
```

## SYN Cookie로 SYN Flood 방어

```bash
# Linux 커널: SYN Cookie 활성화
sysctl -w net.ipv4.tcp_syncookies=1

# 영구 설정 (/etc/sysctl.conf)
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 3

# SYN Flood 감지 로그 활성화
net.ipv4.tcp_syn_retries = 3

# iptables로 단일 IP의 SYN 패킷 제한
iptables -A INPUT -p tcp --syn \
  -m limit --limit 1/s --limit-burst 4 \
  -j ACCEPT
iptables -A INPUT -p tcp --syn -j DROP
```

## 복구 계획

```yaml
# DDoS 대응 플레이북 핵심
탐지:
  - CloudWatch 알람: 5분 평균 4xx > 500
  - Datadog: RPS 기준선 3σ 초과
  - 경보: PagerDuty → 담당자 호출

즉시 대응:
  - Cloudflare I'm Under Attack Mode 활성화
  - AWS Shield Advanced 긴급 지원 연락
  - 악성 IP 대역 즉시 차단

복구:
  - 공격 패턴 로그 분석 후 영구 규칙 추가
  - 사후 분석 보고서 작성
  - Rate Limit 임계값 재조정
```

---

**지난 글:** [SBOM: 소프트웨어 자재명세서로 공급망 가시성 확보](/posts/websec-sbom/)

**다음 글:** [Rate Limiting: API와 웹 서비스 속도 제한 구현](/posts/websec-rate-limiting/)

<br>
읽어주셔서 감사합니다. 😊
