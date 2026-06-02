---
title: "MSS, MTU, PMTUD: 세그먼트 크기 결정의 모든 것"
description: "MTU와 MSS의 정확한 관계, IP 단편화, DF 플래그, PMTUD 동작 원리, PMTUD Black Hole과 MSS Clamping을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["MTU", "MSS", "PMTUD", "IP단편화", "DF플래그", "MSS Clamping", "JumboFrame"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-sliding-window/)에서 슬라이딩 윈도우와 파이프라인 전송의 원리를 살펴봤다. TCP 세그먼트 크기를 결정하는 또 다른 핵심 요소가 있다. **MTU**와 **MSS**다. 이 두 개념을 정확히 이해하지 못하면 "왜 패킷이 안 가지?" 같은 난감한 장애를 만났을 때 원인조차 파악하기 어렵다.

## MTU: 한 번에 보낼 수 있는 최대 크기

**MTU(Maximum Transmission Unit)**는 네트워크 인터페이스가 하나의 프레임에 담을 수 있는 최대 IP 패킷 크기다. 이더넷의 기본값은 1500 bytes다. 이는 이더넷 표준에서 정의된 값이며, 라우터나 스위치를 거칠 때 각 인터페이스 MTU가 다를 수 있다.

```bash
# 인터페이스 MTU 확인
ip link show eth0
# eth0: mtu 1500

# MTU 변경 (일시적)
ip link set eth0 mtu 9000  # Jumbo Frame

# ping으로 특정 크기 테스트 (DF 플래그 포함)
ping -M do -s 1472 8.8.8.8
# -M do: DF(Don't Fragment) 플래그 설정
# -s 1472: 데이터 크기 (1472 + 8 ICMP헤더 + 20 IP헤더 = 1500)
```

## MSS: TCP 페이로드 최대 크기

**MSS(Maximum Segment Size)**는 TCP가 한 세그먼트에 담을 수 있는 **데이터(페이로드) 최대 크기**다. 헤더는 포함하지 않는다.

![MTU/MSS 계층 관계](/assets/posts/network-mss-mtu-pmtud-layers.svg)

MSS는 3-way 핸드셰이크의 SYN 세그먼트에서 TCP 옵션으로 협상한다. 각 측이 자신의 MSS를 알리고, 양방향에서 각각 상대방의 MSS를 사용한다.

```text
SYN: MSS=1460  (나는 최대 1460 bytes 받을 수 있음)
SYN+ACK: MSS=1460 (나도 마찬가지)

※ MSS는 수신 MSS를 상대방에게 알리는 것
  → "네가 나에게 보낼 때 최대 이 크기로 보내라"
```

## IP 단편화와 DF 플래그

IP 패킷이 MTU보다 크면 라우터는 이를 쪼개서 전달할 수 있다(**IP 단편화**). 단편화된 패킷은 수신 측에서 다시 조립한다. 하지만 단편화는 오버헤드가 크고 한 단편만 유실돼도 전체를 재전송해야 한다.

**DF(Don't Fragment)** 플래그를 설정하면 라우터가 단편화 대신 ICMP Type 3 Code 4 "Fragmentation Needed" 메시지를 반송한다. TCP는 기본적으로 DF 플래그를 설정해 IP 단편화를 피한다.

## PMTUD: 경로 MTU 자동 탐색

경로 상의 링크 MTU가 각기 다를 때, 송신자는 어떻게 최적 크기를 알 수 있을까? **PMTUD(Path MTU Discovery)**가 이를 해결한다.

![PMTUD 동작 흐름](/assets/posts/network-mss-mtu-pmtud-flow.svg)

1. 송신자는 DF=1로 큰 패킷 전송
2. 병목 라우터에서 ICMP "Fragmentation Needed"(Next-Hop MTU 포함) 수신
3. 송신자가 MSS를 줄여 재전송
4. 이를 반복해 최소 MTU를 발견

## PMTUD Black Hole

방화벽이 ICMP를 전부 차단하면 PMTUD ICMP 메시지가 도달하지 않는다. 송신자는 왜 패킷이 유실되는지 모른 채 재전송만 반복한다. 이를 **PMTUD Black Hole**이라 한다.

```bash
# 해결책 1: MSS Clamping (iptables)
iptables -t mangle -A FORWARD \
  -p tcp --tcp-flags SYN,RST SYN \
  -j TCPMSS --clamp-mss-to-pmtu
# SYN 통과 시 MSS 옵션을 경로 MTU에 맞게 자동 축소

# 해결책 2: 명시적 MSS 설정 (Nginx)
# nginx.conf
# proxy_buffer_size: 버퍼 조정

# 해결책 3: ICMP 최소한 허용
# Type 3 (Destination Unreachable) + Code 4 는 반드시 허용
iptables -A INPUT -p icmp --icmp-type 3/4 -j ACCEPT
```

## Jumbo Frame

데이터센터 이더넷에서는 **Jumbo Frame**(MTU 9000)을 사용해 오버헤드 비율을 줄인다. 1500 bytes MTU 대비 헤더 비율이 낮아져 처리량이 증가한다. 단, 경로상의 모든 장비가 동일한 MTU를 지원해야 한다.

```text
MTU 비교
─────────────────────────────────────────
MTU 1500: 헤더 40B / 1500B = 2.7%
MTU 9000: 헤더 40B / 9000B = 0.4%
→ 단순 계산으로도 처리량 약 2.3% 향상
실제로는 인터럽트·CPU 오버헤드 감소가 더 큰 효과
```

---

**지난 글:** [TCP 슬라이딩 윈도우: 파이프라인 전송의 원리](/posts/network-tcp-sliding-window/)

**다음 글:** [TCP 혼잡 제어: AIMD, Slow Start, CUBIC의 원리](/posts/network-tcp-congestion-control/)

<br>
읽어주셔서 감사합니다. 😊
