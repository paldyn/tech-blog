---
title: "이더넷: LAN의 사실상 표준 기술"
description: "이더넷 프레임 구조(Preamble·MAC·EtherType·FCS), CSMA/CD 충돌 감지, 10Mbps부터 400GbE까지의 진화, MTU와 점보 프레임을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["이더넷", "이더넷프레임", "CSMA/CD", "MTU", "IEEE802.3", "LAN"]
featured: false
draft: false
---

[지난 글](/posts/network-mac-address/)에서 MAC 주소의 구조와 역할을 살펴봤다. 이번 글에서는 현대 유선 LAN의 표준인 **이더넷(Ethernet)**을 깊이 파고든다. 이더넷은 1970년대 제록스 PARC에서 개발돼 현재 데이터센터 400GbE까지 발전한, 가장 오래된 현역 네트워크 기술이다.

## 이더넷이란

이더넷(Ethernet)은 **IEEE 802.3 표준에 정의된 유선 LAN 기술**이다. 데이터링크 계층(L2)에서 동작하며 MAC 주소로 장치를 식별하고, 프레임 단위로 데이터를 전달한다.

이더넷의 핵심 특성:
- 동일 링크 내 장치 간 프레임 전달
- MAC 주소 기반 장치 식별
- CSMA/CD (반이중) 또는 전이중(Full-Duplex) 동작
- MTU 1500바이트 표준

## 이더넷 프레임 구조

![이더넷 프레임 구조](/assets/posts/network-ethernet-frame.svg)

```
이더넷 프레임 (Ethernet II) 상세:
┌──────────┬──────────┬──────────┬────────────────────────┬─────┐
│Preamble  │ Dst MAC  │ Src MAC  │ Payload (IP Packet)    │ FCS │
│7+1 bytes │ 6 bytes  │ 6 bytes  │ EtherType 2B + 46~1500B│ 4B  │
└──────────┴──────────┴──────────┴────────────────────────┴─────┘
총 최소: 64B (패딩 포함), 최대: 1522B (VLAN 태그 포함)
```

각 필드 설명:

**Preamble + SFD (8바이트)**: 수신 측 클럭 동기화를 위한 7바이트 동기화 패턴(AA AA AA AA AA AA AA) + 1바이트 SFD(Start Frame Delimiter: AB). 실제 이더넷 드라이버나 프레임 캡처 도구에서는 보통 생략된다.

**EtherType (2바이트)**: Payload에 담긴 상위 프로토콜을 식별한다.

```python
ETHER_TYPES = {
    0x0800: "IPv4",
    0x86DD: "IPv6",
    0x0806: "ARP",
    0x8100: "VLAN (802.1Q)",
    0x88A8: "Double VLAN (802.1ad)",
    0x8847: "MPLS Unicast",
    0x88CC: "LLDP",
}
```

**Payload (46~1500바이트)**: 상위 계층 데이터. 46바이트 미만이면 0으로 패딩. 1500바이트가 이더넷 **MTU(Maximum Transmission Unit)**다.

**FCS (4바이트)**: CRC-32로 프레임 오류 감지.

## MTU와 점보 프레임

```bash
# MTU 확인
ip link show eth0

# MTU 변경 (점보 프레임: 9000B)
sudo ip link set eth0 mtu 9000

# Path MTU 발견
ping -M do -s 1472 google.com
# -M do: fragmentation 금지
# -s 1472: 1472B 데이터 + IP(20)+ICMP(8) = 1500B
```

**점보 프레임(Jumbo Frame)**은 MTU를 9000바이트로 늘린 것이다. 데이터센터 스토리지 네트워크(NFS, iSCSI)에서 CPU 인터럽트 횟수를 줄이고 처리량을 높이기 위해 사용한다. 반드시 경로 전체 장비가 동일한 MTU를 지원해야 한다.

## CSMA/CD (충돌 감지)

공유 매체(허브 기반) 환경에서 이더넷은 **CSMA/CD(Carrier Sense Multiple Access with Collision Detection)**로 충돌을 처리한다.

![CSMA/CD 흐름](/assets/posts/network-ethernet-csma.svg)

```
CSMA/CD 동작:
1. 전송 전 매체 감지 (Carrier Sense)
2. 매체 idle이면 전송 시작
3. 전송 중 전압 변화로 충돌 감지 (Collision Detection)
4. 충돌 감지 시:
   a. Jam 신호(32비트) 전송 (충돌 알림)
   b. 1~2^k 슬롯 중 랜덤 대기 (Binary Exponential Backoff)
      k = 충돌 횟수 (최대 16)
   c. k > 16이면 포기
5. 충돌 없이 전송 완료
```

오늘날 스위치 기반 이더넷은 전이중(Full-Duplex) 동작이므로 실질적으로 CSMA/CD가 동작하지 않는다. 각 포트가 전용 채널이라 충돌이 없다.

## 이더넷 속도 발전

```
세대별 이더넷 표준:
  10BASE-T    (1990): 10 Mbps, Cat3 UTP, 허브
  100BASE-TX  (1995): 100 Mbps, Cat5 UTP, 스위치
  1000BASE-T  (1999): 1 Gbps, Cat5e UTP, 4쌍 동시 사용
  10GBASE-T   (2006): 10 Gbps, Cat6a UTP
  25GBASE-T         : 25 Gbps, 단거리 광섬유 또는 DAC
  40GbE/100GbE      : 데이터센터 서버 연결
  400GbE/800GbE     : 하이퍼스케일 데이터센터 스파인

광섬유 변형:
  -SX: 단파장 멀티모드 (단거리, ~300m)
  -LX: 장파장 싱글모드 (장거리, ~10km)
  -LR: 장거리 싱글모드 (~10km)
  -ER: 초장거리 (~40km)
```

## tcpdump로 이더넷 프레임 분석

```bash
# 이더넷 프레임 캡처 (링크 레벨)
sudo tcpdump -i eth0 -e -n

# 출력 예:
# 12:34:56.789 aa:bb:cc:11:22:33 > ff:ff:ff:ff:ff:ff, ethertype ARP (0x0806), length 60

# 특정 EtherType 필터
sudo tcpdump -i eth0 ether proto 0x0806  # ARP만
sudo tcpdump -i eth0 ether proto 0x0800  # IPv4만

# pcap 파일로 저장 후 Wireshark 분석
sudo tcpdump -i eth0 -w capture.pcap
```

## 이더넷 vs Wi-Fi

| 항목 | 이더넷 | Wi-Fi |
|------|--------|-------|
| 매체 | 케이블(UTP/광섬유) | 전파(2.4/5/6 GHz) |
| 충돌 감지 | CSMA/CD | CSMA/CA |
| 지연시간 | < 0.1ms (내부) | 1~10ms |
| 간섭 | 없음 | 있음 (다른 기기) |
| 보안 | 물리적 침입 필요 | 공기 중 도청 가능 |
| 표준 | IEEE 802.3 | IEEE 802.11 |

이더넷은 여전히 데이터센터·서버 연결의 표준이고, Wi-Fi는 이동성이 필요한 환경에서 사용한다. 현대 기업 네트워크는 이더넷 백본 위에 Wi-Fi 인프라를 구축하는 하이브리드 구조다.

---

**지난 글:** [MAC 주소](/posts/network-mac-address/)

<br>
읽어주셔서 감사합니다. 😊
