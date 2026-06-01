---
title: "NAT: 네트워크 주소 변환의 모든 것"
description: "SNAT·DNAT·NAPT(PAT)의 차이, NAT 변환 테이블, 포트 포워딩, NAT traversal, iptables 설정을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["NAT", "NAPT", "PAT", "포트포워딩", "SNAT", "DNAT", "iptables"]
featured: false
draft: false
---

[지난 글](/posts/network-bgp/)에서 BGP로 AS 간 경로를 교환하는 방식을 살펴봤다. 이번 글에서는 IPv4 주소 부족 문제를 실용적으로 해결한 **NAT(Network Address Translation)**을 다룬다. 가정용 공유기부터 대규모 엔터프라이즈 네트워크까지, NAT은 현대 네트워크의 핵심 기술이다.

## NAT이란?

NAT은 패킷이 라우터를 통과할 때 **IP 주소(또는 포트 번호)를 변환**하는 기술이다. 사설 IP 주소(`192.168.x.x`, `10.x.x.x`, `172.16~31.x.x`)를 가진 내부 호스트들이 하나의 공인 IP로 인터넷에 접속할 수 있게 해준다.

```text
사설 공간(RFC 1918):
  10.0.0.0/8        (16,777,216개 주소)
  172.16.0.0/12     (1,048,576개 주소)
  192.168.0.0/16    (65,536개 주소)
```

## NAT 종류

| 종류 | 변환 대상 | 방향 | 용도 |
|------|-----------|------|------|
| **SNAT** | 출발지 IP | 내→외 | 사설망이 인터넷 접속 |
| **DNAT** | 목적지 IP | 외→내 | 포트 포워딩, 로드밸런서 |
| **NAPT(PAT)** | IP + 포트 | 양방향 | 가정용 공유기(가장 일반적) |

### NAPT (Network Address Port Translation)

일명 **PAT(Port Address Translation)**. IP 주소뿐 아니라 **포트 번호도 함께 변환**해서 여러 사설 호스트가 하나의 공인 IP를 공유한다.

![NAT 변환 테이블](/assets/posts/network-nat-types.svg)

NAPT는 (사설 IP, 사설 포트) ↔ (공인 IP, 공인 포트)의 매핑을 NAT 변환 테이블에 저장한다. 반환 패킷이 도착하면 목적지 포트로 어느 사설 호스트에게 전달할지 역추적한다.

## 포트 포워딩 (DNAT)

외부 인터넷에서 사설망 내부 서버에 접근할 때 사용한다. 공인 IP의 특정 포트로 오는 트래픽을 내부 서버의 IP:포트로 전달한다.

![포트 포워딩 설정](/assets/posts/network-nat-port-forward.svg)

```bash
# Linux iptables NAT 설정

# 1. IP 포워딩 활성화
echo 1 > /proc/sys/net/ipv4/ip_forward

# 2. SNAT (MASQUERADE): 내부 → 인터넷
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# 3. DNAT: 인터넷 → 내부 웹 서버 (포트 포워딩)
iptables -t nat -A PREROUTING \
  -i eth0 -p tcp --dport 443 \
  -j DNAT --to-destination 192.168.0.80:443

# 4. FORWARD 체인 허용
iptables -A FORWARD -p tcp -d 192.168.0.80 --dport 443 -j ACCEPT
```

## NAT의 한계와 NAT Traversal

NAT은 **엔드투엔드 연결을 깨뜨린다**. 외부에서 사설망 내부 호스트로 직접 연결을 시작할 수 없기 때문에 P2P 통신, VoIP, 온라인 게임에서 문제가 된다.

이를 해결하는 기술이 **NAT Traversal**이다:

- **STUN (Session Traversal Utilities for NAT)**: 클라이언트가 자신의 공인 IP:포트를 STUN 서버에서 알아낸 후 상대방에게 전달
- **TURN (Traversal Using Relays around NAT)**: 릴레이 서버를 거쳐 통신 (성능 저하)
- **ICE (Interactive Connectivity Establishment)**: STUN + TURN 조합, WebRTC에서 사용

```javascript
// WebRTC ICE 설정 (브라우저)
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.example.com:3478' },
    {
      urls: 'turn:turn.example.com:3478',
      username: 'user',
      credential: 'password'
    }
  ]
});
```

## NAT의 유형별 특성

NAT 동작 방식에 따라 트래버설 난이도가 다르다:

| NAT 유형 | 포트 매핑 | 트래버설 |
|----------|-----------|----------|
| Full Cone | 고정 (어디서든 접근 가능) | 쉬움 |
| Restricted Cone | 연결한 IP만 접근 가능 | 중간 |
| Port Restricted | IP+포트 모두 일치해야 | 어려움 |
| Symmetric | 목적지마다 다른 포트 | 매우 어려움 |

IPv6 전환이 완료되면 NAT이 불필요해지지만, 보안·정책 목적의 NAT44나 NAT64(IPv6-IPv4 변환)는 계속 사용된다.

---

**지난 글:** [BGP: 인터넷을 연결하는 경계 게이트웨이 프로토콜](/posts/network-bgp/)

**다음 글:** [ICMP와 ping: 네트워크 진단의 기본 도구](/posts/network-icmp-ping/)

<br>
읽어주셔서 감사합니다. 😊
