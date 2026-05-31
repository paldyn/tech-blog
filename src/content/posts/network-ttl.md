---
title: "TTL: 패킷의 유효 기간과 traceroute의 원리"
description: "IPv4 TTL 필드가 라우팅 루프를 방지하는 방법, ICMP Time Exceeded를 이용한 traceroute 동작 원리, OS별 기본 TTL값과 TTL fingerprinting을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["TTL", "traceroute", "ICMP", "라우팅루프", "네트워크진단", "TTL fingerprinting"]
featured: false
draft: false
---

[지난 글](/posts/network-ip-fragmentation/)에서 MTU를 초과한 패킷이 단편화되는 과정을 살펴봤다. 이번 글에서는 IPv4 헤더의 또 다른 중요한 필드인 **TTL(Time To Live)**을 다룬다. TTL은 패킷이 무한히 순환하지 못하도록 막는 안전장치이며, 동시에 `traceroute`라는 강력한 진단 도구의 근간이 된다.

## TTL의 역할

라우터는 패킷을 수신할 때 TTL 값을 1 감소시킨다. TTL이 0이 되면 패킷을 **즉시 폐기**하고 발신자에게 **ICMP Time Exceeded(Type 11, Code 0)** 메시지를 보낸다.

![TTL 동작 원리](/assets/posts/network-ttl-concept.svg)

이 메커니즘이 필요한 이유는 라우팅 루프 때문이다. 라우팅 테이블 오류로 패킷이 A→B→C→A 루프에 빠지면 영원히 순환할 수 있다. TTL은 최대 홉 수를 제한해 이를 방지한다.

```python
import socket
import struct
from dataclasses import dataclass
from typing import Optional

@dataclass
class ICMPTimeExceeded:
    src_ip: str
    ttl_at_reception: int
    original_ip_header: bytes
    original_icmp_header: bytes

def parse_icmp_time_exceeded(raw_packet: bytes) -> Optional[ICMPTimeExceeded]:
    """ICMP Time Exceeded 패킷 파싱"""
    # IP 헤더 길이 파악 (IHL 필드)
    ihl = (raw_packet[0] & 0x0F) * 4
    ip_header = raw_packet[:ihl]

    # TTL과 출발지 IP 추출
    ttl = raw_packet[8]
    src_ip = socket.inet_ntoa(raw_packet[12:16])

    # ICMP 헤더
    icmp = raw_packet[ihl:]
    icmp_type = icmp[0]
    icmp_code = icmp[1]

    if icmp_type != 11 or icmp_code != 0:
        return None  # Time Exceeded가 아님

    # 원본 IP + ICMP 헤더 (오프셋 8바이트 후)
    orig_ip = icmp[8:28]
    orig_icmp = icmp[28:36]

    return ICMPTimeExceeded(src_ip, ttl, orig_ip, orig_icmp)
```

## OS별 기본 TTL값

ping 응답의 TTL을 보면 상대방 OS를 추측할 수 있다. 이를 **TTL fingerprinting**이라 한다.

```bash
# ping 응답 TTL 확인
ping -c 1 8.8.8.8
# 64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=23.8 ms
# TTL=118 → 원래 128에서 10홉 감소 → Windows 서버로 추정

ping -c 1 1.1.1.1
# ttl=55 → 원래 64에서 9홉 감소 → Linux 서버로 추정
```

```python
OS_TTL_FINGERPRINT = {
    (56, 64):   "Linux/macOS",      # 기본 64, 56은 8홉 후
    (113, 128): "Windows",          # 기본 128
    (245, 255): "Cisco IOS/FreeBSD", # 기본 255
}

def guess_os(received_ttl: int) -> str:
    """수신된 TTL값으로 OS 추측"""
    # 원래 TTL은 보통 64, 128, 255 중 하나
    for initial_ttl in [64, 128, 255]:
        if 0 < initial_ttl - received_ttl <= 50:
            hops = initial_ttl - received_ttl
            if initial_ttl == 64:
                return f"Linux/macOS (초기={initial_ttl}, 홉={hops})"
            elif initial_ttl == 128:
                return f"Windows (초기={initial_ttl}, 홉={hops})"
            else:
                return f"Cisco/FreeBSD (초기={initial_ttl}, 홉={hops})"
    return "알 수 없음"

print(guess_os(118))  # Windows (초기=128, 홉=10)
print(guess_os(55))   # Linux/macOS (초기=64, 홉=9)
print(guess_os(250))  # Cisco/FreeBSD (초기=255, 홉=5)
```

## Traceroute 원리

traceroute는 TTL을 1부터 시작해 1씩 증가시키면서 각 홉의 IP 주소와 RTT를 수집한다.

![Traceroute 동작](/assets/posts/network-ttl-traceroute.svg)

