---
title: "이더넷: LAN의 표준 프로토콜"
description: "이더넷의 역사, 프레임 구조, EtherType, CSMA/CD, 전이중 통신, 표준 속도별 케이블 규격을 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["이더넷", "Ethernet", "프레임", "CSMA/CD", "IEEE802.3", "LAN", "케이블"]
featured: false
draft: false
---

[지난 글](/posts/network-mac-address/)에서 MAC 주소의 구조와 역할을 살펴봤다. MAC 주소가 쓰이는 프로토콜이 바로 **이더넷(Ethernet)**이다. 1970년대 제록스에서 시작해 오늘날 전 세계 LAN의 사실상 표준이 된 이더넷을 깊이 이해한다.

## 이더넷의 역사

1973년 로버트 멧칼프(Robert Metcalfe)가 제록스 PARC에서 최초 이더넷을 개발했다. 이후 DEC, Intel, Xerox(DIX)가 공동으로 이더넷 II 표준을 발표했고, 1983년 IEEE가 802.3으로 표준화했다. 현재는 10Mbps에서 400Gbps, 800Gbps까지 속도가 확장됐지만 프레임 구조는 수십 년 전과 본질적으로 동일하다.

## 이더넷 II 프레임 구조

![이더넷 프레임 구조](/assets/posts/network-ethernet-frame.svg)

각 필드의 역할:

- **Preamble (7byte)**: `10101010` 패턴의 반복. NIC가 클록을 동기화하는 데 사용.
- **SFD (1byte, Start Frame Delimiter)**: `10101011`. 프레임 시작 경계를 알림.
- **Dst/Src MAC (6byte 각각)**: 목적지/출발지 MAC 주소.
- **EtherType (2byte)**: 페이로드의 상위 프로토콜을 알림. `0x0800`=IPv4, `0x86DD`=IPv6, `0x0806`=ARP.
- **Payload (46~1500byte)**: 실제 데이터 (대부분 IP 패킷).
- **FCS (4byte)**: CRC-32로 프레임 오류 감지.

```text
최소 프레임: 64byte (헤더 18byte + 패딩 포함 최소 46byte 페이로드)
최대 프레임: 1518byte (페이로드 최대 1500byte, jumbo frame 제외)
MTU: 1500 byte (Maximum Transmission Unit)
```

## CSMA/CD: 충돌 처리

초기 이더넷은 여러 장치가 하나의 동축 케이블(버스)을 공유했다. 이때 필요한 충돌 처리 메커니즘이 **CSMA/CD**다.

![CSMA/CD 알고리즘](/assets/posts/network-ethernet-csma-cd.svg)

```bash
# 충돌 통계 확인 (레거시 환경)
ethtool -S eth0 | grep collision
# collisions: 0  ← 스위치 환경에서는 항상 0
```

현대 스위치 환경에서 각 포트는 **전이중(Full-Duplex)**으로 동작한다. 송신과 수신이 독립적인 쌍(페어)을 사용하므로 충돌이 발생하지 않는다. CSMA/CD는 사실상 역사 속으로 사라졌다.

## 자동 협상 (Auto-Negotiation)

이더넷 포트는 연결 상대와 속도 및 이중(Duplex) 모드를 자동으로 협상한다.

```bash
# 현재 링크 속도 및 이중 모드 확인
ethtool eth0 | grep -E "Speed|Duplex"
# Speed: 1000Mb/s
# Duplex: Full

# 수동 설정 (권장하지 않음)
ethtool -s eth0 speed 1000 duplex full autoneg off
```

자동 협상이 실패하면 한쪽은 1000Mbps Full-Duplex, 다른 쪽은 Half-Duplex로 연결되는 **Duplex Mismatch**가 발생한다. 이 경우 대역폭은 극히 낮아진다.

## 케이블 표준

| 표준 | 속도 | 케이블 | 최대 거리 |
|------|------|--------|-----------|
| 10BASE-T | 10 Mbps | CAT3 | 100m |
| 100BASE-TX | 100 Mbps | CAT5 | 100m |
| 1000BASE-T | 1 Gbps | CAT5e/CAT6 | 100m |
| 10GBASE-T | 10 Gbps | CAT6a | 100m |
| 10GBASE-SR | 10 Gbps | 광섬유 (MMF) | 300m |
| 100GBASE-LR4 | 100 Gbps | 광섬유 (SMF) | 10km |

데이터센터에서는 DAC(Direct Attach Copper) 케이블로 25G/100G 연결을 짧은 거리에서 저비용으로 구성한다.

## 점보 프레임 (Jumbo Frame)

표준 MTU 1500byte를 초과하는 프레임이다. 일반적으로 9000byte를 사용한다.

```bash
# 점보 프레임 설정
ip link set eth0 mtu 9000

# 현재 MTU 확인
ip link show eth0 | grep mtu
```

같은 경로의 모든 장비(NIC, 스위치, 라우터)가 동일한 MTU를 지원해야 한다. 불일치하면 패킷 단편화 또는 드롭이 발생한다. 스토리지 네트워크(iSCSI, NFS)에서 처리량 향상을 위해 활용한다.

---

**지난 글:** [MAC 주소: 이더넷의 물리적 식별자](/posts/network-mac-address/)

<br>
읽어주셔서 감사합니다. 😊
