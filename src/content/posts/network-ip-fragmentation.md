---
title: "IP 단편화와 재조립: MTU를 넘는 패킷의 운명"
description: "IPv4 단편화 과정, IP 헤더의 단편화 관련 필드(Identification·DF·MF·Offset), PMTUD 동작 원리와 IPv6 차이점을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["IP단편화", "MTU", "PMTUD", "DF비트", "IPv4", "네트워크계층"]
featured: false
draft: false
---

[지난 글](/posts/network-cidr/)에서 CIDR로 IP 주소를 효율적으로 관리하는 방법을 살펴봤다. 이번에는 실제 패킷이 네트워크를 통과할 때 발생하는 물리적 제약인 **MTU(Maximum Transmission Unit)**와, 패킷이 MTU를 초과할 때 발생하는 **단편화(Fragmentation)**를 다룬다.

## MTU란 무엇인가

MTU는 특정 링크 계층 프로토콜이 한 번에 전달할 수 있는 **최대 페이로드 크기(바이트)**다.

```
링크 유형별 MTU:
이더넷 (IEEE 802.3): 1500 bytes (가장 일반적)
Wi-Fi (802.11):      2304 bytes (실제로는 이더넷 MTU 사용)
PPPoE:               1492 bytes (8바이트 오버헤드)
Loopback (lo):       65536 bytes (OS 내부)
GRE 터널:            1476 bytes (24바이트 오버헤드)
VXLAN:               1450 bytes (50바이트 오버헤드)
```

애플리케이션이 1500바이트보다 큰 데이터를 전송하려 할 때 두 가지 일이 일어난다. TCP는 MSS(Maximum Segment Size) 협상으로 미리 조각 크기를 맞추고, UDP는 IP 계층에서 분할이 발생할 수 있다.

## IPv4 단편화 관련 헤더 필드

![단편화 과정](/assets/posts/network-ip-fragmentation-process.svg)

IPv4 헤더에는 단편화를 제어하는 세 가지 필드가 있다.

```
IPv4 헤더 단편화 관련 필드 (Byte 6~9):
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         Identification        |Flags|      Fragment Offset    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

Identification (16비트): 같은 원본 패킷의 단편들이 공유하는 식별자
Flags (3비트):
  - Reserved (1b): 항상 0
  - DF (Don't Fragment, 1b): 1이면 단편화 금지
  - MF (More Fragments, 1b): 1이면 뒤에 더 있음, 0이면 마지막 단편
Fragment Offset (13비트): 원본 데이터에서의 위치 (8바이트 단위)
```

```python
import struct
from dataclasses import dataclass

@dataclass
class IPv4FragmentInfo:
    identification: int
    dont_fragment: bool
    more_fragments: bool
    fragment_offset_bytes: int  # 실제 바이트 오프셋 (Offset × 8)

def parse_fragment_fields(header: bytes) -> IPv4FragmentInfo:
    """IPv4 헤더에서 단편화 관련 필드 추출"""
    # 바이트 6~7: Identification, 8~9: Flags + Offset
    ident, flags_offset = struct.unpack('!HH', header[4:8])
    df = bool(flags_offset & 0x4000)
    mf = bool(flags_offset & 0x2000)
    offset = (flags_offset & 0x1FFF) * 8  # 13비트 값 × 8 = 바이트 오프셋
    return IPv4FragmentInfo(ident, df, mf, offset)

# 예시: MTU 1500에서 4000바이트 패킷 단편화 시뮬레이션
def fragment_ipv4(data: bytes, mtu: int = 1500, header_size: int = 20) -> list:
    """IPv4 단편화 시뮬레이션"""
    max_payload = mtu - header_size
    # 오프셋이 8의 배수여야 하므로 내림
    max_payload = (max_payload // 8) * 8

    fragments = []
    offset = 0
    total = len(data)
    ident = 0xABCD  # 임의 식별자

    while offset < total:
        chunk = data[offset: offset + max_payload]
        is_last = (offset + max_payload) >= total
        fragments.append({
            "identification": ident,
            "offset": offset,
            "mf": not is_last,
            "df": False,
            "payload_size": len(chunk),
            "total_size": len(chunk) + header_size,
        })
        offset += max_payload

    return fragments

frags = fragment_ipv4(bytes(3980), mtu=1500)
for i, f in enumerate(frags):
    print(f"단편 {i+1}: offset={f['offset']:5d}B, "
          f"payload={f['payload_size']:5d}B, "
          f"MF={int(f['mf'])}, "
          f"total={f['total_size']:5d}B")
```

## 재조립 (Reassembly)

단편들은 **목적지 호스트에서만** 재조립된다. 중간 라우터는 재조립하지 않는다.

