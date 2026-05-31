---
title: "IPv4 vs IPv6 완전 비교"
description: "IPv4 주소 고갈 문제와 IPv6 도입 배경, 128비트 주소 표기 규칙, 헤더 차이, 전환 기술(Dual Stack·터널링)을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["IPv4", "IPv6", "주소고갈", "Dual Stack", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-ip-addressing/)에서 IPv4 주소 구조와 사설/공인 IP를 살펴봤습니다. IPv4는 훌륭한 설계였지만, 32비트 주소 공간(약 43억 개)이 스마트폰·IoT 폭발적 성장으로 사실상 고갈됐습니다. IANA는 2011년 마지막 IPv4 블록을 배분했습니다. 이를 해결하기 위해 설계된 것이 **IPv6**입니다.

## IPv4 주소 고갈 문제

```text
IPv4 총 주소: 2^32 = 약 4,294,967,296 (43억 개)
전 세계 IoT 기기 (2024년 예측): 약 170억 개
인터넷 연결 스마트폰: 약 55억 대

→ 43억으로는 절대 부족
```

NAT(사설 IP + 공인 IP 1개 공유)로 임시 해결해왔지만, 종단 간 연결성을 깨고 복잡성을 높이는 문제가 있습니다.

## IPv6란

IPv6는 1995년 IETF가 설계하고 1998년 RFC 2460으로 정식 표준화된 **128비트 주소 체계**입니다.

```text
IPv6 총 주소: 2^128 = 약 3.4 × 10^38 개
= 340,282,366,920,938,463,463,374,607,431,768,211,456 개
= 지구 표면 1제곱미터당 약 665,570,793,348,866,943 개
```

사실상 **무한에 가까운** 주소 공간으로, NAT 없이 모든 장치가 전역 주소를 가질 수 있습니다.

## IPv4 vs IPv6 핵심 비교

![IPv4 vs IPv6 비교](/assets/posts/network-ipv4-vs-ipv6-comparison.svg)

## IPv6 주소 표기

IPv6는 128비트를 16비트 8개 그룹으로 나눠 16진수로 표기합니다.

![IPv6 주소 표기와 축약](/assets/posts/network-ipv4-vs-ipv6-address.svg)

```text
전체:   2001:0db8:0000:0000:0000:0000:0000:0001
규칙 1: 2001:db8:0:0:0:0:0:1        (각 그룹 앞자리 0 생략)
규칙 2: 2001:db8::1                  (연속 0 그룹을 :: 로 1번만 축약)
```

`::` 축약은 주소당 한 번만 가능합니다. `2001::db8::1`처럼 두 번 쓰면 모호해집니다.

### 특수 IPv6 주소

```text
::1              루프백 (IPv4의 127.0.0.1)
::               미지정 주소 (IPv4의 0.0.0.0)
fe80::/10        링크로컬 (자동 생성, 라우터 넘어가지 않음)
fc00::/7         고유 로컬 (Unique Local, IPv4 사설 주소 대응)
ff00::/8         멀티캐스트 (IPv6에는 브로드캐스트 없음)
2001:db8::/32    문서·예제용 예약 (RFC 3849)
```

## IPv6 헤더 개선

IPv4 헤더는 20~60바이트로 가변적이지만, IPv6 기본 헤더는 **정확히 40바이트 고정**입니다.

```text
IPv6 헤더 필드 (IPv4와 비교):
  Version(4) + Traffic Class(8) + Flow Label(20)
  Payload Length(16) + Next Header(8) + Hop Limit(8)
  Source Address(128) + Destination Address(128)

제거된 IPv4 필드:
  - Checksum: 하위 계층(이더넷)과 상위 계층(TCP)이 담당
  - Fragment 관련 필드: 라우터에서 단편화 금지 (송신 측이 담당)
  - IHL, Options: 확장 헤더(Extension Header)로 분리
```

라우터가 헤더 길이를 계산하거나 체크섬을 검증할 필요가 없어 **처리 속도가 개선**됩니다.

## 자동 주소 설정 — SLAAC

IPv6의 대표적 편의 기능은 **SLAAC(Stateless Address Autoconfiguration)** 입니다. DHCP 서버 없이도 자동으로 주소를 설정합니다.

```text
SLAAC 동작:
1. 장치 부팅 시 fe80::/10 링크로컬 주소 자동 생성
   (MAC 주소로부터 EUI-64 방식으로 생성)

2. 라우터에게 Router Solicitation(RS) 전송
3. 라우터가 네트워크 프리픽스(예: 2001:db8::/64) 응답
4. 장치가 프리픽스 + 인터페이스 ID 결합으로 전역 주소 생성
```

## IPv4 → IPv6 전환 기술

아직 인터넷 대부분이 IPv4를 사용하므로 전환 기술이 필요합니다.

```text
1. Dual Stack (이중 스택)
   → 장치에 IPv4 + IPv6 주소 모두 부여
   → 상대방 지원에 따라 자동 선택 (가장 일반적)

2. 터널링 (Tunneling)
   → IPv6 패킷을 IPv4 패킷 안에 캡슐화해 전송
   → 6to4, 6in4, Teredo 등

3. NAT64 / DNS64
   → IPv6 전용 클라이언트가 IPv4 서버와 통신
   → DNS64가 A 레코드를 AAAA로 변환, NAT64가 패킷 변환
```

## 현재 IPv6 보급 현황

```bash
# 내 시스템의 IPv6 주소 확인
ip -6 addr show          # Linux
ifconfig | grep inet6    # macOS

# IPv6 연결 테스트
ping6 ::1                # 루프백 테스트
ping6 2001:4860:4860::8888  # Google DNS IPv6
```

Google의 IPv6 통계에 따르면 2024년 기준 전 세계 사용자의 약 45% 이상이 IPv6로 Google에 접속하고 있습니다. 한국은 LTE/5G의 IPv6 기본 채택으로 보급률이 높은 편입니다.

다음 글에서는 IPv4 주소를 효율적으로 분할하는 **서브네팅(Subnetting)** 을 다룹니다.

---

**지난 글:** [IP 주소 지정 완전 이해](/posts/network-ip-addressing/)

**다음 글:** [서브네팅 완전 이해](/posts/network-subnetting/)

<br>
읽어주셔서 감사합니다. 😊
