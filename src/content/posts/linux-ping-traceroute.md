---
title: "ping·traceroute — 네트워크 연결성 진단"
description: "ICMP 기반 ping의 옵션과 출력 해석, TTL을 활용한 traceroute 동작 원리, UDP/ICMP/TCP 모드, mtr로 실시간 경로 분석하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "ping", "traceroute", "mtr", "icmp", "ttl", "network-debug", "path-mtu", "tracepath"]
featured: false
draft: false
---

[지난 글](/posts/linux-ip-addr-link-route/)에서 `ip` 명령어로 네트워크 인터페이스와 라우팅을 설정했습니다. 설정이 제대로 됐는지 확인할 때 가장 먼저 쓰는 도구가 **ping**과 **traceroute**입니다. ping은 "목적지에 패킷이 도달하는가"를 확인하고, traceroute는 "어떤 경로를 거쳐 가는가"를 보여줍니다.

## ping — ICMP Echo

`ping`은 ICMP Echo Request를 보내고 Echo Reply를 기다립니다. RTT(Round-Trip Time)로 네트워크 지연을 측정합니다.

```bash
# 기본 — Ctrl+C로 중단
ping 8.8.8.8

# 도메인 이름 (DNS 해석 확인 겸)
ping google.com

# 4번만 보내고 종료
ping -c 4 8.8.8.8

# 출력 예
# PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
# 64 bytes from 8.8.8.8: icmp_seq=1 ttl=116 time=12.3 ms
# 64 bytes from 8.8.8.8: icmp_seq=2 ttl=116 time=11.9 ms
# --- 8.8.8.8 ping statistics ---
# 4 packets transmitted, 4 received, 0% packet loss
```

### ping 출력 해석

| 필드 | 의미 |
|------|------|
| `icmp_seq` | 순서 번호 (빠진 번호 = 패킷 손실) |
| `ttl` | 남은 홉 수 (64에서 시작하면 인접, 128이면 Windows, 64/128/255가 기준) |
| `time` | RTT — 응답 시간 (ms) |
| `packet loss` | 손실률 > 0% 이면 네트워크 문제 |

### 주요 옵션

```bash
# 인터벌 0.2초로 빠르게
ping -i 0.2 8.8.8.8

# 패킷 크기 지정 (MTU 테스트)
ping -s 1472 8.8.8.8

# Don't Fragment 비트 + Path MTU Discovery
ping -s 1472 -M do 8.8.8.8
# → "Frag needed" 오류 시 MTU 문제 확인

# TTL 1로 지정 (첫 번째 홉만 테스트)
ping -t 1 8.8.8.8

# IPv6
ping6 ::1
ping -6 google.com
```

![ping · traceroute 핵심 옵션](/assets/posts/linux-ping-traceroute-options.svg)

## traceroute — 경로 추적

traceroute는 TTL을 1씩 증가시키며 패킷을 보냅니다. 각 라우터에서 TTL이 0이 되면 **ICMP Time Exceeded**를 반환해 해당 홉의 IP와 RTT를 알려줍니다.

```bash
# 설치 (없는 경우)
sudo apt install traceroute

# 기본 사용
traceroute 8.8.8.8
```

![traceroute TTL 기반 경로 추적](/assets/posts/linux-ping-traceroute-flow.svg)

### 프로토콜 선택

기본 traceroute는 UDP를 씁니다. 방화벽 설정에 따라 UDP가 차단되면 `*`만 표시됩니다.

```bash
# ICMP 모드 (방화벽 통과 잘 됨)
sudo traceroute -I 8.8.8.8

# TCP 모드 (포트 80/443로, 가장 잘 통과)
sudo traceroute -T -p 80 8.8.8.8

# 최대 홉 수 제한
traceroute -m 15 8.8.8.8

# DNS 해석 없이 IP만 (빠름)
traceroute -n 8.8.8.8
```

### traceroute 출력 해석

각 줄은 `홉번호  IP주소  RTT1 RTT2 RTT3`입니다. `*`은 해당 홉이 ICMP를 반환하지 않는 것을 의미하며, 목적지에 도달 가능해도 경유지가 `*`일 수 있습니다.

## tracepath — 간단한 대안

`tracepath`는 sudo 없이 실행되며 Path MTU Discovery도 함께 수행합니다.

```bash
tracepath 8.8.8.8
# Resume: pmtu 1500 hops 17 back 60
```

## mtr — ping + traceroute 통합

`mtr`은 실시간으로 경로를 반복 측정해 각 홉의 패킷 손실률과 RTT 통계를 보여줍니다.

```bash
# 설치
sudo apt install mtr

# 대화형 실시간 뷰
mtr 8.8.8.8

# 보고서 출력 (10회 측정 후 종료)
mtr --report -c 10 8.8.8.8

# TCP 모드 443 포트
mtr -n --tcp -P 443 8.8.8.8
```

`mtr`의 `Loss%` 컬럼에서 중간 홉은 `*`이더라도 이후 홉이 응답하면 단순 필터링입니다. 마지막 홉(목적지)의 손실률이 실제 네트워크 손실입니다.

## 방화벽 환경에서의 진단

```bash
# ICMP 완전 차단 환경 (ping 응답 없음)
# → curl/wget으로 HTTP 확인
curl -sv --max-time 5 http://8.8.8.8

# DNS 해석 먼저 확인
dig google.com +short

# 특정 포트 도달 여부
nc -zv 8.8.8.8 443
```

## 정리

`ping`은 연결성 확인과 RTT 측정에 씁니다. `-s`와 `-M do`로 MTU 문제를 진단하는 것도 중요합니다. `traceroute -T`는 방화벽이 많은 환경에서 TCP 모드가 가장 신뢰할 수 있습니다. 지속적인 경로 모니터링에는 `mtr`이 최선입니다.

---

**지난 글:** [ip addr·link·route — 현대 리눅스 네트워크 설정](/posts/linux-ip-addr-link-route/)

**다음 글:** [netstat·ss — 소켓과 연결 상태 분석](/posts/linux-netstat-ss/)

<br>
읽어주셔서 감사합니다. 😊
