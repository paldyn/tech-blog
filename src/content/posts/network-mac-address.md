---
title: "MAC 주소란 무엇인가"
description: "네트워크 인터페이스 카드에 부여된 고유 하드웨어 주소 MAC 주소의 구조, OUI, 브로드캐스트, 스위치 학습 과정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["MAC 주소", "이더넷", "스위치", "OUI", "데이터링크"]
featured: false
draft: false
---

[지난 글](/posts/network-bandwidth-throughput-latency/)에서 네트워크 성능을 측정하는 세 가지 지표를 살펴봤습니다. 이번에는 계층을 한 단계 내려가 데이터링크 계층에서 장치를 식별하는 **MAC 주소(Media Access Control Address)** 를 다룹니다. IP 주소가 논리적 주소라면 MAC 주소는 하드웨어에 직접 새겨진 **물리적 주소**입니다.

## MAC 주소란

MAC 주소는 **네트워크 인터페이스 카드(NIC)에 제조 시 부여되는 48비트 고유 식별자**입니다. 흔히 이더넷 주소, 하드웨어 주소라고도 부릅니다. IEEE 802 표준에 따라 전 세계에서 고유하게 관리됩니다.

```text
표기 방식 (모두 동일한 주소):
  콜론 구분:   00:1A:2B:3C:4D:5E   (Linux/macOS)
  하이픈 구분: 00-1A-2B-3C-4D-5E   (Windows)
  점 구분:     001A.2B3C.4D5E       (Cisco)
```

![MAC 주소 구조](/assets/posts/network-mac-address-structure.svg)

## OUI — 제조사 식별자

MAC 주소의 앞 3바이트(24비트)는 **OUI(Organizationally Unique Identifier)** 로, IEEE가 각 제조사에 고유하게 부여합니다. 뒤 3바이트는 제조사가 자체적으로 관리하는 일련번호입니다.

```text
MAC 주소: 00:1A:2B:3C:4D:5E
          ├─────────┤ ├─────────┤
          OUI        NIC 일련번호
          (제조사)    (장치 고유)

OUI 00:1A:2B → Cisco Systems
OUI 3C:22:FB → Apple, Inc.
OUI F4:5C:89 → Samsung Electronics
```

실무에서 OUI를 알면 패킷 캡처 시 장치 종류를 빠르게 파악할 수 있습니다.

## 유니캐스트·브로드캐스트·멀티캐스트

MAC 주소의 최하위 바이트(첫 번째 옥텟)의 마지막 비트로 전달 방식을 구분합니다.

| 구분 | MAC 주소 | 설명 |
|------|---------|------|
| 유니캐스트 | 일반 주소 | 특정 장치 1개에게만 전달 |
| 브로드캐스트 | `FF:FF:FF:FF:FF:FF` | 같은 네트워크의 모든 장치에게 전달 |
| 멀티캐스트 | `01:xx:xx:xx:xx:xx` | 특정 그룹에게 전달 |

브로드캐스트는 ARP 요청처럼 "이 IP를 가진 사람 누구?"라고 전체에게 물어볼 때 사용합니다.

## 스위치의 MAC 주소 학습

MAC 주소가 가장 중요하게 사용되는 곳은 **스위치**입니다. 스위치는 수신한 프레임의 **출발지 MAC 주소와 수신 포트**를 CAM(Content Addressable Memory) 테이블에 학습합니다.

![스위치 MAC 주소 테이블](/assets/posts/network-mac-address-switch.svg)

스위치 동작 과정:

```text
1. PC-A가 프레임 전송
   → 스위치가 포트1에서 수신
   → "포트1 = AA:AA:AA:AA:AA:AA" 학습

2. 목적지 MAC이 테이블에 있으면 해당 포트로만 전송
   (목적지 MAC이 테이블에 없으면 전체 포트로 플러딩)

3. 학습 후에는 포트2(PC-B)로만 포워딩 — 불필요한 트래픽 없음
```

이것이 **허브**와의 차이점입니다. 허브는 모든 포트로 복사·전달하지만, 스위치는 학습된 MAC 테이블 기반으로 **정확한 포트에만** 전달합니다.

## MAC 주소 확인 방법

```bash
# Linux / macOS
ip link show
# 또는
ifconfig

# Windows
ipconfig /all

# 출력 예시 (Linux):
# 2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>
#     link/ether 00:1a:2b:3c:4d:5e brd ff:ff:ff:ff:ff:ff

# macOS
# en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST>
#         ether 3c:22:fb:aa:bb:cc
```

## MAC 주소는 변경할 수 있는가

MAC 주소는 하드웨어에 새겨진(burned-in) 값이지만, 운영체제 수준에서 **소프트웨어로 변경(spoofing)** 이 가능합니다. 이를 MAC 스푸핑이라 하며 개인정보 보호, 네트워크 테스트 등에 사용됩니다.

```bash
# Linux에서 MAC 주소 임시 변경
sudo ip link set dev eth0 down
sudo ip link set dev eth0 address 02:00:00:00:00:01
sudo ip link set dev eth0 up
```

단, MAC 주소는 **동일 네트워크 세그먼트(로컬) 내에서만 유효**합니다. 라우터를 넘어가면 MAC 주소는 교체되고(3계층 라우팅), IP 주소만 남습니다. 다음 글에서는 이 MAC 주소를 기반으로 동작하는 **이더넷** 기술을 살펴봅니다.

---

**지난 글:** [대역폭, 처리량, 지연이란](/posts/network-bandwidth-throughput-latency/)

**다음 글:** [이더넷 완전 이해](/posts/network-ethernet/)

<br>
읽어주셔서 감사합니다. 😊
