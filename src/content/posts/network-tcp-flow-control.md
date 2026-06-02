---
title: "TCP 흐름 제어: 수신 윈도우와 슬라이딩 윈도우"
description: "TCP 흐름 제어의 핵심인 수신 윈도우(rwnd), Zero Window, Window Scale, Nagle 알고리즘, Silly Window Syndrome을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["TCP", "흐름제어", "rwnd", "ZeroWindow", "WindowScale", "Nagle", "SlillyWindow"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-sequence-ack/)에서 TCP 순서 번호와 ACK으로 신뢰성을 확보하는 원리를 살펴봤다. 신뢰성 다음 과제는 **속도 조절**이다. 빠른 송신자가 느린 수신자를 압도하지 않도록 TCP는 **흐름 제어(Flow Control)**를 제공한다.

## 흐름 제어란 무엇인가

흐름 제어는 **수신자가 처리할 수 있는 만큼만 보내도록 송신자를 제어**하는 메커니즘이다. 수신자의 처리 속도(애플리케이션이 버퍼에서 데이터를 읽는 속도)가 수신 가능량을 결정한다. 이는 네트워크 혼잡을 제어하는 **혼잡 제어**와 다른 개념이다.

```text
흐름 제어 vs 혼잡 제어
────────────────────────────────────────────
흐름 제어: 수신자 버퍼 보호
  주체: 수신자가 rwnd를 광고해 송신자를 제어
  목적: 수신 버퍼 오버플로우 방지

혼잡 제어: 네트워크 보호
  주체: 송신자가 cwnd를 자체 조절
  목적: 라우터/링크 혼잡 방지

실제 전송량 = min(rwnd, cwnd)
```

## 수신 윈도우(rwnd) 동작

수신자는 매 ACK마다 TCP 헤더의 Window Size 필드(16비트)에 **수신 버퍼의 여유 공간**을 담아 보낸다. 송신자는 이 값을 넘지 않는 범위에서만 데이터를 보낼 수 있다.

![수신 윈도우 동작](/assets/posts/network-tcp-flow-control-window.svg)

```text
수신 버퍼 상태와 rwnd
───────────────────────────────────────
총 버퍼 크기: 8000 bytes
현재 버퍼에 있는 데이터: 5000 bytes
rwnd = 8000 - 5000 = 3000 bytes 광고

애플리케이션이 3000 bytes 읽음 →
rwnd = 8000 - 2000 = 6000 bytes 광고
```

## Zero Window와 Window Probe

rwnd가 0이 되면 송신자는 전송을 완전히 멈춰야 한다. 하지만 수신자가 버퍼를 비워도 송신자가 모를 수 있다(ACK이 도착하지 않으면). 이를 해결하기 위해 송신자는 **Window Probe** 세그먼트(1바이트 데이터)를 주기적으로 보내 rwnd가 열렸는지 확인한다.

```bash
# Wireshark 필터로 Zero Window 탐지
# tcp.window_size_value == 0
# tcp.analysis.zero_window

# ss로 수신 버퍼 상태 확인
ss -tn -o
# Recv-Q: 수신 버퍼에 쌓인 데이터 (앱이 아직 안 읽음)
# Send-Q: 전송 버퍼에 쌓인 데이터 (ACK 미확인)
# Recv-Q가 크면 애플리케이션이 느리게 읽고 있음 → rwnd 작아짐
```

## Window Scale 옵션

TCP 헤더의 Window Size 필드는 16비트라 최대 65,535 bytes다. 고속 네트워크에서 이 크기가 병목이 된다. **Window Scale** 옵션(RFC 1323)은 3-way 핸드셰이크에서 협상해 실제 윈도우를 최대 **2³⁰ bytes(1GB)**까지 확장한다.

```text
Window Scale 협상
SYN: Win=65535, WS=8  → 실제 rwnd = 65535 × 2^8 = 16,776,960 bytes (약 16MB)
SYN+ACK: Win=65535, WS=6 → 실제 rwnd = 65535 × 2^6 = 4,194,240 bytes (약 4MB)

이후 모든 ACK의 Window 값에 Scale 계수 곱해서 해석
```

## Silly Window Syndrome과 Nagle 알고리즘

![Silly Window Syndrome](/assets/posts/network-tcp-flow-control-silly.svg)

Nagle 알고리즘은 작은 데이터를 묶어서 보내 오버헤드를 줄인다. 하지만 SSH 세션이나 게임처럼 빠른 응답이 필요한 경우 오히려 지연을 유발한다. `TCP_NODELAY`로 비활성화한다.

```python
import socket

# 서버 소켓 설정 예시
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

# 수신 버퍼 크기 설정 (rwnd에 반영됨)
server.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 131072)  # 128KB

# Nagle 비활성화 (실시간 앱)
server.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
```

## 버퍼 자동 튜닝

Linux는 `tcp_rmem`과 `tcp_wmem` 설정을 기반으로 실제 트래픽에 따라 버퍼를 자동 조절한다(Autotuning). 수동 설정보다 자동 튜닝이 대부분의 경우 더 나은 성능을 보인다.

```bash
# 수신/송신 버퍼 설정 (min default max, bytes)
sysctl net.ipv4.tcp_rmem
# 4096 131072 6291456  → 기본 128KB, 최대 6MB

# 자동 튜닝 활성화 (기본값 1)
sysctl net.ipv4.tcp_moderate_rcvbuf
```

---

**지난 글:** [TCP 순서 번호와 ACK: 신뢰성의 수학적 기반](/posts/network-tcp-sequence-ack/)

**다음 글:** [TCP 슬라이딩 윈도우: 파이프라인 전송의 원리](/posts/network-tcp-sliding-window/)

<br>
읽어주셔서 감사합니다. 😊
