---
title: "RTT와 지터: 네트워크 응답성 지표 완전 해설"
description: "RTT(Round-Trip Time)와 지터(Jitter)의 개념, 측정 방법, ping/mtr 출력 해석, VoIP·게임에 미치는 영향과 개선 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["RTT", "지터", "Jitter", "ping", "mtr", "네트워크성능", "QoS"]
featured: false
draft: false
---

[지난 글](/posts/network-bandwidth-throughput-latency/)에서 대역폭·처리량·지연시간 개념을 살펴봤다. 이번 글에서는 지연시간과 밀접한 두 지표인 **RTT(Round-Trip Time)**와 **지터(Jitter)**를 깊이 파고든다.

## RTT (Round-Trip Time)

RTT는 **패킷을 보내고 응답을 받기까지 걸리는 왕복 시간**이다. 네트워크 지연시간을 측정하는 가장 실용적인 단위다.

![RTT와 지터 다이어그램](/assets/posts/network-rtt-jitter-diagram.svg)

```
t=0      → 클라이언트가 ICMP Echo Request 송신
t=RTT/2  → 서버가 패킷 수신
t=RTT    → 클라이언트가 ICMP Echo Reply 수신

RTT = t_receive - t_send
```

### RTT 구성요소

RTT는 앞서 다룬 지연시간의 왕복 합산이다.

```
RTT = 2 × (전파지연 + 전송지연 + 처리지연 + 큐잉지연)

서울 ↔ 뉴욕 핑 RTT 계산 (이론값):
  전파지연: 11,000km / (200,000 km/s) ≈ 55ms 편도
  RTT 이론값 ≈ 110ms
  실제 측정값 ≈ 140~180ms (케이블 경로 구불, 큐잉 등)
```

## ping 출력 해석

```bash
$ ping -c 10 google.com
PING google.com (142.250.9.100): 56 data bytes
64 bytes: icmp_seq=0 ttl=118 time=12.4 ms
64 bytes: icmp_seq=1 ttl=118 time=11.9 ms
64 bytes: icmp_seq=2 ttl=118 time=45.2 ms  ← 이상값
64 bytes: icmp_seq=3 ttl=118 time=12.1 ms

--- google.com ping statistics ---
10 packets transmitted, 10 received, 0% packet loss
rtt min/avg/max/mdev = 11.2/14.8/45.2/10.1 ms
```

각 필드 의미:
- `ttl`: Time To Live. 경유 라우터 수(홉)에 따라 감소. 초기값(64/128/255)에서 현재값을 빼면 홉 수 추정 가능
- `time`: 해당 패킷의 RTT
- `min/avg/max/mdev`: 최솟값/평균/최댓값/**평균 편차**(지터 지표)

`mdev`(mean deviation)가 크면 RTT가 불안정하다는 뜻, 즉 지터가 높다.

## 지터 (Jitter)

지터는 **연속적으로 도착하는 패킷들의 RTT 변동성**이다. RTT 자체가 크더라도 일정하면 괜찮지만, 들쭉날쭉하면 실시간 애플리케이션에 치명적이다.

```
패킷 1: RTT 10ms
패킷 2: RTT 80ms   ← 70ms 튀었음
패킷 3: RTT 12ms
패킷 4: RTT 150ms  ← 138ms 튀었음

평균 RTT: 63ms (중간값 정도)
지터 (mdev): 56ms  ← 매우 높음 → VoIP/게임에 치명적
```

### 지터 발생 원인

```
1. 네트워크 혼잡: 라우터 버퍼가 채워질 때마다 큐잉 지연 급증
2. 라우팅 경로 변경: BGP 경로 업데이트로 패킷이 다른 경로로 우회
3. 무선 재전송: Wi-Fi 패킷 손실 후 재전송 시 지연 급증
4. 처리 지연 변동: CPU 사용률 높은 라우터에서 처리 속도 불균일
```

![RTT/지터 측정 도구](/assets/posts/network-rtt-jitter-tools.svg)

## mtr로 경로별 지터 분석

`mtr`(my traceroute)은 traceroute와 ping을 결합해 각 홉별 손실률·지터를 실시간으로 보여준다.

```bash
$ mtr --report --report-cycles 20 google.com

HOST: mypc             Loss%  Snt  Last  Avg  Best  Wrst StDev
  1. 192.168.1.1         0.0%   20   0.6  0.5  0.4   0.8   0.1
  2. 10.0.0.1            0.0%   20   4.2  4.3  3.9   5.1   0.3
  3. 203.0.113.1         0.0%   20   9.8  10.1  9.2  12.3   0.7
  4. 142.250.9.100       0.0%   20  12.4  12.6  11.9  15.2   0.8
```

`StDev`(표준편차)가 지터를 나타낸다. 특정 홉에서 StDev가 급증하면 그 구간이 문제 지점이다.

```bash
# 패킷 손실이 있는 홉 사례
  3. transit-router    5.0%   20  80.2  79.8  10.1  150.2  32.1
  # ↑ 5% 패킷 손실 + StDev 32ms → 이 홉이 병목
```

## 지터 버퍼 (Jitter Buffer)

VoIP·화상회의 애플리케이션은 **지터 버퍼**를 사용해 지터를 흡수한다. 패킷이 도착하는 시점을 균일하게 만들어 재생한다.

```
지터 버퍼 동작 원리:
  실제 도착:  [p1 t=10ms] [p2 t=80ms] [p3 t=12ms]
  버퍼링 후:  [p1]        [p2]         [p3]       (균등 재생)

버퍼 크기 딜레마:
  너무 작으면 → 지터 흡수 못해 끊김
  너무 크면  → 전체 지연 증가 (화상통화 어색함)
  
적응형 지터 버퍼: 네트워크 상태에 따라 버퍼 크기 자동 조정
  WebRTC, 대부분의 현대 VoIP 스택이 사용
```

## QoS로 지터 개선

네트워크 장비에서 **QoS(Quality of Service)**를 설정하면 실시간 트래픽을 우선 처리해 지터를 줄일 수 있다.

```
DSCP 코드포인트로 트래픽 분류:
  EF (Expedited Forwarding, 46): VoIP, 게임 등 실시간 트래픽
  AF41 (34): 화상회의
  CS0 (0): 일반 best-effort 트래픽

라우터가 EF 패킷을 먼저 전송 → 큐잉 지연 감소 → 지터 개선
```

## 실무 목표값

```
서비스별 권장 RTT / 지터 기준:
─────────────────────────────────────────
웹 브라우징    : RTT < 200ms (체감 영향)
VoIP          : RTT < 150ms, 지터 < 30ms
화상회의       : RTT < 300ms, 지터 < 50ms  
온라인 게임    : RTT < 80ms (FPS), 지터 최소화
금융 거래      : RTT < 10ms (HFT), 마이크로초 수준
─────────────────────────────────────────
패킷 손실률   : < 0.1% (VoIP), < 1% (일반)
```

---

**지난 글:** [대역폭, 처리량, 지연시간](/posts/network-bandwidth-throughput-latency/)

**다음 글:** [회선 교환 vs 패킷 교환](/posts/network-circuit-vs-packet-switching/)

<br>
읽어주셔서 감사합니다. 😊
