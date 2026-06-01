---
title: "브로드캐스트·멀티캐스트·애니캐스트: IP 전송 방식 완전 정리"
description: "유니캐스트·브로드캐스트·멀티캐스트·애니캐스트의 차이를 주소 범위, IGMP, 실제 활용 예시와 함께 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "Network"
tags: ["브로드캐스트", "멀티캐스트", "애니캐스트", "IGMP", "IPv6멀티캐스트", "네트워크전송방식"]
featured: false
draft: false
---

[지난 글](/posts/network-ttl/)에서 TTL이 패킷 유효 기간을 제한하고 traceroute의 원리가 되는 방식을 살펴봤다. 이번 글에서는 IP 계층의 **전송 방식(transmission mode)**을 다룬다. 같은 데이터를 "누구에게" 보내느냐에 따라 유니캐스트·브로드캐스트·멀티캐스트·애니캐스트 네 가지로 나뉘며, 각각의 주소 체계와 프로토콜이 존재한다.

## 전송 방식 비교

![브로드캐스트·멀티캐스트·애니캐스트 전송 방식](/assets/posts/network-broadcast-multicast-anycast-types.svg)

| 방식 | 수신자 | IPv4 주소 | IPv6 지원 |
|------|--------|-----------|-----------|
| 유니캐스트 | 1명 | 일반 호스트 주소 | ✓ |
| 브로드캐스트 | 서브넷 전체 | 255.255.255.255 / x.x.x.255 | ✗ (없음) |
| 멀티캐스트 | 구독 그룹 | 224.0.0.0/4 | ff00::/8 |
| 애니캐스트 | 최근접 1명 | BGP로 관리 | 기본 지원 |

IPv6는 브로드캐스트를 완전히 제거하고 멀티캐스트로 대체했다. 예를 들어 `ff02::1`은 링크 로컬 내 모든 노드, `ff02::2`는 모든 라우터에 해당한다.

## 브로드캐스트

브로드캐스트는 같은 서브넷에 속한 **모든 호스트**에게 패킷을 전달한다.

- **Limited Broadcast** `255.255.255.255`: 현재 서브넷 안에서만 전달. 라우터가 포워딩하지 않음
- **Directed Broadcast** `192.168.1.255`: 특정 서브넷의 모든 호스트. 기본적으로 라우터가 차단(RFC 2644)

```text
# DHCP Discover는 브로드캐스트를 사용한다 (클라이언트가 아직 IP 모름)
Src: 0.0.0.0:68  →  Dst: 255.255.255.255:67
```

브로드캐스트 도메인은 VLAN이나 라우터로 분리된다. 브로드캐스트가 많으면 **브로드캐스트 스톰**이 발생해 네트워크 성능이 크게 저하된다.

## 멀티캐스트

멀티캐스트는 특정 그룹에 **가입(subscribe)한 호스트들**에게만 패킷을 전달한다. 동일 스트림을 수백 명에게 보낼 때 유니캐스트 대비 대역폭을 크게 절약할 수 있다.

### IGMP (Internet Group Management Protocol)

호스트가 멀티캐스트 그룹에 가입하거나 탈퇴할 때 라우터에게 알리는 프로토콜이다.

![IGMP 그룹 관리](/assets/posts/network-broadcast-multicast-anycast-igmp.svg)

```python
import socket, struct

# 멀티캐스트 소켓 생성 및 그룹 가입
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock.bind(('', 5007))

# IP_ADD_MEMBERSHIP: 224.1.2.3 그룹에 가입
mreq = struct.pack("4sL", socket.inet_aton("224.1.2.3"), socket.INADDR_ANY)
sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

data, addr = sock.recvfrom(1024)
print(f"수신: {data} from {addr}")
```

멀티캐스트 라우팅 프로토콜로는 PIM-SM(Protocol Independent Multicast - Sparse Mode)이 주로 사용되며, RP(Rendezvous Point)를 기준으로 배포 트리를 구성한다.

### IPv4 멀티캐스트 주소 범위

| 범위 | 용도 |
|------|------|
| 224.0.0.0/24 | 링크 로컬 (라우터 미전달) |
| 224.0.0.1 | All Hosts (서브넷 전체) |
| 224.0.0.2 | All Routers |
| 224.0.1.0/24 | Internetwork Control |
| 239.0.0.0/8 | 관리자 정의(사설) |

## 애니캐스트

애니캐스트는 동일한 IP 주소를 여러 노드가 공유하되, **라우팅상 가장 가까운 노드** 하나만 실제로 수신한다. BGP 라우팅이 경로를 결정한다.

```text
# DNS 루트 서버 K root (193.0.14.129) - 전 세계 분산
# 클라이언트는 같은 IP로 질의하지만 네트워크상 가장 가까운 인스턴스가 응답
$ dig +short NS .
# → a.root-servers.net, b.root-servers.net ... k.root-servers.net

# traceroute로 실제 경로 확인 (지역마다 다른 홉 수)
$ traceroute 193.0.14.129
```

대표적 활용 사례:
- **DNS 루트 서버**: 13개 IP이지만 실제 서버는 전 세계 600개+ (애니캐스트로 분산)
- **CDN**: Cloudflare, Akamai 등의 PoP 라우팅
- **DDoS 완화**: 공격 트래픽을 여러 PoP에 분산 흡수

IPv6에서는 서브넷의 첫 번째 주소를 라우터 애니캐스트 주소로 예약하는 등 프로토콜 수준에서 지원한다.

## 정리

브로드캐스트는 구현이 단순하지만 확장성이 없어 IPv6에서 제거됐다. 멀티캐스트는 스트리밍·금융 시세 같은 1:N 트래픽에 효율적이나, 네트워크 인프라 지원이 필요하다. 애니캐스트는 지리적 부하분산과 고가용성에 유용하며, DNS와 CDN의 핵심 기술이 됐다.

---

**지난 글:** [TTL: 패킷의 유효 기간과 traceroute의 원리](/posts/network-ttl/)

**다음 글:** [IPv6 SLAAC: 상태 비저장 주소 자동 구성](/posts/network-ipv6-slaac/)

<br>
읽어주셔서 감사합니다. 😊
