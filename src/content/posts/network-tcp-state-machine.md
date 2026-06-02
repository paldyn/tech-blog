---
title: "TCP 상태 머신: 11가지 상태와 전이 완전 해부"
description: "TCP의 11가지 상태(LISTEN·SYN_SENT·ESTABLISHED·FIN_WAIT·TIME_WAIT 등)와 각 전이 조건, 실전 트러블슈팅 방법을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["TCP", "상태머신", "ESTABLISHED", "TIME_WAIT", "CLOSE_WAIT", "FIN_WAIT", "LISTEN", "ss"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-connection-termination/)에서 TCP 연결 종료 과정과 TIME_WAIT을 살펴봤다. 실제 서버 운영에서 TCP 문제를 진단하려면 **상태 머신** 전체를 이해해야 한다. 소켓이 어느 상태에 있는지를 알면 어느 단계에서 막혔는지 즉시 파악할 수 있다.

## TCP 상태 전이 다이어그램

![TCP 상태 머신](/assets/posts/network-tcp-state-machine-diagram.svg)

TCP 연결은 총 11개 상태를 가진다. 그 중 핵심 상태는 다음 세 그룹으로 나눌 수 있다.

- **연결 수립**: CLOSED → LISTEN → SYN_RCVD → ESTABLISHED (서버) / CLOSED → SYN_SENT → ESTABLISHED (클라이언트)
- **데이터 전송**: ESTABLISHED
- **연결 종료**: FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT → CLOSED (Active Close) / CLOSE_WAIT → LAST_ACK → CLOSED (Passive Close)

## 각 상태의 의미

![TCP 상태별 의미 요약](/assets/posts/network-tcp-state-machine-table.svg)

```bash
# ss 명령으로 상태별 소켓 수 확인
ss -tan | awk '{print $1}' | sort | uniq -c | sort -rn

# 출력 예시
# 1423 ESTABLISHED
#  234 TIME-WAIT
#   18 LISTEN
#    3 CLOSE-WAIT   ← 애플리케이션 버그 의심
#    1 FIN-WAIT-2
```

## CLOSE_WAIT 과다: 애플리케이션 버그 신호

`CLOSE_WAIT`은 상대방이 FIN을 보냈지만 내 쪽 애플리케이션이 `close()`를 호출하지 않은 상태다. 정상이라면 매우 짧게 존재하고 사라져야 한다. 수십~수백 개가 쌓여 있다면 **소켓 리소스 누수**를 의심해야 한다.

```python
# Python 예: CLOSE_WAIT 누수 원인
import socket

sock = socket.socket()
sock.connect(('server', 80))
# 서버가 FIN을 보냈는데 sock.close()를 안 부르면
# 이 프로세스가 살아있는 동안 CLOSE_WAIT 지속
# 해결: with 문 사용 또는 finally 블록에서 명시적 close()

# 올바른 패턴
with socket.socket() as sock:
    sock.connect(('server', 80))
    sock.sendall(b'GET / HTTP/1.0\r\n\r\n')
    data = sock.recv(1024)
# with 블록 종료 시 자동 close() 호출
```

## FIN_WAIT_2 고착

`FIN_WAIT_2`는 Active Close 측이 ACK를 수신했지만 상대방의 FIN을 아직 받지 못한 상태다. Passive Close 측이 `close()`를 호출하지 않으면 영구적으로 머문다. Linux는 `tcp_fin_timeout`(기본 60초) 후에 이 상태에서 강제 종료한다.

```bash
# FIN_WAIT_2 타임아웃 조회/설정
cat /proc/sys/net/ipv4/tcp_fin_timeout
# 60 (기본값, 초)

# 줄이고 싶다면
sysctl -w net.ipv4.tcp_fin_timeout=30
```

## 동시 열기와 동시 닫기

이론상 양쪽이 동시에 SYN을 보내는 **동시 열기(Simultaneous Open)** 도 가능하다. 이 경우 `SYN_SENT` 상태에서 상대방의 SYN을 수신하면 `SYN_RCVD`로 전이하고 4-way가 아닌 특수 경로로 ESTABLISHED에 도달한다. 마찬가지로 양쪽이 동시에 FIN을 보내는 **동시 닫기(Simultaneous Close)** 도 있는데, 둘 다 `FIN_WAIT_1`에서 상대방 FIN을 받아 `CLOSING` 상태를 거쳐 `TIME_WAIT`으로 전이한다.

```text
동시 닫기 경로 (드물지만 존재)
A: FIN_WAIT_1 --[FIN 수신]--> CLOSING --[ACK 수신]--> TIME_WAIT
B: FIN_WAIT_1 --[FIN 수신]--> CLOSING --[ACK 수신]--> TIME_WAIT
```

## 실전 트러블슈팅 흐름

```bash
# 1. 전체 상태 분포 확인
ss -s

# 2. 특정 상태 상세 조회
ss -tnp state close-wait
# CLOSE-WAIT이 많다 → 어느 프로세스인지 PID 확인

# 3. 특정 포트 상태 추적
watch -n 1 'ss -tn "( dport = :443 or sport = :443 )"'

# 4. 연결 수립 실패 (SYN_SENT에서 멈춤)
#    → 방화벽 차단 또는 서버 LISTEN 상태 아님
ss -tn state syn-sent
```

---

**지난 글:** [TCP 연결 종료: 4-way 핸드셰이크와 Half-close](/posts/network-tcp-connection-termination/)

**다음 글:** [TCP TIME_WAIT 완전 정복: 왜 생기고 어떻게 다루는가](/posts/network-tcp-time-wait/)

<br>
읽어주셔서 감사합니다. 😊
