---
title: "TCP/IP 4계층 모델: 인터넷이 실제로 동작하는 방식"
description: "TCP/IP 4계층 모델의 구조와 각 계층의 역할, OSI 모델과의 차이, 웹 요청이 계층을 거치는 실제 흐름을 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["TCP/IP", "4계층모델", "인터넷계층", "전송계층", "네트워크", "프로토콜스택"]
featured: false
draft: false
---

[지난 글](/posts/network-osi-7-layers/)에서 OSI 7계층 모델을 살펴봤다. OSI는 이론적 참조 모델이고, 실제 인터넷은 **TCP/IP 4계층 모델**로 동작한다. 1970년대 DARPA가 군용 네트워크 ARPANET을 위해 개발한 이 모델이 오늘날 인터넷의 기반이 됐다.

## TCP/IP 4계층 구조

TCP/IP 모델은 OSI의 7계층을 4개로 압축한다.

![TCP/IP 4계층과 OSI 비교](/assets/posts/network-tcp-ip-model-layers.svg)

### 1. 네트워크 접근 계층 (Network Access / Link Layer)

물리적 네트워크와 직접 상호작용하는 계층이다. 이더넷, Wi-Fi, PPP 등 실제 전송 매체를 다루며, MAC 주소 기반으로 같은 네트워크 내 프레임을 전달한다. OSI의 1~2계층을 합친 것이다.

### 2. 인터넷 계층 (Internet Layer)

IP 주소를 사용해 서로 다른 네트워크 간 패킷을 라우팅한다. OSI 3계층에 해당한다. 핵심 특성은 **Best-Effort 전달** — 패킷 도착 보장이나 순서 보장을 하지 않는다. 그 책임은 상위 전송 계층이 진다.

```text
주요 프로토콜: IP (IPv4/IPv6), ICMP, ARP, BGP, OSPF
```

### 3. 전송 계층 (Transport Layer)

종단 간(End-to-End) 데이터 전달을 담당한다. 포트 번호로 프로세스를 구분하고, 두 가지 프로토콜을 제공한다.

- **TCP**: 연결 지향, 순서 보장, 재전송, 흐름 제어 — 신뢰성이 필요한 통신
- **UDP**: 비연결, 최소 오버헤드 — 실시간 스트리밍, DNS, 게임

### 4. 응용 계층 (Application Layer)

사용자와 직접 상호작용하는 모든 프로토콜이 위치한다. OSI의 5~7계층을 통합한 층이다.

```text
HTTP/HTTPS — 웹
DNS         — 도메인 이름 해석
SMTP/IMAP   — 이메일
SSH         — 원격 접속
FTP/SFTP    — 파일 전송
```

## 웹 요청이 계층을 통과하는 흐름

브라우저에서 `https://example.com`을 요청할 때 각 계층이 어떻게 동작하는지 살펴보자.

![웹 요청 계층별 흐름](/assets/posts/network-tcp-ip-model-flow.svg)

```text
[Browser → Server]
App:       HTTP GET / HTTP 요청 생성
Transport: TCP 헤더 추가 (src port: 49152, dst port: 443)
Internet:  IP 헤더 추가 (src: 내 IP, dst: 서버 IP)
Link:      이더넷 프레임 생성 (dst MAC: 게이트웨이)

[경유 라우터]
Link:      프레임 수신, MAC 헤더 제거
Internet:  IP 라우팅 테이블 조회, Next Hop 결정
Link:      새 MAC 헤더 붙여 다음 라우터로 전송

[Server 수신]
Link → Internet → Transport → App 순으로 역캡슐화
App:       HTTP 요청 처리 → HTTP 200 OK 응답
```

라우터는 L3(인터넷 계층)까지만 처리한다. HTTP 내용은 읽지 않는다. 이것이 **계층 독립성**의 핵심이다.

## TCP/IP vs OSI: 실용적 차이

| 측면 | OSI | TCP/IP |
|------|-----|--------|
| 계층 수 | 7 | 4 |
| 목적 | 이론적 참조 | 실제 구현 |
| 등장 시기 | 1984 | 1970년대 |
| 현재 사용 | 교육·진단 | 실제 인터넷 |

현장에서는 "L3 스위치", "L4 로드밸런서" 같이 OSI 계층 번호를 그대로 사용한다. TCP/IP 모델로 치면 인터넷 계층, 전송 계층이지만 관행적으로 OSI 번호를 쓴다.

## 계층을 알아야 하는 이유

네트워크 문제는 대부분 특정 계층에서 발생한다.

```text
핑(ping)이 안 된다 → L3 문제 (IP, 라우팅)
포트 연결이 안 된다 → L4 문제 (TCP, 방화벽)
HTTP 응답이 이상하다 → L7 문제 (앱, 프록시)
```

계층을 알면 문제를 격리(Isolation)할 수 있고, 진단 명령어도 계층별로 따로 있다. 이 시리즈를 통해 각 계층의 핵심 개념을 차례로 살펴볼 것이다.

---

**지난 글:** [OSI 7계층 모델 완전 해설](/posts/network-osi-7-layers/)

**다음 글:** [대역폭·처리량·지연: 네트워크 성능의 세 축](/posts/network-bandwidth-throughput-latency/)

<br>
읽어주셔서 감사합니다. 😊
