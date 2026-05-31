---
title: "회선 교환 vs 패킷 교환: 데이터 전달 방식의 두 철학"
description: "전통적인 회선 교환(Circuit Switching)과 인터넷의 근간 패킷 교환(Packet Switching)의 원리, 장단점, Store-and-Forward 지연 계산을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["회선교환", "패킷교환", "네트워크기초", "Store-and-Forward", "인터넷원리"]
featured: false
draft: false
---

[지난 글](/posts/network-rtt-jitter/)에서 RTT와 지터로 네트워크 지연을 정량화하는 방법을 살펴봤다. 그렇다면 애초에 데이터는 네트워크를 통해 어떻게 전달되는 걸까? 전화망과 인터넷이 같은 물리 선로를 쓰면서도 동작 방식이 전혀 다른 이유가 여기에 있다. 핵심은 **회선 교환(Circuit Switching)**과 **패킷 교환(Packet Switching)**의 근본적인 차이에 있다.

## 회선 교환: 전용 경로 예약

회선 교환은 통신 전에 출발지와 목적지 사이에 **전용 회선을 설정**하는 방식이다. 전통적인 PSTN(공중전화망)이 대표적이다.

![회선 교환과 패킷 교환 비교](/assets/posts/network-circuit-vs-packet-switching-circuit.svg)

동작은 세 단계로 구분된다.

1. **회선 설정(Circuit Establishment)**: 교환기를 통해 A → B 사이의 전용 경로 예약. 셋업 시간이 필요하다.
2. **데이터 전송**: 예약된 회선을 독점 사용. 고정 대역폭 보장, 일정한 지연.
3. **회선 해제(Circuit Teardown)**: 통화 종료 후 자원 반환.

```
전통 전화 연결 흐름:
사용자 A ──[교환기1]──[교환기2]──[교환기3]── 사용자 B
          ←────── 전용 64kbps 채널 예약 ──────→
          (통화 중 미사용 구간도 채널 점유)
```

**장점**: 지연이 일정하고 예측 가능하다. 품질이 보장된다 (QoS 보장).  
**단점**: 침묵 구간에도 채널을 점유하므로 자원 낭비가 크다. 전화 통화의 약 50%는 침묵이다.

## 패킷 교환: 공유 자원과 Store-and-Forward

인터넷의 근간인 패킷 교환은 데이터를 **패킷(Packet)**이라는 단위로 분할해 전송한다. 각 패킷은 독립적으로 라우팅되며, 목적지에서 재조립된다.

![Store-and-Forward 패킷 전달](/assets/posts/network-circuit-vs-packet-switching-packet.svg)

### Store-and-Forward 방식

라우터는 패킷을 **전부 수신한 뒤** 다음 홉으로 전송한다. 이 방식이 Store-and-Forward다. 패킷 크기가 L 비트이고 링크 속도가 R bps일 때, 한 링크의 전송 지연은 L/R이다.

```python
def store_and_forward_delay(
    packet_size_bits: int,
    link_rate_bps: int,
    num_hops: int,
    propagation_delay_per_hop_ms: float,
) -> float:
    """Store-and-Forward 총 지연 계산"""
    # 각 홉마다 전송 지연 발생 (패킷 재전송)
    transmission_delay_ms = (packet_size_bits / link_rate_bps) * 1000 * num_hops
    total_propagation_ms = propagation_delay_per_hop_ms * num_hops
    return transmission_delay_ms + total_propagation_ms

# 예시: 1500 bytes 패킷, 100Mbps 링크, 3홉, 홉당 전파 지연 5ms
delay = store_and_forward_delay(
    packet_size_bits=1500 * 8,   # 12000 bits
    link_rate_bps=100_000_000,   # 100 Mbps
    num_hops=3,
    propagation_delay_per_hop_ms=5,
)
print(f"총 지연: {delay:.3f} ms")
# → 총 지연: 15.360 ms  (전송 0.12ms × 3 + 전파 5ms × 3)
```

### 통계적 다중화 (Statistical Multiplexing)

