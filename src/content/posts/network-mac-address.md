---
title: "MAC 주소: 이더넷의 물리적 식별자"
description: "MAC 주소의 48비트 구조, OUI와 NIC 식별자, 유니캐스트/멀티캐스트/브로드캐스트 구분, IP 주소와의 차이, 조회 명령어를 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["MAC주소", "이더넷", "OUI", "ARP", "L2", "네트워크", "물리주소"]
featured: false
draft: false
---

[지난 글](/posts/network-error-detection-crc/)에서 이더넷 프레임의 FCS를 통해 오류를 감지하는 방법을 살펴봤다. 이더넷 프레임이 목적지를 찾아가려면 주소가 필요하다. L2에서 사용하는 주소가 **MAC 주소(Media Access Control Address)**다.

## MAC 주소란

MAC 주소는 네트워크 인터페이스 카드(NIC)에 부여된 **48비트 물리 주소**다. 제조 시 하드웨어에 새겨지기 때문에 **하드웨어 주소** 또는 **물리 주소**라고도 한다.

```text
표기 형식:
00:1A:2B:3C:4D:5E  (콜론 구분, 각 바이트 16진수)
00-1A-2B-3C-4D-5E  (하이픈, Windows 스타일)
001A.2B3C.4D5E     (Cisco 스타일)
```

![MAC 주소 구조](/assets/posts/network-mac-address-structure.svg)

## OUI와 NIC 식별자

MAC 주소는 두 부분으로 나뉜다.

- **상위 24비트 (OUI, Organizationally Unique Identifier)**: IEEE가 제조사에 할당하는 식별자
- **하위 24비트**: 제조사가 각 NIC에 부여하는 고유 번호

```bash
# OUI 데이터베이스로 제조사 확인
# 예: 00:50:56은 VMware
curl -s "https://api.macvendors.com/00:50:56:aa:bb:cc"
# → VMware, Inc.
```

## 특수 비트: U/L과 I/G

첫 번째 옥텟의 두 비트가 MAC 주소의 특성을 결정한다.

```text
첫 번째 옥텟: XX:......
비트 0 (LSB) — I/G 비트:
  0 = 유니캐스트 (특정 NIC 하나)
  1 = 멀티캐스트 또는 브로드캐스트

비트 1 — U/L 비트:
  0 = 전역 고유 (OUI 기반, 제조사 할당)
  1 = 로컬 관리 (소프트웨어로 임의 설정)
```

가상화 환경(VM, Docker)의 가상 NIC는 U/L 비트를 1로 설정해 OUI 충돌을 피한다.

## 특수 주소

```text
FF:FF:FF:FF:FF:FF  → 이더넷 브로드캐스트 (같은 LAN 전체)
01:00:5E:xx:xx:xx  → IPv4 멀티캐스트 (하위 23비트는 IP 멀티캐스트 주소)
33:33:xx:xx:xx:xx  → IPv6 멀티캐스트
```

브로드캐스트 프레임은 스위치가 모든 포트로 전달하며, 모든 NIC가 수신한다. ARP, DHCP 요청이 브로드캐스트를 사용하는 대표적 예다.

## MAC 주소 vs IP 주소

![MAC 주소 vs IP 주소](/assets/posts/network-mac-address-vs-ip.svg)

핵심 차이: **MAC 주소는 같은 LAN 내에서만 유효하다.** 이더넷 프레임이 라우터를 넘어가면, 라우터는 새로운 MAC 주소로 새 이더넷 프레임을 만든다. IP 주소는 변하지 않는다.

## 실전 명령어

```bash
# Linux: MAC 주소 확인
ip link show
# 또는
ip addr show eth0 | grep ether

# macOS
ifconfig en0 | grep ether

# Windows
ipconfig /all | findstr "Physical"

# Linux: MAC 주소 임시 변경 (재부팅 시 초기화)
ip link set dev eth0 down
ip link set dev eth0 address 02:00:00:00:00:01
ip link set dev eth0 up
```

## MAC 스푸핑

MAC 주소는 소프트웨어로 변경할 수 있다. 이를 **MAC 스푸핑**이라 한다. 프라이버시 보호(Wi-Fi 추적 방지), 네트워크 접근 우회, 로드 밸런싱 테스트 등 다양한 용도로 사용된다.

```bash
# NetworkManager로 무작위 MAC 주소 설정 (Linux)
# /etc/NetworkManager/conf.d/random-mac.conf
[device]
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=random
```

현대 스마트폰(iOS 14+, Android 10+)은 Wi-Fi 스캔 시 무작위 MAC 주소를 사용해 사용자 추적을 방지한다.

---

**지난 글:** [오류 감지: CRC와 체크섬](/posts/network-error-detection-crc/)

**다음 글:** [이더넷: LAN의 표준 프로토콜](/posts/network-ethernet/)

<br>
읽어주셔서 감사합니다. 😊