```python
from collections import defaultdict

class ReassemblyBuffer:
    """IPv4 단편 재조립 버퍼"""
    def __init__(self, timeout_sec: float = 60.0):
        self.fragments: dict = defaultdict(dict)  # {(src, dst, ident): {offset: data}}
        self.timeout = timeout_sec

    def add_fragment(self, src: str, dst: str, ident: int,
                     offset: int, mf: bool, data: bytes) -> bytes | None:
        key = (src, dst, ident)
        self.fragments[key][offset] = (data, mf)

        return self._try_reassemble(key)

    def _try_reassemble(self, key: tuple) -> bytes | None:
        frags = self.fragments[key]

        # 마지막 단편이 도착했는지 확인
        has_last = any(not mf for _, mf in frags.values())
        if not has_last:
            return None

        # 순서대로 정렬
        sorted_offsets = sorted(frags.keys())

        # 연속성 확인
        expected = 0
        for off in sorted_offsets:
            if off != expected:
                return None  # 갭 있음 → 아직 단편 미수신
            data, mf = frags[off]
            expected = off + len(data)

        # 재조립
        result = b''.join(frags[off][0] for off in sorted_offsets)
        del self.fragments[key]  # 버퍼 정리
        return result

buf = ReassemblyBuffer()
# 단편 순서 무관하게 도착
buf.add_fragment("10.0.0.1", "10.0.0.2", 0xABCD, 2960, False, b"Z" * 1020)  # 마지막
buf.add_fragment("10.0.0.1", "10.0.0.2", 0xABCD, 1480, True, b"B" * 1480)
result = buf.add_fragment("10.0.0.1", "10.0.0.2", 0xABCD, 0, True, b"A" * 1480)
print(f"재조립 완료: {len(result)} bytes" if result else "미완성")
```

## PMTUD (Path MTU Discovery)

단편화는 여러 문제를 일으킨다. 단편 중 하나라도 손실되면 전체 재전송 필요, 방화벽에서 단편 차단 가능, 재조립 버퍼 소모 등이다. 이를 피하기 위해 **DF 비트를 1로 설정하고 경로 최소 MTU를 탐색**하는 것이 PMTUD다.

![PMTUD 동작](/assets/posts/network-ip-fragmentation-pmtud.svg)

```bash
# Linux: PMTUD 테스트
# DF 비트 설정해서 ping (큰 패킷)
ping -M do -s 1472 8.8.8.8  # 1472 bytes data + 20 IP + 8 ICMP = 1500

# ICMP Fragmentation Needed 수신 시 (라우터가 차단하면 블랙홀)
# 경로 MTU 확인
ip route get 8.8.8.8
# mtu 1500 라고 표시됨

# TCP MSS Clamping으로 PMTUD 블랙홀 우회
iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN \
  -j TCPMSS --clamp-mss-to-pmtu
```

## IPv6에서의 단편화

IPv6는 **라우터에서의 단편화를 완전히 금지**한다. 오직 송신 호스트만 단편화할 수 있다. 따라서 모든 IPv6 구현은 PMTUD를 반드시 지원해야 한다.

```
IPv6 최소 MTU = 1280 bytes (RFC 2460)
IPv6 단편화: Extension Header(Fragment Header, 8bytes) 사용

Fragment Header:
 ┌─────────────┬──────────────────────┬──────────────────┬─────┐
 │ Next Header │     Reserved         │ Fragment Offset  │ M   │
 └─────────────┴──────────────────────┴──────────────────┴─────┘
```

```bash
# IPv6 경로 MTU 확인
ip -6 route show cache
# 또는
tracepath6 2001:4860:4860::8888
```

## 단편화 방지 모범 사례

```
1. TCP: MSS 협상으로 단편화 사전 방지
   - SYN 패킷에 MSS 옵션 포함
   - MSS = MTU - IP 헤더(20) - TCP 헤더(20) = 1460 bytes (이더넷)

2. UDP 애플리케이션: MTU 고려한 페이로드 크기 선택
   - DNS over UDP: 512 bytes (레거시), EDNS0로 4096까지 확장

3. 터널링/VPN: 오버헤드를 감안한 MTU 설정
   - WireGuard MTU = 1420 (1500 - 80 바이트 오버헤드)
   - OpenVPN tun-mtu = 1500, fragment = 1200 권장

4. 방화벽: ICMP Type 3 Code 4 (Fragmentation Needed) 반드시 허용
   → 차단하면 PMTUD 실패 → TCP 연결 블랙홀
```

## 정리

IPv4 단편화는 MTU를 초과하는 패킷을 전달하기 위한 메커니즘이지만, 성능 저하와 보안 문제를 일으킬 수 있다. 현대 네트워크에서는 PMTUD로 단편화를 피하고, TCP MSS 클램핑으로 방화벽 문제를 우회한다. IPv6는 아예 라우터 단편화를 금지해 복잡성을 줄였다.

---

**지난 글:** [CIDR과 주소 집약](/posts/network-cidr/)

**다음 글:** [TTL: 패킷의 유효 기간](/posts/network-ttl/)

<br>
읽어주셔서 감사합니다. 😊
