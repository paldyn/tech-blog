---
title: "RTT와 지터: 네트워크 지연의 두 얼굴"
description: "왕복 지연 RTT와 패킷 도착 시간 편차 지터의 차이, 측정 방법, 실시간 서비스(VoIP·게임)에서 왜 중요한지 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 1
type: "knowledge"
category: "Network"
tags: ["RTT", "지터", "레이턴시", "핑", "VoIP", "네트워크성능"]
featured: false
draft: false
---

[지난 글](/posts/network-bandwidth-throughput-latency/)에서 대역폭·처리량·지연이라는 세 가지 성능 지표를 살펴봤다. 그 중 **지연(Latency)**을 조금 더 파고들면, 실무에서 자주 혼용되는 두 개념이 나타난다. **RTT(Round-Trip Time)**와 **지터(Jitter)**다. 각각 무엇을 측정하는지, 어떤 서비스에 치명적인지 정확히 이해해야 네트워크 장애를 제대로 진단할 수 있다.

## RTT란 무엇인가

RTT는 패킷을 보낸 시점부터 그 응답이 돌아오기까지의 **왕복 시간**이다. 쉽게 말해 `ping` 명령어가 출력하는 `time=24.3 ms`가 RTT다.

![RTT 측정 다이어그램](/assets/posts/network-rtt-jitter-diagram.svg)

```bash
# ICMP Echo Request/Reply로 RTT 측정
ping -c 4 8.8.8.8

# 출력 예시
PING 8.8.8.8 (8.8.8.8): 56 data bytes
64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=23.8 ms
64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=24.1 ms
64 bytes from 8.8.8.8: icmp_seq=2 ttl=118 time=24.5 ms
64 bytes from 8.8.8.8: icmp_seq=3 ttl=118 time=23.9 ms

--- 8.8.8.8 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss
round-trip min/avg/max/stddev = 23.8/24.1/24.5/0.3 ms
```

RTT는 네 가지 지연 요소의 합이다.

| 구성 요소 | 설명 | 특징 |
|-----------|------|------|
| 전파 지연 | 전기 신호가 물리 매체를 이동하는 시간 | 거리 / 광속, 줄일 수 없음 |
| 전송 지연 | 패킷 전체를 링크에 올리는 시간 | 패킷 크기 / 대역폭 |
| 처리 지연 | 라우터가 헤더를 분석하는 시간 | 보통 무시 가능 |
| 큐 대기 지연 | 라우터 버퍼에서 대기하는 시간 | 혼잡 시 급증 |

서울—뉴욕 구간의 광케이블 전파 지연만 약 70ms다. 물리적으로 줄일 수 없는 값이므로, 실제 RTT를 낮추려면 **엣지 서버(CDN)나 프록시를 사용자 가까이 배치**하는 것이 핵심이다.

## 단방향 지연 vs RTT

`ping`으로 측정하는 RTT는 **왕복** 값이다. 일반적으로 `단방향 지연 ≈ RTT / 2`로 추정하지만, 정확히는 경로의 비대칭성 때문에 같지 않을 수 있다. 예를 들어 CDN이 응답 경로를 최적화하면 응답이 더 빠르게 돌아오기도 한다.

```python
# Python으로 RTT 직접 측정 (소켓 레벨)
import socket
import time

def measure_tcp_rtt(host: str, port: int = 80) -> float:
    """TCP 연결 RTT 측정 (SYN + SYN-ACK 왕복)"""
    start = time.perf_counter()
    with socket.create_connection((host, port), timeout=5):
        rtt_ms = (time.perf_counter() - start) * 1000
    return rtt_ms

rtt = measure_tcp_rtt("www.google.com")
print(f"TCP RTT: {rtt:.1f} ms")
```

## 지터(Jitter)란 무엇인가

지터는 연속된 패킷들의 **RTT 편차**다. 같은 목적지로 10개의 패킷을 보냈을 때 각각 20ms, 35ms, 18ms, 42ms가 나온다면 지터가 크다. `ping` 출력의 `stddev` 값이 지터를 대략적으로 나타낸다.

