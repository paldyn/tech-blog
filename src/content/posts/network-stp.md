---
title: "STP: 스패닝 트리 프로토콜로 루프를 제거하다"
description: "이더넷 루프의 위험성, STP가 루트 브리지를 선출하고 차단 포트를 결정하는 원리, 포트 상태 전이, RSTP와의 비교를 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["STP", "스패닝트리", "루트브리지", "BPDU", "RSTP", "이더넷루프"]
featured: false
draft: false
---

[지난 글](/posts/network-vlan/)에서 VLAN으로 네트워크를 논리적으로 분리하는 방법을 살펴봤다. 스위치를 여러 대 연결할 때 **이중화(Redundancy)**를 위해 링크를 두 개 이상 연결하면 반드시 **루프(Loop)**가 생긴다. 이더넷 루프는 브로드캐스트 스톰을 일으켜 네트워크 전체를 마비시킬 수 있다. **STP(Spanning Tree Protocol, IEEE 802.1D)**는 이 루프를 자동으로 감지하고 제거한다.

## 이더넷 루프의 위험성

이더넷 프레임에는 TTL 필드가 없다. 루프 경로가 생기면 브로드캐스트 프레임이 영원히 순환하면서 두 가지 재앙이 발생한다.

```
루프 시나리오:
SW1 ─── SW2
│        │
└─── SW3 ┘

브로드캐스트 프레임 A가 SW1에서 출발
→ SW2, SW3 모두로 전달
→ SW2가 SW3으로 전달, SW3이 SW2로 전달
→ 다시 SW1으로 → 무한 반복

1. 브로드캐스트 스톰: 트래픽이 기하급수적으로 증폭
2. MAC 테이블 불안정: 같은 MAC이 여러 포트에서 계속 갱신
```

## STP 동작 원리

STP는 물리 루프 위에서 **논리적 트리(스패닝 트리)**를 만들어 루프를 제거한다. 루프를 제거하되 모든 세그먼트에 경로가 유지된다.

![STP 토폴로지](/assets/posts/network-stp-topology.svg)

### 1단계: 루트 브리지 선출

모든 스위치는 자신을 루트로 가정하고 **BPDU(Bridge Protocol Data Unit)**를 주고받는다. 우선순위가 가장 낮은 스위치가 루트 브리지로 선출된다.

```
Bridge ID (BID) = Bridge Priority (2B) + MAC Address (6B)
선출 기준: 낮은 BID가 우선
→ 동점이면 MAC 주소가 낮은 쪽
```

```bash
# Cisco: 루트 브리지 강제 지정
SW1(config)# spanning-tree vlan 1 priority 4096
# 기본 32768보다 낮으므로 SW1이 루트 브리지

# 또는 자동 설정
SW1(config)# spanning-tree vlan 1 root primary
# → 현재 루트보다 낮은 우선순위 자동 설정
```

### 2단계: 루트 포트(RP) 선정

루트 브리지를 제외한 모든 스위치는 루트 브리지까지의 **최단 경로 포트 하나**를 루트 포트로 선정한다.

```
경로 비용 (Path Cost):
링크 속도     | 비용 (802.1D)
10 Mbps      | 100
100 Mbps     | 19
1 Gbps       | 4
10 Gbps      | 2
100 Gbps     | 1
```

### 3단계: 지정 포트(DP) 선정

각 네트워크 세그먼트에서 루트까지 최단 경로를 제공하는 포트가 지정 포트다. 루트 브리지의 모든 포트는 지정 포트다.

### 4단계: 나머지 포트 차단

루트 포트도, 지정 포트도 아닌 포트는 **차단(Blocking)** 상태로 전환된다.

## STP 포트 상태 전이

![STP 포트 상태](/assets/posts/network-stp-states.svg)

```python
from enum import Enum, auto
from typing import Optional
import time

class STPState(Enum):
    DISABLED   = auto()  # 관리적 비활성
    BLOCKING   = auto()  # BPDU 수신, 데이터 차단
    LISTENING  = auto()  # BPDU 송수신, MAC 학습 X
    LEARNING   = auto()  # MAC 학습 시작, 데이터 아직 차단
    FORWARDING = auto()  # 정상 데이터 전달

class STPPort:
    FORWARD_DELAY = 15  # Listening/Learning 각 15초

    def __init__(self, port_id: str):
        self.port_id = port_id
        self.state = STPState.BLOCKING
        self.state_change_time: Optional[float] = None

    def transition_to(self, new_state: STPState) -> None:
        print(f"[{self.port_id}] {self.state.name} → {new_state.name}")
        self.state = new_state
        self.state_change_time = time.time()

    def can_forward(self) -> bool:
        return self.state == STPState.FORWARDING

    def tick(self) -> None:
        """상태 전이 타이머 처리 (단순화)"""
        if self.state_change_time is None:
            return
        elapsed = time.time() - self.state_change_time

        if self.state == STPState.LISTENING and elapsed >= self.FORWARD_DELAY:
            self.transition_to(STPState.LEARNING)
        elif self.state == STPState.LEARNING and elapsed >= self.FORWARD_DELAY:
            self.transition_to(STPState.FORWARDING)
```

