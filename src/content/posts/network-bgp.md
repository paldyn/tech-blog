---
title: "BGP: 인터넷을 연결하는 경계 게이트웨이 프로토콜"
description: "BGP의 AS 구조, eBGP/iBGP 차이, 경로 속성(AS_PATH·LOCAL_PREF·MED), FSM 상태 머신, 경로 선택 알고리즘을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["BGP", "AS", "eBGP", "iBGP", "라우팅프로토콜", "인터넷라우팅", "AS_PATH"]
featured: false
draft: false
---

[지난 글](/posts/network-routing-table-lpm/)에서 최장 프리픽스 매칭으로 라우터가 경로를 선택하는 방식을 살펴봤다. 이번 글에서는 인터넷 자체를 연결하는 프로토콜, **BGP(Border Gateway Protocol)**를 다룬다. 전 세계 수만 개의 네트워크가 BGP로 경로 정보를 교환하며 인터넷이 동작한다.

## 자율 시스템 (Autonomous System, AS)

인터넷은 수많은 **자율 시스템(AS)**으로 구성된다. AS는 단일 조직이 관리하는 네트워크 집합으로, 고유한 **AS 번호(ASN)**를 가진다.

```text
AS 64500: ISP A (KT)
AS 64501: ISP B (SK Broadband)
AS 64502: 기업 네트워크 (삼성전자)
AS 13335: Cloudflare
AS 15169: Google
```

- **IANA**가 ASN을 할당 (1~64511: 공인, 64512~65535: 사설)
- 4바이트 ASN 도입으로 최대 4,294,967,295개 AS 지원

## eBGP vs iBGP

![BGP AS 구조](/assets/posts/network-bgp-architecture.svg)

| 구분 | eBGP | iBGP |
|------|------|------|
| 범위 | AS 간 | AS 내부 |
| TTL | 1 (직접 연결이 기본) | 255 (멀티홉 가능) |
| NEXT_HOP | 변경됨 | 유지됨 |
| 루프 방지 | AS_PATH | Split-Horizon |
| 요구 사항 | 없음 | 완전 메시(Full Mesh) 또는 Route Reflector |

iBGP는 AS 내부에서 eBGP로 받은 경로를 전파하기 위해 사용한다. 완전 메시 문제를 해결하기 위해 **Route Reflector**나 **BGP Confederation**을 구성한다.

## BGP 세션 수립 과정

![BGP FSM 상태 머신](/assets/posts/network-bgp-states.svg)

BGP는 **TCP 포트 179**를 사용한다. 두 라우터가 상호 TCP 연결을 맺고 OPEN 메시지로 파라미터를 협상한 뒤 Established 상태에 진입한다.

```bash
# FRRouting BGP 기본 설정
router bgp 64500
  bgp router-id 1.2.3.4
  neighbor 5.6.7.1 remote-as 64501     # eBGP 피어
  neighbor 10.0.0.2 remote-as 64500    # iBGP 피어
  !
  address-family ipv4 unicast
    network 1.2.3.0/24                 # 자신의 프리픽스 광고
    neighbor 5.6.7.1 activate
  exit-address-family
```

## 경로 속성과 선택 알고리즘

BGP는 **경로 벡터(Path Vector)** 프로토콜이다. 단순한 메트릭 대신 다양한 속성으로 경로를 선택한다. 선택 순서(높은 우선순위부터):

1. **Weight** (Cisco 독자 속성, 높을수록 선호)
2. **LOCAL_PREF** — AS 내부에서 선호 출구 지정 (높을수록 선호)
3. 로컬 프리픽스 여부
4. **AS_PATH 길이** — 짧을수록 선호 (루프 방지도 겸임)
5. **ORIGIN** — IGP > EGP > Incomplete
6. **MED(Multi-Exit Discriminator)** — 낮을수록 선호
7. eBGP > iBGP
8. 최저 IGP 메트릭

```text
# AS_PATH 예시: 64500 → 64501 → 64502 → 목적지
UPDATE 메시지:
  NLRI: 9.10.11.0/24
  AS_PATH: 64502 64501
  NEXT_HOP: 5.6.7.1
  LOCAL_PREF: 100
```

AS_PATH에 자신의 AS 번호가 있으면 루프로 판단해 경로를 버린다.

## 경로 필터링과 정책

BGP의 강력한 기능은 **세밀한 정책 제어**다. prefix-list, route-map으로 특정 경로를 허용·거부하거나 속성을 변경할 수 있다.

```bash
# 특정 프리픽스만 수신 허가
ip prefix-list ALLOW_PREFIXES seq 10 permit 1.2.3.0/24
ip prefix-list ALLOW_PREFIXES seq 20 deny 0.0.0.0/0 le 32

router bgp 64500
  neighbor 5.6.7.1 prefix-list ALLOW_PREFIXES in

# LOCAL_PREF로 선호 경로 지정 (인바운드 트래픽 제어)
route-map SET_PREF permit 10
  set local-preference 200

router bgp 64500
  neighbor 5.6.7.1 route-map SET_PREF in
```

## BGP 보안 이슈

BGP는 설계 당시 신뢰 기반으로 만들어졌다. 주요 보안 위협:

- **BGP Hijacking**: 다른 AS의 프리픽스를 허위로 광고 (2008년 파키스탄 텔레콤이 YouTube를 오프라인)
- **Route Leak**: 의도치 않게 경로를 다른 AS로 전파

대응 방법:
- **RPKI (Resource Public Key Infrastructure)**: AS가 자신의 프리픽스를 암호화 서명
- **ROA (Route Origin Authorization)**: 특정 ASN이 특정 프리픽스를 광고할 권한을 증명

```bash
# RPKI ROA 검증 활성화 (FRRouting)
router bgp 64500
  bgp rpki cache 192.168.1.100 port 3323
  !
  address-family ipv4 unicast
    bgp bestpath prefix-validate allow-invalid  # 또는 deny
```

---

**지난 글:** [라우팅 테이블과 LPM: 최장 프리픽스 매칭](/posts/network-routing-table-lpm/)

**다음 글:** [NAT: 네트워크 주소 변환의 모든 것](/posts/network-nat/)

<br>
읽어주셔서 감사합니다. 😊
