---
title: "L4 · L7 로드 밸런서 완전 정복"
description: "Transport 계층(L4)과 Application 계층(L7) 로드 밸런서의 차이점, 동작 원리, TLS 오프로딩, 콘텐츠 기반 라우팅을 실제 설정 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["L4로드밸런서", "L7로드밸런서", "ALB", "NLB", "HAProxy", "Nginx", "TLS오프로딩", "콘텐츠라우팅"]
featured: false
draft: false
---

[지난 글](/posts/network-load-balancing/)에서 로드 밸런서의 기본 개념과 알고리즘을 다뤘다. 실무에서는 "L4 쓸래요, L7 쓸래요?"라는 질문이 자주 나온다. 계층에 따라 볼 수 있는 정보가 달라지고, 그 정보를 얼마나 활용하느냐가 두 방식의 차이를 만든다. 이번 글에서는 그 차이를 정확히 짚어본다.

## OSI 계층과 로드 밸런서

로드 밸런서의 동작 계층은 라우팅 결정에 어떤 정보를 쓸 수 있는지를 결정한다.

- **L4 로드 밸런서**: OSI 4계층(Transport)에서 동작. TCP/UDP **IP 주소와 포트**만 보고 서버를 선택한다.
- **L7 로드 밸런서**: OSI 7계층(Application)에서 동작. HTTP **헤더, URL 경로, 쿠키, 메서드**까지 파악하고 결정한다.

![L4 vs L7 로드 밸런서 비교](/assets/posts/network-load-balancing-l4-l7-comparison.svg)

## L4 로드 밸런서

### 동작 방식

L4 LB는 TCP 연결을 보고 대상 서버를 결정한다. 패킷의 IP 헤더와 TCP/UDP 헤더만 분석하므로 **처리 속도가 매우 빠르다**. HTTP 페이로드(URL, 헤더 등)는 들여다보지 않는다.

```
클라이언트 → LB:443 (TCP SYN)
LB → 서버 A:8443 (TCP SYN 포워드)

# LB가 보는 것: src=1.2.3.4:50123, dst=10.0.0.1:443
# LB가 결정하는 것: 어느 서버로 포워딩할지 (IP+Port 기반)
```

### 특징

- **TLS 패스스루**: 암호화 트래픽을 복호화하지 않고 그대로 통과시킬 수 있다. 서버에서 TLS를 직접 종료한다.
- **낮은 레이턴시**: HTTP 파싱이 없으므로 수백만 TPS도 처리 가능하다.
- **프로토콜 무관**: HTTP가 아닌 TCP/UDP 기반 서비스(데이터베이스, 게임 서버, DNS)도 처리한다.
- **제약**: URL 기반 라우팅, WAF(웹 방화벽), A/B 테스트 불가.

### AWS NLB 예시

```
NLB 리스너: TCP:443
  Target Group A (서버 A, B, C)
  → 알고리즘: Flow Hash (IP + Port + Protocol)
  → Cross-zone load balancing: enabled
```

## L7 로드 밸런서

### 동작 방식

L7 LB는 TCP 연결을 맺고 HTTP 요청을 완전히 파싱한 뒤 라우팅한다. 요청의 URL 경로, Host 헤더, 메서드, 쿠키를 모두 볼 수 있다.

```
클라이언트 → LB (TLS 종료)
LB → HTTP 파싱 →
  GET /api/users    → API 서버 풀
  GET /images/logo  → CDN Origin 또는 이미지 서버
  GET /ws/chat      → WebSocket 서버 (Upgrade 헤더 확인)
  그 외             → 메인 웹 서버
```

![L7 URL 기반 콘텐츠 라우팅](/assets/posts/network-load-balancing-l4-l7-routing.svg)

### TLS 오프로딩 (SSL Termination)

L7 LB가 클라이언트와의 TLS를 종료하고, 내부 서버와는 HTTP(비암호화) 또는 별도 TLS로 통신한다.

```
[클라이언트] --TLS--> [LB] --HTTP 또는 TLS--> [서버]
```

장점: 각 서버가 TLS 처리 부담을 덜고, 인증서를 LB 한 곳에서만 관리한다.

### AWS ALB 규칙 예시

```
리스너 규칙 (우선순위 순):
  1. 조건: path-pattern = /api/*
     액션: forward → api-target-group

  2. 조건: path-pattern = /images/*
     액션: forward → image-target-group

  3. 조건: host-header = ws.example.com
     액션: forward → websocket-target-group

  4. 기본 규칙:
     액션: forward → web-target-group
```

### Nginx L7 라우팅 예시

```nginx
upstream api_servers {
    server 10.0.1.10:8080;
    server 10.0.1.11:8080;
}
upstream image_servers {
    server 10.0.2.10:8080;
    server 10.0.2.11:8080;
}

server {
    listen 443 ssl;

    location /api/ {
        proxy_pass http://api_servers;
    }
    location /images/ {
        proxy_pass http://image_servers;
    }
    location / {
        proxy_pass http://web_servers;
    }
}
```

## 언제 L4, 언제 L7?

| 상황 | 선택 |
|---|---|
| TCP/UDP 기반 서비스 (DB, 게임 서버) | L4 |
| 초저지연, 초고처리량 필요 | L4 |
| TLS end-to-end (LB가 복호화 불가) | L4 패스스루 |
| URL 기반 마이크로서비스 라우팅 | L7 |
| A/B 테스트, 카나리 배포 | L7 |
| WAF(웹 방화벽), Rate Limiting | L7 |
| 헤더 추가·수정, 리다이렉트 | L7 |

실제로는 **두 계층을 함께** 사용하는 경우가 많다. 외부에서 오는 트래픽을 L7 ALB가 받아 URL로 라우팅하고, 내부 서비스 간 통신은 L4 NLB로 처리하는 식이다.

## DSR(Direct Server Return)

L4 LB의 고급 기법. 클라이언트 → LB → 서버로 요청이 가지만, **응답은 서버 → 클라이언트로 직접** 간다. LB를 응답 경로에서 제외해 처리량을 극대화한다. 주로 고트래픽 미디어 서버나 게임 서버에서 사용된다.

```
요청:  클라이언트 → LB → 서버
응답:  서버 → 클라이언트 (LB 우회)
```

단, 서버에서 VIP를 로컬 인터페이스로 할당하는 설정이 필요하다.

---

**지난 글:** [로드 밸런싱 완전 정복 — 개념부터 알고리즘·헬스 체크까지](/posts/network-load-balancing/)

**다음 글:** [CDN 완전 정복 — 엣지 서버와 캐싱 전략](/posts/network-cdn/)

<br>
읽어주셔서 감사합니다. 😊
