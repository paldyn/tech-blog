---
title: "라우팅 기초: 패킷이 목적지를 찾아가는 방법"
description: "라우팅 테이블, 넥스트홉, 정적·동적 라우팅, 거리벡터·링크상태 알고리즘을 실제 명령어와 함께 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["라우팅", "라우팅테이블", "정적라우팅", "OSPF", "BGP", "넥스트홉"]
featured: false
draft: false
---

[지난 글](/posts/network-ipv6-slaac/)에서 IPv6 호스트가 SLAAC으로 스스로 주소를 구성하는 방법을 살펴봤다. 이번 글에서는 그 주소를 가진 패킷이 실제로 목적지까지 어떻게 이동하는지, **라우팅(Routing)**의 기초 원리를 다룬다.

## 라우팅이란?

라우팅은 **패킷을 목적지 IP 주소까지 전달하기 위한 경로 선택 과정**이다. 라우터는 수신한 패킷의 목적지 IP를 라우팅 테이블과 비교해 다음 홉(next hop)을 결정하고, 해당 인터페이스로 패킷을 전달한다.

![라우팅 패킷 전달 흐름](/assets/posts/network-routing-basics-flow.svg)

라우팅이 동작하는 계층은 **네트워크 계층(L3)**이다. 각 라우터는 자신의 라우팅 테이블만 보고 결정을 내리며, 전체 경로를 미리 알지 못한다. 이를 **홉 바이 홉(hop-by-hop)** 라우팅이라고 한다.

## 라우팅 테이블의 구성

라우팅 테이블은 각 목적지 네트워크에 대해 어떤 경로로 패킷을 보낼지 기록한 데이터베이스다.

```bash
# Linux 라우팅 테이블 확인
ip route show
# 또는
route -n

# 출력 예시
# 10.0.1.0/24 dev eth0 proto kernel scope link src 10.0.1.1
# 10.0.4.0/24 via 10.0.2.2 dev eth1
# default via 10.0.2.2 dev eth1
```

주요 필드:
- **목적지(Destination)**: 목적지 네트워크 또는 호스트
- **넥스트홉(Next-hop)**: 다음 라우터의 IP 주소
- **인터페이스(Interface)**: 패킷을 내보낼 네트워크 인터페이스
- **메트릭(Metric)**: 경로 우선순위 (낮을수록 선호)

## 정적 vs 동적 라우팅

![정적·동적 라우팅 비교](/assets/posts/network-routing-basics-types.svg)

### 정적 라우팅

관리자가 직접 라우팅 테이블을 설정한다. 변경이 없는 소규모 네트워크에 적합하다.

```bash
# 정적 경로 추가
ip route add 10.0.4.0/24 via 10.0.2.2 dev eth1 metric 100

# 기본 경로(default route) 설정
ip route add default via 203.0.113.1 dev eth0

# 정적 경로 삭제
ip route del 10.0.4.0/24 via 10.0.2.2
```

### 동적 라우팅

라우팅 프로토콜이 라우터 간 경로 정보를 자동으로 교환한다. 링크 장애 시 자동으로 우회 경로를 찾는다.

동적 라우팅 알고리즘은 크게 두 가지다:

**거리 벡터 (Distance Vector)**
- 이웃 라우터에게서 받은 거리 정보를 바탕으로 경로 계산
- 전체 토폴로지를 모름, 수렴 느림
- 예: RIP (Routing Information Protocol)

**링크 상태 (Link State)**
- 네트워크 전체 토폴로지를 파악한 뒤 Dijkstra 알고리즘으로 최단 경로 계산
- 수렴 빠름, 확장성 우수
- 예: OSPF (Open Shortest Path First)

```bash
# OSPF 설정 예시 (FRRouting/Quagga)
router ospf
  network 10.0.0.0/8 area 0.0.0.0
  passive-interface eth0   # LAN 쪽은 LSA 광고만, 수신 안 함
```

## 라우팅 결정 과정

라우터는 목적지 IP에 대해 라우팅 테이블을 **위에서 아래로** 검색하고, 가장 긴 프리픽스가 일치하는(Longest Prefix Match) 항목을 선택한다.

```text
패킷 목적지: 10.0.4.20

라우팅 테이블:
  10.0.0.0/8     via 10.0.2.3   → 매칭 (prefix 8bit)
  10.0.4.0/24    via 10.0.2.2   → 매칭 (prefix 24bit) ← 선택 (더 길다)
  0.0.0.0/0      via 10.0.2.2   → 매칭 (prefix 0bit, 기본경로)
```

패킷을 전달할 때 라우터는 목적지 IP는 그대로 유지하고, **이더넷 프레임의 목적지 MAC 주소만** 다음 홉의 MAC으로 바꿔 전달한다 (ARP로 조회).

## 어드민 디스턴스

라우터에 여러 라우팅 프로토콜이 동시에 동작하는 경우, **어드민 디스턴스(Administrative Distance)**로 프로토콜 간 신뢰도를 결정한다.

| 출처 | Cisco AD | 의미 |
|------|----------|------|
| 직접 연결 | 0 | 가장 신뢰 |
| 정적 경로 | 1 | |
| OSPF | 110 | |
| RIP | 120 | |
| BGP(외부) | 20 | |

낮을수록 우선 적용된다.

---

**지난 글:** [IPv6 SLAAC: 상태 비저장 주소 자동 구성](/posts/network-ipv6-slaac/)

**다음 글:** [라우팅 테이블과 LPM: 최장 프리픽스 매칭](/posts/network-routing-table-lpm/)

<br>
읽어주셔서 감사합니다. 😊
