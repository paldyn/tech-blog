---
title: "DNS 레코드 타입: A, AAAA, CNAME, MX, TXT의 역할"
description: "A·AAAA·CNAME·MX·NS·TXT·SOA·PTR 등 주요 DNS 레코드 타입의 역할, 형식, 실제 사용 사례를 dig 명령과 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["DNS레코드", "A레코드", "CNAME", "MX", "TXT", "SPF", "DKIM"]
featured: false
draft: false
---

[지난 글](/posts/network-dns-resolution/)에서 DNS 이름 해석의 전체 흐름을 살펴봤다. 이번에는 DNS 데이터베이스를 구성하는 핵심 요소인 **레코드 타입**을 상세히 살펴본다.

## DNS 레코드의 기본 구조

DNS 레코드는 다음 형식으로 구성된다.

```text
<도메인>  <TTL>  <클래스>  <타입>  <값>
example.com.  300  IN  A  93.184.216.34

- TTL: 캐시 유효 시간 (초)
- IN: Internet 클래스 (거의 항상 IN)
- A: 레코드 타입
- 값: IP 주소, 도메인, 텍스트 등
```

![주요 DNS 레코드 타입](/assets/posts/network-dns-record-types-overview.svg)

## A / AAAA 레코드

가장 기본적인 레코드다. **A**는 IPv4, **AAAA**는 IPv6 주소를 가리킨다.

```bash
dig example.com A
# example.com.  300  IN  A  93.184.216.34

dig google.com AAAA
# google.com.  300  IN  AAAA  2404:6800:4005:810::200e
```

하나의 도메인에 여러 A 레코드를 설정할 수 있다. 이를 **라운드 로빈 DNS**라고 하며, 간단한 로드 밸런싱에 활용된다.

```bash
dig google.com A
# google.com.  300  IN  A  142.250.196.110
# google.com.  300  IN  A  142.250.196.99
# ...  (여러 IP가 순환)
```

## CNAME 레코드 (Canonical Name)

도메인의 **별명(Alias)**을 지정한다. CNAME은 또 다른 도메인을 가리키며, 최종적으로 A 레코드까지 연쇄 조회한다.

```text
www.example.com  →  CNAME  →  cdn.example.net  →  A  →  104.21.23.145
```

![CNAME 연쇄 해석](/assets/posts/network-dns-record-types-cname.svg)

**주요 제약사항:**

1. **Zone Apex에 CNAME 불가**: `example.com` (루트 도메인)에는 CNAME을 설정할 수 없다. SOA, NS 레코드와 함께 존재할 수 없기 때문이다. 이를 해결하기 위해 Cloudflare의 CNAME Flattening, AWS의 ALIAS 레코드가 사용된다.

2. **CNAME 체인**: CNAME이 또 다른 CNAME을 가리킬 수 있지만, 성능상 이유로 권장되지 않는다.

```bash
dig www.github.com CNAME
# www.github.com.  1800  IN  CNAME  github.com.
```

## MX 레코드 (Mail Exchanger)

이메일 수신 서버를 지정한다. **우선순위(priority)** 숫자가 낮을수록 먼저 시도한다.

```bash
dig gmail.com MX
# gmail.com.  3600  IN  MX  5  gmail-smtp-in.l.google.com.
# gmail.com.  3600  IN  MX  10 alt1.gmail-smtp-in.l.google.com.
# gmail.com.  3600  IN  MX  20 alt2.gmail-smtp-in.l.google.com.
```

`user@gmail.com`으로 이메일을 보내면 발신 SMTP 서버는 `gmail.com`의 MX 레코드를 조회하고, 우선순위 5의 서버부터 연결을 시도한다.

## TXT 레코드

임의의 텍스트를 저장한다. 현대에는 도메인 소유권 인증, 이메일 보안 설정에 핵심적으로 사용된다.

**SPF (Sender Policy Framework)**

이 도메인에서 이메일을 보낼 수 있는 서버 목록이다.

```bash
dig gmail.com TXT | grep spf
# "v=spf1 redirect=_spf.google.com"
```

**DKIM (DomainKeys Identified Mail)**

이메일 서명 공개키를 배포한다.

```bash
dig google._domainkey.gmail.com TXT
# "v=DKIM1; k=rsa; p=MIIBIjAN..."
```

**DMARC (Domain-based Message Authentication)**

SPF/DKIM 실패 시 정책을 지정한다.

```bash
dig _dmarc.gmail.com TXT
# "v=DMARC1; p=none; rua=mailto:mailauth-reports@google.com"
```

**도메인 소유권 인증:**

```bash
dig example.com TXT
# "google-site-verification=abc123..."
# "v=spf1 include:_spf.google.com ~all"
```

## NS 레코드 (Name Server)

이 도메인의 권위 네임서버를 지정한다.

```bash
dig example.com NS
# example.com.  172800  IN  NS  a.iana-servers.net.
# example.com.  172800  IN  NS  b.iana-servers.net.
```

## SOA 레코드 (Start of Authority)

DNS 존의 권위 정보를 담는 레코드다. 각 존에 정확히 하나만 존재한다.

```bash
dig example.com SOA
# example.com. IN SOA ns1.example.com. admin.example.com. (
#   2024010101  ; Serial (버전 번호)
#   86400       ; Refresh (보조 NS가 갱신 확인하는 주기)
#   7200        ; Retry (갱신 실패 시 재시도 간격)
#   3600000     ; Expire (보조 NS가 데이터를 유효하다고 보는 기간)
#   300         ; Negative TTL (NXDOMAIN 캐시 시간)
# )
```

## PTR 레코드 (역방향 조회)

IP 주소를 도메인으로 변환한다. `in-addr.arpa` 특수 도메인을 사용한다.

```bash
dig -x 8.8.8.8
# 8.8.8.8.in-addr.arpa.  21599  IN  PTR  dns.google.

# IPv6 역방향 조회 (ip6.arpa)
dig -x 2001:4860:4860::8888
```

이메일 서버의 PTR 레코드는 스팸 필터링에 중요하다. rDNS(역방향 DNS)가 없는 IP에서 보낸 메일은 스팸으로 분류될 가능성이 높다.

---

**지난 글:** [DNS 이름 해석: 도메인이 IP로 변환되는 과정](/posts/network-dns-resolution/)

**다음 글:** [DNS 재귀·반복 질의: 해석기가 답을 찾는 두 가지 방법](/posts/network-dns-recursive-iterative/)

<br>
읽어주셔서 감사합니다. 😊
