---
title: "혼잡 제어 알고리즘 심층 비교: Reno, CUBIC, BBR"
description: "TCP 혼잡 제어 알고리즘 Reno·CUBIC·BBR의 동작 원리 차이, BDP 개념, Bufferbloat 문제, Linux에서 BBR 활성화하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 1
type: "knowledge"
category: "Network"
tags: ["혼잡제어", "CUBIC", "BBR", "TCP성능", "Bufferbloat", "BDP"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-congestion-control/)에서 TCP 혼잡 제어의 기본 원리인 Slow Start, AIMD, Fast Retransmit을 살펴봤다. 이번에는 실제 운영 환경에서 사용되는 혼잡 제어 알고리즘들 — **Reno, CUBIC, BBR** — 의 차이와 각각의 장단점을 깊이 파고든다.

## 왜 다양한 혼잡 제어 알고리즘이 존재하는가

네트워크 환경은 다양하다. 10ms RTT의 데이터센터 내부와 200ms RTT의 대륙 간 링크에서, 100Mbps 가정 인터넷과 10Gbps 서버 간 링크에서 최적의 알고리즘이 다르다. 하나의 알고리즘이 모든 환경에서 최선일 수 없기 때문에 여러 알고리즘이 공존한다.

![혼잡 제어 알고리즘 비교](/assets/posts/network-congestion-algorithms-compare.svg)

## TCP Reno

1988년 Van Jacobson이 설계한 알고리즘으로, 현대 혼잡 제어의 기반이다.

**핵심 동작:**

```text
Slow Start: cwnd += 1 MSS per ACK (지수 증가)
Congestion Avoidance: cwnd += 1 MSS per RTT (선형 증가)
Triple Dup ACK: cwnd = cwnd/2, ssthresh = cwnd/2 (Fast Recovery)
타임아웃: cwnd = 1 MSS, ssthresh = cwnd/2 (Slow Start 재시작)
```

**한계:** 고속·장거리 링크(고 BDP)에서 성능이 나쁘다. 100Mbps × 100ms RTT 링크에서 최대 처리량에 도달하려면 수분이 걸린다.

## TCP CUBIC

2008년 Sangtae Ha 등이 설계. Linux 4.9 이전부터 Linux 기본값이었으며, 현재도 대부분의 Linux 배포판 기본 알고리즘이다.

**핵심 동작:**

CUBIC은 이전 혼잡 지점을 기준으로 3차 함수(cubic) 곡선으로 cwnd를 증가시킨다.

```text
cwnd(t) = C × (t - K)³ + W_max

여기서:
- W_max: 직전 혼잡 시 cwnd
- K: W_max 도달 예상 시간
- C: 스케일 상수
- t: 마지막 혼잡 후 경과 시간
```

직전 혼잡 지점 근처에서는 cwnd를 천천히 늘려 안정적으로 탐색하고, 멀어질수록 빠르게 증가한다. 이 덕분에 고 BDP 링크에서 Reno보다 훨씬 빠르게 대역폭을 활용한다.

```bash
# 현재 사용 중인 혼잡 제어 알고리즘 확인
sysctl net.ipv4.tcp_congestion_control
# net.ipv4.tcp_congestion_control = cubic

# 사용 가능한 알고리즘 목록
sysctl net.ipv4.tcp_available_congestion_control
# net.ipv4.tcp_available_congestion_control = reno cubic bbr
```

## TCP BBR (Bottleneck Bandwidth and RTT)

2016년 Google이 개발한 알고리즘이다. YouTube, Google.com, Google Cloud에서 성능 향상을 위해 배포됐다.

**패러다임 전환:** Reno와 CUBIC이 **손실 발생 후** 반응하는 방식이라면, BBR은 손실 없이도 **현재 네트워크의 물리적 특성**을 측정해 최적 전송량을 결정한다.

![BBR 4단계 동작](/assets/posts/network-congestion-algorithms-bbr.svg)

```text
BBR 목표: 파이프를 가득 채우되 큐를 만들지 않는다.

파이프 용량 = BDP = 대역폭 × RTT
cwnd_optimal = BDP
```

**BBR의 순환 단계:**
1. **Startup**: 지수 증가로 병목 대역폭 탐색
2. **Drain**: Startup에서 채워진 큐를 비움
3. **ProbeBW**: 대부분의 시간을 보내는 크루즈 상태. 8RTT 주기로 대역폭 탐색
4. **ProbeRTT**: 10초마다 cwnd를 일시적으로 최소화해 진짜 min_RTT 재측정

**Bufferbloat 문제와 BBR의 해결:**

Bufferbloat은 라우터 버퍼가 과도하게 채워져 RTT가 수백 ms로 급증하는 현상이다. CUBIC 같은 손실 기반 알고리즘은 버퍼가 가득 찰 때까지 cwnd를 늘리기 때문에 이 문제를 유발한다. BBR은 큐를 최소한으로 유지하도록 설계되어 Bufferbloat을 줄인다.

## 알고리즘별 적합 환경

| 알고리즘 | 적합 환경 | 비적합 환경 |
|---|---|---|
| Reno | 단순한 표준 환경 | 고 BDP 링크 |
| CUBIC | 일반적인 인터넷 (기본값) | 위성, 무선 환경 |
| BBR | 고 BDP, 무선, 위성 | CUBIC 혼합 환경 (공정성) |

## Linux에서 BBR 활성화

```bash
# BBR 활성화 (즉시 적용)
sysctl -w net.ipv4.tcp_congestion_control=bbr

# 영구 적용
echo "net.ipv4.tcp_congestion_control = bbr" >> /etc/sysctl.conf
echo "net.core.default_qdisc = fq" >> /etc/sysctl.conf
sysctl -p

# BBR2 (더 개선된 버전, 일부 커널에서)
modprobe tcp_bbr2
sysctl -w net.ipv4.tcp_congestion_control=bbr2
```

BBR과 함께 `fq` (Fair Queue) qdisc를 사용하면 최적의 성능을 얻는다.

## 실제 성능 측정

```bash
# iperf3로 TCP 혼잡 제어 알고리즘 비교
# 서버
iperf3 -s

# CUBIC으로 측정
iperf3 -c <서버IP> -Z cubic -t 30

# BBR로 측정
iperf3 -c <서버IP> -Z bbr -t 30

# ss로 실시간 cwnd, RTT 확인
ss -tiH dst <서버IP> | grep -E "cwnd|rtt"
```

---

**지난 글:** [TCP 혼잡 제어: AIMD, Slow Start, CUBIC의 원리](/posts/network-tcp-congestion-control/)

**다음 글:** [UDP 활용 사례: 빠른 전송이 필요한 곳](/posts/network-udp-use-cases/)

<br>
읽어주셔서 감사합니다. 😊
