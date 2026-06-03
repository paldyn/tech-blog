---
title: "DoH와 DoT: DNS 암호화"
description: "일반 DNS의 프라이버시 문제와 DNS over HTTPS(DoH), DNS over TLS(DoT)의 동작 원리, 설정 방법 완전 정리"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["DoH", "DoT", "DNS", "암호화", "프라이버시", "네트워크"]
featured: false
draft: false
---

## 일반 DNS의 프라이버시 문제

DNSSEC가 무결성을 보장하지만, DNS 쿼리와 응답 **내용 자체는 여전히 평문**으로 전송됩니다. 누가 어떤 도메인을 언제 조회했는지 ISP, 네트워크 관리자, 중간자가 모두 볼 수 있습니다.

## DoH vs DoT vs 일반 DNS

![DoH vs DoT vs 일반 DNS 비교](/assets/posts/network-doh-dot-compare.svg)

| | 일반 DNS | DoT | DoH |
|---|---|---|---|
| 포트 | UDP/TCP 53 | TCP 853 | TCP 443 |
| 암호화 | 없음 | TLS | HTTPS (TLS) |
| 트래픽 식별 | 쉬움 | 쉬움 (853) | 어려움 (443) |
| 브라우저 지원 | OS 의존 | 없음 | Firefox, Chrome 내장 |
| RFC | RFC 1035 | RFC 7858 | RFC 8484 |

## DoT (DNS over TLS)

DoT는 기존 DNS 메시지 형식을 그대로 유지하면서 **TLS 터널**로 감쌉니다. 전용 포트 853을 사용하기 때문에 방화벽에서 DNS 트래픽으로 식별 가능합니다. 기업 네트워크에서 DNS 정책을 유지하면서도 암호화를 원할 때 적합합니다.

## DoH (DNS over HTTPS)

DoH는 DNS 쿼리를 **HTTPS 요청**으로 래핑합니다. 포트 443을 사용해 일반 HTTPS 트래픽과 구분이 어렵습니다.

두 가지 형식을 지원합니다.
- **JSON API** (`application/dns-json`): `?name=example.com&type=A`
- **Wire format** (`application/dns-message`): RFC 4501 이진 형식

```bash
# JSON 방식
curl -H "accept: application/dns-json" \
  "https://cloudflare-dns.com/dns-query?name=example.com&type=A"
```

## 설정 방법

![DoH/DoT 설정 예시](/assets/posts/network-doh-dot-config.svg)

### systemd-resolved (Linux)

```ini
# /etc/systemd/resolved.conf
[Resolve]
DNS=1.1.1.1#cloudflare-dns.com
DNSOverTLS=yes
DNSSEC=yes
```

### Firefox

`about:config` → `network.trr.mode = 2` (preferred) 또는 `3` (exclusive)

### macOS (Big Sur 이상)

네트워크 설정 > DNS > DoH 활성화 또는 mobileconfig 프로파일 배포.

## 공개 DoH/DoT 서버

| 공급자 | DoT | DoH |
|--------|-----|-----|
| Cloudflare | 1.1.1.1:853 | cloudflare-dns.com/dns-query |
| Google | dns.google:853 | dns.google/dns-query |
| NextDNS | dns.nextdns.io:853 | nextdns.io/dns-query |
| Quad9 | dns.quad9.net:853 | dns.quad9.net/dns-query |

## DoH 논란: 기업망 DNS 정책 우회

DoH는 브라우저가 OS의 리졸버를 우회해 직접 DoH 서버에 연결하므로, **기업 내부 DNS 정책**(도메인 필터링, 스플릿 DNS)이 적용되지 않을 수 있습니다. 이 때문에 일부 기업 보안팀은 DoH를 차단하고 DoT+기업 리졸버로 대체합니다.

## DNSSEC + DoH/DoT 조합

DNSSEC는 무결성, DoH/DoT는 프라이버시를 제공합니다. 두 기술은 상호 보완적입니다.

- DNSSEC 없음 + DoH: 내용 암호화되지만 응답 위조 가능
- DNSSEC 있음 + 일반 DNS: 위조 불가하지만 내용 노출
- DNSSEC + DoH/DoT: 완전한 보안

---

**이전 글:** [DNSSEC: DNS 보안 확장](/posts/network-dnssec/)

**다음 글:** [WebSocket 프로토콜 완전 정복](/posts/network-websocket-protocol/)
