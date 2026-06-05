---
title: "OSI 7계층 모델: 네트워크 통신의 설계도"
description: "OSI 7계층 모델의 각 계층 역할, PDU 이름, 대표 프로토콜을 정리하고 캡슐화·디캡슐화 동작을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["OSI7계층", "캡슐화", "프로토콜계층", "네트워크모델", "PDU", "TCP/IP"]
featured: false
draft: false
---

[지난 글](/posts/network-what-is-network/)에서 네트워크가 노드·링크·프로토콜의 조합임을 살펴봤다. 이번 글에서는 그 프로토콜을 계층별로 정리한 **OSI(Open Systems Interconnection) 7계층 모델**을 파헤친다. OSI 모델은 실제 구현보다는 개념 이해와 문제 해결의 기준이 되는 참조 모델(Reference Model)이다.

## OSI 모델이란

1984년 ISO(국제표준화기구)가 제안한 **통신 프로토콜 설계를 위한 7단계 계층 구조**다. 서로 다른 벤더의 장비끼리도 통신할 수 있도록 표준화된 계층별 역할을 정의한다. 실제 인터넷은 TCP/IP 4계층을 사용하지만, 트러블슈팅이나 기술 설명 시 OSI 모델이 기준이 된다.

![OSI 7계층 다이어그램](/assets/posts/network-osi-7-layers-diagram.svg)

## 7개 계층 상세

### 1계층: 물리 (Physical)

전기 신호, 광 신호, 전파를 이용해 비트(0, 1)를 전송한다. 케이블 종류, 커넥터, 전압 레벨, 전송 속도를 정의한다. 이 계층은 데이터의 의미를 모르고, 비트 스트림만 전달한다.

- PDU: **Bit**
- 장비: 케이블, 리피터, 허브
- 기술: 이더넷 물리 규격(100BASE-TX), Wi-Fi 무선 신호, 광섬유

### 2계층: 데이터링크 (Data Link)

같은 네트워크(링크) 내의 노드 간 신뢰성 있는 프레임 전송을 담당한다. **MAC 주소**로 장치를 식별하고, 오류 감지(FCS), 흐름 제어를 수행한다. 2개의 서브계층으로 구성된다.

- LLC(Logical Link Control): 상위 프로토콜 식별, 흐름제어
- MAC(Media Access Control): 매체 접근 제어, MAC 주소 관리

```
Ethernet Frame 구조:
[Preamble 8B][Dest MAC 6B][Src MAC 6B][EtherType 2B][Data][FCS 4B]
```

- PDU: **Frame**
- 장비: 스위치, 브리지
- 기술: Ethernet, Wi-Fi(802.11), PPP

### 3계층: 네트워크 (Network)

서로 다른 네트워크 간의 **패킷 라우팅**을 담당한다. **IP 주소**로 출발지·목적지를 표시하고, 라우터가 최적 경로를 결정한다. 에러 보고(ICMP), 주소 해석(ARP)도 이 계층에서 처리된다.

```
IP Packet 구조:
[IP Header: Src IP, Dst IP, TTL, Protocol ...][TCP/UDP Segment]
```

- PDU: **Packet**
- 장비: 라우터, L3 스위치
- 기술: IPv4, IPv6, ICMP, ARP, BGP

### 4계층: 전송 (Transport)

**종단 간(End-to-End) 데이터 전달**을 책임진다. **포트 번호**로 애플리케이션을 구분하고, TCP는 신뢰성(재전송, 흐름제어, 혼잡제어)을, UDP는 빠른 전송을 제공한다.

```
TCP Segment 구조:
[Src Port 2B][Dst Port 2B][Seq# 4B][Ack# 4B][Flags][Window][Checksum][Data]
```

- PDU: **Segment** (TCP) / **Datagram** (UDP)
- 기술: TCP, UDP, SCTP

### 5계층: 세션 (Session)

통신 세션의 수립·유지·종료를 관리한다. 체크포인트를 두어 연결이 끊겼을 때 복구 지점을 제공한다. 현대 인터넷 애플리케이션에서는 애플리케이션 레이어에서 직접 처리하는 경우가 많아 실질적 역할이 줄었다.

