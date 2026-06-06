---
title: "로드 밸런싱 완전 정복 — 개념부터 알고리즘·헬스 체크까지"
description: "로드 밸런서가 무엇인지, VIP·알고리즘·헬스 체크·세션 지속성(Sticky Session)까지 로드 밸런싱의 핵심 개념을 실무 관점에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 1
type: "knowledge"
category: "Network"
tags: ["로드밸런싱", "LoadBalancer", "RoundRobin", "LeastConnections", "IPHash", "VIP", "헬스체크", "고가용성"]
featured: false
draft: false
---

[지난 글](/posts/network-proxy-forward-reverse/)에서 리버스 프록시를 살펴봤다. 클라이언트 요청을 받아 백엔드 서버로 전달하는 그 구조에서 자연스럽게 생기는 질문이 있다. "백엔드 서버가 여러 대라면 요청을 어떻게 나눠 보낼까?" 그 답이 **로드 밸런싱(Load Balancing)**이다. 단순히 '트래픽을 분산'하는 것처럼 보이지만, 알고리즘 선택·헬스 체크·세션 지속성까지 고려하면 꽤 깊은 주제다.

## 로드 밸런싱이란

로드 밸런싱은 **여러 서버에 네트워크 트래픽이나 요청을 균등하게 분산시키는 기술**이다. 단일 서버에 모든 요청이 집중되면 서버가 다운되거나 응답이 느려지는데, 로드 밸런서(Load Balancer, LB)가 클라이언트와 서버 사이에서 트래픽을 조율한다.

로드 밸런서의 핵심 특성:

- **단일 진입점**: 클라이언트는 하나의 IP(VIP: Virtual IP)로만 접속한다. 실제 서버 IP는 감춰진다.
- **가용성 향상**: 서버 한 대가 죽어도 나머지로 요청이 자동 전달된다.
- **수평 확장**: 서버를 추가할수록 처리 용량이 늘어난다.

![로드 밸런싱 요청 분산 구조](/assets/posts/network-load-balancing-overview.svg)

## VIP와 헬스 체크

### VIP (Virtual IP)

클라이언트는 항상 로드 밸런서의 **VIP**(예: `10.0.0.1:443`)로 연결한다. 로드 밸런서는 알고리즘에 따라 실제 서버(Real Server) 중 하나를 선택해 요청을 포워딩한다. 클라이언트는 어느 서버가 응답했는지 알 수 없다.

### 헬스 체크 (Health Check)

로드 밸런서는 주기적으로 각 서버의 상태를 점검한다.

```
# HAProxy 헬스 체크 설정 예시
backend web_servers
    balance roundrobin
    option httpchk GET /health HTTP/1.1\r\nHost:\ app.example.com
    timeout check 2s

    server web1 192.168.1.10:8080 check inter 3s rise 2 fall 3
    server web2 192.168.1.11:8080 check inter 3s rise 2 fall 3
    server web3 192.168.1.12:8080 check inter 3s rise 2 fall 3
```

- `inter 3s`: 3초마다 체크
- `rise 2`: 2회 연속 성공 → 복구 판정
- `fall 3`: 3회 연속 실패 → 다운 판정
- 다운 판정된 서버는 풀에서 제거, 복구 시 자동 재투입

## 로드 밸런싱 알고리즘

![로드 밸런싱 알고리즘 비교](/assets/posts/network-load-balancing-algorithms.svg)

### Round Robin

가장 기본적인 방식. 서버 목록을 순서대로 순환하며 요청을 배분한다.

```
요청 1 → 서버 A
요청 2 → 서버 B
요청 3 → 서버 C
요청 4 → 서버 A  (다시 처음으로)
```

서버 성능이 동일하고 요청 처리 시간이 비슷할 때 최적이다. 구현이 단순하고 오버헤드가 낮다.

### Least Connections

현재 활성 연결 수가 가장 적은 서버로 요청을 보낸다.

