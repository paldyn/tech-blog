---
title: "DNSSEC: DNS 보안 확장"
description: "DNS 스푸핑 공격 원리와 DNSSEC의 디지털 서명 체계, KSK/ZSK/DS 레코드, NSEC3까지 완전 정리"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["DNSSEC", "DNS", "보안", "디지털서명", "네트워크"]
featured: false
draft: false
---

## DNS는 왜 위험한가?

DNS는 설계 당시 보안을 고려하지 않았습니다. 응답이 IP, UDP로 오기 때문에 공격자가 **위조 응답을 리졸버에 먼저 전달**하면 클라이언트는 가짜 IP를 받습니다. 이를 **DNS 스푸핑(캐시 포이즈닝)** 이라고 합니다.

2008년 Dan Kaminsky가 발견한 취약점은 리졸버의 트랜잭션 ID(16비트)를 brute-force로 예측해 캐시를 오염시킬 수 있음을 보여주었습니다.

## DNSSEC 개요

DNSSEC(DNS Security Extensions, RFC 4033~4035)는 DNS 응답에 **디지털 서명**을 추가해 위·변조를 감지합니다. 암호화는 하지 않으며, **무결성과 출처 인증**만 제공합니다.

## 신뢰 체인 (Chain of Trust)

![DNSSEC 신뢰 체인](/assets/posts/network-dnssec-chain.svg)

루트 존의 KSK(Key Signing Key)를 신뢰 앵커(Trust Anchor)로 두고, 부모 존이 자식 존의 키를 DS 레코드로 서명하는 계층 구조입니다.

| 레코드 | 역할 |
|--------|------|
| DNSKEY | 존의 공개 키 (KSK + ZSK) |
| RRSIG | 각 RRset에 ZSK로 생성한 서명 |
| DS | 자식 존 KSK의 해시 (부모가 보유) |
| NSEC/NSEC3 | 존재하지 않는 레코드 증명 |

### KSK vs ZSK

- **KSK**: ZSK를 서명, 교체 빈도 낮음 (연 1회)
- **ZSK**: 모든 RRset 서명, 교체 빈도 높음 (월 단위)

두 키를 분리하는 이유는 ZSK를 자주 교체할 때 DS 레코드(부모에게 등록된 KSK 해시)를 변경하지 않아도 되기 때문입니다.

## DNS 스푸핑 vs DNSSEC 방어

![DNS 스푸핑 vs DNSSEC](/assets/posts/network-dnssec-attack.svg)

DNSSEC가 활성화된 리졸버는 응답의 RRSIG를 신뢰 체인으로 검증하며, 서명이 유효하지 않으면 **SERVFAIL**을 반환합니다.

```bash
# DNSSEC 검증 확인 (AD bit = 1 이면 인증됨)
dig +dnssec example.com A
;; flags: qr rd ra ad; QUERY: 1, ANSWER: 2
;                                           ^^ ad bit
```

## NSEC vs NSEC3

**NSEC**는 존재하지 않는 레코드를 증명하기 위해 이웃 레코드 이름을 평문으로 나열합니다. 이를 순서대로 따라가면 존의 모든 레코드를 열거할 수 있는 **Zone Walking** 문제가 있습니다.

**NSEC3**는 레코드 이름을 SHA-1(+salt)로 해시해 체인을 구성합니다. Zone Walking이 사실상 불가능해 권장됩니다.

## 리졸버에서 DNSSEC 강제 활성화

```bash
# systemd-resolved
sudo nano /etc/systemd/resolved.conf
# DNSSEC=yes

# Unbound
server:
  val-permissive-mode: no   # 검증 실패 시 SERVFAIL

# 테스트: 고의로 서명이 깨진 도메인 (fail.dnssec.works)
dig fail.dnssec.works A
# 예상: SERVFAIL (검증 실패)
```

## DNSSEC의 한계

- **암호화 없음**: 응답 내용은 여전히 평문 (→ DoH/DoT 필요)
- **키 관리 복잡**: KSK 롤오버 시 DS 레코드 업데이트 필요
- **응답 크기 증가**: RRSIG, DNSKEY 레코드 추가로 UDP 응답이 512바이트 초과 → EDNS0 또는 TCP 폴백
- **증폭 공격 악용**: 큰 DNSSEC 응답이 DDoS 증폭에 이용될 수 있음

---

**이전 글:** [DNS 캐싱과 TTL: 빠른 응답의 비밀](/posts/network-dns-caching-ttl/)

**다음 글:** [DoH와 DoT: DNS 암호화](/posts/network-doh-dot/)