- 기술: NetBIOS, RPC, SMB 세션 관리

### 6계층: 표현 (Presentation)

데이터의 **형식·암호화·압축**을 담당한다. 서로 다른 시스템 간 데이터 형식 차이를 해결한다. TLS/SSL 암호화, JPEG/PNG 이미지 인코딩, ASCII/UTF-8 문자 인코딩이 이 계층에 속한다.

- 기술: TLS, SSL, JPEG, ASCII, Base64

### 7계층: 응용 (Application)

사용자가 직접 상호작용하는 서비스를 제공한다. 웹 브라우저, 이메일 클라이언트, FTP 클라이언트가 이 계층에서 동작한다.

- PDU: **Data** (Message)
- 기술: HTTP, HTTPS, FTP, SMTP, DNS, SSH

## 캡슐화와 디캡슐화

OSI 모델의 핵심 메커니즘은 **캡슐화(Encapsulation)**다. 데이터를 보낼 때 각 계층이 헤더를 추가하고, 받을 때 역순으로 제거한다.

![캡슐화 과정](/assets/posts/network-osi-7-layers-encapsulation.svg)

```python
# 캡슐화 과정 개념 코드 (의사 코드)
def send_data(raw_data):
    # 7계층: HTTP 헤더 추가
    app_data = http_header + raw_data

    # 4계층: TCP 헤더 추가 (포트, 시퀀스번호...)
    segment = tcp_header + app_data

    # 3계층: IP 헤더 추가 (IP 주소, TTL...)
    packet = ip_header + segment

    # 2계층: 이더넷 헤더+FCS 추가 (MAC 주소...)
    frame = eth_header + packet + fcs

    # 1계층: 비트로 변환해 물리 매체로 전송
    transmit_bits(frame)
```

수신 측에서는 정확히 반대 순서로 헤더를 벗겨낸다(디캡슐화). 각 계층은 자신의 헤더만 처리하고, 상위 계층 내용은 불투명 페이로드로 취급한다.

## PDU(Protocol Data Unit) 이름

각 계층에서 데이터 단위를 부르는 이름이 다르다.

| 계층 | PDU 이름 | 비고 |
|------|----------|------|
| 7~5 | Data / Message | 응용 데이터 |
| 4 | Segment (TCP) / Datagram (UDP) | 포트 정보 포함 |
| 3 | Packet | IP 주소 포함 |
| 2 | Frame | MAC 주소 포함 |
| 1 | Bit | 0/1 신호 |

## OSI vs TCP/IP 모델

실제 인터넷은 TCP/IP 4계층 모델을 사용한다.

```
OSI 7계층          TCP/IP 4계층
─────────────────  ────────────────
7. Application     Application (5+6+7 통합)
6. Presentation
5. Session
─────────────────  ────────────────
4. Transport       Transport
─────────────────  ────────────────
3. Network         Internet
─────────────────  ────────────────
2. Data Link       Network Access (1+2 통합)
1. Physical
```

TCP/IP는 OSI보다 단순하고 실용적이다. 다음 글에서 TCP/IP 모델을 자세히 다룬다.

## 트러블슈팅에서의 OSI 모델

OSI 7계층 모델의 실제 가치는 **네트워크 장애 원인을 계층별로 격리**하는 데 있다.

```
1계층 문제: 케이블 불량, 링크 다운 → ip link show
2계층 문제: ARP 실패, MAC 충돌 → arp -n
3계층 문제: 라우팅 오류, IP 충돌 → ping, traceroute
4계층 문제: 포트 차단, TCP 연결 실패 → telnet, nc
7계층 문제: HTTP 오류, 인증 실패 → curl -v
```

"ping은 되는데 HTTP가 안 된다"면 3계층까지는 정상이므로 4~7계층 문제다. 이렇게 계층을 좁혀가며 원인을 찾는다.

---

**지난 글:** [네트워크란 무엇인가](/posts/network-what-is-network/)

**다음 글:** [TCP/IP 4계층 모델](/posts/network-tcp-ip-model/)

<br>
읽어주셔서 감사합니다. 😊
