---
title: "대역폭, 처리량, 지연시간: 네트워크 성능의 3요소"
description: "네트워크 성능을 측정하는 핵심 지표인 대역폭(Bandwidth), 처리량(Throughput), 지연시간(Latency)의 차이와 측정 방법을 실무 관점에서 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["대역폭", "처리량", "지연시간", "Bandwidth", "Throughput", "Latency", "네트워크성능"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-ip-model/)에서 TCP/IP 4계층 모델 구조를 살펴봤다. 이번 글에서는 네트워크 성능을 평가할 때 반드시 알아야 할 세 가지 핵심 지표인 **대역폭(Bandwidth)**, **처리량(Throughput)**, **지연시간(Latency)**을 다룬다. 이 세 개념을 혼동하면 성능 병목을 잘못 진단하게 된다.

## 대역폭 (Bandwidth)

대역폭은 **네트워크 링크가 이론상 전송할 수 있는 최대 데이터 속도**다. 파이프의 굵기에 비유한다. 1Gbps 이더넷 케이블은 초당 최대 1,000,000,000비트를 전송할 수 있다.

단위 체계:
```
1 bps   = 1 bit per second
1 Kbps  = 1,000 bps
1 Mbps  = 1,000,000 bps
1 Gbps  = 1,000,000,000 bps
1 Tbps  = 1,000,000,000,000 bps

⚠ 1 MBps (메가바이트/초) ≠ 1 Mbps (메가비트/초)
  1 MBps = 8 Mbps
```

대역폭은 링크의 물리적 특성에서 결정된다. 광섬유는 구리 케이블보다 훨씬 높은 대역폭을 제공한다.

![대역폭·처리량·지연시간 개념](/assets/posts/network-bandwidth-throughput-latency-concepts.svg)

## 처리량 (Throughput)

처리량은 **실제로 전송된 데이터 속도**다. 파이프에 실제로 흐르는 물의 양에 비유한다. 대역폭보다 항상 작거나 같으며, 다양한 요인으로 감소한다.

처리량을 낮추는 요인들:
```
실제 처리량 = 대역폭 × 효율
             ─────────────────────────
효율을 낮추는 요소:
  - 프로토콜 오버헤드 (TCP/IP 헤더 ~5%)
  - 패킷 손실 및 재전송
  - 네트워크 혼잡 (TCP 혼잡 제어)
  - 인코딩 오버헤드 (이더넷 프리앰블 등)
  - 반이중(Half-Duplex) 충돌
  - 큐잉 지연으로 인한 버퍼 드롭
```

1Gbps 링크에서 실제 파일 전송 속도가 700~800Mbps에 그치는 것이 정상이다. 50%를 밑돌면 문제가 있다고 볼 수 있다.

## 지연시간 (Latency)

지연시간은 **데이터 패킷이 출발지에서 목적지까지 이동하는 데 걸리는 시간**이다. 단위는 ms(밀리초)다. 대역폭과 별개의 개념으로, 파이프가 아무리 굵어도 지구 반대편 서버까지의 물리적 거리는 변하지 않는다.

지연시간의 4가지 구성요소:

| 구성요소 | 원인 | 크기 |
|----------|------|------|
| 전파 지연 | 물리적 거리, 빛의 속도 | 국내 ~5ms, 태평양 ~80ms |
| 전송 지연 | 패킷 크기 ÷ 대역폭 | 1500B/1Gbps ≈ 0.012ms |
| 처리 지연 | 라우터 헤더 분석 | 수 마이크로초 |
| 큐잉 지연 | 라우터 버퍼 대기 | 0~수십ms (혼잡 시) |

```python
# 전송 지연 계산 예시
packet_size_bits = 1500 * 8   # 1500 bytes = 12000 bits
bandwidth_bps = 1_000_000_000  # 1 Gbps

transmission_delay = packet_size_bits / bandwidth_bps
print(f"전송 지연: {transmission_delay * 1000:.4f} ms")  # 0.0120 ms

# 전파 지연 (서울-부산, 약 400km 광케이블)
distance_m = 400_000
speed_of_light = 200_000_000  # 광섬유 내 2/3 광속
propagation_delay = distance_m / speed_of_light
print(f"전파 지연: {propagation_delay * 1000:.2f} ms")  # 2.00 ms
```

## RTT (Round-Trip Time)

RTT는 **패킷 왕복 시간**이다. 요청을 보내고 응답이 돌아오기까지 걸리는 시간으로, 대부분의 latency 측정은 RTT로 표현된다.

```bash
$ ping -c 4 google.com
PING google.com (142.250.9.100): 56 data bytes
64 bytes: icmp_seq=0 ttl=117 time=12.4 ms
64 bytes: icmp_seq=1 ttl=117 time=11.8 ms
64 bytes: icmp_seq=2 ttl=117 time=12.1 ms
64 bytes: icmp_seq=3 ttl=117 time=13.2 ms

--- google.com ping statistics ---
4 packets transmitted, 4 received, 0% packet loss
rtt min/avg/max/mdev = 11.8/12.4/13.2/0.5 ms
```

RTT ≈ 왕복이므로 단방향 지연은 약 RTT/2다. `mdev` 값이 크면 지터(Jitter)가 높다는 신호다.

## 성능 측정 도구

![성능 측정 도구](/assets/posts/network-bandwidth-throughput-latency-metrics.svg)

```bash
# 처리량 측정: iperf3
iperf3 -s                          # 서버 모드
iperf3 -c <server-ip> -t 10 -P 4  # 10초, 4 스트림으로 측정

# UDP 처리량과 패킷 손실 측정
iperf3 -c <server-ip> -u -b 100M

# TCP 연결 상세 정보 (RTT, cwnd)
ss -i dst google.com
# rtt:12.4/2.1 means avg_rtt:12.4ms, rtt_variance:2.1ms

# 경로별 지연 측정
traceroute -n google.com
mtr --report google.com
```

## Bandwidth-Delay Product

**BDP(Bandwidth-Delay Product)**는 링크 위에 "in-flight" 상태로 있을 수 있는 최대 데이터 양이다.

```
BDP = 대역폭(bps) × RTT(초)

예: 100 Mbps 링크, RTT 100ms
BDP = 100,000,000 × 0.1 = 10,000,000 bits = 10 MB

→ TCP 수신 윈도우가 10MB 이상이어야 링크를 100% 활용 가능
  그보다 작으면 sender가 ACK를 기다리며 멈추는 현상 발생
```

고대역폭·고지연 환경(예: 위성 링크)에서 TCP 성능이 떨어지는 이유가 바로 BDP를 채우지 못하는 윈도우 크기 제한 때문이다.

## 대역폭 vs 지연시간: 어느 것이 중요한가

둘 다 중요하지만 워크로드에 따라 병목이 다르다.

```
대역폭이 중요한 경우:
  - 대용량 파일 전송 (백업, 미디어 스트리밍)
  - 배치 작업, 데이터 마이그레이션

지연시간이 중요한 경우:
  - 게임, 화상통화, 실시간 거래
  - HTTP 요청/응답 패턴 (TTFB: Time To First Byte)
  - DB 쿼리, 마이크로서비스 RPC 호출
```

웹 페이지 로딩 속도를 개선하려면 대역폭보다 RTT 감소(CDN, HTTP/2 멀티플렉싱)가 훨씬 효과적인 경우가 많다.

---

**지난 글:** [TCP/IP 4계층 모델](/posts/network-tcp-ip-model/)

**다음 글:** [RTT와 지터](/posts/network-rtt-jitter/)

<br>
읽어주셔서 감사합니다. 😊
