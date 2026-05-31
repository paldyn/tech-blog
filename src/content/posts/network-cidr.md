---
title: "CIDR과 주소 집약: IP 주소 공간을 효율적으로 관리하기"
description: "클래스 없는 도메인 간 라우팅 CIDR의 표기법, 프리픽스 길이 계산, 슈퍼네팅과 라우트 집약으로 라우팅 테이블을 최적화하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["CIDR", "라우트집약", "슈퍼네팅", "프리픽스", "IP주소관리", "BGP"]
featured: false
draft: false
---

[지난 글](/posts/network-subnetting/)에서 IP 주소를 작은 서브넷으로 나누는 서브네팅을 다뤘다. 이번에는 반대 방향, 즉 여러 네트워크를 **하나의 큰 프리픽스로 합치는** CIDR과 라우트 집약(Route Aggregation)을 살펴본다. 이 기술이 없었다면 인터넷 라우팅 테이블은 수억 개의 항목으로 폭발했을 것이다.

## 클래스 주소 체계의 한계

1993년 이전의 인터넷은 **클래스 기반(Classful) 주소**를 사용했다.

```
클래스 A: 1.0.0.0 ~ 126.255.255.255  (최대 1677만 호스트)
클래스 B: 128.0.0.0 ~ 191.255.255.255 (최대 65534 호스트)
클래스 C: 192.0.0.0 ~ 223.255.255.255 (최대 254 호스트)

문제: 중간 크기 조직에 클래스 B 할당 → 65534개 중 수천 개만 사용 → 낭비
문제: 클래스 C는 너무 작아 여러 블록 필요 → 라우팅 테이블 폭발
```

## CIDR 표기법

CIDR(Classless Inter-Domain Routing, RFC 1519)은 클래스 경계를 없애고 **프리픽스 길이(/n)**로 네트워크를 표현한다.

![CIDR 표기법](/assets/posts/network-cidr-notation.svg)

```python
import ipaddress

def cidr_info(network: str) -> dict:
    """CIDR 네트워크 정보 계산"""
    net = ipaddress.IPv4Network(network, strict=False)
    return {
        "network_address": str(net.network_address),
        "broadcast_address": str(net.broadcast_address),
        "subnet_mask": str(net.netmask),
        "prefix_length": net.prefixlen,
        "num_hosts": net.num_addresses - 2,
        "first_host": str(list(net.hosts())[0]) if net.num_addresses > 2 else "N/A",
        "last_host": str(list(net.hosts())[-1]) if net.num_addresses > 2 else "N/A",
    }

# 예시
for cidr in ["10.0.0.0/8", "172.16.0.0/12", "192.168.1.0/24", "192.168.1.128/25"]:
    info = cidr_info(cidr)
    print(f"{cidr:22s} | 호스트: {info['num_hosts']:8,d} | 마스크: {info['subnet_mask']}")

# 출력:
# 10.0.0.0/8             | 호스트: 16,777,214 | 마스크: 255.0.0.0
# 172.16.0.0/12          | 호스트:  1,048,574 | 마스크: 255.240.0.0
# 192.168.1.0/24         | 호스트:        254 | 마스크: 255.255.255.0
# 192.168.1.128/25       | 호스트:        126 | 마스크: 255.255.255.128
```

## 라우트 집약 (Route Aggregation)

여러 연속된 네트워크를 하나의 더 큰 프리픽스로 합치는 기술이다. BGP에서 인터넷 라우팅 테이블 크기를 줄이는 핵심 기법이다.

![라우트 집약](/assets/posts/network-cidr-aggregation.svg)

```python
import ipaddress
from typing import list

def find_supernet(networks: list[str]) -> str | None:
    """연속된 네트워크의 최소 슈퍼넷 찾기"""
    nets = [ipaddress.IPv4Network(n, strict=True) for n in networks]

    # 프리픽스 길이 통일 여부 확인
    if len(set(n.prefixlen for n in nets)) != 1:
        return None

    # 슈퍼넷 탐색
    current = nets[0]
    for net in nets[1:]:
        current = current.supernet()
        while not all(current.supernet_of(n) or n == current for n in nets):
            current = current.supernet()
            if current.prefixlen == 0:
                return "0.0.0.0/0"

    # 모든 네트워크가 슈퍼넷 안에 있는지 확인
    if all(current.supernet_of(n) or n == current for n in nets):
        return str(current)
    return None

# 4개 /24를 /22로 집약
result = find_supernet([
    "192.168.0.0/24",
    "192.168.1.0/24",
    "192.168.2.0/24",
    "192.168.3.0/24",
])
print(f"집약 결과: {result}")  # 192.168.0.0/22

# ipaddress 내장 collapse
networks = [
    ipaddress.IPv4Network("10.0.0.0/24"),
    ipaddress.IPv4Network("10.0.1.0/24"),
    ipaddress.IPv4Network("10.0.2.0/24"),
    ipaddress.IPv4Network("10.0.3.0/24"),
]
collapsed = list(ipaddress.collapse_addresses(networks))
print(f"자동 집약: {collapsed}")  # [IPv4Network('10.0.0.0/22')]
```

