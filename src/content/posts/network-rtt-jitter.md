---
title: "RTT와 지터: 지연을 정밀하게 측정하는 방법"
description: "RTT(왕복 지연)와 Jitter(지터)의 정의, 측정 방법, 실시간 통신에 미치는 영향, ping 출력을 읽는 법을 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["RTT", "지터", "Jitter", "ping", "지연", "네트워크성능", "실시간통신"]
featured: false
draft: false
---

[지난 글](/posts/network-bandwidth-throughput-latency/)에서 지연(Latency)이 네트워크 성능에서 얼마나 중요한지 살펴봤다. 이번에는 지연을 더 정밀하게 측정하는 두 지표인 **RTT(Round-Trip Time)**와 **지터(Jitter)**를 다룬다.

## RTT(Round-Trip Time)란

RTT는 패킷이 출발지에서 목적지까지 갔다가 **응답이 돌아오는 데 걸린 총 시간**이다. 편도 지연(one-way latency)의 약 2배다.

```text
RTT = 요청 편도 지연 + 서버 처리 시간 + 응답 편도 지연
    ≈ 편도 지연 × 2 (처리 시간이 무시 가능한 경우)
```

![RTT와 지터 개념](/assets/posts/network-rtt-jitter-diagram.svg)

`ping` 명령이 측정하는 값이 바로 RTT다. ICMP Echo Request를 보내고 Echo Reply가 돌아오기까지의 시간을 ms 단위로 보고한다.

## RTT가 중요한 이유

TCP는 ACK(수신 확인)가 돌아와야 다음 데이터를 보낼 수 있다. RTT가 크면 매 ACK마다 긴 대기가 생겨 처리량이 떨어진다. HTTP/1.1은 요청-응답이 순차적이어서 RTT의 영향을 특히 많이 받는다.

```text
단순 HTTP 요청 최소 소요 시간:
DNS 조회(1 RTT) + TCP 연결(1 RTT) + HTTP 요청/응답(1 RTT) = 3 RTT 이상

RTT 200ms → 최소 600ms 소요 (콘텐츠 크기 무관)
RTT 10ms  → 최소 30ms 소요
```

## 지터 (Jitter)

지터는 **패킷 도착 간격의 변동**이다. 모든 패킷이 정확히 일정한 간격으로 도착하면 지터는 0이다. 네트워크 혼잡, 큐잉 지연 변동 등으로 패킷마다 도착 시간이 달라지면 지터가 발생한다.

```text
패킷 1: 30ms 후 도착
패킷 2: 45ms 후 도착  ← 15ms 지연 증가
패킷 3: 28ms 후 도착  ← 17ms 지연 감소
지터 = 이 변동폭의 통계적 측정값
```

지터가 크면 음성·영상 통화에서 음질 저하, 버퍼링, 끊김이 발생한다. VoIP는 패킷이 일정한 간격으로 도착해야 자연스러운 음성이 재생되기 때문이다.

## ping으로 RTT와 지터 측정하기

![ping 출력 분석](/assets/posts/network-rtt-jitter-measurement.svg)

```bash
# 5번 전송
ping -c 5 google.com

# 출력 해석
# rtt min/avg/max/mdev = 29.8/31.1/33.1/1.1 ms
# min  = 가장 빠른 RTT (이상적 조건)
# avg  = 평균 RTT
# max  = 가장 느린 RTT (혼잡 피크)
# mdev = 평균 편차 → 사실상 지터 지표
```

`mdev`(mean deviation)가 낮을수록 RTT가 일정하다는 의미다. `mdev`가 높으면 네트워크 혼잡이나 경로 불안정을 의심할 수 있다.

## 상세 지터 측정: mtr

```bash
# mtr: ping + traceroute 결합 도구
mtr --report --report-cycles 20 google.com

# 출력:
# HOST          Loss%  Snt  Last  Avg  Best  Wrst  StDev
# 192.168.0.1   0.0%   20   0.5  0.6   0.4   0.9   0.1
# 58.x.x.x      0.0%   20   3.1  3.2   3.0   3.5   0.1
# ...
# google.com    0.0%   20  31.0 31.1  29.8  33.1   0.9
```

`StDev`(표준편차)가 각 홉의 지터를 나타낸다. 특정 홉에서 StDev가 갑자기 커지면 그 구간이 병목이다.

## 실용 기준값

| 애플리케이션 | RTT 목표 | 지터 목표 |
|-------------|---------|---------|
| 온라인 FPS 게임 | < 30ms | < 5ms |
| 화상 통화 (Zoom) | < 150ms | < 30ms |
| VoIP | < 150ms | < 20ms |
| 웹 브라우징 | < 200ms | 민감하지 않음 |
| 파일 전송 | 관대 | 관대 |

## 지터 완화: 재생 버퍼 (Jitter Buffer)

실시간 애플리케이션은 도착한 패킷을 즉시 재생하지 않고, 짧은 버퍼에 모아 일정한 속도로 재생한다. 이 **재생 버퍼(Playout Buffer)**가 지터를 흡수한다. 단, 버퍼가 클수록 추가 지연이 생기므로 균형이 필요하다.

```text
지터 버퍼 전략:
- 고정 버퍼: 항상 N ms 기다렸다가 재생 (단순, 지연 고정)
- 적응형 버퍼: 측정된 지터에 따라 버퍼 크기 동적 조정 (더 나은 품질)
```

---

**지난 글:** [대역폭·처리량·지연](/posts/network-bandwidth-throughput-latency/)

**다음 글:** [회선 교환 vs 패킷 교환: 인터넷의 선택](/posts/network-circuit-vs-packet-switching/)

<br>
읽어주셔서 감사합니다. 😊
