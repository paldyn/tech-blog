---
title: "DHCP: 동적 IP 주소 할당의 원리"
description: "DHCP DORA 4단계, 임대 갱신, 주요 옵션, 릴레이 에이전트, DHCPv6와 snooping을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["DHCP", "DORA", "임대갱신", "DHCPv6", "DHCP릴레이", "IP할당"]
featured: false
draft: false
---

[지난 글](/posts/network-icmp-ping/)에서 ICMP와 ping으로 네트워크를 진단하는 방법을 살펴봤다. 이번 글에서는 네트워크에 연결될 때 자동으로 IP 주소를 받아오는 **DHCP(Dynamic Host Configuration Protocol)**를 다룬다.

## DHCP란?

DHCP(RFC 2131)는 호스트가 네트워크에 연결될 때 **IP 주소, 서브넷 마스크, 기본 게이트웨이, DNS 서버** 등을 자동으로 받아오는 프로토콜이다. UDP 포트 67(서버)과 68(클라이언트)을 사용한다.

## DORA: 주소 할당 4단계

![DHCP DORA 과정](/assets/posts/network-dhcp-process.svg)

**D-O-R-A**는 Discover → Offer → Request → Acknowledge의 약자다.

1. **DISCOVER**: 클라이언트가 `255.255.255.255`로 브로드캐스트, IP 없음(0.0.0.0)
2. **OFFER**: 서버가 사용 가능한 IP를 제안 (일시 예약)
3. **REQUEST**: 클라이언트가 특정 서버의 제안을 수락(브로드캐스트로 전송해 다른 서버에게도 알림)
4. **ACK**: 서버가 확정, 구성 정보 전달

```bash
# dhclient로 수동 DHCP 요청 (Linux)
dhclient -v eth0

# tcpdump로 DHCP 패킷 캡처
tcpdump -i eth0 -n port 67 or port 68

# 현재 임대 정보 확인
cat /var/lib/dhclient/dhclient.leases

# 임대 갱신 강제 실행
dhclient -r eth0 && dhclient eth0
```

## 임대 갱신 (Lease Renewal)

DHCP는 IP를 **임대 기간(lease time)** 동안만 제공한다. 기간이 지나도 갱신하지 않으면 IP를 회수한다.

| 타이머 | 기본값 | 동작 |
|--------|--------|------|
| T1 (Renewal) | lease * 0.5 | 서버에게 유니캐스트로 갱신 요청 |
| T2 (Rebinding) | lease * 0.875 | 모든 서버에게 브로드캐스트로 갱신 요청 |
| 만료 | lease 100% | IP 반납, DORA 재시작 |

## DHCP 옵션과 서버 설정

![DHCP 옵션과 ISC 서버 설정](/assets/posts/network-dhcp-options.svg)

DHCP는 기본 네트워크 설정 외에도 다양한 **옵션(Option)**으로 추가 정보를 전달한다.

```bash
# Linux에서 DHCP로 받은 정보 확인
ip addr show eth0
ip route show
resolvectl status

# NetworkManager로 확인
nmcli device show eth0 | grep DHCP
```

## DHCP 릴레이 에이전트

DHCP는 브로드캐스트를 사용하므로 기본적으로 라우터를 넘지 못한다. 다른 서브넷의 호스트에게 IP를 할당하려면 **DHCP 릴레이 에이전트**가 필요하다.

```bash
# Linux에서 DHCP 릴레이 설정 (dhcrelay)
dhcrelay -i eth0 -i eth1 192.168.1.10  # DHCP 서버 IP

# Cisco 라우터에서 릴레이 설정
interface GigabitEthernet0/0
  ip helper-address 192.168.1.10
```

릴레이 에이전트는 클라이언트의 브로드캐스트를 유니캐스트로 변환해 DHCP 서버로 전달하고, 서버 응답을 다시 클라이언트에게 전달한다.

## DHCPv6

IPv6 환경에서는 **DHCPv6**(RFC 3315)가 사용된다. SLAAC으로 주소를 받더라도 DNS 등 추가 정보는 DHCPv6로 받는 경우가 많다.

```bash
# DHCPv6 클라이언트 요청
dhclient -6 eth0

# radvd + DHCPv6 혼합 사용 (O 플래그)
# RA에서 O=1이면 DNS 등은 DHCPv6에서 받음
```

## DHCP Snooping (보안)

**DHCP Snooping**은 스위치 레벨에서 가짜 DHCP 서버(Rogue DHCP)를 차단하는 보안 기능이다.

```text
스위치 포트 설정:
- Trusted port: 실제 DHCP 서버로 향하는 업링크
- Untrusted port: 클라이언트 포트 (DHCP Offer/ACK 응답 차단)

Rogue DHCP 공격:
  공격자가 가짜 DHCP 서버를 운영해 잘못된 게이트웨이를 배포
  → 중간자 공격(MITM)으로 트래픽 가로채기 가능
```

---

**지난 글:** [ICMP와 ping: 네트워크 진단의 기본 도구](/posts/network-icmp-ping/)

**다음 글:** [전송 계층: TCP와 UDP의 역할](/posts/network-transport-layer/)

<br>
읽어주셔서 감사합니다. 😊
