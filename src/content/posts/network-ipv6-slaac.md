---
title: "IPv6 SLAAC: 상태 비저장 주소 자동 구성"
description: "IPv6 SLAAC의 동작 과정, EUI-64 인터페이스 ID 생성, DAD, RA/RS, Privacy Extensions를 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["IPv6", "SLAAC", "EUI-64", "DAD", "RouterAdvertisement", "Privacy Extensions"]
featured: false
draft: false
---

[지난 글](/posts/network-broadcast-multicast-anycast/)에서 브로드캐스트·멀티캐스트·애니캐스트 전송 방식을 살펴봤다. 이번 글에서는 IPv6의 핵심 기능 중 하나인 **SLAAC(Stateless Address Autoconfiguration)**을 다룬다. DHCP 서버 없이 호스트 스스로 전역 IPv6 주소를 생성하는 메커니즘이다.

## SLAAC이란?

SLAAC(RFC 4862)는 IPv6 호스트가 **라우터의 광고(RA)**와 자신의 **인터페이스 식별자**를 결합해 전역 유니캐스트 주소를 자동으로 구성하는 방식이다. 상태 비저장(stateless)이므로 서버가 주소 할당 기록을 유지할 필요가 없다.

## SLAAC 동작 과정

![IPv6 SLAAC 주소 자동 구성 과정](/assets/posts/network-ipv6-slaac-process.svg)

### 1단계: 링크 로컬 주소 생성

부팅 직후 호스트는 `fe80::/10` 프리픽스와 인터페이스 ID를 합쳐 링크 로컬 주소를 만든다. 이 주소는 같은 링크(세그먼트) 안에서만 유효하다.

```bash
# 링크 로컬 주소 확인
ip -6 addr show eth0 | grep 'scope link'
# inet6 fe80::a1b2:c3d4:e5f6:0001/64 scope link
```

### 2단계: DAD (Duplicate Address Detection)

생성한 주소가 이미 사용 중인지 확인한다. Neighbor Solicitation(NS) 메시지를 `ff02::1:ffXX:XXXX` (Solicited-Node 멀티캐스트)로 전송하고, 응답이 없으면 해당 주소를 사용한다.

```text
NS: "이 주소(fe80::...)를 쓰는 노드 있습니까?"
NA: 응답 있음 → 주소 충돌, 재생성 필요
   응답 없음 → 주소 사용 가능
```

### 3단계: RS (Router Solicitation) 전송

링크 로컬 주소가 확정되면 호스트는 `ff02::2`(All Routers 멀티캐스트)로 RS를 전송해 라우터에게 프리픽스 정보를 요청한다.

### 4단계: RA (Router Advertisement) 수신

라우터가 호스트에게 다음 정보를 포함한 RA를 응답한다:
- **프리픽스**: `2001:db8::/64` 같은 서브넷 프리픽스
- **기본 게이트웨이**: 라우터의 링크 로컬 주소
- **플래그**: M(Managed) - DHCPv6로 주소 받을지, O(Other) - DNS 등 기타 정보를 DHCPv6로 받을지

### 5·6단계: 글로벌 주소 생성 및 DAD

호스트는 RA의 프리픽스(64비트)와 인터페이스 ID(64비트)를 합쳐 글로벌 유니캐스트 주소를 만들고, 다시 DAD로 중복을 확인한다.

## EUI-64: 인터페이스 ID 생성

![EUI-64 MAC에서 IPv6 인터페이스 ID 변환](/assets/posts/network-ipv6-slaac-eui64.svg)

EUI-64 방식은 48비트 MAC 주소를 64비트 인터페이스 ID로 변환한다:

1. MAC 주소 3바이트 OUI + 3바이트 NIC 사이에 `FF:FE` 삽입 (48 → 64비트)
2. OUI의 7번째 비트(U/L 비트, Universal/Local)를 반전

```python
def mac_to_eui64(mac: str) -> str:
    parts = mac.split(':')
    # FF:FE 삽입
    parts = parts[:3] + ['ff', 'fe'] + parts[3:]
    # 7번째 비트 반전 (첫 바이트 XOR 0x02)
    parts[0] = format(int(parts[0], 16) ^ 0x02, '02x')
    # 16비트 그룹으로 묶기
    return ':'.join(''.join(parts[i:i+2]) for i in range(0, 8, 2))

print(mac_to_eui64("00:1a:2b:3c:4d:5e"))
# → 021a:2bff:fe3c:4d5e
```

### Privacy Extensions (RFC 4941)

EUI-64는 MAC 주소를 직접 노출하므로 사용자 추적이 가능하다. 현대 OS는 **Privacy Extensions**를 기본 활성화해 임의 인터페이스 ID를 주기적으로 갱신한다.

```bash
# Linux에서 Privacy Extensions 확인
cat /proc/sys/net/ipv6/conf/eth0/use_tempaddr
# 2 = 임시 주소 생성(권장), 0 = 비활성
```

## RA 플래그와 DHCPv6 연동

RA에는 두 개의 핵심 플래그가 있다:

| 플래그 | 의미 | 동작 |
|--------|------|------|
| M=0, O=0 | 순수 SLAAC | 주소 + DNS 모두 RA에서 획득 |
| M=0, O=1 | SLAAC + Stateless DHCPv6 | 주소는 SLAAC, DNS 등은 DHCPv6 |
| M=1 | Stateful DHCPv6 | 주소 자체를 DHCPv6에서 할당 |

```text
# radvd.conf (Linux 라우터 설정 예시)
interface eth0 {
    AdvSendAdvert on;
    MinRtrAdvInterval 3;
    MaxRtrAdvInterval 10;
    AdvManagedFlag off;    # M=0: SLAAC 사용
    AdvOtherConfigFlag on; # O=1: DNS는 DHCPv6
    prefix 2001:db8::/64 {
        AdvOnLink on;
        AdvAutonomous on;  # SLAAC 허용
    };
};
```

SLAAC은 서버가 없어도 되는 단순함이 장점이지만, 특정 IP를 특정 호스트에 고정 할당하려면 Stateful DHCPv6가 필요하다.

---

**지난 글:** [브로드캐스트·멀티캐스트·애니캐스트: IP 전송 방식 완전 정리](/posts/network-broadcast-multicast-anycast/)

**다음 글:** [라우팅 기초: 패킷이 목적지를 찾아가는 방법](/posts/network-routing-basics/)

<br>
읽어주셔서 감사합니다. 😊
