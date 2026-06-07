---
title: "TCP/IP 4계층 모델: 인터넷이 동작하는 실제 구조"
description: "TCP/IP 4계층(응용·전송·인터넷·네트워크접근)의 역할, 프로토콜, OSI 7계층과의 대응 관계를 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["TCP/IP", "4계층", "인터넷계층", "전송계층", "응용계층", "네트워크모델", "OSI비교"]
featured: false
draft: false
---

[지난 글](/posts/network-osi-7-layers/)에서 OSI 7계층의 각 계층 역할과 캡슐화 과정을 살펴봤다. 이론적으로 정교한 OSI 모델과 달리, 실제 인터넷을 움직이는 구조는 **TCP/IP 4계층 모델**이다. 1970년대 DARPA의 ARPANET 프로젝트에서 실용적으로 설계된 이 모델은 OSI보다 먼저 인터넷 표준으로 자리 잡았으며, 오늘날 모든 인터넷 통신의 기반이다.

## TCP/IP 4계층 구조

![TCP/IP 4계층 모델](/assets/posts/network-tcp-ip-model-layers.svg)

TCP/IP는 OSI의 7계층을 4계층으로 통합했다. OSI의 세션·표현·응용 계층이 TCP/IP의 응용 계층 하나로 합쳐진 것이 가장 큰 차이다.

### 4계층: 응용 계층 (Application Layer)

사용자와 직접 상호작용하는 계층이다. HTTP, HTTPS, FTP, SMTP, DNS, SSH 등 우리가 일상적으로 접하는 모든 서비스 프로토콜이 여기에 있다. 데이터 형식과 표현(OSI 6계층)도 이 계층에서 처리한다.

```bash
# HTTP 요청 헤더 확인 (curl -v)
curl -v https://example.com 2>&1 | head -20
# > GET / HTTP/2
# > Host: example.com
# > User-Agent: curl/8.x
```

### 3계층: 전송 계층 (Transport Layer)

포트 번호를 이용해 프로세스 간 통신을 담당한다. TCP는 연결 지향적이고 신뢰성 있는 전송을, UDP는 빠르고 가벼운 전송을 제공한다. TCP의 3-way 핸드셰이크, 흐름 제어, 혼잡 제어가 이 계층에서 이뤄진다.

### 2계층: 인터넷 계층 (Internet Layer)

서로 다른 네트워크를 넘나드는 **패킷 라우팅**을 담당한다. IP 주소를 기반으로 최적 경로를 찾아 패킷을 전달한다. IPv4, IPv6, ICMP, ARP, BGP, OSPF가 이 계층에 속한다.

```python
# Python으로 IP 패킷 TTL 확인 (scapy)
from scapy.all import IP, ICMP, sr1
pkt = IP(dst="8.8.8.8", ttl=64) / ICMP()
response = sr1(pkt, timeout=2, verbose=0)
if response:
    print(f"TTL in response: {response.ttl}")
```

### 1계층: 네트워크 접근 계층 (Network Access Layer)

물리적 전송 매체와 직접 통신하는 계층이다. OSI의 데이터링크 계층과 물리 계층을 합친 것으로, 이더넷 프레임 구성, MAC 주소 기반 전달, 케이블 신호 규격이 모두 이 계층의 역할이다.

## OSI vs TCP/IP 대응 관계

![OSI vs TCP/IP 비교](/assets/posts/network-tcp-ip-model-vs-osi.svg)

| OSI 계층 | TCP/IP 계층 | 프로토콜 예시 |
|---------|------------|-------------|
| 7 응용 | 응용 | HTTP, HTTPS, FTP |
| 6 표현 | 응용 | TLS/SSL, JPEG, Unicode |
| 5 세션 | 응용 | RPC, NetBIOS |
| 4 전송 | 전송 | TCP, UDP |
| 3 네트워크 | 인터넷 | IP, ICMP, BGP |
| 2 데이터링크 | 네트워크접근 | 이더넷, Wi-Fi |
| 1 물리 | 네트워크접근 | 케이블, 광섬유 |

## TCP/IP가 OSI를 이긴 이유

TCP/IP의 승리는 **먼저 작동하는 구현**이 있었기 때문이다. OSI는 명세 완성 전에 TCP/IP가 ARPANET을 통해 이미 운영 중이었고, 벤더들이 TCP/IP 기반 장비와 소프트웨어를 대거 출시한 상태였다. "이론적으로 더 좋은 모델"보다 "지금 돌아가는 구현"이 시장을 지배한다는 역사적 교훈이다.

다음 글에서는 네트워크 성능을 측정하는 핵심 지표인 대역폭, 처리량, 지연 시간을 자세히 살펴본다.

---

**지난 글:** [OSI 7계층 모델 완전 정복](/posts/network-osi-7-layers/)

**다음 글:** [대역폭·처리량·지연 시간 완전 정복](/posts/network-bandwidth-throughput-latency/)

<br>
읽어주셔서 감사합니다. 😊
