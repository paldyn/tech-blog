---
title: "대역폭·처리량·지연: 네트워크 성능의 세 축"
description: "대역폭(Bandwidth), 처리량(Throughput), 지연(Latency)의 정확한 정의와 차이, 계산 방법, 실무 진단 관점을 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["대역폭", "처리량", "지연", "Latency", "Throughput", "Bandwidth", "네트워크성능"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-ip-model/)에서 TCP/IP 4계층 모델이 어떻게 동작하는지 살펴봤다. 계층 구조를 이해했다면 이제 "이 네트워크는 얼마나 빠른가?"를 정량적으로 표현하는 방법이 필요하다. **대역폭**, **처리량**, **지연** — 이 세 지표가 네트워크 성능의 전부라 해도 과언이 아니다.

## 대역폭 (Bandwidth)

대역폭은 네트워크 링크가 이론적으로 전달할 수 있는 **최대 데이터 속도**다. 단위는 **bps(bits per second)** 또는 그 배수(Kbps, Mbps, Gbps, Tbps)를 쓴다.

```text
1 Gbps 이더넷 포트: 초당 최대 1,000,000,000 비트 전송 가능
Wi-Fi 6 (802.11ax): 이론 최대 9.6 Gbps (실제는 훨씬 낮음)
```

중요한 점: **대역폭은 용량이지 속도가 아니다.** 도로의 차선 수에 비유할 수 있다. 차선이 많다고 차가 빨리 가는 것이 아니라, 동시에 더 많은 차가 달릴 수 있을 뿐이다.

![대역폭·처리량·지연 개념](/assets/posts/network-bandwidth-throughput-latency-concepts.svg)

## 처리량 (Throughput)

처리량은 **실제로** 단위 시간당 전달된 데이터량이다. 항상 대역폭보다 낮거나 같다.

```text
처리량 < 대역폭  (항상)

감소 원인:
- 패킷 손실 (혼잡, 링크 오류)
- 프로토콜 오버헤드 (TCP/IP 헤더, ACK)
- TCP 흐름 제어 / 혼잡 제어
- 중간 경로 병목 (가장 느린 링크가 한계를 결정)
```

`iperf3`으로 실제 처리량을 측정할 수 있다.

```bash
# 서버
iperf3 -s

# 클라이언트 (서버 IP 지정)
iperf3 -c 192.168.0.1 -t 10   # 10초 테스트
# Bandwidth: 실제 처리량 출력
```

## 지연 (Latency)

지연은 패킷이 출발지에서 목적지까지 **이동하는 데 걸리는 시간**이다. 단위는 **ms(밀리초)**를 주로 쓴다. 지연은 4가지 요소로 구성된다.

![전송 시간 계산](/assets/posts/network-bandwidth-throughput-latency-formula.svg)

| 구성 요소 | 설명 | 주요 변수 |
|-----------|------|-----------|
| **전파 지연** | 신호가 매체를 통해 이동하는 시간 | 물리 거리, 매체 속도 |
| **전송 지연** | 패킷을 링크에 밀어 넣는 시간 | 패킷 크기, 링크 속도 |
| **처리 지연** | 라우터가 패킷을 처리하는 시간 | 라우터 성능 |
| **큐잉 지연** | 라우터 버퍼에서 대기하는 시간 | 혼잡도 |

```bash
# RTT(왕복 지연) 측정
ping -c 10 google.com

# 경로별 지연 측정
traceroute google.com   # Linux/macOS
tracert google.com      # Windows
```

## 대역폭과 지연의 독립성

가장 흔한 오해: "대역폭을 늘리면 지연도 줄어든다."

**그렇지 않다.** 전파 지연은 물리 거리에 의해 결정되므로 대역폭과 무관하다. 서울-뉴욕 간 광섬유를 100Gbps로 업그레이드해도 빛의 속도로 이동하는 전파 지연(약 90ms 편도)은 변하지 않는다.

```text
대용량 파일 전송 → 대역폭이 중요
실시간 게임/화상통화 → 지연이 중요
```

## Bandwidth-Delay Product (BDP)

BDP는 대역폭 × 왕복 지연으로, **현재 파이프(링크) 안에 있는 데이터의 양**을 나타낸다.

```text
BDP = 대역폭(bps) × RTT(초)
예: 1Gbps 링크, RTT 100ms
BDP = 1×10^9 × 0.1 = 100MB

→ ACK가 돌아오기 전까지 최대 100MB 데이터가 이동 중
→ TCP 수신 버퍼가 최소 100MB 이상이어야 링크를 100% 활용 가능
```

BDP는 TCP 튜닝과 직결된다. 고대역폭-고지연 경로(예: 위성 링크)에서 기본 TCP 설정이 처리량을 낮추는 이유가 바로 여기 있다.

## 실무 기준값

```text
인터랙티브 애플리케이션(SSH, 게임): RTT < 50ms
화상 통화(Zoom, Teams): RTT < 150ms, 손실률 < 1%
웹 브라우징: RTT < 200ms에서 체감 양호
파일 전송/백업: 지연보다 처리량(Throughput) 중요
```

네트워크 성능을 진단할 때 "느리다"는 증상이 대역폭 부족인지, 지연 문제인지, 손실 문제인지부터 구분해야 한다. 다음 글에서는 지연과 밀접한 **RTT와 지터(Jitter)**를 더 깊이 다룬다.

---

**지난 글:** [TCP/IP 4계층 모델](/posts/network-tcp-ip-model/)

**다음 글:** [RTT와 지터: 지연을 정밀하게 측정하는 방법](/posts/network-rtt-jitter/)

<br>
읽어주셔서 감사합니다. 😊
