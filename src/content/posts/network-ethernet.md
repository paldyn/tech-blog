---
title: "이더넷 완전 이해"
description: "세계 LAN 표준 이더넷의 프레임 구조, CSMA/CD, MTU, 10Mbps부터 400Gbps까지의 발전 과정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["이더넷", "Ethernet", "프레임", "CSMA/CD", "MTU"]
featured: false
draft: false
---

[지난 글](/posts/network-mac-address/)에서 네트워크 장치를 고유하게 식별하는 MAC 주소를 살펴봤습니다. 이제 그 MAC 주소를 실제로 사용해 데이터를 전달하는 기술인 **이더넷(Ethernet)** 을 살펴봅니다. 이더넷은 오늘날 유선 LAN의 사실상 표준으로, 전 세계 기업·가정 네트워크의 토대입니다.

## 이더넷이란

이더넷은 1973년 제록스 팔로알토 연구소(PARC)에서 로버트 멧칼프가 발명하고, 이후 DEC·Intel·Xerox(DIX)가 공동으로 표준화한 **유선 LAN 기술**입니다. IEEE 802.3으로 정식 표준화됐으며, 데이터링크 계층(OSI 2계층)에서 동작합니다.

## 이더넷 프레임 구조

이더넷이 데이터를 전달하는 단위는 **프레임(Frame)** 입니다.

![이더넷 프레임 구조](/assets/posts/network-ethernet-frame.svg)

```text
[프리앰블 8B][목적지MAC 6B][출발지MAC 6B][EtherType 2B][페이로드 46~1500B][FCS 4B]
```

각 필드의 역할:

- **프리앰블(Preamble)**: `10101010...` 패턴으로 수신 NIC의 클럭 동기화
- **목적지/출발지 MAC**: 각 6바이트, 프레임 전달 경로 결정
- **EtherType**: 상위 프로토콜 구분 (`0x0800=IPv4`, `0x0806=ARP`, `0x86DD=IPv6`)
- **페이로드**: 실제 데이터 (IP 패킷 등), 46~1500바이트
- **FCS**: CRC-32 체크섬으로 오류 감지

### MTU (Maximum Transmission Unit)

이더넷 표준 MTU는 **1500바이트**입니다. IP 패킷이 이보다 크면 **단편화(Fragmentation)** 가 발생합니다.

```bash
# Linux에서 MTU 확인/변경
ip link show eth0
# eth0: mtu 1500

sudo ip link set dev eth0 mtu 9000  # Jumbo Frame
```

데이터센터 내부 통신에는 Jumbo Frame(최대 9000바이트)을 사용해 단편화 오버헤드를 줄이기도 합니다.

## CSMA/CD — 충돌 감지 방식

과거 공유 이더넷(버스형, 허브)에서는 여러 장치가 **같은 케이블을 공유**했습니다. 동시에 전송하면 신호가 충돌하므로 **CSMA/CD** 방식으로 이를 처리했습니다.

```text
CSMA/CD 동작:
1. 회선 감지(Carrier Sense): 케이블이 사용 중인지 확인
2. 비어 있으면 전송 시작
3. 충돌 감지(Collision Detection): 전송 중 충돌 신호 감지
4. 충돌 발생 시 Jam 신호 전송 후 랜덤 시간 대기(Backoff)
5. 재전송 시도
```

현대 스위치 기반 이더넷은 **풀 듀플렉스(Full-Duplex)** 로 동작해 충돌이 원천적으로 불가능합니다. CSMA/CD는 레거시 환경에서만 의미가 있습니다.

## 이더넷 표준 발전사

![이더넷 발전사](/assets/posts/network-ethernet-evolution.svg)

| 표준 | 속도 | 매체 | 비고 |
|------|------|------|------|
| 10BASE-T | 10Mbps | UTP Cat3 | 최초 UTP 이더넷 (1990) |
| 100BASE-TX | 100Mbps | Cat5 | Fast Ethernet (1995) |
| 1000BASE-T | 1Gbps | Cat5e | Gigabit Ethernet (1999) |
| 10GBASE-T | 10Gbps | Cat6a | 10G Ethernet (2002) |
| 100GBASE-SR4 | 100Gbps | 광섬유 | 데이터센터용 |
| 400GBASE-DR4 | 400Gbps | 광섬유 | 최신 고성능 |

## 이더넷 케이블 카테고리

```text
Cat5   — 100Mbps, 최대 100m
Cat5e  — 1Gbps, 최대 100m (가정용 표준)
Cat6   — 1Gbps (10G는 55m 제한)
Cat6a  — 10Gbps, 최대 100m (기업용)
Cat7   — 10Gbps, 고차폐
Cat8   — 25/40Gbps, 최대 30m (데이터센터 TOR)
```

## 반이중 vs 전이중

| 구분 | 반이중(Half-Duplex) | 전이중(Full-Duplex) |
|------|---------------------|---------------------|
| 방향 | 한 번에 한 방향만 가능 | 동시 양방향 가능 |
| 충돌 | 발생 가능 → CSMA/CD 필요 | 충돌 없음 |
| 환경 | 허브, 레거시 | 스위치 (현대 표준) |

오늘날 대부분의 NIC와 스위치는 자동 협상(Auto-Negotiation)으로 속도와 이중화 모드를 자동으로 설정합니다. 다음 글에서는 이더넷 통신에서 IP 주소를 MAC 주소로 변환하는 **ARP** 프로토콜을 다룹니다.

---

**지난 글:** [MAC 주소란 무엇인가](/posts/network-mac-address/)

**다음 글:** [ARP 완전 이해](/posts/network-arp/)

<br>
읽어주셔서 감사합니다. 😊
