---
title: "OSI 7계층 모델 완전 해설: 역할과 캡슐화 흐름"
description: "OSI 7계층의 각 레이어가 무엇을 하는지, PDU 명칭은 무엇인지, 캡슐화/역캡슐화가 어떻게 동작하는지 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["OSI7계층", "캡슐화", "PDU", "TCP/IP", "네트워크계층", "프로토콜"]
featured: false
draft: false
---

[지난 글](/posts/network-what-is-network/)에서 네트워크의 기본 개념을 살펴봤다. 장치들이 통신하려면 공통된 규칙이 필요한데, 그 규칙을 체계적으로 정리한 것이 **OSI 7계층 모델**이다. 1984년 ISO가 제정한 이 참조 모델은 복잡한 네트워크 통신을 7개의 독립적인 계층으로 나눠 설명한다.

## OSI 모델이 필요한 이유

다양한 제조사의 장비, 운영체제, 애플리케이션이 서로 통신하려면 표준이 필요하다. OSI 모델은 각 계층이 **어떤 역할을 담당하는지** 명확히 정의해 표준화의 기준을 제공한다. 실제 구현에는 TCP/IP 모델이 쓰이지만, 네트워크 문제를 진단하거나 프로토콜을 이해할 때 OSI 7계층은 필수 언어다.

![OSI 7계층 모델](/assets/posts/network-osi-7-layers-model.svg)

## 각 계층의 역할

### 1계층: 물리 계층 (Physical Layer)

전기 신호, 광 신호, 전파로 **비트(Bit)**를 전송한다. 케이블의 핀 배열, 전압 레벨, 전송 속도 등 물리적 특성을 정의한다. 이 계층에서 오류 감지는 없다. 대표 장비: 케이블, 허브, NIC, 중계기.

### 2계층: 데이터링크 계층 (Data Link Layer)

같은 네트워크(LAN) 내 장치 간 **프레임(Frame)** 전달을 담당한다. MAC 주소로 발신지/목적지를 식별하고, FCS(Frame Check Sequence)로 비트 오류를 감지한다. 이더넷, Wi-Fi(802.11)가 이 계층이다. 대표 장비: 스위치, 브리지.

### 3계층: 네트워크 계층 (Network Layer)

서로 다른 네트워크 간 **패킷(Packet)** 라우팅을 담당한다. IP 주소로 논리적 주소 체계를 제공하고, 라우터가 최적 경로를 선택한다. 대표 프로토콜: IP, ICMP, OSPF, BGP.

### 4계층: 전송 계층 (Transport Layer)

**종단 간(End-to-End)** 데이터 전송을 책임진다. 포트 번호로 애플리케이션을 구분하고, TCP는 신뢰성·순서 보장, UDP는 빠른 전송을 제공한다. PDU 명칭: **세그먼트(Segment)**.

### 5~7계층: 세션·표현·응용 계층

실제 구현에서는 TCP/IP 모델에서 하나의 "애플리케이션 계층"으로 통합된다.

- **5계층(Session)**: 통신 세션 수립·유지·종료. RPC, SQL 세션.
- **6계층(Presentation)**: 데이터 형식 변환, 암호화/복호화, 압축. TLS가 여기에 속한다.
- **7계층(Application)**: 사용자와 가장 가까운 서비스. HTTP, DNS, FTP, SMTP.

## 캡슐화와 역캡슐화

OSI 모델의 핵심 메커니즘은 **캡슐화(Encapsulation)**다.

![캡슐화 과정](/assets/posts/network-osi-7-layers-encapsulation.svg)

송신 측 애플리케이션이 데이터를 만들면, 각 계층을 내려가며 헤더(또는 트레일러)를 추가한다.

```text
Application  Data
Transport    [TCP Header] + Data               → Segment
Network      [IP Header] + TCP Header + Data   → Packet
Data Link    [ETH Header] + Packet + [FCS]     → Frame
Physical     비트 스트림으로 변환 후 전송
```

수신 측은 물리 계층부터 역순으로 헤더를 제거하며 최종 데이터를 복원한다. 이를 **역캡슐화(Decapsulation)**라 한다.

## PDU(Protocol Data Unit) 정리

각 계층의 데이터 단위에는 고유한 이름이 있다.

| 계층 | PDU 이름 | 비고 |
|------|----------|------|
| 7~5 (Application) | 데이터(Data) | 메시지라고도 함 |
| 4 (Transport) | 세그먼트(Segment) | TCP / 데이터그램(UDP) |
| 3 (Network) | 패킷(Packet) | IP 패킷 |
| 2 (Data Link) | 프레임(Frame) | Ethernet 프레임 |
| 1 (Physical) | 비트(Bit) | 전기·광 신호 |

## 계층 분리의 이점

```text
상위 계층은 하위 계층의 구현을 몰라도 된다.
HTTP는 TCP가 어떤 링크(이더넷인지 Wi-Fi인지)를 쓰는지 신경 쓰지 않는다.
TCP는 IP가 어떤 경로로 라우팅하는지 신경 쓰지 않는다.
```

이 **계층 독립성** 덕분에 Wi-Fi를 이더넷으로 교체해도 HTTP 코드를 수정할 필요가 없다. 각 계층은 자신의 인터페이스(API)만 지키면 된다.

## OSI vs TCP/IP

OSI는 이론적 참조 모델이고, 실제 인터넷은 4계층 TCP/IP 모델로 동작한다. OSI 5~7계층이 TCP/IP의 Application Layer에 해당하고, 나머지는 1:1 매핑된다. 이 시리즈에서는 다음 글에서 TCP/IP 모델을 직접 다룬다.

---

**지난 글:** [네트워크란 무엇인가](/posts/network-what-is-network/)

**다음 글:** [TCP/IP 4계층 모델: 인터넷이 실제로 동작하는 방식](/posts/network-tcp-ip-model/)

<br>
읽어주셔서 감사합니다. 😊