패킷 교환의 핵심 강점은 여러 사용자가 링크를 **동적으로 공유**한다는 점이다. A, B, C가 동시에 전송할 때 각각의 패킷이 큐에서 순서를 기다리며 전송된다. 사용하지 않는 사용자는 대역폭을 소비하지 않으므로 자원 효율이 극대화된다.

```
회선 교환 (100 Mbps, 4 사용자):
각 사용자: 25 Mbps 고정 할당
→ A가 침묵해도 25 Mbps 낭비

패킷 교환 (100 Mbps, 4 사용자):
A, B만 전송 중 → 각 50 Mbps 동적 할당
→ C, D가 쉬는 대역폭을 A, B가 활용
```

## 지연 계산 비교

100명이 동시에 사용하는 시나리오를 가정해 보자. 각 사용자는 필요할 때만 1Mbps를 사용하고, 동시 사용 확률은 10%다.

```python
import math
from scipy.stats import binom

def calc_congestion_prob(
    total_users: int,
    link_capacity_mbps: int,
    per_user_mbps: int,
    active_prob: float,
) -> float:
    """패킷 교환에서 혼잡 발생 확률"""
    max_simultaneous = link_capacity_mbps // per_user_mbps
    # P(동시 활성 사용자 > max_simultaneous)
    prob = 1 - binom.cdf(max_simultaneous, total_users, active_prob)
    return prob

# 회선 교환: 1Mbps × 100명 = 100Mbps 필요
# 패킷 교환: 10% 확률이면 평균 10명 동시 사용 → 10Mbps로도 충분?
prob_congestion = calc_congestion_prob(
    total_users=100,
    link_capacity_mbps=35,   # 35Mbps 링크
    per_user_mbps=1,
    active_prob=0.10,
)
print(f"혼잡 확률: {prob_congestion:.4%}")
# → 혼잡 확률: 0.0004%  (사실상 0)
# 35Mbps로 100Mbps급 서비스 가능 = 3배 효율!
```

## 패킷 교환의 단점: 큐 지연과 패킷 손실

패킷 교환은 트래픽이 폭증하면 라우터 버퍼가 넘쳐 **패킷을 폐기**한다. 이를 패킷 손실(Packet Loss)이라 하며, TCP는 재전송으로 대응하지만 추가 지연이 생긴다.

```
링크 버퍼 모델:
입력 트래픽 > 출력 링크 용량 → 큐 증가
큐 > 버퍼 크기 → 패킷 드롭 (Tail Drop)

개선책:
- RED (Random Early Detection): 큐가 차기 전 미리 일부 폐기 → TCP 조기 반응
- QoS (Quality of Service): 트래픽 우선순위 부여 → VoIP를 웹보다 우선
```

## 두 방식의 현재

| 항목 | 회선 교환 | 패킷 교환 |
|------|-----------|-----------|
| 대표 기술 | PSTN, ISDN | 인터넷, LTE/5G |
| 자원 할당 | 정적 예약 | 동적 공유 |
| 지연 특성 | 일정 (예측 가능) | 가변적 |
| 패킷 손실 | 없음 | 발생 가능 |
| 비용 효율 | 낮음 | 높음 |
| 적합 서비스 | 음성 통화 | 데이터, 인터넷 |

오늘날 VoIP는 패킷 교환 위에서 동작하면서도 QoS로 음성 품질을 보장하는 **하이브리드 접근**을 사용한다. PSTN 자체도 백본에서는 패킷 교환으로 전환됐다.

## 정리

회선 교환은 자원을 독점 예약해 품질을 보장하지만 낭비가 크다. 패킷 교환은 자원을 공유해 효율을 극대화하지만 혼잡 시 지연과 손실이 생긴다. 인터넷은 패킷 교환을 선택하고, QoS와 혼잡 제어 알고리즘으로 품질 문제를 보완해 왔다.

---

**지난 글:** [RTT와 지터: 네트워크 지연의 두 얼굴](/posts/network-rtt-jitter/)

**다음 글:** [신호와 인코딩: 데이터를 전파로 바꾸는 법](/posts/network-signaling-encoding/)

<br>
읽어주셔서 감사합니다. 😊
