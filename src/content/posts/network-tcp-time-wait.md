---
title: "TCP TIME_WAIT 완전 정복: 왜 생기고 어떻게 다루는가"
description: "TCP TIME_WAIT 상태의 두 가지 존재 이유, MSL·2MSL 의미, 포트 고갈 진단과 안전한 튜닝 방법을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["TCP", "TIME_WAIT", "MSL", "포트고갈", "tcp_tw_reuse", "SO_REUSEADDR", "Keep-Alive"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-state-machine/)에서 TCP 11개 상태와 전이 전체를 살펴봤다. 그 중 `TIME_WAIT`은 서버 운영자에게 가장 빈번한 문제 원인이다. "TIME_WAIT가 너무 많아서 포트가 부족하다"는 증상은 흔하지만, **왜 TIME_WAIT이 존재하는지** 를 모르면 위험한 방법으로 제거하려다 더 큰 장애를 만들 수 있다.

## TIME_WAIT가 존재하는 두 가지 이유

```text
이유 1: 마지막 ACK 유실 시 재전송 대응
────────────────────────────────────────
Active Close가 마지막 ACK을 보낸 뒤 Passive Close의 FIN이
재전송될 수 있다. TIME_WAIT 중이어야 이를 받아서 ACK을 다시
보낼 수 있다. 즉시 CLOSED 상태가 되면 RST를 응답하게 되고
Passive Close 측은 오류로 연결이 끝난다.

이유 2: 이전 연결의 지연 패킷 오염 방지
────────────────────────────────────────
같은 4-tuple(src IP, src port, dst IP, dst port)로 새 연결을
맺었을 때, 이전 연결에서 네트워크에 떠 있던 패킷이 늦게 도착하면
새 연결의 데이터로 잘못 처리된다. 2MSL(최대 세그먼트 수명 × 2)
동안 기다리면 이전 연결의 패킷은 모두 소멸되었음이 보장된다.
```

## TIME_WAIT 시나리오: 마지막 ACK 유실

![마지막 ACK 유실 시나리오](/assets/posts/network-tcp-time-wait-why.svg)

마지막 ACK이 유실되면 Passive Close 측은 FIN을 재전송한다. Active Close 측이 TIME_WAIT 상태에 있기 때문에 이 FIN을 받아서 ACK을 다시 보낼 수 있다. 이 시점에 2MSL 타이머가 리셋된다.

## MSL과 2MSL

**MSL(Maximum Segment Lifetime)**은 세그먼트가 네트워크에서 살아있을 수 있는 최대 시간이다. Linux 기본값은 60초(RFC 793은 2분 권장). 따라서 TIME_WAIT 지속 시간은 **2×60 = 120초**다.

```bash
# Linux에서 MSL 확인 (직접 조회 불가, tcp_fin_timeout으로 간접 파악)
# TIME_WAIT 지속 시간 = 2 * MSL = 보통 60~120초

# 실제 TIME_WAIT 소켓 수
ss -tan state time-wait | wc -l

# 포트 범위 확인 (사용 가능한 Outbound 포트 수)
sysctl net.ipv4.ip_local_port_range
# net.ipv4.ip_local_port_range = 32768 60999
# → 28231개 포트 사용 가능
```

## 튜닝 옵션 비교

![TIME_WAIT 튜닝 옵션](/assets/posts/network-tcp-time-wait-tuning.svg)

## 안전한 접근 순서

TIME_WAIT 과다 문제의 근본 원인은 **연결을 너무 많이 맺고 끊는다**는 것이다. 튜닝 옵션보다 **연결 재사용**이 우선이다.

```nginx
# Nginx upstream에서 keep-alive 활성화
upstream backend {
    server 127.0.0.1:8080;
    keepalive 32;        # 유지할 idle 연결 수
}

server {
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";  # keep-alive 강제
    }
}
```

```bash
# 1단계: 연결 재사용 (HTTP Keep-Alive, HTTP/2, 커넥션 풀)
# 2단계: SO_REUSEADDR (서버 재시작 시 필수)
# 3단계: tcp_tw_reuse (Outbound 연결만, NAT 없는 환경)
# 4단계: ip_local_port_range 확장 (최후 수단)
sysctl -w net.ipv4.ip_local_port_range="1024 65535"

# ✗ SO_LINGER(0): 데이터 유실 위험, 사용 금지
# ✗ tcp_tw_recycle: Linux 4.12+ 제거됨, 이전 커널에서도 NAT 위험
```

## Active Close는 서버? 클라이언트?

통상 HTTP에서 **서버**가 `Connection: close` 헤더와 함께 먼저 FIN을 보내는 경우가 많다. 이 경우 서버에 TIME_WAIT이 쌓인다. HTTP Keep-Alive나 HTTP/2를 쓰면 연결을 오래 유지하므로 이 문제가 크게 줄어든다. HTTP/1.1 이상 + `Connection: keep-alive`가 기본이지만, 백엔드 서버에서 짧은 `keepalive_timeout`으로 빠르게 닫는 경우 서버 측에 TIME_WAIT이 발생한다.

---

**지난 글:** [TCP 상태 머신: 11가지 상태와 전이 완전 해부](/posts/network-tcp-state-machine/)

**다음 글:** [TCP 순서 번호와 ACK: 신뢰성의 수학적 기반](/posts/network-tcp-sequence-ack/)

<br>
읽어주셔서 감사합니다. 😊