STP의 가장 큰 단점은 **수렴 시간이 30~50초**라는 점이다. 링크 장애 후 Blocking → Listening(15s) → Learning(15s) → Forwarding 과정을 거쳐야 하므로 그 동안 통신이 중단된다.

## RSTP (Rapid STP, 802.1w)

IEEE 802.1w는 STP를 대폭 개선해 **1~2초 내 수렴**을 달성한다. 802.1D와 하위 호환되며 현대 스위치의 기본 프로토콜이다.

```
RSTP 개선 핵심:
1. 포트 역할 추가: Alternate(백업 루트 포트), Backup(백업 지정 포트)
2. 즉시 전이(Rapid Transition): 엣지 포트와 P2P 링크는 Forwarding 즉시 전환
3. BPDU 타임아웃 3배 → 실패 감지 3 × HelloTime(2s) = 6초로 단축

RSTP 포트 역할:
  Root Port    → 루트로의 최단 경로
  Designated   → 세그먼트의 포워딩 포트
  Alternate    → 루트 포트 장애 시 즉시 대체 (Blocking 상태)
  Backup       → 지정 포트 장애 시 대체
  Edge         → 단말 연결 (PortFast)
```

```bash
# Cisco: RSTP 활성화
SW(config)# spanning-tree mode rapid-pvst   # VLAN별 RSTP

# PortFast: 단말 연결 포트에서 즉시 Forwarding
SW(config-if)# spanning-tree portfast
# !주의: 다른 스위치에 연결된 포트에는 절대 적용 금지 (루프 발생)

# BPDU Guard: PortFast 포트로 BPDU 수신 시 포트 비활성
SW(config-if)# spanning-tree bpduguard enable
```

## PVST+와 MST

Cisco의 **PVST+(Per-VLAN STP)**는 VLAN마다 별도의 STP 인스턴스를 운영한다. VLAN별 루트 브리지를 다르게 설정해 로드 밸런싱이 가능하다.

```bash
# PVST+ 로드 밸런싱 예시
# SW1: VLAN 10/30 루트, SW2: VLAN 20/40 루트
SW1(config)# spanning-tree vlan 10,30 priority 4096
SW1(config)# spanning-tree vlan 20,40 priority 8192

SW2(config)# spanning-tree vlan 20,40 priority 4096
SW2(config)# spanning-tree vlan 10,30 priority 8192
# → 물리 링크를 VLAN에 따라 다른 경로 사용
```

**MST(Multiple Spanning Tree, 802.1s)**는 여러 VLAN을 하나의 인스턴스로 그룹화해 PVST+의 오버헤드를 줄인다. 대규모 환경에서 선호된다.

## STP 트러블슈팅

```bash
# STP 상태 확인
SW# show spanning-tree vlan 1
# Topology change 감지 여부, 루트 브리지 BID, 포트 상태 확인

# 토폴로지 변경 이력
SW# show spanning-tree detail

# 루트 브리지 찾기
SW# show spanning-tree vlan 1 root

# STP 이벤트 로그
SW# debug spanning-tree events
```

## 정리

STP는 이더넷 루프 방지의 토대가 되는 프로토콜이다. 루트 브리지를 선출하고 불필요한 포트를 차단해 루프 없는 트리를 만든다. 느린 수렴이 단점이지만 RSTP가 이를 크게 개선했다. 실무에서는 단말 연결 포트에 PortFast와 BPDU Guard를 반드시 설정하고, PVST+나 MST로 VLAN별 트래픽 경로를 최적화하는 것이 중요하다.

---

**지난 글:** [VLAN: 논리적 네트워크 분리](/posts/network-vlan/)

**다음 글:** [CIDR과 주소 집약](/posts/network-cidr/)

<br>
읽어주셔서 감사합니다. 😊
