---
title: "ARP 완전 이해"
description: "IP 주소를 MAC 주소로 변환하는 ARP 프로토콜의 동작 원리, 패킷 구조, ARP 캐시, Gratuitous ARP와 ARP 스푸핑을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["ARP", "MAC주소", "IP주소", "이더넷", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-ethernet/)에서 이더넷 프레임이 목적지 MAC 주소를 기반으로 전달된다는 것을 확인했습니다. 그런데 우리가 통신할 때는 보통 IP 주소만 알고 있습니다. **ARP(Address Resolution Protocol)** 는 이 간극을 메워주는 프로토콜입니다. "이 IP를 가진 장치의 MAC 주소가 뭐야?"라는 질문을 네트워크에 던지는 역할입니다.

## ARP가 필요한 이유

이더넷 프레임을 전송하려면 **목적지 MAC 주소**가 반드시 필요합니다. 하지만 애플리케이션은 IP 주소를 사용해 통신합니다.

```text
상황: PC-A(192.168.1.10)가 PC-B(192.168.1.20)에게 데이터 전송 시도

IP 패킷: 목적지 IP = 192.168.1.20  ✓ (알고 있음)
이더넷 프레임: 목적지 MAC = ???      ✗ (모름)
```

이 "???"를 해결하는 것이 ARP입니다.

## ARP 동작 과정

![ARP 동작 흐름](/assets/posts/network-arp-flow.svg)

```text
1. PC-A가 ARP 브로드캐스트 전송
   → 목적지 MAC: FF:FF:FF:FF:FF:FF (전체 장치)
   → "192.168.1.20의 MAC 주소를 알려주세요"

2. 같은 네트워크의 모든 장치가 수신
   → PC-C(192.168.1.30): "내 IP 아님" → 무시
   → PC-B(192.168.1.20): "내 IP!" → 응답

3. PC-B가 ARP 유니캐스트 응답
   → 목적지: PC-A의 MAC 주소 (이미 Request에 포함)
   → "내 MAC은 BB:BB:BB:BB:BB:BB입니다"

4. PC-A가 ARP 캐시에 저장
   → 192.168.1.20 = BB:BB:BB:BB:BB:BB
   → 이후 통신 시 ARP 없이 바로 사용
```

## ARP 패킷 구조

![ARP 패킷 구조](/assets/posts/network-arp-packet.svg)

ARP 패킷의 핵심 필드는 Opcode입니다. `1 = Request`, `2 = Reply`로 구분하며, 나머지 구조는 동일합니다.

```bash
# tcpdump로 ARP 패킷 캡처
sudo tcpdump -i eth0 arp -v

# 출력 예시:
# ARP, Request who-has 192.168.1.20 tell 192.168.1.10, length 28
# ARP, Reply 192.168.1.20 is-at bb:bb:bb:bb:bb:bb, length 28
```

## ARP 캐시

ARP 결과는 OS가 일정 시간 **캐시**에 보관합니다. 매번 브로드캐스트를 보내면 네트워크 트래픽이 증가하므로, 캐시 TTL 동안은 재사용합니다.

```bash
# ARP 캐시 확인
arp -n          # Linux (구식)
ip neigh show   # Linux (최신)
arp -a          # macOS / Windows

# 출력 예시:
# 192.168.1.1  dev eth0  lladdr 00:11:22:33:44:55  REACHABLE
# 192.168.1.20 dev eth0  lladdr bb:bb:bb:bb:bb:bb  STALE

# REACHABLE: 최근 사용, STALE: 일정 시간 미사용 (재확인 대기)
```

## Gratuitous ARP

**Gratuitous ARP**는 요청 없이 자신의 MAC 주소를 네트워크에 알리는 특수 ARP입니다.

```text
사용 사례:
1. IP 충돌 감지
   → 부팅 시 자신의 IP로 ARP Request 전송
   → 응답이 오면 IP 충돌!

2. 장애 조치 (Failover)
   → 가상 IP를 새 서버로 이전 시
   → Gratuitous ARP로 스위치 CAM 테이블 즉시 갱신

3. 로드밸런서, 고가용성 클러스터
```

## ARP 스푸핑 (보안 위협)

ARP는 **인증 없이** 동작합니다. 악의적 장치가 허위 ARP Reply를 보내면 다른 장치의 ARP 캐시를 오염시킬 수 있습니다.

```text
ARP 스푸핑 공격:
  악성 PC가 "192.168.1.1(게이트웨이)의 MAC은 나야!"라고 허위 Reply
  → 피해자 PC의 ARP 캐시가 오염
  → 모든 트래픽이 악성 PC를 거치게 됨 (중간자 공격)
```

방어 방법으로는 **Dynamic ARP Inspection(DAI)**, 정적 ARP 항목 설정, VPN 등이 있습니다.

## ARP와 라우터의 관계

ARP는 **같은 네트워크(서브넷) 내에서만** 동작합니다. 다른 네트워크의 장치에게 데이터를 보낼 때는 게이트웨이(라우터)의 MAC 주소로 프레임을 전송하고, 라우터가 이후 경로를 처리합니다.

```text
목적지가 192.168.2.50 (다른 서브넷)인 경우:
  PC-A → (ARP로) 게이트웨이 MAC 확인
  PC-A → 프레임 목적지 MAC = 게이트웨이 MAC
  라우터 → IP 패킷 목적지 192.168.2.50으로 라우팅
```

다음 글에서는 논리 주소 체계인 **IP 주소 지정** 방법을 자세히 살펴봅니다.

---

**지난 글:** [이더넷 완전 이해](/posts/network-ethernet/)

**다음 글:** [IP 주소 지정 완전 이해](/posts/network-ip-addressing/)

<br>
읽어주셔서 감사합니다. 😊
