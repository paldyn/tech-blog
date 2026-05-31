---
title: "VLAN: 논리적 네트워크 분리와 802.1Q 태깅"
description: "하나의 물리 스위치를 여러 논리 네트워크로 분리하는 VLAN 개념, 802.1Q 태그 구조, Access/Trunk 포트 설정, Inter-VLAN 라우팅까지 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["VLAN", "802.1Q", "트렁크포트", "브로드캐스트도메인", "네트워크분리", "Inter-VLAN"]
featured: false
draft: false
---

[지난 글](/posts/network-switching-mac-learning/)에서 스위치가 MAC 테이블로 프레임을 지능적으로 전달하는 방법을 살펴봤다. 그런데 하나의 스위치에 연결된 모든 장치는 같은 브로드캐스트 도메인에 속한다. 개발팀과 재무팀이 같은 스위치에 연결되면 서로의 브로드캐스트가 전달되고 보안 격리도 어렵다. **VLAN(Virtual LAN)**이 이 문제를 해결한다.

## VLAN이 필요한 이유

브로드캐스트 도메인이 크면 두 가지 문제가 생긴다.

1. **성능**: ARP 요청, DHCP Discovery 등 브로드캐스트가 모든 장치에 전달 → 불필요한 CPU 부하
2. **보안**: 같은 L2 세그먼트 내에서는 패킷 스니핑이 가능

VLAN은 물리 케이블을 바꾸지 않고 스위치 설정만으로 브로드캐스트 도메인을 분리한다.

```
물리 구성: PC 24대가 하나의 스위치에 연결
VLAN 설정:
  VLAN 10 (개발팀):  포트 1~8   → 192.168.10.0/24
  VLAN 20 (인사팀):  포트 9~16  → 192.168.20.0/24
  VLAN 30 (재무팀):  포트 17~24 → 192.168.30.0/24

결과:
  개발팀 브로드캐스트 → VLAN 10 내에서만
  VLAN 간 통신 → 라우터(L3 스위치) 필수
```

## VLAN 유형

| 유형 | 설명 | 사용 예 |
|------|------|--------|
| 포트 기반 VLAN | 스위치 포트에 VLAN ID 할당 | 가장 일반적 |
| MAC 기반 VLAN | MAC 주소로 VLAN 결정 | 이동성 요구 환경 |
| 프로토콜 기반 VLAN | EtherType으로 결정 | 레거시 호환 |
| 관리 VLAN | 스위치 관리 접근용 | 보통 VLAN 1 사용 금지 |

## Access 포트와 Trunk 포트

![VLAN 개념도](/assets/posts/network-vlan-concept.svg)

**Access 포트**는 하나의 VLAN에만 속한다. 연결된 장치(PC, 서버)는 VLAN 존재를 모른다. 프레임은 태그 없이 전달된다.

**Trunk 포트**는 여러 VLAN의 프레임을 하나의 링크로 전달한다. 스위치 간 연결, 스위치-라우터 연결에 사용된다. 프레임에 **802.1Q 태그**를 추가해 VLAN을 식별한다.

## 802.1Q VLAN 태깅

![802.1Q 태그 구조](/assets/posts/network-vlan-tagging.svg)

802.1Q는 이더넷 프레임에 4바이트 태그를 삽입한다. 표준 이더넷 헤더(목적지 MAC + 출발지 MAC) 바로 뒤에 붙는다.

```
802.1Q 태그 4바이트:
┌──────────────────┬────────────────────────────────────┐
│   TPID (2B)      │           TCI (2B)                 │
│   0x8100         │  PCP(3b) │ DEI(1b) │ VID(12b)      │
└──────────────────┴──────────┴─────────┴───────────────┘
TPID: Tag Protocol Identifier (0x8100 = IEEE 802.1Q)
PCP:  Priority Code Point (0~7, QoS 우선순위)
DEI:  Drop Eligible Indicator (혼잡 시 폐기 대상 표시)
VID:  VLAN Identifier (0~4095, 유효 범위 1~4094)
```

