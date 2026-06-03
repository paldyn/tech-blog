---
title: "UDP 활용 사례: 빠른 전송이 필요한 곳"
description: "UDP가 TCP 대신 쓰이는 이유, DNS·DHCP·VoIP·게임·QUIC 등 실제 활용 사례, UDP 위에서 신뢰성을 구현하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["UDP", "DNS", "QUIC", "VoIP", "RTP", "실시간통신"]
featured: false
draft: false
---

[지난 글](/posts/network-congestion-algorithms/)에서 TCP 혼잡 제어 알고리즘의 발전을 살펴봤다. 이번에는 TCP와 다른 선택을 하는 **UDP(User Datagram Protocol)**가 왜 여전히 핵심 프로토콜인지, 어떤 상황에서 TCP보다 UDP가 올바른 선택인지를 깊이 살펴본다.

## UDP의 특성 요약

UDP는 TCP가 제공하는 대부분의 기능을 **의도적으로 제거**한 프로토콜이다.

```text
TCP가 제공하는 것:        UDP는?
- 연결 설정 (3-way HS)  → 없음
- 순서 보장             → 없음
- 재전송               → 없음
- 흐름 제어             → 없음
- 혼잡 제어             → 없음
- 오류 검출 (체크섬)    → 있음 (선택적)
```

헤더 크기: TCP 최소 20바이트 vs **UDP 8바이트**.

UDP의 가치는 이 단순성에서 나온다. 연결 설정에 드는 1.5 RTT가 없고, 재전송 대기가 없으며, 흐름 제어 오버헤드가 없다.

![UDP 주요 활용 사례](/assets/posts/network-udp-use-cases-overview.svg)

## DNS: UDP를 쓰는 이유

DNS 조회는 거의 대부분 UDP 포트 53을 사용한다.

이유가 간단하다. DNS 요청과 응답은 **하나의 패킷**으로 충분한 크기다. TCP 연결을 맺어야 한다면 DNS 응답을 받기 전에 이미 1.5 RTT를 낭비한다. UDP라면 요청과 응답 각 1개씩, **0.5 RTT** 면 된다.

```bash
# DNS 조회 (UDP 53)
dig google.com

# TCP로 강제 DNS 조회 (응답이 512바이트 초과 시 자동 전환)
dig +tcp google.com

# DNS 응답이 512바이트 초과 시: TC(Truncated) 비트 = 1 → 클라이언트가 TCP로 재시도
# DNSSEC 레코드처럼 큰 응답은 TCP나 DNS-over-TLS/HTTPS 사용
```

DNS over HTTPS(DoH), DNS over TLS(DoT)는 UDP/TCP 모두 사용하지만, 전통적인 DNS는 UDP가 기본이다.

## DHCP: 연결 전 통신

DHCP는 더 강력한 이유로 UDP를 쓴다. IP 주소를 아직 갖지 않은 클라이언트가 IP 주소를 받아야 한다.

```text
DORA 과정:
Discover: 출발지 0.0.0.0:68 → 255.255.255.255:67  (브로드캐스트)
Offer:    서버 → 클라이언트 (제안)
Request:  클라이언트 → 서버 (수락)
ACK:      서버 → 클라이언트 (확정)
```

연결이 설정되기 전의 브로드캐스트 통신이므로 TCP의 3-way handshake가 불가능하다.

## VoIP와 RTP: 실시간 미디어 전송

Zoom, Microsoft Teams, Google Meet의 음성/영상 스트림은 **RTP(Real-time Transport Protocol)** 위에서 UDP로 전송된다.

왜 UDP인가? 패킷이 늦게 도착하면 재전송해도 소용없다. 20ms 늦은 음성 패킷을 재전송받아서 40ms 뒤에 재생하면 더 나빠진다. 그냥 버리고 다음 패킷을 재생하는 게 낫다.

```text
RTP 처리 방식:
- 손실 패킷: 무시 (또는 패킷 오류 보완 FEC)
- 늦은 패킷: 지터 버퍼에서 일정 시간 기다린 후 폐기
- 재전송: 없음 (RTCP로 품질 모니터링만)
```

## QUIC: UDP 위에 신뢰성 구현

**QUIC(Quick UDP Internet Connections)**는 구글이 개발한 프로토콜로, HTTP/3의 전송 계층이다.

![QUIC vs TCP+TLS](/assets/posts/network-udp-use-cases-quic.svg)

QUIC는 **UDP 위에서** TCP+TLS가 제공하는 기능을 더 효율적으로 구현한다.

**QUIC의 핵심 개선:**

1. **0-RTT/1-RTT 연결 수립**: TCP+TLS 1.3이 2.5 RTT인 반면 QUIC는 1 RTT(첫 연결) 또는 0 RTT(재연결).

2. **HOL Blocking 제거**: HTTP/2에서는 TCP 스트림의 패킷 하나가 손실되면 모든 HTTP 스트림이 대기한다. QUIC는 스트림별로 독립 패킷 번호를 사용해 특정 스트림의 손실이 다른 스트림을 막지 않는다.

3. **연결 마이그레이션**: 모바일에서 Wi-Fi → LTE 전환 시 TCP는 연결이 끊어지지만, QUIC는 Connection ID로 IP 변경에도 연결을 유지한다.

```bash
# HTTP/3 (QUIC) 지원 확인
curl --http3 https://www.google.com -I 2>&1 | head -5

# QUIC 연결 확인 (Wireshark filter)
# udp.port == 443 && quic
```

## UDP 기반 신뢰성 구현 패턴

UDP를 쓰면서 일부 신뢰성이 필요하다면 애플리케이션 레벨에서 직접 구현한다.

```python
# 간단한 UDP 재전송 예시
import socket
import time

def send_with_retry(sock, data, addr, timeout=0.5, max_retries=3):
    for attempt in range(max_retries):
        sock.sendto(data, addr)
        sock.settimeout(timeout)
        try:
            response, _ = sock.recvfrom(1024)
            return response
        except socket.timeout:
            timeout *= 2  # 지수 백오프
    raise TimeoutError("Max retries exceeded")
```

온라인 게임에서는 보통:
- 위치 업데이트: 손실 허용 (최신 값이 계속 오므로)
- 중요 이벤트 (아이템 획득, 사망): 별도 ACK 구현

---

**지난 글:** [혼잡 제어 알고리즘 심층 비교: Reno, CUBIC, BBR](/posts/network-congestion-algorithms/)

**다음 글:** [DNS 이름 해석: 도메인이 IP로 변환되는 과정](/posts/network-dns-resolution/)

<br>
읽어주셔서 감사합니다. 😊
