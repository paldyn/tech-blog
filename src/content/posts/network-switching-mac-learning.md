---
title: "스위치와 MAC 학습: 이더넷 스위칭의 동작 원리"
description: "이더넷 스위치가 MAC 주소 테이블을 동적으로 학습하고, 플러딩·포워딩·필터링으로 프레임을 전달하는 과정과 에이징 타임을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["스위치", "MAC학습", "CAM테이블", "플러딩", "포워딩", "이더넷스위칭"]
featured: false
draft: false
---

[지난 글](/posts/network-ethernet/)에서 이더넷 프레임 구조와 CSMA/CD를 살펴봤다. 이번에는 실제 LAN 환경에서 프레임을 지능적으로 전달하는 **이더넷 스위치(Layer 2 Switch)**의 핵심 동작인 **MAC 학습(MAC Learning)**을 다룬다. 허브(Hub)와 달리 스위치가 어떻게 목적지 포트를 정확히 찾아내는지 이해하면 네트워크 설계와 트러블슈팅이 훨씬 명확해진다.

## 허브 vs 스위치

과거의 **허브(Hub)**는 한 포트로 들어온 신호를 **모든 포트에 그대로 복사**한다. 충돌 도메인도 하나고 대역폭도 공유된다. 반면 스위치는 프레임의 목적지 MAC 주소를 읽어 **해당 포트에만** 전달한다.

```
허브 (10Mbps, 4포트):
포트1 수신 → 포트2, 3, 4 동시 전송
충돌 도메인: 1개 (전체 공유)
대역폭: 10Mbps 공유

스위치 (100Mbps, 4포트):
포트1 수신, 목적지 MAC → 포트3으로만 전달
충돌 도메인: 4개 (포트별 독립)
대역폭: 각 포트 독립 100Mbps (전체 200Mbps 이중화)
```

## MAC 주소 테이블 (CAM Table)

스위치의 핵심은 **CAM(Content Addressable Memory) 테이블**이다. MAC 주소, 포트 번호, VLAN ID, 에이징 타임을 저장한다.

![MAC 학습 과정](/assets/posts/network-switching-mac-learning-process.svg)

```
MAC 주소 테이블 구조:
┌──────────────────────┬────────┬──────┬──────────┐
│ MAC Address          │ Port   │ VLAN │ Age(sec) │
├──────────────────────┼────────┼──────┼──────────┤
│ AA:AA:AA:AA:AA:AA    │ Fa0/1  │  1   │   285    │
│ BB:BB:BB:BB:BB:BB    │ Fa0/4  │  1   │   300    │
│ CC:CC:CC:CC:CC:CC    │ Fa0/2  │  1   │   143    │
└──────────────────────┴────────┴──────┴──────────┘
에이징 타임: 기본 300초 (비활성 항목 자동 삭제)
```

## 스위치 동작 3단계

![포워딩 의사결정](/assets/posts/network-switching-mac-learning-forward.svg)

### 1단계: 학습 (Learning)

프레임을 수신하면 **출발지 MAC 주소**와 **수신 포트**를 테이블에 기록한다.

```python
from dataclasses import dataclass
from time import time
from typing import Optional

@dataclass
class MacEntry:
    port: str
    vlan: int
    timestamp: float

    def is_expired(self, aging_time: float = 300.0) -> bool:
        return (time() - self.timestamp) > aging_time

class MacTable:
    def __init__(self, aging_time: float = 300.0):
        self._table: dict[str, MacEntry] = {}
        self.aging_time = aging_time

    def learn(self, mac: str, port: str, vlan: int = 1) -> None:
        """출발지 MAC → 포트 매핑 학습 (또는 갱신)"""
        mac = mac.upper()
        entry = self._table.get(mac)
        if entry is None:
            self._table[mac] = MacEntry(port, vlan, time())
            print(f"  [학습] {mac} → {port} (VLAN {vlan})")
        else:
            # 같은 MAC이 다른 포트에서 오면 포트 이동 (예: VM 이동)
            if entry.port != port:
                print(f"  [포트 이동] {mac}: {entry.port} → {port}")
            entry.port = port
            entry.timestamp = time()

    def lookup(self, mac: str) -> Optional[str]:
        """목적지 MAC으로 포트 조회"""
        mac = mac.upper()
        entry = self._table.get(mac)
        if entry and not entry.is_expired(self.aging_time):
            return entry.port
        elif entry:
            del self._table[mac]  # 에이징 만료 삭제
        return None  # 테이블 미스 → 플러딩

    def flush(self, vlan: Optional[int] = None) -> None:
        """MAC 테이블 초기화 (TCN 수신 시 호출)"""
        if vlan is None:
            self._table.clear()
        else:
            to_delete = [m for m, e in self._table.items() if e.vlan == vlan]
            for mac in to_delete:
                del self._table[mac]
```

