---
title: "TCP/IP 4계층 모델: 인터넷의 실제 프로토콜 스택"
description: "TCP/IP 4계층 모델의 구조와 각 계층 역할, OSI 모델과의 대응 관계, HTTP 요청이 처리되는 실제 흐름을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["TCP/IP", "4계층모델", "인터넷계층", "전송계층", "네트워크모델", "프로토콜스택"]
featured: false
draft: false
---

[지난 글](/posts/network-osi-7-layers/)에서 OSI 7계층 모델을 살펴봤다. 이번 글에서는 실제 인터넷이 동작하는 기반인 **TCP/IP 4계층 모델**을 다룬다. OSI가 이론적 참조 모델이라면, TCP/IP는 현실에서 구현된 인터넷 표준이다.

## TCP/IP 모델의 탄생

TCP/IP는 1970년대 ARPANET(인터넷의 전신)에서 개발됐다. 1983년 ARPANET이 공식적으로 TCP/IP를 채택하면서 오늘날 인터넷의 기초가 됐다. OSI 모델(1984)보다 먼저 설계됐고, 실용성을 우선했기 때문에 7계층을 4계층으로 단순화했다.

![TCP/IP 4계층 구조](/assets/posts/network-tcp-ip-model-layers.svg)

## 4개 계층 상세

### 1계층: Network Access (네트워크 접근)

OSI 1계층(Physical)과 2계층(Data Link)을 합친 계층이다. 같은 네트워크 내에서 실제 비트를 전송하고, MAC 주소로 장치를 식별한다.

```
처리 대상: 이더넷 프레임 (Frame)
  ┌─────────────┬──────────┬────────────────┬─────┐
  │ Dst MAC(6B) │ Src MAC  │ EtherType(2B)  │ FCS │
  │ ff:ff:..    │ aa:bb:.. │ 0x0800 (IPv4)  │ CRC │
  └─────────────┴──────────┴────────────────┴─────┘
장비: 스위치, 이더넷 NIC, Wi-Fi AP
```

### 2계층: Internet (인터넷)

OSI 3계층(Network)에 해당한다. IP 주소를 이용해 서로 다른 네트워크를 넘나드는 **패킷 라우팅**이 핵심이다.

```
IPv4 패킷 헤더 (주요 필드):
  Version(4) | IHL | DSCP | Total Length
  ID | Flags | Fragment Offset
  TTL | Protocol | Header Checksum
  Source IP Address (32bit)
  Destination IP Address (32bit)
  [Options] [Data = TCP Segment]
```

핵심 프로토콜:
- **IP**: 논리 주소 지정 및 패킷 라우팅
- **ICMP**: 에러 보고, ping (echo request/reply)
- **ARP**: IP → MAC 주소 해석
- **BGP / OSPF**: 라우팅 프로토콜

### 3계층: Transport (전송)

OSI 4계층과 동일. **포트 번호**로 프로세스를 식별하고 종단 간 데이터 전달을 담당한다.

```python
import socket

# TCP 소켓: src_port → dst_port 조합이 연결 식별자
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect(("example.com", 443))  # dst port: 443 (HTTPS)
# OS가 임시 포트(ephemeral port) 자동 할당: 예) 54321

# UDP 소켓: 연결 수립 없이 즉시 전송
u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
u.sendto(b"query", ("8.8.8.8", 53))  # DNS UDP
```

**TCP**는 3-way handshake, 재전송, 흐름제어, 혼잡제어를 제공한다. **UDP**는 헤더가 8바이트뿐이고 연결 수립 없이 즉시 전송해 지연을 최소화한다.

### 4계층: Application (응용)

OSI 5·6·7계층을 통합한다. 사용자 서비스를 제공하는 모든 프로토콜이 여기에 속한다.

```
웰 노운 포트 (Well-Known Ports):
  HTTP    :  80 (TCP)
  HTTPS   : 443 (TCP)
  DNS     :  53 (UDP/TCP)
  SSH     :  22 (TCP)
  SMTP    :  25 (TCP)
  FTP     :  21 (TCP)
  DHCP    :  67/68 (UDP)
```

## HTTP 요청의 TCP/IP 처리 흐름

브라우저에서 `https://example.com`을 요청할 때 각 계층이 어떻게 동작하는지 살펴보자.

![HTTP 요청 처리 흐름](/assets/posts/network-tcp-ip-model-flow.svg)

```
1. Application: GET /index.html HTTP/1.1 메시지 생성
   ↓ [TLS 암호화 포함]
2. Transport: TCP Segment 생성 (src:54321 → dst:443)
   ↓ [3-way handshake 선행]
3. Internet: IP Packet 생성 (src IP → dst IP)
   ↓ [라우팅 테이블 조회]
4. Network Access: Ethernet Frame 생성 (MAC 주소)
   ↓ [다음 홉(hop) 라우터로 전송]

라우터: L3(IP) 헤더 읽어 다음 경로 결정, L2 프레임 재생성
서버: 반대 순서로 디캡슐화 → HTTP 요청 처리
```

## OSI vs TCP/IP 대응표

```
OSI 계층              TCP/IP 계층        주요 프로토콜
─────────────────────────────────────────────────────
7. Application        Application        HTTP, DNS, FTP
6. Presentation           ↓              TLS, MIME
5. Session                ↓              NetBIOS, RPC
─────────────────────────────────────────────────────
4. Transport          Transport          TCP, UDP
─────────────────────────────────────────────────────
3. Network            Internet           IP, ICMP, ARP
─────────────────────────────────────────────────────
2. Data Link          Network Access     Ethernet, Wi-Fi
1. Physical               ↓              케이블, 광섬유
```

## 왜 TCP/IP가 OSI를 이겼는가

1. **실용성**: OSI가 표준화를 논의하는 동안 TCP/IP는 이미 ARPANET에서 검증됐다
2. **단순함**: 4계층이 7계층보다 구현하기 쉽다
3. **오픈**: RFC(Request for Comments)를 통해 누구나 참여해 발전시킬 수 있었다

TCP/IP는 "rough consensus and running code(대략적 합의와 돌아가는 코드)"를 중시하는 인터넷 문화를 반영한다.

## 소켓과 TCP/IP

애플리케이션은 **소켓 API**를 통해 Transport 계층에 접근한다. 소켓은 IP 주소 + 포트 번호의 조합으로, 하나의 연결을 식별하는 5-tuple로 표현된다.

```
연결 5-tuple:
  (프로토콜, 출발지 IP, 출발지 포트, 목적지 IP, 목적지 포트)
  예: (TCP, 192.168.1.5, 54321, 93.184.216.34, 443)
```

같은 서버에 여러 클라이언트가 동시에 접속해도 출발지 포트가 달라서 각 연결을 구분할 수 있다.

---

**지난 글:** [OSI 7계층 모델](/posts/network-osi-7-layers/)

**다음 글:** [대역폭, 처리량, 지연시간](/posts/network-bandwidth-throughput-latency/)

<br>
읽어주셔서 감사합니다. 😊