## 집약 가능 여부 수동 확인

두 /24가 /23으로 집약 가능한지 확인하는 규칙은 단순하다.

```
규칙: 두 네트워크의 주소가 2^(32-n) 단위로 정렬되어 있어야 함

예시: 192.168.0.0/24 + 192.168.1.0/24 → 192.168.0.0/23?
이진: 11000000.10101000.00000000.x
     11000000.10101000.00000001.x
공통 23비트: 11000000.10101000.0000000
→ 192.168.0.0/23 (가능!)

예시: 192.168.1.0/24 + 192.168.2.0/24 → /23?
이진: 11000000.10101000.00000001.x
     11000000.10101000.00000010.x
공통? 22비트까지만: 11000000.10101000.000000
→ 192.168.0.0/22 (하지만 192.168.0.0/24와 192.168.3.0/24도 포함됨)
→ 올바른 집약 불가 (두 네트워크만으로는 /23 경계 불일치)
```

```python
def can_aggregate_to(nets: list[str], target_prefix: int) -> bool:
    """주어진 네트워크들이 target_prefix로 집약 가능한지 확인"""
    networks = [ipaddress.IPv4Network(n) for n in nets]
    # 모두 같은 프리픽스 길이인지 확인
    if len(set(n.prefixlen for n in networks)) != 1:
        return False
    current_prefix = networks[0].prefixlen
    if target_prefix >= current_prefix:
        return False

    expected_count = 2 ** (current_prefix - target_prefix)
    if len(networks) != expected_count:
        return False

    # 첫 번째 네트워크가 target_prefix 경계에 정렬되는지 확인
    first_ip = int(networks[0].network_address)
    block_size = 2 ** (32 - target_prefix)
    return first_ip % block_size == 0

print(can_aggregate_to(["192.168.0.0/24", "192.168.1.0/24"], 23))  # True
print(can_aggregate_to(["192.168.1.0/24", "192.168.2.0/24"], 23))  # False
```

## CIDR과 BGP

인터넷 라우팅 프로토콜인 BGP는 CIDR을 기반으로 동작한다. ISP는 고객에게 할당한 주소 블록을 집약해서 인터넷에 광고한다.

```
AS65001이 보유한 주소:
  192.0.2.0/24
  192.0.3.0/24
  192.0.4.0/24
  192.0.5.0/24
  192.0.6.0/24
  192.0.7.0/24

BGP 광고 (집약 후):
  192.0.2.0/23  (2+3)
  192.0.4.0/22  (4+5+6+7)

→ 6개 라우팅 항목 → 2개로 감소
→ 전체 인터넷 라우팅 테이블 크기 절감
```

```bash
# BGP에서 집약 광고 설정 (Cisco)
router bgp 65001
 network 192.0.2.0 mask 255.255.254.0   # /23
 aggregate-address 192.0.4.0 255.255.252.0 summary-only  # /22
```

## 사설 IP 주소 범위 (RFC 1918)

```python
PRIVATE_RANGES = [
    ipaddress.IPv4Network("10.0.0.0/8"),       # 클래스 A 대체
    ipaddress.IPv4Network("172.16.0.0/12"),    # 172.16~172.31
    ipaddress.IPv4Network("192.168.0.0/16"),   # 클래스 C 대체
]

def is_private(ip: str) -> bool:
    addr = ipaddress.IPv4Address(ip)
    return any(addr in net for net in PRIVATE_RANGES)

print(is_private("10.1.2.3"))       # True
print(is_private("172.20.0.1"))     # True
print(is_private("203.0.113.1"))    # False (인터넷 라우팅 가능)
```

## 정리

CIDR은 클래스 기반 주소 체계의 낭비와 라우팅 테이블 폭발을 해결했다. `/n` 표기법으로 어떤 크기든 네트워크를 표현할 수 있고, 라우트 집약으로 작은 네트워크들을 하나로 묶어 광고 효율을 높인다. 오늘날 모든 IP 주소 할당과 라우팅은 CIDR 기반이다.

---

**지난 글:** [서브네팅 완전 이해](/posts/network-subnetting/)

**다음 글:** [IP 단편화와 재조립](/posts/network-ip-fragmentation/)

<br>
읽어주셔서 감사합니다. 😊
