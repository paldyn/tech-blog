---
title: "이더넷 완전 정복: 프레임 구조와 CSMA/CD"
description: "이더넷 II 프레임 구조(프리앰블·MAC·EtherType·FCS), CSMA/CD 충돌 감지 알고리즘, 지수 백오프, 속도별 이더넷 표준까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["이더넷", "Ethernet", "CSMACD", "프레임구조", "MTU", "FCS", "IEEE802.3"]
featured: false
draft: false
---

[지난 글](/posts/network-mac-address/)에서 MAC 주소의 구조와 역할을 살펴봤다. MAC 주소가 이더넷 프레임의 핵심 필드 중 하나라면, 이번 글에서는 이더넷 프레임 전체 구조와 이더넷이 공유 매체에서 충돌을 어떻게 처리하는지, 즉 **CSMA/CD(Carrier Sense Multiple Access with Collision Detection)** 알고리즘을 완전히 해부한다.

## 이더넷 역사: 제록스 PARC에서 IEEE 표준까지

이더넷은 1973년 Bob Metcalfe가 제록스 PARC에서 발명한 LAN 기술이다. 1980년 DEC, Intel, Xerox가 최초 버전을 발표하고, 1983년 IEEE 802.3으로 표준화됐다. 현재 버전인 **이더넷 II(DIX)** 프레임 형식이 가장 널리 사용된다.

## 이더넷 II 프레임 구조

![이더넷 프레임 구조](/assets/posts/network-ethernet-frame.svg)

```text
┌──────────┬─────┬──────────┬──────────┬──────────┬──────────────┬──────────┐
│ 프리앰블  │ SFD │ Dest MAC │  Src MAC │EtherType │   페이로드    │   FCS    │
│  7 bytes │ 1B  │  6 bytes │  6 bytes │  2 bytes │  46-1500 B   │  4 bytes │
└──────────┴─────┴──────────┴──────────┴──────────┴──────────────┴──────────┘
```

**프리앰블(Preamble)**: 7바이트의 `10101010` 패턴. 수신 측 클록 동기화를 위한 신호다.

**SFD(Start Frame Delimiter)**: 1바이트 `10101011`. 프리앰블 끝과 실제 프레임 시작을 알리는 구분자다.

**목적지/출발지 MAC**: 각 6바이트. 앞의 글에서 상세히 다뤘다.

**EtherType**: 2바이트. 페이로드에 담긴 상위 계층 프로토콜을 식별한다. 0x0800=IPv4, 0x86DD=IPv6, 0x0806=ARP.

**페이로드**: 46~1500바이트. 최소 46바이트 미만이면 패딩(Padding)을 추가한다. 최대 1500바이트가 이더넷 MTU다.

**FCS(Frame Check Sequence)**: 4바이트 CRC-32. 프레임 전송 중 발생한 오류를 검출한다. 수신 측이 불일치를 검출하면 프레임을 폐기한다.

## MTU (Maximum Transmission Unit)

이더넷의 기본 MTU는 **1500 bytes**다. IP 패킷이 이 크기를 초과하면 **분할(Fragmentation)**이 발생한다. MTU Discovery와 단편화는 이후 IP 분할 글에서 상세히 다룬다.

```bash
# 인터페이스별 MTU 확인
ip link show
# ... mtu 1500 ...

# MTU 변경 (점보 프레임: 9000 bytes, 서버-서버 고속 연결)
ip link set eth0 mtu 9000
```

## CSMA/CD: 공유 매체에서의 충돌 감지

초기 이더넷은 **반이중(Half-Duplex)** 방식으로, 한 링크를 여러 장치가 공유했다. 동시에 전송하면 신호가 충돌해 데이터가 손상되므로 CSMA/CD 알고리즘이 필요했다.

![CSMA/CD 동작 흐름](/assets/posts/network-ethernet-csmacd.svg)

```text
CSMA/CD 알고리즘:
1. CS (Carrier Sense): 채널이 사용 중인지 감지
   - 사용 중 → 사용 완료까지 대기
   - 비어있음 → 전송 시작

2. MA (Multiple Access): 비어있으면 즉시 전송

3. CD (Collision Detection): 전송 중 충돌 감지
   - 충돌 감지 → JAM 신호(48비트) 전송으로 충돌 알림
   - 충돌 없음 → 전송 완료

4. Exponential Backoff (지수 백오프):
   재시도 횟수 k에서 [0, 2^k - 1] 중 무작위 슬롯 대기
   k=1: [0, 1] * 51.2μs
   k=2: [0, 3] * 51.2μs
   ...
   k=10: [0, 1023] * 51.2μs (최대)
   16회 실패 → 프레임 폐기, 상위 계층에 오류 보고
```

```python
import random
import time

def ethernet_backoff(attempt: int, slot_time_us: float = 51.2) -> float:
    """이더넷 지수 백오프 대기 시간 계산 (μs)"""
    k = min(attempt, 10)  # 최대 2^10 = 1024
    max_slots = (2 ** k) - 1
    slots = random.randint(0, max_slots)
    wait_us = slots * slot_time_us
    return wait_us

for attempt in range(1, 6):
    wait = ethernet_backoff(attempt)
    print(f"재시도 {attempt}회: {wait:.1f} μs 대기")
```

## 현대 이더넷: 전이중과 스위치

현대 이더넷은 스위치와 **전이중(Full-Duplex)** 모드를 사용하므로 CSMA/CD가 필요 없다. 각 포트가 점대점(Point-to-Point) 전용 링크로 연결되어 충돌이 발생하지 않기 때문이다.

```text
속도별 이더넷 표준:
10BASE-T    : 10 Mbps    (Cat3 UTP)   1990년대
100BASE-TX  : 100 Mbps   (Cat5 UTP)   Fast Ethernet
1000BASE-T  : 1 Gbps     (Cat5e UTP)  Gigabit Ethernet
10GBASE-T   : 10 Gbps    (Cat6a UTP)  10G Ethernet
100GBASE-SR : 100 Gbps   (멀티모드 광섬유)
400GBASE-DR4: 400 Gbps   (단일모드 광섬유) 데이터센터
```

이더넷이 이렇게 진화할 수 있었던 배경에는 하위 호환성이 있다. 케이블 규격만 업그레이드하면 기존 소프트웨어와 프로토콜을 그대로 사용할 수 있다는 점이 이더넷이 수십 년간 지배적인 LAN 기술로 남아있는 핵심 이유다.

---

**지난 글:** [MAC 주소 완전 정복](/posts/network-mac-address/)

<br>
읽어주셔서 감사합니다. 😊
