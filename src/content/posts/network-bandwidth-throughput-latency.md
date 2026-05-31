---
title: "대역폭, 처리량, 지연이란"
description: "네트워크 성능을 측정하는 대역폭(Bandwidth), 처리량(Throughput), 지연(Latency)의 차이와 RTT 개념을 명확히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["대역폭", "처리량", "지연", "RTT", "네트워크 성능"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-ip-model/)에서 TCP/IP 모델의 계층 구조와 각 계층의 역할을 살펴봤습니다. 네트워크 구조를 이해했다면 이제 "이 네트워크가 얼마나 빠른가"를 측정하는 방법을 알아야 합니다. **대역폭(Bandwidth), 처리량(Throughput), 지연(Latency)** 은 네트워크 성능을 설명하는 가장 중요한 세 가지 지표이며, 이 셋을 혼용하면 잘못된 병목 분석으로 이어집니다.

## 대역폭 (Bandwidth)

대역폭은 네트워크 링크가 **이론적으로 전달할 수 있는 최대 데이터 양**입니다. 단위는 비트/초(bps, bit per second)이며, 일반적으로 Mbps·Gbps로 표현합니다.

```text
100Mbps 이더넷 = 초당 최대 100,000,000 비트 전송 가능
1Gbps 광케이블  = 초당 최대 1,000,000,000 비트 전송 가능
```

대역폭은 **도로의 최대 차선 수**에 비유할 수 있습니다. 8차선 고속도로라 해도 차가 막히면 실제 통행 속도는 낮아집니다.

> **주의**: ISP 광고 속도(예: "500Mbps 인터넷")는 대역폭 기준입니다. 실제 다운로드 속도는 이보다 낮을 수 있습니다.

## 처리량 (Throughput)

처리량은 **단위 시간 동안 실제로 전달된 데이터 양**입니다. 대역폭이 상한선이라면, 처리량은 실제 측정값입니다.

처리량이 대역폭보다 낮아지는 이유:

| 원인 | 설명 |
|------|------|
| 패킷 손실 | 재전송 발생 → 유효 처리량 감소 |
| 프로토콜 오버헤드 | TCP 헤더, IP 헤더가 실제 데이터 공간 소비 |
| 네트워크 혼잡 | 중간 라우터 큐 초과 |
| TCP 윈도우 크기 | 슬라이딩 윈도우 크기 제한 |

```bash
# iperf3로 처리량 측정 (서버/클라이언트 모드)
# 서버
iperf3 -s

# 클라이언트 (서버 IP = 192.168.1.10)
iperf3 -c 192.168.1.10 -t 10

# 출력 예시:
# [ ID] Interval        Transfer    Bitrate
# [  5] 0.00-10.00 sec  880 MBytes  739 Mbits/sec  ← 처리량
```

![대역폭·처리량·지연 개념도](/assets/posts/network-bandwidth-throughput-latency-concepts.svg)

## 지연 (Latency)

지연은 **데이터가 출발지에서 목적지까지 이동하는 데 걸리는 시간**입니다. 단위는 밀리초(ms)입니다. 대역폭이 아무리 넓어도 지연이 크면 응답성이 나쁩니다.

### 지연의 4가지 구성 요소

```text
1. 전파 지연 (Propagation Delay)
   신호가 물리 매체를 통해 이동하는 시간
   = 거리 / 빛의 속도(0.7c)
   서울→도쿄(약 1,200km) ≈ 5.7ms

2. 전송 지연 (Transmission Delay)
   패킷을 링크에 내보내는 데 걸리는 시간
   = 패킷 크기(bits) / 대역폭(bps)
   1500byte 패킷 @ 100Mbps ≈ 0.12ms

3. 큐잉 지연 (Queuing Delay)
   라우터 버퍼에서 대기하는 시간
   네트워크 혼잡 시 가변적·예측 불가

4. 처리 지연 (Processing Delay)
   라우터가 헤더를 읽고 경로를 결정하는 시간
   일반적으로 수 마이크로초
```

### RTT (Round-Trip Time)

실무에서 지연은 주로 **RTT(왕복 지연)** 로 측정합니다.

![RTT 측정 흐름](/assets/posts/network-bandwidth-throughput-latency-rtt.svg)

```bash
# ping으로 RTT 측정
ping -c 5 google.com

# 출력 예시:
# 64 bytes from 142.250.196.110: icmp_seq=1 ttl=118 time=5.23 ms
# 64 bytes from 142.250.196.110: icmp_seq=2 ttl=118 time=4.89 ms
# rtt min/avg/max/mdev = 4.89/5.06/5.23/0.17 ms
```

편도 지연 = RTT ÷ 2로 근사합니다. 지구 반대편(한국↔뉴욕)은 약 160ms RTT로, 웹 요청마다 이 지연이 누적됩니다.

## 대역폭 vs 지연: 무엇이 병목인가

```text
시나리오 A: 대용량 파일 다운로드 (1GB)
  → 대역폭이 병목. 지연 20ms여도 큰 영향 없음.
  → 대역폭 100Mbps → 200Mbps로 올리면 2배 빠름.

시나리오 B: 실시간 API 요청 (1KB 요청/응답)
  → 지연이 병목. 대역폭 1Gbps여도 RTT 200ms면 느림.
  → CDN·엣지 서버로 거리 줄이면 효과적.

시나리오 C: 화상통화 (연속 스트림)
  → 대역폭 + 지연 모두 중요.
  → 지터(Jitter, 지연 편차)도 추가 고려 필요.
```

## BDP: 대역폭-지연 곱

네트워크에서 "파이프 안에 얼마나 많은 데이터가 있을 수 있나"를 나타내는 **BDP(Bandwidth-Delay Product)** 는 TCP 최적화에 중요합니다.

```text
BDP = 대역폭 × RTT
예: 100Mbps × 0.04s(RTT 40ms) = 4,000,000 bits = 500KB

→ TCP 수신 윈도우가 500KB 이상이어야 링크를 완전히 활용 가능
```

대역폭이 넓고 지연이 큰 링크(예: 위성 통신)에서는 BDP가 매우 커져서, TCP의 기본 윈도우 크기로는 링크를 다 쓰지 못합니다. 이것이 TCP 윈도우 스케일링이 필요한 이유입니다.

다음 글에서는 네트워크 하드웨어 수준의 주소 체계인 **MAC 주소**를 살펴봅니다.

---

**지난 글:** [TCP/IP 모델 완전 이해](/posts/network-tcp-ip-model/)

**다음 글:** [MAC 주소란 무엇인가](/posts/network-mac-address/)

<br>
읽어주셔서 감사합니다. 😊