```python
import socket
import time
import struct

def simple_traceroute(target: str, max_hops: int = 30) -> None:
    """단순 UDP 기반 traceroute 구현"""
    dst_ip = socket.gethostbyname(target)
    print(f"traceroute to {target} ({dst_ip}), {max_hops} hops max\n")

    recv_sock = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_ICMP)
    recv_sock.settimeout(3.0)

    for ttl in range(1, max_hops + 1):
        # UDP 소켓: TTL 설정
        send_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        send_sock.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, ttl)
        send_sock.settimeout(3.0)

        rtts = []
        hop_ip = "*"

        for probe in range(3):  # 3회 측정
            # 목적지 UDP 포트 33434~33434+n (traceroute 관례)
            port = 33434 + ttl * 3 + probe
            t_send = time.perf_counter()
            send_sock.sendto(b'\x00' * 40, (dst_ip, port))

            try:
                data, addr = recv_sock.recvfrom(1024)
                t_recv = time.perf_counter()
                hop_ip = addr[0]
                rtts.append((t_recv - t_send) * 1000)
            except socket.timeout:
                rtts.append(None)

        send_sock.close()

        # 결과 출력
        rtt_str = "  ".join(
            f"{r:.1f} ms" if r else "*" for r in rtts
        )
        try:
            hostname = socket.gethostbyaddr(hop_ip)[0]
        except Exception:
            hostname = hop_ip

        print(f"{ttl:3d}  {hop_ip:16s} ({hostname[:30]:30s}) {rtt_str}")

        if hop_ip == dst_ip:
            print("\n도달!")
            break

    recv_sock.close()
```

## traceroute vs tracepath

```bash
# traceroute (Linux): UDP 기반, root 필요
traceroute -n 8.8.8.8

# tracepath: PMTUD까지 동시 측정, root 불필요
tracepath -n 8.8.8.8
# 출력에 각 홉의 MTU도 표시

# Windows: ICMP 기반 (tracert)
tracert 8.8.8.8

# mtr: 실시간 갱신, 통계 포함
mtr --report-cycles 20 -n 8.8.8.8
# 홉별 패킷 손실률, 평균 RTT, 지터 표시

# hops 제한
traceroute -m 15 -n 8.8.8.8  # 최대 15홉
```

## TTL 관련 보안 이슈

```
TTL 기반 공격 방어:
1. TTL < 1로 조작된 패킷 → 방화벽/IDS에서 차단
2. 비정상 TTL (예: 255) → 실제 홉 수 은폐 시도

방화벽 TTL 필터:
iptables -A INPUT -m ttl --ttl-lt 5 -j DROP
# → TTL이 5 미만인 패킷 차단 (스캐너 방지)

traceroute 차단 (방화벽 정책):
# 일부 방화벽이 ICMP Time Exceeded 응답을 차단
# → traceroute에서 해당 홉이 * * * 로 표시
# → PMTUD 블랙홀의 원인이 되기도 함

traceroute 결과에서 * * * 의미:
1. 방화벽이 ICMP 응답 차단
2. 패킷 손실
3. 홉이 ICMP 생성 시간 초과
```

## IPv6에서의 Hop Limit

IPv6는 TTL을 **Hop Limit**으로 이름을 바꿨지만 동작은 동일하다.

```bash
# IPv6 traceroute
traceroute6 2001:4860:4860::8888

# IPv6 ping의 hop limit 확인
ping6 -c 3 2001:4860:4860::8888
# 64 bytes from 2001:4860:4860::8888: icmp_seq=0 hlim=120 time=24.1 ms
```

## TTL 조작 활용 사례

```python
# 특정 홉까지만 패킷 전달 (멀티캐스트 범위 제한)
# TTL 1: 같은 서브넷만
# TTL 15: 사이트 내부만
# TTL 63: 지역 범위
# TTL 127: 국가 범위

# Scapy를 이용한 TTL 조작 예시
# from scapy.all import IP, ICMP, send
# pkt = IP(dst="8.8.8.8", ttl=3) / ICMP()
# send(pkt)
# → 3홉 후 ICMP Time Exceeded 반환

# 소켓 레벨 TTL 설정
sock = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_ICMP)
sock.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, 64)  # TTL = 64
```

## 정리

TTL은 IPv4 헤더의 단순한 8비트 카운터지만, 라우팅 루프 방지와 네트워크 진단 도구 traceroute의 핵심 메커니즘을 제공한다. 수신된 TTL 값으로 상대방 OS를 추측할 수 있고(TTL fingerprinting), TTL이 0이 될 때 발생하는 ICMP Time Exceeded를 역이용해 각 라우터 홉을 식별하는 것이 traceroute의 원리다. 방화벽 설정 시 ICMP 응답 차단은 PMTUD 블랙홀을 유발할 수 있으므로 주의해야 한다.

---

**지난 글:** [IP 단편화와 재조립](/posts/network-ip-fragmentation/)

<br>
읽어주셔서 감사합니다. 😊
