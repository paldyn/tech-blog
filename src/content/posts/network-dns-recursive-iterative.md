---
title: "DNS 재귀·반복 질의: 해석기가 답을 찾는 두 가지 방법"
description: "DNS 재귀 질의와 반복 질의의 차이, 재귀 해석기의 역할, 공개 DNS 서버(Google/Cloudflare/Quad9) 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["DNS", "재귀질의", "반복질의", "재귀해석기", "공개DNS", "1.1.1.1"]
featured: false
draft: false
---

[지난 글](/posts/network-dns-record-types/)에서 DNS 레코드 타입을 살펴봤다. 이번에는 DNS 해석 과정에서 핵심 역할을 하는 **재귀 질의**와 **반복 질의**의 차이, 그리고 재귀 해석기의 동작 방식을 깊이 이해한다.

## 두 가지 질의 방식

DNS 프로토콜은 두 가지 질의 방식을 정의한다.

![재귀 vs 반복 질의](/assets/posts/network-dns-recursive-iterative-flow.svg)

### 재귀 질의 (Recursive Query)

클라이언트가 해석기에게 "나 대신 끝까지 알아봐 줘"라고 요청하는 방식이다.

DNS 패킷 헤더의 **RD(Recursion Desired) 비트를 1**로 설정한다. 해석기는 클라이언트를 대신해 루트 → TLD → 권위 NS까지 전체 조회를 처리하고, 최종 IP 주소를 반환한다.

일반 클라이언트(브라우저, 앱)가 ISP나 공개 DNS 서버(8.8.8.8, 1.1.1.1)에 사용하는 방식이다.

### 반복 질의 (Iterative Query)

"모르면 누구한테 물어볼지 알려줘"라고 요청하는 방식이다.

각 네임서버는 직접 답을 모르면 **다음으로 물어볼 네임서버의 주소(Referral)**를 반환한다. 해석기가 직접 각 단계를 순환한다.

재귀 해석기가 루트 NS, TLD NS, 권위 NS에 사용하는 방식이다.

```bash
# dig +trace: 반복 질의 전 과정을 보여줌
dig +trace example.com

# 출력:
# .     518400 IN NS a.root-servers.net.   (루트에서 시작)
# com.  172800 IN NS a.gtld-servers.net.   (TLD로 위임)
# example.com. 172800 IN NS a.iana-servers.net.  (Auth로 위임)
# example.com.  3600  IN A  93.184.216.34  (최종 답)
```

## 루트 네임서버가 재귀를 지원하지 않는 이유

루트 네임서버는 재귀 질의를 처리하지 않는다. 이유는 간단하다. 전 세계 모든 DNS 질의가 루트를 거친다면, 재귀 처리까지 담당하면 루트 서버가 감당할 수 없는 부하가 걸린다. 반복 질의로 "다음 목적지"만 알려주는 것이 훨씬 효율적이다.

## 재귀 해석기의 캐시 역할

재귀 해석기의 가장 중요한 기능 중 하나는 **캐싱**이다.

```text
첫 질의 (캐시 없음):
클라이언트 → 해석기 → 루트 → TLD → Auth = 총 4단계 왕복

이후 질의 (캐시 있음, TTL 이내):
클라이언트 → 해석기 (캐시에서 즉시 응답) = 1단계 왕복
```

TTL이 짧으면 캐시 효율이 낮아지고(더 자주 조회), 길면 DNS 레코드 변경이 늦게 전파된다.

```bash
# 캐시된 응답 vs 직접 조회 시간 비교
dig example.com   # 해석기 캐시에서 (빠름)
dig @a.iana-servers.net example.com   # 권위 NS 직접 조회
```

## 공개 DNS 서버 비교

![공개 DNS 서버 비교](/assets/posts/network-dns-recursive-iterative-compare.svg)

### DNS over HTTPS (DoH)와 DNS over TLS (DoT)

전통적인 DNS는 평문으로 통신한다. ISP나 중간자가 어떤 도메인에 접속하는지 볼 수 있다.

```bash
# DoH (HTTPS, 포트 443)
curl -H "accept: application/dns-json" \
  "https://cloudflare-dns.com/dns-query?name=example.com&type=A"

# DoT (TLS, 포트 853)
kdig @1.1.1.1 +tls example.com

# Linux: systemd-resolved DoT 설정
# /etc/systemd/resolved.conf:
# DNS=1.1.1.1
# DNSOverTLS=yes
```

## 부하 분산과 DNS Anycast

Google의 8.8.8.8은 단일 서버가 아니다. 전 세계 수백 개의 서버가 BGP Anycast를 통해 같은 IP를 공유한다. 사용자는 자신과 가장 가까운 서버로 라우팅된다.

```bash
# 어느 데이터센터로 연결되는지 확인
traceroute 8.8.8.8
# 최종 홉에서 다른 위치의 서버에 도달할 수 있음
```

---

**지난 글:** [DNS 레코드 타입: A, AAAA, CNAME, MX, TXT의 역할](/posts/network-dns-record-types/)

**다음 글:** [DNS 캐싱과 TTL: 빠른 응답의 비밀](/posts/network-dns-caching-ttl/)

<br>
읽어주셔서 감사합니다. 😊
