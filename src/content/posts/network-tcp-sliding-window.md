---
title: "TCP 슬라이딩 윈도우: 파이프라인 전송의 원리"
description: "TCP 슬라이딩 윈도우가 Stop-and-Wait 대비 처리량을 높이는 원리, 송신 윈도우 구조, Bandwidth-Delay Product, Go-Back-N vs Selective Repeat을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["TCP", "슬라이딩윈도우", "파이프라인", "BDP", "GoBackN", "SelectiveRepeat", "처리량"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-flow-control/)에서 수신 윈도우(rwnd)와 흐름 제어의 원리를 살펴봤다. 이번에는 TCP가 **높은 처리량**을 달성하는 핵심 기법인 **슬라이딩 윈도우**를 깊이 파헤친다.

## Stop-and-Wait의 한계

가장 단순한 방식은 **Stop-and-Wait**이다. 세그먼트를 하나 보내고 ACK을 받을 때까지 기다린다. 이 방식은 RTT 동안 링크를 놀린다.

```text
Stop-and-Wait 처리량 계산
─────────────────────────────────────────────
링크 속도: 1 Mbps, 세그먼트 크기: 1KB = 8000 bits
전송 시간: 8000 / 1,000,000 = 8ms
RTT: 100ms

한 세그먼트 사이클 = 8ms(전송) + 100ms(RTT) = 108ms
처리량 = 8000 bits / 108ms ≈ 74 Kbps
링크 활용률 = 74 / 1000 ≈ 7.4% ← 매우 낮음
```

## 슬라이딩 윈도우: 파이프를 가득 채우기

슬라이딩 윈도우는 ACK 없이도 윈도우 크기만큼 연속으로 전송한다. ACK이 돌아오면 윈도우가 앞으로 "슬라이드"해서 새 세그먼트를 보낼 수 있게 된다.

![슬라이딩 윈도우 파이프라인](/assets/posts/network-tcp-sliding-window-pipeline.svg)

```text
슬라이딩 윈도우 처리량 계산 (이전 예시)
─────────────────────────────────────────────
윈도우 크기 = 10 × 1KB = 10KB = 80,000 bits
전송 시간(10개) = 80,000 / 1,000,000 = 80ms
RTT: 100ms

80ms < 100ms이므로 아직 ACK 전에 10개 모두 전송 완료
처리량 = 80,000 bits / 100ms = 800 Kbps
링크 활용률 = 80% ← 10배 이상 향상
```

## Bandwidth-Delay Product: 파이프 용량

링크를 100% 활용하려면 **Bandwidth-Delay Product(BDP)** 이상의 윈도우가 필요하다.

![Bandwidth-Delay Product](/assets/posts/network-tcp-sliding-window-bwdelay.svg)

고속 장거리 링크(예: 서울-뉴욕 100ms RTT, 10Gbps)에서 기본 65KB 윈도우는 터무니없이 작다. Window Scale 옵션과 충분한 버퍼 설정이 필수다.

## 송신 윈도우의 4가지 구역

TCP 송신 측은 바이트 스트림을 4개 구역으로 관리한다.

```text
         SND.UNA        SND.NXT      SND.UNA+SND.WND
           │               │                │
───────────┼───────────────┼────────────────┼──────────
 전송+ACK  │  전송됨       │  전송 가능     │  윈도우 밖
           │  (ACK 대기)   │  (아직 미전송) │
           └───────────────┴────────────────┘
                    송신 윈도우 = min(rwnd, cwnd)

SND.UNA: 가장 오래된 미확인 seq
SND.NXT: 다음에 보낼 seq
SND.WND: 수신자 광고 윈도우
```

## Go-Back-N vs Selective Repeat

오류 발생 시 재전송 범위가 다르다.

```text
Go-Back-N
  유실된 세그먼트부터 윈도우 끝까지 모두 재전송
  수신자 버퍼 불필요, 구현 간단
  → 손실 빈번한 환경에서 낭비 심함

Selective Repeat (= SACK)
  유실된 세그먼트만 선택적 재전송
  수신자가 Out-of-Order 데이터를 버퍼에 보관
  → 효율적, TCP SACK 옵션이 이 방식

TCP는 기본적으로 Cumulative ACK을 쓰지만
SACK 옵션 활성화 시 Selective Repeat에 가까워짐
```

## 처리량과 손실률의 관계

네트워크 손실이 있으면 TCP 처리량이 급감한다. Mathis 공식으로 근사 계산할 수 있다.

```python
import math

def tcp_throughput(mss_bytes, rtt_sec, loss_rate):
    """
    Mathis 공식: BW ≈ (MSS / RTT) × (1 / sqrt(loss_rate))
    """
    return (mss_bytes / rtt_sec) * (1 / math.sqrt(loss_rate))

# 예시: MSS=1460 bytes, RTT=50ms, 손실률 0.1%
throughput = tcp_throughput(1460, 0.05, 0.001)
print(f"처리량: {throughput/1_000_000:.2f} Mbps")
# 처리량: 18.47 Mbps (1Gbps 링크에서 1.8%만 활용)
# → 손실 제어가 TCP 성능의 핵심
```

---

**지난 글:** [TCP 흐름 제어: 수신 윈도우와 슬라이딩 윈도우](/posts/network-tcp-flow-control/)

**다음 글:** [MSS, MTU, PMTUD: 세그먼트 크기 결정의 모든 것](/posts/network-mss-mtu-pmtud/)

<br>
읽어주셔서 감사합니다. 😊
