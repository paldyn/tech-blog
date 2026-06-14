---
title: "TCP/IP 모델 완전 이해"
description: "실제 인터넷을 움직이는 TCP/IP 4계층 모델의 각 계층 역할, OSI와의 대응, HTTP 요청 시 계층 흐름을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["TCP/IP", "4계층", "인터넷", "프로토콜", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-osi-7-layers/)에서 OSI 7계층이 네트워크 통신을 어떻게 추상화하는지 살펴봤습니다. 이번에는 **실제 인터넷이 동작하는 방식인 TCP/IP 모델**을 다룹니다. OSI가 이론적 참조 모델이라면, TCP/IP는 1970년대에 실용 목적으로 먼저 설계된 뒤 인터넷의 표준이 된 모델입니다.

## TCP/IP 모델의 탄생 배경

1969년 미국 국방부의 ARPANET 프로젝트에서 탄생한 TCP/IP는 **분산된 네트워크에서도 신뢰성 있게 통신**할 수 있도록 설계됐습니다. 핵심 철학은 "네트워크 자체는 단순하게, 복잡성은 종단(End) 장치에"입니다. 이 원칙 덕분에 인터넷은 수십억 개의 이질적인 장치를 하나로 연결할 수 있었습니다.

## 4개 계층 구조

TCP/IP는 OSI 7계층을 4개의 실용적인 계층으로 단순화합니다.

![TCP/IP 4계층 모델과 OSI 대응](/assets/posts/network-tcp-ip-model-layers.svg)

### 1. 네트워크 접근 계층 (Network Access Layer)

OSI의 물리·데이터링크 계층을 합친 개념입니다. 실제로 데이터를 전선/광섬유/전파로 전달하는 하드웨어 수준의 작업을 담당합니다.

```text
역할: 프레임 송수신, MAC 주소 기반 로컬 전달
대표: 이더넷(Ethernet), Wi-Fi(802.11), PPP
장비: 스위치, NIC(네트워크 인터페이스 카드)
```

### 2. 인터넷 계층 (Internet Layer)

OSI 3계층에 해당합니다. **IP 주소를 사용해 패킷을 목적지까지 라우팅**하는 것이 핵심 역할입니다. 경로 선택은 라우터가 담당합니다.

```text
역할: 논리 주소(IP) 부여, 라우팅, 단편화
대표: IPv4, IPv6, ICMP, ARP
장비: 라우터
```

### 3. 전송 계층 (Transport Layer)

OSI 4계층과 동일합니다. 포트 번호를 사용해 어떤 애플리케이션이 데이터를 받을지 결정합니다.

| 프로토콜 | 특징 | 사용 예 |
|---------|------|---------|
| **TCP** | 연결 지향, 신뢰성, 순서 보장 | HTTP, HTTPS, FTP |
| **UDP** | 비연결, 빠름, 손실 허용 | DNS, 동영상 스트리밍 |

### 4. 응용 계층 (Application Layer)

OSI 5·6·7계층을 통합합니다. 사용자가 직접 상호작용하는 서비스 프로토콜이 모두 이 계층에 위치합니다.

```text
HTTP/HTTPS  — 웹 통신
FTP/SFTP    — 파일 전송
SMTP/IMAP   — 이메일
DNS         — 도메인 이름 해석
SSH         — 보안 원격 접속
```

## HTTP 요청 시 계층별 처리 흐름

브라우저에서 `https://example.com`을 입력하면 어떤 일이 일어날까요?

![HTTP 요청 시 TCP/IP 계층 흐름](/assets/posts/network-tcp-ip-model-flow.svg)

```text
[클라이언트]                         [서버]
응용 계층:  HTTP GET /index.html  →  HTTP 요청 수신
전송 계층:  TCP 세그먼트 생성     →  TCP 포트 443 확인
인터넷:     IP 패킷 생성(목적지IP) →  IP 검증
네트워크:   이더넷 프레임 생성    →  프레임 수신·디캡슐화
물리 매체:  ─────── 신호 전송 ──────────────
```

라우터는 **인터넷 계층(IP)까지만** 처리합니다. HTTP 헤더나 TCP 연결 상태는 전혀 관여하지 않고 오직 목적지 IP 주소를 보고 다음 홉(hop)을 결정합니다.

## 계층 간 데이터 전달: 소켓(Socket)

개발자 관점에서 TCP/IP를 사용하는 인터페이스는 **소켓(Socket)** 입니다.

```python
import socket

# TCP 소켓 생성 (AF_INET=IPv4, SOCK_STREAM=TCP)
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(("example.com", 80))     # 전송+인터넷 계층이 처리
sock.sendall(b"GET / HTTP/1.1\r\nHost: example.com\r\n\r\n")
response = sock.recv(4096)
sock.close()
```

소켓은 응용 계층과 전송 계층 사이의 API입니다. `AF_INET + SOCK_STREAM`을 지정하면 하위 TCP·IP·이더넷 처리는 운영체제 커널이 모두 대신합니다.

## 왜 TCP/IP가 표준이 됐나

OSI 모델이 1984년 정식 표준으로 발표됐지만, TCP/IP는 이미 1983년부터 ARPANET에서 실제로 동작하고 있었습니다. 구현체가 먼저 존재했고, 그것이 인터넷으로 성장하면서 사실상 표준(de facto standard)이 됐습니다. OSI는 이론적으로 더 정교하지만 "이미 있는 것이 동작한다"는 실용주의가 TCP/IP의 승리를 이끌었습니다.

다음 글에서는 네트워크 성능을 가늠하는 세 가지 척도인 **대역폭(Bandwidth), 처리량(Throughput), 지연(Latency)** 을 구체적으로 살펴봅니다.

---

**지난 글:** [OSI 7계층 완전 이해](/posts/network-osi-7-layers/)

**다음 글:** [대역폭, 처리량, 지연이란](/posts/network-bandwidth-throughput-latency/)

<br>
읽어주셔서 감사합니다. 😊
