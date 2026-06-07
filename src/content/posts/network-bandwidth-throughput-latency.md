---
title: "대역폭·처리량·지연 시간: 네트워크 성능 지표 완전 정복"
description: "대역폭(Bandwidth), 처리량(Throughput), 지연 시간(Latency)의 정확한 정의, 차이, 측정 방법, 그리고 실제 네트워크 성능 분석 방법을 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["대역폭", "처리량", "지연시간", "네트워크성능", "Bandwidth", "Throughput", "Latency"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-ip-model/)에서 TCP/IP 4계층이 실제 인터넷 통신의 뼈대임을 살펴봤다. 네트워크 구조를 이해했다면 다음 단계는 **성능 측정**이다. "인터넷이 느리다"는 말은 사실 매우 불정확하다. 대역폭이 부족한 건지, 실제 처리량이 낮은 건지, 아니면 지연이 높은 건지에 따라 원인과 해결 방법이 완전히 달라지기 때문이다.

## 세 지표의 수도관 비유

![대역폭, 처리량, 지연 시간 개념](/assets/posts/network-bandwidth-throughput-latency-concepts.svg)

**대역폭(Bandwidth)**은 수도관의 굵기다. 단위 시간 동안 이론적으로 전송 가능한 최대 데이터 양을 뜻하며, 회선 계약 스펙이 바로 대역폭이다. 단위는 bps(bits per second)이고, 현대 이더넷은 1 Gbps, 10 Gbps가 일반적이다.

**처리량(Throughput)**은 실제로 흐르는 물의 양이다. 동일한 파이프라도 불순물(패킷 손실), 압력 변동(혼잡), 밸브(방화벽 규칙)에 따라 실제 유량이 줄어든다. 처리량은 대역폭보다 항상 낮거나 같다.

**지연 시간(Latency)**은 물이 A에서 B까지 이동하는 데 걸리는 시간이다. 파이프가 아무리 굵어도 거리가 멀면 오래 걸린다.

```text
대역폭  : 1 Gbps  →  최대 1초에 1,000 Mb 전송 가능
처리량  : 942 Mbps →  실제 측정값 (94.2% 효율)
지연    : 14 ms   →  패킷이 목적지에 도달하는 왕복 시간의 절반
```

## 지연 시간의 4가지 구성 요소

지연 시간은 하나의 단순한 값이 아니라 4가지 구성 요소의 합이다.

**전파 지연(Propagation Delay)**: 신호가 물리 매체를 통해 이동하는 시간. 광섬유에서 빛의 속도는 진공보다 약 33% 느리므로, 서울-뉴욕 간 편도 전파 지연만 70ms가 넘는다.

**전송 지연(Transmission Delay)**: 패킷 전체를 링크에 올리는 시간. `패킷 크기(bit) ÷ 링크 대역폭(bps)`으로 계산한다. 1500 byte 패킷을 100 Mbps 링크에서 전송하면 `(1500×8) ÷ 100,000,000 = 0.12ms`.

**처리 지연(Processing Delay)**: 라우터·스위치가 헤더를 분석하고 출력 포트를 결정하는 시간. 일반적으로 마이크로초 수준이다.

**큐잉 지연(Queueing Delay)**: 출력 버퍼에서 대기하는 시간. 혼잡한 네트워크에서 가장 크게 변동하며 지터(Jitter)의 주 원인이다.

## 측정 방법

![성능 지표 측정 방법](/assets/posts/network-bandwidth-throughput-latency-comparison.svg)

```bash
# 처리량 측정: iperf3
# 서버 쪽
iperf3 -s

# 클라이언트 쪽 (10초 동안 TCP 전송)
iperf3 -c server_ip -t 10

# UDP 처리량 + 패킷 손실 측정
iperf3 -c server_ip -u -b 100M

# 지연 측정: ping
ping -c 20 google.com

# 경로 지연 측정: traceroute
traceroute google.com
```

처리량과 대역폭의 비율인 **네트워크 효율(Network Efficiency)**은 정상 상태에서 85~95%가 일반적이다. 70% 미만이면 손실이나 혼잡을 의심해야 한다.

## 대역폭-지연 곱(BDP)

고속 고지연 링크에서는 **BDP(Bandwidth-Delay Product)**가 중요하다. BDP = 대역폭 × RTT로, "파이프 안에 떠 있는" 데이터 양을 나타낸다.

```text
BDP = 1 Gbps × 0.1s (RTT 100ms)
    = 100,000,000 bits = 12.5 MB

→ 위성 링크(RTT 600ms)에서 1 Gbps를 모두 쓰려면
  송신 버퍼가 75 MB 이상이어야 한다.
```

TCP의 윈도우 크기가 BDP보다 작으면 대역폭을 낭비하게 된다. 이를 **장거리 고속 링크(Long Fat Network, LFN)** 문제라 부르며, TCP 윈도우 스케일링 옵션으로 해결한다. 다음 글에서 살펴볼 RTT와 지터가 이 문제와 직결된다.

---

**지난 글:** [TCP/IP 4계층 모델 완전 정복](/posts/network-tcp-ip-model/)

**다음 글:** [RTT와 지터: 지연 변동성 이해하기](/posts/network-rtt-jitter/)

<br>
읽어주셔서 감사합니다. 😊