```python
import struct

def encode_dot1q_tag(vlan_id: int, priority: int = 0, dei: int = 0) -> bytes:
    """802.1Q VLAN 태그 생성"""
    assert 1 <= vlan_id <= 4094, "VLAN ID 범위: 1-4094"
    assert 0 <= priority <= 7, "PCP 범위: 0-7"
    tpid = 0x8100
    tci = (priority << 13) | (dei << 12) | vlan_id
    return struct.pack('!HH', tpid, tci)

def decode_dot1q_tag(tag: bytes) -> dict:
    """802.1Q 태그 파싱"""
    tpid, tci = struct.unpack('!HH', tag[:4])
    if tpid != 0x8100:
        raise ValueError("802.1Q 태그가 아님")
    return {
        "tpid": f"0x{tpid:04X}",
        "priority": (tci >> 13) & 0x7,
        "dei": (tci >> 12) & 0x1,
        "vlan_id": tci & 0xFFF,
    }

# VLAN 20, 우선순위 5 (VoIP)
tag = encode_dot1q_tag(vlan_id=20, priority=5)
print(f"태그 hex: {tag.hex()}")  # 81 00 a0 14
parsed = decode_dot1q_tag(tag)
print(parsed)
# {'tpid': '0x8100', 'priority': 5, 'dei': 0, 'vlan_id': 20}
```

## Native VLAN

트렁크 포트에서 **태그 없이 전달되는 VLAN**이다. Cisco 기본값은 VLAN 1이다. 보안상 Native VLAN을 사용하지 않는 VLAN ID로 변경하는 것이 권장된다.

```bash
# Cisco IOS VLAN 기본 설정
# VLAN 생성
SW(config)# vlan 10
SW(config-vlan)# name ENGINEERING
SW(config-vlan)# exit

# Access 포트 설정 (개발팀 PC용)
SW(config)# interface Fa0/1
SW(config-if)# switchport mode access
SW(config-if)# switchport access vlan 10

# Trunk 포트 설정 (스위치 간 연결)
SW(config)# interface Gi0/1
SW(config-if)# switchport mode trunk
SW(config-if)# switchport trunk encapsulation dot1q
SW(config-if)# switchport trunk allowed vlan 10,20,30
SW(config-if)# switchport trunk native vlan 999   # Native VLAN 변경

# 확인
SW# show vlan brief
SW# show interfaces trunk
```

## Inter-VLAN 라우팅

VLAN 간 통신은 반드시 **라우터(또는 L3 스위치)**를 거쳐야 한다. 두 가지 방법이 있다.

### Router-on-a-Stick

단일 물리 인터페이스에 서브인터페이스를 만들어 VLAN별 게이트웨이를 제공한다.

```bash
# 라우터 설정 (Router-on-a-Stick)
R(config)# interface Gi0/0.10
R(config-subif)# encapsulation dot1q 10
R(config-subif)# ip address 192.168.10.1 255.255.255.0

R(config)# interface Gi0/0.20
R(config-subif)# encapsulation dot1q 20
R(config-subif)# ip address 192.168.20.1 255.255.255.0
```

### L3 스위치 (SVI)

```bash
# L3 스위치: SVI(Switch Virtual Interface) 방식
SW(config)# ip routing  # L3 라우팅 활성화

SW(config)# interface vlan 10
SW(config-if)# ip address 192.168.10.1 255.255.255.0
SW(config-if)# no shutdown

SW(config)# interface vlan 20
SW(config-if)# ip address 192.168.20.1 255.255.255.0
SW(config-if)# no shutdown
# VLAN 간 라우팅이 스위치 내부 하드웨어로 처리 → 고성능
```

## QinQ (Double Tagging)

서비스 사업자 환경에서 고객 VLAN 태그를 유지하면서 사업자 VLAN 태그를 추가로 붙이는 기술(802.1ad). 태그가 두 겹이라 VLAN ID 공간을 4094 × 4094로 확장한다.

```
고객 프레임: [Dst MAC][Src MAC][0x8100 CVLAN-20][EtherType][Data]
QinQ 추가 후: [Dst MAC][Src MAC][0x88A8 SVLAN-100][0x8100 CVLAN-20][EtherType][Data]
```

## 정리

VLAN은 물리 인프라 변경 없이 네트워크를 논리적으로 분리하는 강력한 도구다. Access 포트는 단말이 VLAN을 모르게 하고, Trunk 포트는 802.1Q 태그로 여러 VLAN을 하나의 링크에 실어 보낸다. VLAN 간 통신은 라우터나 L3 스위치가 담당하며, Native VLAN 보안 설정도 빠뜨리지 말아야 한다.

---

**지난 글:** [스위치와 MAC 학습](/posts/network-switching-mac-learning/)

**다음 글:** [STP: 스패닝 트리 프로토콜](/posts/network-stp/)

<br>
읽어주셔서 감사합니다. 😊
