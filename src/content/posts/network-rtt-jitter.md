---
title: "RTT와 지터: 네트워크 지연 변동성 완전 이해"
description: "RTT(왕복 시간)의 측정 원리와 계산법, 지터(Jitter)의 정의와 영향, VoIP·스트리밍 품질과의 관계를 코드와 그림으로 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["RTT", "지터", "Jitter", "지연", "네트워크성능", "VoIP", "ping", "mtr"]
featured: false
draft: false
---

[지난 글](/posts/network-bandwidth-throughput-latency/)에서 대역폭·처리량·지연 시간의 개념과 측정법을 살펴봤다. 이번 글에서는 지연 시간의 두 가지 핵심 세부 지표인 **RTT(Round Trip Time)**와 **지터(Jitter)**를 깊게 파헤친다. 이 두 지표는 실시간 통신(VoIP, 화상회의, 온라인 게임)의 품질을 결정하는 핵심 요소다.

## RTT(Round Trip Time): 왕복 시간

RTT는 패킷이 송신자에서 수신자로 갔다가 응답이 돌아올 때까지 걸리는 시간이다. 단방향 지연(One-way Latency)과 달리 양방향 경로를 모두 포함하므로, 타임스탬프 동기화 없이 측정할 수 있어 실용적이다.

![RTT 측정 원리](/assets/posts/network-rtt-jitter-rtt.svg)

```bash
# ping으로 RTT 측정 (20회 샘플)
ping -c 20 google.com

# 출력 예시:
# PING google.com (142.250.X.X): 56 data bytes
# 64 bytes from ...: icmp_seq=1 ttl=116 time=12.4 ms
# ...
# --- google.com ping statistics ---
# 20 packets transmitted, 20 received, 0% packet loss
# rtt min/avg/max/mdev = 11.2/13.8/21.4/2.1 ms
#                                           ^^^ 이게 지터!
```

RTT 측정 결과 해석:
- **min**: 네트워크가 최적 상태일 때의 RTT (전파 지연 기준값)
- **avg**: 평균 RTT (일반적인 성능 지표)
- **max**: 최악의 경우 (혼잡, 큐잉 지연 포함)
- **mdev**: 표준편차 = 지터(Jitter)

단방향 지연은 `RTT / 2`로 추정한다. 단, 이는 경로가 대칭이라는 가정 아래서만 유효하다. 비대칭 경로(예: 이동통신망)에서는 오차가 크다.

## 지터(Jitter): RTT의 변동성

지터는 연속된 RTT 값들 사이의 변동이다. 통계적으로는 표준편차(Standard Deviation)나 평균 편차(Mean Deviation)로 표현한다.

![지터 시각화](/assets/posts/network-rtt-jitter-jitter.svg)

```bash
# mtr로 실시간 경로 지연 + 지터 측정
mtr --report --report-cycles 50 google.com

# 출력 예시 (각 홉별):
# HOST              Loss%  Snt   Avg  Best  Wrst StDev
# 1. 192.168.1.1    0.0%   50    1.2   0.9   2.4  0.3
# 2. 10.0.0.1       0.0%   50    5.4   4.8   8.1  0.6
# ...
# 15. google.com    0.0%   50   13.8  11.2  21.4  2.1
#                                               ^^^ 지터
```

## 지터가 실시간 서비스에 미치는 영향

지터가 문제가 되는 이유는 실시간 서비스가 일정한 도착 간격을 기대하기 때문이다.

```text
# VoIP 패킷 정상 도착 (저 지터)
t=0ms  → 패킷1 도착
t=20ms → 패킷2 도착
t=40ms → 패킷3 도착  ← 일정하게 20ms 간격

# 고 지터 상황
t=0ms  → 패킷1 도착
t=8ms  → 패킷2 도착  ← 너무 빨리
t=55ms → 패킷3 도착  ← 너무 늦게 → 끊김 발생
```

**지터 버퍼(Jitter Buffer)**는 수신 측에서 패킷을 일시적으로 버퍼링해 이 변동을 흡수한다. 버퍼 크기를 크게 하면 지터에 강해지지만 전체 지연(End-to-End Latency)이 늘어나는 트레이드오프가 있다.

## ITU-T 품질 기준 (G.114)

```text
서비스별 지연/지터 권고값:
┌──────────────────┬──────────────┬──────────────┐
│ 서비스           │ 최대 단방향  │ 최대 지터     │
├──────────────────┼──────────────┼──────────────┤
│ VoIP (음성)      │ 150 ms       │ 30 ms         │
│ 화상회의         │ 200 ms       │ 50 ms         │
│ 온라인 게임      │ 50 ms 이하   │ 10 ms 이하    │
│ 스트리밍 (버퍼)  │ 제한 없음    │ 제한 없음     │
└──────────────────┴──────────────┴──────────────┘
```

스트리밍(Netflix, YouTube)은 수~수십 초 버퍼를 사용하기 때문에 지터에 무관하다. 반면 Zoom이나 Discord는 수백 ms의 엄격한 지연 요건을 가진다.

다음 글에서는 네트워크가 어떻게 데이터를 전달하는 두 가지 근본적인 방식인 회선 교환과 패킷 교환을 비교한다.

---

**지난 글:** [대역폭·처리량·지연 시간 완전 정복](/posts/network-bandwidth-throughput-latency/)

**다음 글:** [회선 교환 vs 패킷 교환: 인터넷의 근본 원리](/posts/network-circuit-vs-packet-switching/)

<br>
읽어주셔서 감사합니다. 😊
