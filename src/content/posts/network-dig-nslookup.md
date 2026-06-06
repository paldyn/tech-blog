---
title: "dig · nslookup으로 DNS 쿼리 직접 분석하기"
description: "dig과 nslookup 명령어로 DNS A/MX/TXT 레코드 조회, 재귀 질의 흐름 추적(+trace), 특정 DNS 서버 지정 쿼리, TTL 확인 방법을 실무 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["dig", "nslookup", "DNS", "DNS레코드", "NXDOMAIN", "dig+trace", "네임서버", "DNS진단"]
featured: false
draft: false
---

[지난 글](/posts/network-ss-netstat/)에서 TCP 연결 상태를 ss로 확인했다. 이번엔 DNS 레이어로 올라간다. "도메인이 어느 IP로 연결되지?", "메일 서버 레코드가 맞게 설정됐나?", "DNS 전파가 됐나?" 이 모든 질문에 답하는 도구가 **dig**과 **nslookup**이다.

## dig 기본 사용법

`dig`(Domain Information Groper)은 DNS 쿼리를 직접 보내고 상세 응답을 출력하는 도구다. `bind-utils` 또는 `dnsutils` 패키지에 포함된다.

![dig 출력 구조 해부](/assets/posts/network-dig-output-anatomy.svg)

### 기본 쿼리

```bash
# A 레코드 (IPv4 주소)
dig example.com A

# AAAA 레코드 (IPv6 주소)
dig example.com AAAA

# MX 레코드 (메일 서버)
dig example.com MX

# TXT 레코드 (SPF, DKIM, 도메인 소유권 등)
dig example.com TXT

# NS 레코드 (권한 네임서버)
dig example.com NS

# CNAME 레코드 (별칭)
dig www.example.com CNAME
```

### 특정 DNS 서버 지정

```bash
# Google DNS로 쿼리
dig @8.8.8.8 example.com A

# Cloudflare DNS로 쿼리
dig @1.1.1.1 example.com A

# 특정 권한 NS에 직접 쿼리 (캐시 우회)
dig @ns1.example.com example.com A
```

### 깔끔한 출력 옵션

```bash
# IP만 출력 (스크립트에 유용)
dig example.com A +short

# 특정 섹션만 출력
dig example.com MX +noall +answer

# TTL 포함 + 통계 포함
dig example.com A +stats

# 재귀 금지 (캐시에서만)
dig example.com A +norecurse
```

## dig +trace — 전체 재귀 질의 추적

DNS 전파 문제 디버깅에 가장 유용한 옵션이다. 리졸버 캐시를 무시하고 루트 NS부터 직접 추적한다.

![dig +trace DNS 재귀 질의 흐름](/assets/posts/network-dig-dns-query-flow.svg)

```bash
dig example.com A +trace

# 출력 예
# .           86400   IN  NS  a.root-servers.net.  (루트 NS 쿼리)
# com.         172800  IN  NS  a.gtld-servers.net.  (TLD NS)
# example.com. 172800  IN  NS  ns1.example.com.     (권한 NS)
# example.com. 300     IN  A   93.184.216.34         (최종 응답)
```

### DNS 전파 확인

도메인 설정 변경 후 여러 DNS 서버에 동시에 쿼리해 전파 상태를 확인한다.

```bash
for ns in 8.8.8.8 1.1.1.1 9.9.9.9 208.67.222.222; do
  echo -n "$ns: "
  dig @$ns example.com A +short
done
```

## 주요 응답 상태 코드

| status | 의미 | 원인 |
|---|---|---|
| `NOERROR` | 정상 응답 | - |
| `NXDOMAIN` | 도메인 존재하지 않음 | 오타, 레코드 삭제 |
| `SERVFAIL` | 서버 오류 | NS 설정 문제, DNSSEC 검증 실패 |
| `REFUSED` | 쿼리 거부 | 재귀 쿼리 허용 안 됨 |
| `NODATA` | 도메인은 있지만 해당 타입 레코드 없음 | A 없이 AAAA만 존재 등 |

```bash
# NXDOMAIN 확인
dig notexist.example.com A
# status: NXDOMAIN, ANSWER: 0
```

## 역방향 DNS 조회 (PTR)

IP 주소로 도메인 이름을 조회한다.

```bash
# 역방향 조회 (-x 옵션)
dig -x 93.184.216.34

# 또는
dig 34.216.184.93.in-addr.arpa PTR
```

## nslookup

`nslookup`은 Windows에서도 기본으로 사용할 수 있어 범용성이 높다. 인터랙티브 모드와 비인터랙티브 모드를 지원한다.

```bash
# 비인터랙티브 모드
nslookup example.com
nslookup example.com 8.8.8.8    # 특정 서버 지정

# 인터랙티브 모드
nslookup
> server 8.8.8.8    # 쿼리 서버 변경
> set type=MX       # 레코드 타입 변경
> example.com
> exit
```

nslookup은 dig보다 출력이 간결하지만 `+trace`, `+stats` 같은 고급 옵션이 없어 상세 진단엔 dig을 사용하는 것이 좋다.

## 실무 진단 시나리오

### 이메일 발송 실패 - MX 레코드 확인

```bash
dig example.com MX +short
# 10 mail.example.com.
# 20 mail2.example.com.

# MX 서버가 실제 IP를 반환하는지 확인
dig mail.example.com A +short
```

### HTTPS 접속 실패 - A/CNAME 체인 확인

```bash
# CNAME 체인 전체 추적
dig www.example.com CNAME +short
# www.example.com. → cdn.example.com. → 1.2.3.4

# 실제 IP 확인 (CNAME 해소 후)
dig www.example.com A +short
```

### SPF 레코드 확인

```bash
dig example.com TXT +short | grep spf
# "v=spf1 include:_spf.google.com ~all"
```

---

**지난 글:** [ss · netstat로 네트워크 연결 상태 파악하기](/posts/network-ss-netstat/)

**다음 글:** [tcpdump · Wireshark로 패킷 직접 캡처하기](/posts/network-packet-capture/)

<br>
읽어주셔서 감사합니다. 😊
