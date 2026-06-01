---
title: "라우팅 테이블과 LPM: 최장 프리픽스 매칭"
description: "라우팅 테이블 구조, 최장 프리픽스 매칭(LPM) 알고리즘, Patricia Trie 자료구조, ECMP를 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["라우팅테이블", "LPM", "최장프리픽스매칭", "PatriciaTrie", "ECMP", "FIB"]
featured: false
draft: false
---

[지난 글](/posts/network-routing-basics/)에서 라우팅의 기초와 정적·동적 라우팅의 차이를 살펴봤다. 이번 글에서는 라우터가 패킷의 목적지 주소를 라우팅 테이블과 어떻게 비교하는지, **최장 프리픽스 매칭(LPM)** 알고리즘을 깊이 다룬다.

## 왜 최장 프리픽스 매칭인가?

라우팅 테이블에는 같은 목적지를 포함하는 여러 경로가 겹칠 수 있다.

```text
192.168.0.0/16   → via A   (65536개 주소 포함)
192.168.10.0/24  → via B   (256개 주소 포함)
192.168.10.0/25  → via C   (128개 주소 포함)
```

`192.168.10.50`으로 향하는 패킷은 세 항목 모두에 해당한다. 이때 **가장 긴(구체적인) 프리픽스**를 우선 적용하는 규칙이 LPM이다. `/25 > /24 > /16`이므로 via C가 선택된다.

## LPM 동작 예시

![최장 프리픽스 매칭 동작](/assets/posts/network-routing-table-lpm-lookup.svg)

LPM을 비트 수준에서 보면:
- `192.168.10.50` = `11000000.10101000.00001010.00110010`
- `/24` 매칭: 처음 24비트 `11000000.10101000.00001010`가 일치하는지 확인
- `/16` 매칭: 처음 16비트 `11000000.10101000`이 일치하는지 확인

더 긴 프리픽스가 더 구체적인 경로를 의미하므로, 항상 가장 긴 매칭을 선택한다.

## 라우팅 테이블 자료구조: Patricia Trie

![Patricia Trie 구조](/assets/posts/network-routing-table-lpm-trie.svg)

실제 라우터 하드웨어와 OS 커널은 LPM을 **Patricia Trie**(또는 Radix Trie)로 구현한다. IP 주소 비트를 분기 조건으로 트리를 탐색한다.

- 탐색 시간 복잡도: **O(W)** — W는 주소 길이(IPv4=32, IPv6=128)
- 항목 수에 무관하게 최대 32(또는 128)번 비교로 결정
- 고속 라우터는 TCAM(Ternary Content Addressable Memory) 하드웨어로 1클록 내 탐색

```python
# Python으로 간단한 LPM 구현
import ipaddress

routing_table = [
    ("0.0.0.0/0",       "default-gw"),
    ("192.168.0.0/16",  "via-A"),
    ("192.168.10.0/24", "via-B"),
    ("10.0.0.0/8",      "via-C"),
]

def lpm(dst_ip: str) -> str:
    addr = ipaddress.ip_address(dst_ip)
    best = None
    best_plen = -1
    for prefix_str, nexthop in routing_table:
        net = ipaddress.ip_network(prefix_str)
        if addr in net and net.prefixlen > best_plen:
            best_plen = net.prefixlen
            best = nexthop
    return best or "drop"

print(lpm("192.168.10.50"))  # → via-B
print(lpm("192.168.20.1"))   # → via-A
print(lpm("8.8.8.8"))        # → default-gw
```

## RIB vs FIB

라우팅 정보는 두 개의 테이블로 분리된다:

| 구분 | 이름 | 역할 |
|------|------|------|
| **RIB** | Routing Information Base | 라우팅 프로토콜이 학습한 모든 경로 저장 |
| **FIB** | Forwarding Information Base | LPM 결과 최적 경로만 저장, 실제 패킷 포워딩에 사용 |

라우터는 OSPF·BGP 등이 수집한 경로를 RIB에 저장하고, 최적 경로만 FIB(커널의 라우팅 테이블)에 설치한다.

```bash
# Linux에서 FIB 확인
ip route show table main

# RIB(모든 경로) 확인 - FRRouting 기준
vtysh -c "show ip route"

# BGP로 수신한 경로
vtysh -c "show bgp ipv4 unicast"
```

## ECMP (Equal-Cost Multi-Path)

같은 목적지에 **동일 메트릭**의 경로가 여러 개 있을 때, ECMP는 이를 동시에 사용해 부하를 분산한다.

```bash
# 동일 비용 경로 2개 설정
ip route add 10.1.0.0/24 nexthop via 192.168.1.1 weight 1 \
                          nexthop via 192.168.2.1 weight 1

# 흐름 기반 해싱으로 같은 연결은 항상 같은 경로로 (세션 일관성)
```

Linux 커널은 기본적으로 5-tuple(src IP, dst IP, protocol, src port, dst port) 해싱으로 ECMP 경로를 선택해 TCP 세션이 중간에 경로를 바꾸지 않도록 한다.

---

**지난 글:** [라우팅 기초: 패킷이 목적지를 찾아가는 방법](/posts/network-routing-basics/)

**다음 글:** [BGP: 인터넷을 연결하는 경계 게이트웨이 프로토콜](/posts/network-bgp/)

<br>
읽어주셔서 감사합니다. 😊