### 2단계: 플러딩 (Flooding)

목적지 MAC이 테이블에 없을 때, 또는 브로드캐스트/알 수 없는 유니캐스트일 때 **입력 포트를 제외한 모든 포트**로 전송한다.

```python
class Switch:
    def __init__(self, ports: list[str]):
        self.mac_table = MacTable()
        self.ports = ports

    def receive_frame(self, ingress_port: str, src_mac: str,
                      dst_mac: str, vlan: int, data: bytes) -> None:
        # 1. 출발지 MAC 학습
        self.mac_table.learn(src_mac, ingress_port, vlan)

        # 2. 브로드캐스트 체크
        if dst_mac.upper() == "FF:FF:FF:FF:FF:FF":
            print(f"  [브로드캐스트 플러딩] {ingress_port} 제외 전체")
            self._flood(ingress_port, data, vlan)
            return

        # 3. 목적지 포트 조회
        egress_port = self.mac_table.lookup(dst_mac)

        if egress_port is None:
            print(f"  [언노운 유니캐스트 플러딩] {dst_mac}")
            self._flood(ingress_port, data, vlan)
        elif egress_port == ingress_port:
            print(f"  [필터링] 같은 포트 → 폐기")
        else:
            print(f"  [포워딩] {ingress_port} → {egress_port}")
            self._forward(egress_port, data)

    def _flood(self, ingress_port: str, data: bytes, vlan: int) -> None:
        for port in self.ports:
            if port != ingress_port:
                self._forward(port, data)

    def _forward(self, port: str, data: bytes) -> None:
        pass  # 실제 전송 로직
```

### 3단계: 포워딩과 필터링

목적지 MAC이 테이블에 있으면 해당 포트로만 전달한다(포워딩). 목적지와 출발지가 같은 포트이면 폐기한다(필터링). 이 필터링 덕분에 같은 세그먼트의 통신은 다른 포트로 넘어가지 않는다.

## 에이징 타임과 주의사항

```bash
# Cisco: 에이징 타임 확인 및 변경
SW# show mac address-table aging-time
Global Aging Time:  300

SW(config)# mac address-table aging-time 180   # 180초로 변경

# 특정 MAC 고정 (static)
SW(config)# mac address-table static AA:BB:CC:DD:EE:FF vlan 1 interface Fa0/1

# MAC 테이블 전체 확인
SW# show mac address-table
          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
   1    aabb.ccdd.eeff    DYNAMIC     Fa0/1
   1    1122.3344.5566    STATIC      Fa0/2
```

**에이징 타임이 너무 짧으면**: 빈번한 플러딩으로 불필요한 트래픽 증가  
**에이징 타임이 너무 길면**: 이동한 장치(예: VM 마이그레이션)의 이전 포트로 트래픽이 전달됨

## MAC 플러딩 공격

공격자가 임의의 MAC 주소로 가득 찬 프레임을 대량 전송하면 CAM 테이블이 꽉 찬다. 이후 모든 프레임이 플러딩되어 같은 VLAN의 트래픽이 모든 포트로 노출된다.

```bash
# 방어: Port Security로 포트당 MAC 수 제한 (Cisco)
SW(config-if)# switchport port-security
SW(config-if)# switchport port-security maximum 2        # 포트당 최대 2개 MAC
SW(config-if)# switchport port-security violation restrict  # 위반 시 드롭+로깅
SW(config-if)# switchport port-security mac-address sticky  # 동적 학습 후 고정
```

## 정리

이더넷 스위치는 프레임을 받을 때마다 출발지 MAC을 학습하고, 목적지 MAC을 조회해 포워딩·플러딩·필터링을 결정한다. 이 단순한 동작이 허브 대비 충돌 감소, 대역폭 증가, 보안 향상을 가능하게 한다. 에이징 타임과 포트 보안 설정을 올바르게 관리하는 것이 스위치 운영의 핵심이다.

---

**지난 글:** [이더넷 완전 이해](/posts/network-ethernet/)

**다음 글:** [VLAN: 논리적 네트워크 분리](/posts/network-vlan/)

<br>
읽어주셔서 감사합니다. 😊