![지터 시각화](/assets/posts/network-rtt-jitter-jitter.svg)

```bash
# ping 통계의 stddev가 지터 지표
ping -c 20 8.8.8.8
# round-trip min/avg/max/stddev = 22.1/25.3/48.7/6.2 ms
#                                                       ^^^
#                                           stddev 6.2ms = 지터

# iperf3로 UDP 지터 측정 (VoIP 시뮬레이션)
# 서버 쪽:
iperf3 -s
# 클라이언트 쪽 (UDP, 1Mbps, 10초):
iperf3 -c 192.168.1.1 -u -b 1M -t 10
# 출력: Jitter  0.234 ms  — 낮을수록 좋음
```

지터가 문제가 되는 이유는 실시간 서비스의 **재생 버퍼(Playout Buffer)** 때문이다. 전화나 영상 통화는 패킷이 일정한 간격으로 도착한다고 가정하고 오디오/비디오를 디코딩한다. 패킷이 불규칙하게 들어오면 버퍼가 비거나(결음) 넘치는(딜레이 급증) 현상이 발생한다.

## 지터 허용 기준

| 서비스 | RTT 권장 | 지터 허용 범위 | 패킷 손실 허용 |
|--------|----------|---------------|---------------|
| VoIP (G.711) | < 150ms | < 30ms | < 1% |
| 화상 회의 | < 150ms | < 50ms | < 2% |
| 온라인 게임 (FPS) | < 50ms | < 20ms | < 0.5% |
| 스트리밍 (버퍼링) | < 1000ms | 관대함 | < 5% |

## 지터 버퍼 (Jitter Buffer)

VoIP 기기와 웹브라우저의 WebRTC는 지터를 흡수하기 위해 **적응형 지터 버퍼**를 내장한다. 패킷을 잠시 저장해 두었다가 일정한 간격으로 재생하는 방식이다. 버퍼를 크게 잡으면 지터는 흡수되지만 전체 지연이 늘어나고, 작게 잡으면 지연은 줄지만 버퍼 언더런(결음)이 생긴다.

```python
# 간단한 지터 버퍼 시뮬레이션
from collections import deque
import time

class JitterBuffer:
    def __init__(self, target_delay_ms: float = 40.0):
        self.target_delay = target_delay_ms / 1000
        self.buffer: deque = deque()

    def push(self, packet: bytes, recv_time: float) -> None:
        play_time = recv_time + self.target_delay
        self.buffer.append((play_time, packet))
        self.buffer = deque(sorted(self.buffer, key=lambda x: x[0]))

    def pop(self, now: float) -> bytes | None:
        if self.buffer and self.buffer[0][0] <= now:
            _, packet = self.buffer.popleft()
            return packet
        return None  # 아직 재생 시간 미도달
```

## RTT와 지터 측정 도구 정리

```bash
# 1. ping — 가장 기본적인 RTT 측정
ping -c 10 -i 0.2 8.8.8.8   # 0.2초 간격 10회

# 2. hping3 — TCP/UDP RTT 측정 (포트 지정 가능)
hping3 -S -p 80 -c 5 www.example.com

# 3. mtr — 실시간 홉별 RTT + 패킷 손실
mtr --report --report-cycles 20 8.8.8.8

# 4. iperf3 — 대역폭 + 지터 동시 측정
iperf3 -c 서버IP -u -b 10M -t 30 --get-server-output
```

## 정리

RTT는 왕복 지연의 절대값이고, 지터는 그 값의 **변동 크기**다. 웹 서비스는 RTT에 민감하고 (사용자가 느리다고 느낌), VoIP·게임은 지터에 더 민감하다 (결음·끊김 발생). 네트워크 문제를 진단할 때는 두 값을 함께 확인해야 한다. RTT가 낮아도 지터가 크면 실시간 서비스는 불안정하다.

---

**지난 글:** [대역폭, 처리량, 지연이란](/posts/network-bandwidth-throughput-latency/)

**다음 글:** [회선 교환 vs 패킷 교환](/posts/network-circuit-vs-packet-switching/)

<br>
읽어주셔서 감사합니다. 😊
