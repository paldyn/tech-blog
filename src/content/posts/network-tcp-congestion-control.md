---
title: "TCP 혼잡 제어: AIMD, Slow Start, CUBIC의 원리"
description: "TCP 혼잡 제어의 4단계(Slow Start, Congestion Avoidance, Fast Retransmit, Fast Recovery), AIMD 원리, CUBIC, BBR 알고리즘을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["TCP", "혼잡제어", "SlowStart", "AIMD", "CUBIC", "BBR", "cwnd", "ssthresh"]
featured: false
draft: false
---

[지난 글](/posts/network-mss-mtu-pmtud/)에서 MSS와 MTU, PMTUD의 원리를 살펴봤다. TCP 성능의 마지막 퍼즐 조각은 **혼잡 제어(Congestion Control)**다. 흐름 제어가 수신자를 보호한다면, 혼잡 제어는 **네트워크를 보호**한다. 이 둘의 최솟값이 실제 전송 속도를 결정한다.

## 혼잡이란 무엇인가

라우터의 큐가 꽉 차면 새로 들어오는 패킷을 버린다. 이를 **혼잡(Congestion)**이라 한다. 모든 TCP 연결이 욕심껏 보내면 네트워크 전체가 붕괴하는 **혼잡 붕괴(Congestion Collapse)**가 발생한다(1980년대에 실제 발생). TCP 혼잡 제어는 각 연결이 스스로 자제하는 분산 알고리즘이다.

```text
cwnd (Congestion Window): 송신자 자체 제한 윈도우
ssthresh (Slow Start Threshold): SS와 CA의 경계

실제 전송량 = min(rwnd, cwnd) / RTT
```

## cwnd 변화 그래프

![TCP 혼잡 제어 cwnd 변화 (Reno)](/assets/posts/network-tcp-congestion-control-aimd.svg)

그래프의 특징적인 **톱니 모양(Sawtooth)**은 TCP가 점진적으로 속도를 높이다가 손실을 감지하면 즉시 줄이는 AIMD 동작을 나타낸다.

## 4단계 혼잡 제어

![TCP 혼잡 제어 4단계](/assets/posts/network-tcp-congestion-control-phases.svg)

### 1단계: Slow Start (느린 시작, 실제로는 빠름)

이름과 달리 지수 성장한다. 연결 초기 네트워크 용량을 빠르게 탐색한다.

```text
Slow Start 규칙
  cwnd 초기값: 1~10 MSS (RFC 6928에서 10 MSS 권고)
  ACK 1개 수신 시: cwnd += 1 MSS
  → 1 RTT에 2배: 1, 2, 4, 8, 16 ...
  → cwnd >= ssthresh 이면 CA로 전환
```

### 2단계: Congestion Avoidance (혼잡 회피)

선형 증가(AIMD의 AI 부분)한다.

```text
Congestion Avoidance 규칙
  ACK 1개 수신 시: cwnd += MSS * MSS / cwnd
  → 1 RTT에 +1 MSS (선형 증가)
```

### 3/4단계: Fast Retransmit + Fast Recovery

RTO를 기다리지 않고 3개의 Dup-ACK으로 손실을 감지해 즉시 재전송한다. Tahoe는 cwnd를 1로 줄이고 Slow Start부터 재시작하지만, **Reno**는 Fast Recovery를 통해 cwnd를 절반(ssthresh)으로만 줄인다.

```python
# TCP Reno 혼잡 제어 의사 코드
def on_ack(cwnd, ssthresh, dup_count):
    if cwnd < ssthresh:
        # Slow Start
        cwnd += 1
    else:
        # Congestion Avoidance
        cwnd += 1 / cwnd

def on_triple_dup_ack(cwnd, ssthresh):
    # Fast Retransmit + Fast Recovery
    ssthresh = cwnd // 2
    cwnd = ssthresh + 3
    return cwnd, ssthresh

def on_timeout(cwnd, ssthresh):
    # RTO: 더 심한 상황
    ssthresh = cwnd // 2
    cwnd = 1            # Slow Start 재시작
    return cwnd, ssthresh
```

## AIMD: 공정성을 보장하는 원리

**AIMD(Additive Increase, Multiplicative Decrease)**는 TCP 혼잡 제어의 핵심 철학이다. 여러 TCP 연결이 공유 링크를 경쟁할 때 AIMD는 자연스럽게 공평한 분배로 수렴한다.

```text
AI (Additive Increase): 문제없으면 조금씩 늘린다
  cwnd += 1 MSS / RTT

MD (Multiplicative Decrease): 문제 생기면 반으로 줄인다
  cwnd = cwnd / 2 (3 Dup-ACK)
  cwnd = 1 (RTO)

두 연결이 같은 링크를 쓰면
  → AI 기울기가 같고 MD 비율이 같으므로 결국 50:50으로 수렴
```

## CUBIC: 현대 리눅스의 기본 알고리즘

Reno는 고속 장거리 링크에서 BDP가 크면 수렴이 너무 느리다. **CUBIC**(Linux 2.6.19+)은 cwnd를 선형 대신 **3차 함수**로 증가시켜 고속 네트워크에서 더 빠르게 대역폭을 활용한다.

```bash
# 현재 사용 중인 알고리즘
sysctl net.ipv4.tcp_congestion_control
# cubic

# 사용 가능한 알고리즘 목록
sysctl net.ipv4.tcp_available_congestion_control
# reno cubic bbr ...

# BBR로 변경 (대역폭·RTT 추정 기반, 고속·장거리 권장)
sysctl -w net.ipv4.tcp_congestion_control=bbr
```

## BBR: 모델 기반 혼잡 제어

Google이 개발한 **BBR(Bottleneck Bandwidth and RTT)**은 패킷 손실이 아닌 **대역폭과 RTT를 직접 측정**해 혼잡을 감지한다. 특히 무선 네트워크처럼 손실이 혼잡이 아닌 노이즈 때문에 발생하는 환경에서 Reno/CUBIC보다 훨씬 좋은 성능을 보인다. 유튜브, Google 검색 서비스에 BBR이 배포됐다.

---

**지난 글:** [MSS, MTU, PMTUD: 세그먼트 크기 결정의 모든 것](/posts/network-mss-mtu-pmtud/)

<br>
읽어주셔서 감사합니다. 😊
