---
title: "MAC 주소 완전 정복: 구조, 역할, 실전 활용"
description: "MAC 주소의 48비트 구조(OUI+NIC), I/G비트와 U/L비트, 유니캐스트·멀티캐스트·브로드캐스트 주소, 스푸핑 방어까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["MAC주소", "OUI", "이더넷", "브로드캐스트", "멀티캐스트", "MAC스푸핑", "ARP"]
featured: false
draft: false
---

[지난 글](/posts/network-error-detection-crc/)에서 CRC가 이더넷 프레임의 무결성을 어떻게 보장하는지 살펴봤다. 이더넷 프레임의 또 다른 핵심 요소가 **MAC 주소(Media Access Control Address)**다. IP 주소가 논리적 주소라면, MAC 주소는 네트워크 인터페이스 카드(NIC)에 부여된 **물리적 주소**다. 같은 네트워크 세그먼트 안에서 프레임을 올바른 장치에 전달하는 것이 MAC 주소의 역할이다.

## MAC 주소의 48비트 구조

![MAC 주소 구조](/assets/posts/network-mac-address-structure.svg)

MAC 주소는 **48비트(6바이트)**로 구성되며, 통상 콜론이나 하이픈으로 구분된 16진수로 표현한다.

```text
AC:DE:48:00:11:22
│         │
OUI       NIC 고유 번호
(24비트)  (24비트)
```

**OUI(Organizationally Unique Identifier)**: 앞 3바이트로, IEEE가 제조사에 할당한 고유 식별자다. 특정 MAC 주소의 제조사를 알고 싶으면 OUI 데이터베이스에서 조회할 수 있다.

```bash
# OUI 데이터베이스 조회
curl -s "https://api.macvendors.com/AC:DE:48" 
# 응답: Apple, Inc.

# Linux에서 OUI DB 직접 조회
grep -i "AC:DE:48" /usr/share/misc/oui.txt
```

**NIC 고유 번호**: 뒤 3바이트로, 제조사가 각 장치에 순차적으로 할당한다. 이론적으로 전 세계에서 유일한 값이어야 하지만, 가상화 환경에서는 OS가 임의 생성한 값을 사용하기도 한다.

## 첫 번째 바이트의 특수 비트

첫 번째 옥텟의 최하위 2비트는 특별한 의미를 가진다.

```text
바이트: AC = 1010 1100
                   │ └── 비트 0 (I/G): 0=유니캐스트, 1=멀티캐스트
                   └──── 비트 1 (U/L): 0=전역고유, 1=로컬관리

AC(10101100):
- 비트0 = 0 → 유니캐스트 주소
- 비트1 = 0 → IEEE 전역 고유 주소 (실제 제조사 할당)
```

## 이더넷 프레임 내 MAC 주소 위치

![이더넷 프레임의 MAC 주소](/assets/posts/network-mac-address-frame.svg)

이더넷 프레임은 목적지 MAC 6바이트를 먼저, 출발지 MAC 6바이트를 그 다음에 배치한다. 스위치는 이 두 주소를 기반으로 프레임을 올바른 포트로 전달한다.

## 유니캐스트, 멀티캐스트, 브로드캐스트

```text
유니캐스트:   AC:DE:48:00:11:22  (특정 NIC 1개)
멀티캐스트:   01:00:5E:xx:xx:xx  (IPv4 멀티캐스트 그룹)
              33:33:xx:xx:xx:xx  (IPv6 멀티캐스트 그룹)
브로드캐스트: FF:FF:FF:FF:FF:FF  (동일 세그먼트 전체)
```

브로드캐스트는 모든 장치가 수신·처리해야 하므로, 대규모 네트워크에서 남용되면 성능 저하(브로드캐스트 스톰)를 일으킨다. VLAN으로 브로드캐스트 도메인을 분리하는 이유가 바로 이것이다.

## MAC 주소 확인과 변경

```bash
# Linux: MAC 주소 확인
ip link show eth0
# link/ether ac:de:48:00:11:22 brd ff:ff:ff:ff:ff:ff

# MAC 주소 임시 변경 (인터페이스 DOWN → 변경 → UP)
ip link set eth0 down
ip link set eth0 address 02:00:00:00:00:01
ip link set eth0 up

# macOS
ifconfig en0 | grep ether
```

## MAC 스푸핑 (Spoofing)

공격자가 MAC 주소를 타 장치 주소로 변경해 프레임을 가로채는 기법이다. 방어 수단으로는 스위치의 **포트 보안(Port Security)** 기능이 있다.

```text
포트 보안 설정 (Cisco IOS 예시):
interface FastEthernet0/1
  switchport port-security
  switchport port-security maximum 1
  switchport port-security mac-address sticky
  switchport port-security violation shutdown
```

MAC 주소가 어떻게 실제 통신에 사용되는지, 스위치가 어떻게 MAC 테이블을 관리하는지는 이더넷 글에서 더 자세히 다룬다. 다음 글에서는 이더넷 표준 자체를 완전히 해부한다.

---

**지난 글:** [오류 검출과 CRC](/posts/network-error-detection-crc/)

**다음 글:** [이더넷 완전 정복: 프레임 구조와 CSMA/CD](/posts/network-ethernet/)

<br>
읽어주셔서 감사합니다. 😊
