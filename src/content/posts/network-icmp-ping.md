---
title: "ICMP와 ping: 네트워크 진단의 기본 도구"
description: "ICMP 메시지 구조, 주요 타입(Echo Request·Time Exceeded·Unreachable), ping 옵션, traceroute 원리를 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["ICMP", "ping", "traceroute", "네트워크진단", "TimeExceeded", "Unreachable"]
featured: false
draft: false
---

[지난 글](/posts/network-nat/)에서 NAT이 사설 IP를 공인 IP로 변환하는 방법을 살펴봤다. 이번 글에서는 네트워크 진단의 기본 도구인 **ICMP(Internet Control Message Protocol)**와 그것을 활용한 **ping**, **traceroute**를 다룬다.

## ICMP란?

ICMP는 **IP 계층의 오류 보고 및 진단 프로토콜**이다. TCP·UDP처럼 데이터를 전송하는 프로토콜이 아니라, 네트워크 상태를 알리고 연결 가능성을 테스트하는 데 사용된다. IP 프로토콜 번호 1번이며 IP 패킷의 페이로드에 담긴다.

IPv6에서는 ICMPv6(RFC 4443)로 확장되어 NDP(Neighbor Discovery), MLD(멀티캐스트) 등 추가 기능을 포함한다.

## ICMP 구조와 주요 타입

![ICMP 메시지 구조](/assets/posts/network-icmp-ping-structure.svg)

`Type 3: Destination Unreachable`의 Code 필드 주요 값:

| Code | 의미 |
|------|------|
| 0 | Network Unreachable |
| 1 | Host Unreachable |
| 3 | Port Unreachable |
| 4 | Fragmentation Needed (DF set) |

Code 4는 PMTUD(Path MTU Discovery)에서 중요하게 활용된다. DF 비트가 설정된 패킷이 너무 크면 라우터가 이 메시지를 보내 적절한 MTU를 알려준다.

## ping 사용법

ping은 ICMP Echo Request(Type 8)를 보내고 Echo Reply(Type 0)를 기다린다. 수신 지연 시간(RTT)으로 연결 품질을 파악한다.

```bash
# 기본 ping
ping 8.8.8.8

# 횟수 지정
ping -c 5 google.com

# 패킷 크기 지정 (MTU 테스트)
ping -s 1400 8.8.8.8

# DF 비트 설정 (PMTUD 수동 테스트)
ping -M do -s 1472 8.8.8.8

# flood ping (root 권한, 부하 테스트)
ping -f -c 1000 192.168.1.1

# ping 결과 해석
# 64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=14.2 ms
# ttl=118: 목적지가 TTL=128로 시작, 10홉 경유 (128-10=118)
```

## traceroute 원리

![traceroute TTL 기반 경로 발견](/assets/posts/network-icmp-ping-traceroute.svg)

traceroute는 **TTL을 1부터 하나씩 증가**시키며 패킷을 보낸다. 각 라우터는 TTL이 0이 되면 **ICMP Time Exceeded(Type 11)**를 출발지에게 보내고, 이 응답의 출발지 IP가 해당 홉의 라우터 주소가 된다.

```bash
# traceroute (Linux)
traceroute 8.8.8.8

# UDP 대신 ICMP Echo 사용 (-I 옵션)
traceroute -I 8.8.8.8

# 홉 수 제한
traceroute -m 20 8.8.8.8

# Windows
tracert 8.8.8.8

# 출력 예시:
#  1  192.168.1.1    0.5 ms
#  2  10.0.0.1       5.2 ms
#  3  203.0.113.1   14.1 ms
#  4  8.8.8.8        14.9 ms
# * * *  ← 해당 홉에서 응답 없음 (방화벽)
```

`* * *`은 해당 라우터가 ICMP를 차단하거나 응답하지 않는 경우다. 다음 홉이 응답한다면 중간에 ICMP를 막은 것뿐 실제 연결은 정상일 수 있다.

## mtr: traceroute + 실시간 통계

```bash
# mtr 설치 및 실행
apt install mtr

# 대화형 실시간 통계
mtr 8.8.8.8

# 보고서 형식 출력
mtr --report --report-cycles 10 8.8.8.8
```

mtr은 각 홉별 패킷 손실률과 RTT 분포를 실시간으로 보여줘 간헐적 네트워크 장애 진단에 유용하다.

## ICMP와 방화벽

방화벽에서 ICMP를 전부 차단하면 ping과 traceroute가 작동하지 않는다. 하지만 다음 타입은 차단하면 안 된다:

- **Type 3 Code 4**: Fragmentation Needed — 차단 시 PMTUD 실패, HTTPS 연결 불안정
- **Type 11**: Time Exceeded — 차단 시 traceroute 불가
- **Type 0/8**: Echo Reply/Request — 선택적으로 허용 가능

```bash
# iptables에서 필수 ICMP 허용 (최소 권장)
iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT
iptables -A INPUT -p icmp --icmp-type echo-reply -j ACCEPT
iptables -A INPUT -p icmp --icmp-type time-exceeded -j ACCEPT
iptables -A INPUT -p icmp --icmp-type destination-unreachable -j ACCEPT
```

---

**지난 글:** [NAT: 네트워크 주소 변환의 모든 것](/posts/network-nat/)

**다음 글:** [DHCP: 동적 IP 주소 할당의 원리](/posts/network-dhcp/)

<br>
읽어주셔서 감사합니다. 😊
