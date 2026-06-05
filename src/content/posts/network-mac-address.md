---
title: "MAC 주소: 네트워크 장치의 물리적 신분증"
description: "MAC 주소의 구조(OUI + NIC), I/G·U/L 비트, 유니캐스트·멀티캐스트·브로드캐스트 구분, MAC 범위와 IP와의 역할 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["MAC주소", "OUI", "이더넷", "L2주소", "유니캐스트", "브로드캐스트"]
featured: false
draft: false
---

[지난 글](/posts/network-error-detection-crc/)에서 오류 감지와 CRC를 살펴봤다. 이번 글에서는 데이터링크 계층(L2)에서 장치를 식별하는 **MAC 주소(MAC Address)**의 구조와 동작을 다룬다. IP 주소가 논리적 주소라면, MAC 주소는 네트워크 인터페이스에 새겨진 물리적 주소다.

## MAC 주소란

MAC(Media Access Control) 주소는 **네트워크 인터페이스 카드(NIC)에 제조사가 부여하는 48비트(6바이트) 고유 식별자**다. 이더넷, Wi-Fi, Bluetooth 등 모든 데이터링크 계층 기술에서 사용한다.

```
표기 형식:
  콜론 구분: AA:BB:CC:DD:EE:FF  (Linux, macOS)
  하이픈 구분: AA-BB-CC-DD-EE-FF  (Windows)
  점 구분: AABB.CCDD.EEFF  (Cisco)

크기: 6바이트 = 48비트
이론적 주소 수: 2⁴⁸ = 약 281조 개
```

## MAC 주소 구조

![MAC 주소 구조](/assets/posts/network-mac-address-structure.svg)

### OUI (Organizationally Unique Identifier)

앞 3바이트(24비트)는 **제조사 식별자**로 IEEE가 제조사에게 부여한다. 예를 들어 `00:1A:E9`는 Apple의 OUI다.

```bash
# Linux에서 MAC 주소 확인
ip link show
# 또는
cat /sys/class/net/eth0/address

# macOS
ifconfig en0 | grep ether

# OUI 조회
# curl https://api.macvendors.com/AA:BB:CC:DD:EE:FF
```

### NIC Specific

뒤 3바이트(24비트)는 **제조사가 장치별로 할당**하는 고유 번호다. 같은 제조사의 제품 사이에서도 중복되지 않아야 한다.

### 특수 비트 (첫 번째 바이트)

첫 번째 바이트의 최하위 2비트가 특별한 의미를 갖는다.

```
첫 번째 바이트: 0xAA = 1010 1010
                                ↑↑
                              U/L I/G

비트 0 (I/G: Individual/Group):
  0 → Unicast: 특정 장치 하나를 지정
  1 → Multicast/Broadcast

비트 1 (U/L: Universal/Local):
  0 → UAA (Universally Administered): 제조사 부여, 전역적으로 유일
  1 → LAA (Locally Administered): 소프트웨어로 임의 설정

예) 가상화 환경의 가상 NIC:
  VMware: 00:0C:29:xx:xx:xx (UAA, VMware OUI)
  임의 MAC: 02:xx:xx:xx:xx:xx (U/L 비트=1, LAA)
```

## 유니캐스트·멀티캐스트·브로드캐스트

```
유니캐스트 (Unicast):
  I/G 비트 = 0
  특정 NIC 하나에 전달
  예: AA:BB:CC:DD:EE:FF

멀티캐스트 (Multicast):
  I/G 비트 = 1
  특정 그룹의 장치들에 전달
  IPv4 멀티캐스트: 01:00:5E:xx:xx:xx
  IPv6 멀티캐스트: 33:33:xx:xx:xx:xx

브로드캐스트 (Broadcast):
  FF:FF:FF:FF:FF:FF
  LAN 내 모든 장치에 전달
  ARP 요청, DHCP Discovery에 사용
```

## MAC 주소의 범위

![MAC 주소의 범위](/assets/posts/network-mac-address-scope.svg)

MAC 주소는 **같은 LAN(링크) 내에서만 유효**하다. 라우터를 넘어가면 Ethernet 프레임이 새로 만들어지며 MAC 주소가 변경된다.

```
패킷 이동 경로 예시:
  [Client] → [Router 1] → [Router 2] → [Server]

  Client  → Router 1 (Ethernet):
    Src MAC: Client의 MAC
    Dst MAC: Router 1의 MAC (default gateway)

  Router 1 → Router 2 (WAN):
    Ethernet 프레임 새로 생성
    Src MAC: Router 1 WAN 인터페이스 MAC
    Dst MAC: Router 2 WAN 인터페이스 MAC

  Router 2 → Server (Ethernet):
    Src MAC: Router 2 LAN 인터페이스 MAC
    Dst MAC: Server의 MAC (ARP로 확인)
```

## MAC 주소와 IP 주소의 역할 분리

```
MAC 주소 (L2):
  - 같은 네트워크(링크) 내 장치 식별
  - 스위치가 프레임 전달에 사용
  - 라우터를 넘으면 변경됨
  - 하드웨어에 고정 (LAA로 변경 가능)

IP 주소 (L3):
  - 전 네트워크에서 유일한 논리 주소
  - 라우터가 패킷 경로 결정에 사용
  - 라우터를 넘어도 유지됨
  - 소프트웨어적 할당 (DHCP)
```

## MAC 주소 변경 (MAC Spoofing)

MAC 주소는 소프트웨어로 변경 가능하다. 이를 MAC 스푸핑(Spoofing) 또는 MAC 클로닝이라고 한다.

```bash
# Linux에서 MAC 주소 임시 변경
ip link set dev eth0 down
ip link set dev eth0 address 02:11:22:33:44:55  # LAA (비트1=1)
ip link set dev eth0 up

# macOS (Network Preferences에서 변경 또는)
sudo ifconfig en0 ether 02:11:22:33:44:55

# Windows PowerShell
Set-NetAdapter -Name "Ethernet" -MacAddress "02-11-22-33-44-55"
```

합법적 사용: VPN, 가상화, 프라이버시 보호(iOS/Android의 랜덤 MAC).  
악의적 사용: MAC 필터 우회, ARP 스푸핑 공격.

## ip link 출력 해석

```bash
$ ip link show eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP
    link/ether aa:bb:cc:11:22:33 brd ff:ff:ff:ff:ff:ff
#              ↑ MAC 주소           ↑ 브로드캐스트 MAC
# MTU 1500: 이더넷 최대 전송 단위 (바이트)
```

---

**지난 글:** [오류 감지와 CRC](/posts/network-error-detection-crc/)

**다음 글:** [이더넷](/posts/network-ethernet/)

<br>
읽어주셔서 감사합니다. 😊