```
서버 A: 활성 연결 5개
서버 B: 활성 연결 2개  ← 다음 요청은 여기
서버 C: 활성 연결 4개
```

요청마다 처리 시간이 크게 다를 때(파일 업로드 vs 단순 API 호출 혼재) 효과적이다.

### IP Hash

클라이언트 IP를 해시하여 항상 동일한 서버로 라우팅한다.

```python
server_index = hash(client_ip) % num_servers
```

같은 IP에서 온 요청은 항상 동일 서버로 전달된다. **Sticky Session** 효과를 낸다. 단, 서버 수가 변경되면 해시 결과가 달라져 기존 연결이 깨질 수 있다.

### Weighted Round Robin / Weighted Least Connections

서버마다 가중치를 부여해 고성능 서버에 더 많은 트래픽을 보낸다.

```
서버 A (weight=3): 요청 3개
서버 B (weight=1): 요청 1개
→ 순서: A, A, A, B, A, A, A, B ...
```

사양이 다른 서버가 혼재하는 환경에서 유용하다.

## 세션 지속성 (Session Persistence / Sticky Session)

로드 밸런서가 요청을 여러 서버로 분산하면, 로그인 세션처럼 서버에 저장된 상태가 유실될 수 있다. 이를 해결하는 두 가지 방법이 있다.

**1. 쿠키 기반 Sticky Session**

로드 밸런서가 첫 응답에 쿠키를 심고, 이후 요청에서 같은 쿠키가 있으면 동일 서버로 라우팅한다.

```
# Nginx sticky module 예시
upstream app {
    sticky cookie srv_id expires=1h domain=.example.com path=/;
    server 192.168.1.10:8080;
    server 192.168.1.11:8080;
}
```

**2. 공유 세션 저장소 (권장)**

세션을 Redis나 Memcached 같은 외부 저장소에 두면 어느 서버가 요청을 받아도 세션을 읽을 수 있다. Sticky Session 없이 진정한 수평 확장이 가능하다.

## Active-Active vs Active-Passive

로드 밸런서 자체도 고가용성이 필요하다.

| 구성 | 설명 | 특징 |
|---|---|---|
| **Active-Active** | LB 2대 모두 트래픽 처리 | 용량 2배, 두 대 동시 장애 시 서비스 중단 |
| **Active-Passive** | LB 1대가 Standby 대기 | 처리 용량은 1대분, Failover 시 Standby가 VIP 인계 |

두 LB가 VIP를 공유하기 위해 VRRP(Virtual Router Redundancy Protocol) 또는 클라우드 제공 기능을 활용한다.

## 실무에서 사용하는 로드 밸런서

| 제품 | 계층 | 특징 |
|---|---|---|
| **HAProxy** | L4/L7 | 오픈소스 최강자, TCP/HTTP 모두 지원 |
| **Nginx** | L7 | 웹서버 겸용, HTTP upstream 블록 |
| **AWS ALB** | L7 | HTTP/HTTPS URL 기반 라우팅 |
| **AWS NLB** | L4 | TCP/UDP 초저지연, 고정 IP |
| **GCP Load Balancing** | L4/L7 | 글로벌 anycast 지원 |
| **Kubernetes Service** | L4 | 클러스터 내부 kube-proxy 기반 |

## 간단한 Nginx 로드 밸런서 설정

```nginx
upstream backend {
    least_conn;  # Least Connections 알고리즘

    server 192.168.1.10:8080 weight=3;
    server 192.168.1.11:8080 weight=2;
    server 192.168.1.12:8080 weight=1 backup;

    keepalive 32;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

`backup` 키워드가 붙은 서버는 나머지 서버가 모두 다운됐을 때만 사용하는 예비 서버다.

---

**지난 글:** [프록시 완전 정복 — 포워드 프록시와 리버스 프록시](/posts/network-proxy-forward-reverse/)

**다음 글:** [L4 · L7 로드 밸런서 완전 정복](/posts/network-load-balancing-l4-l7/)

<br>
읽어주셔서 감사합니다. 😊
