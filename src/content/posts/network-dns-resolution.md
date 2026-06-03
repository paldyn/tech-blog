---
title: "DNS 이름 해석: 도메인이 IP로 변환되는 과정"
description: "DNS 계층 구조(루트·TLD·권위 NS), 재귀 해석기의 동작 방식, 캐시, dig 명령으로 DNS 조회 결과를 분석하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["DNS", "이름해석", "재귀해석기", "루트네임서버", "dig", "FQDN"]
featured: false
draft: false
---

[지난 글](/posts/network-udp-use-cases/)에서 UDP가 DNS에 적합한 이유를 살펴봤다. 이번 글에서는 DNS 시스템 전체를 깊이 파고든다. 브라우저에 `www.example.com`을 입력하는 순간 어떤 일이 벌어지는지를 단계별로 추적한다.

## DNS의 역할

**DNS(Domain Name System)**는 사람이 기억하기 쉬운 도메인 이름을 기계가 사용하는 IP 주소로 변환하는 전화번호부 시스템이다. 이 변환 과정을 **이름 해석(Name Resolution)**이라고 한다.

```text
www.example.com → 93.184.216.34
naver.com       → 223.130.195.95
```

DNS 없이는 `93.184.216.34`를 외워야 웹사이트에 접속할 수 있다.

## DNS 계층 구조

DNS는 계층적 분산 데이터베이스다. 중앙 서버 하나가 모든 도메인을 관리하지 않는다. 대신 트리 구조로 권한이 위임된다.

![DNS 계층 구조](/assets/posts/network-dns-resolution-hierarchy.svg)

도메인 이름은 **오른쪽에서 왼쪽으로** 읽는다.

```text
www.example.com.
│    │       │  └─ 루트 (.)
│    │       └──── TLD (.com)
│    └──────────── 2차 도메인 (example)
└───────────────── 서브도메인 (www)
```

FQDN(Fully Qualified Domain Name)은 루트까지 명시한 완전한 도메인 이름이다.

## 세 가지 네임서버

### 루트 네임서버

DNS 트리의 꼭대기다. 전 세계에 13개의 루트 서버 클러스터가 있으며(a.root-servers.net ~ m.root-servers.net), 실제로는 Anycast로 수천 개의 물리 서버가 운영된다. TLD 네임서버의 주소를 알고 있다.

### TLD 네임서버

`.com`, `.kr`, `.org` 등 최상위 도메인을 관리한다. `.com`은 Verisign이 운영한다. 2차 도메인의 권위 네임서버 주소를 알고 있다.

### 권위 네임서버(Authoritative NS)

특정 도메인의 DNS 레코드를 실제로 보유하는 서버다. `example.com`의 A 레코드(IP 주소)를 가지고 있다. 도메인 등록 시 지정한다.

## 이름 해석 과정

![DNS 이름 해석 흐름](/assets/posts/network-dns-resolution-flow.svg)

```bash
# 단계별 DNS 조회 추적
dig +trace www.example.com

# 출력 예시:
# .             518400 IN NS  a.root-servers.net.   (루트)
# com.          172800 IN NS  a.gtld-servers.net.   (TLD)
# example.com.  172800 IN NS  a.iana-servers.net.   (권위 NS)
# www.example.com. 3600 IN A  93.184.216.34         (최종 답)
```

**재귀 해석기(Recursive Resolver)**는 클라이언트를 대신해 이 순환 과정을 처리한다. ISP가 제공하거나, 8.8.8.8(Google), 1.1.1.1(Cloudflare) 같은 공개 DNS 서비스를 사용한다.

재귀 해석기는 결과를 **캐시**에 저장한다. TTL(Time To Live) 동안 동일 도메인 요청에 대해 루트/TLD 조회 없이 바로 응답한다.

## dig 명령으로 DNS 분석

```bash
# 기본 A 레코드 조회
dig google.com

# 특정 레코드 타입 조회
dig google.com MX       # 메일 서버
dig google.com NS       # 네임서버
dig google.com TXT      # 텍스트 레코드 (SPF, DKIM 등)

# 특정 DNS 서버에 직접 질의
dig @8.8.8.8 google.com

# 짧은 답변 출력
dig +short google.com

# PTR 레코드 (역방향 조회)
dig -x 8.8.8.8
# 8.8.8.8.in-addr.arpa. → dns.google.

# DNSSEC 정보 포함
dig +dnssec google.com
```

## OS 레벨 DNS 설정

```bash
# Linux: DNS 서버 설정 확인
cat /etc/resolv.conf
# nameserver 8.8.8.8
# nameserver 8.8.4.4
# search example.com

# systemd-resolved 사용 시
resolvectl status

# DNS 캐시 플러시 (Linux/systemd)
systemd-resolve --flush-caches

# macOS DNS 캐시 플러시
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

## 로컬 이름 해석 우선순위

실제 DNS 조회 전에 다음 순서로 확인한다.

```text
1. /etc/hosts (로컬 재정의)
2. OS DNS 캐시
3. 재귀 해석기 캐시
4. 루트 → TLD → 권위 NS 순환 조회
```

```bash
# /etc/hosts 재정의 예시
echo "127.0.0.1 myapp.local" >> /etc/hosts

# nsswitch.conf에서 우선순위 확인
cat /etc/nsswitch.conf | grep hosts
# hosts: files dns  ← files(hosts)가 dns보다 먼저
```

---

**지난 글:** [UDP 활용 사례: 빠른 전송이 필요한 곳](/posts/network-udp-use-cases/)

**다음 글:** [DNS 레코드 타입: A, AAAA, CNAME, MX, TXT의 역할](/posts/network-dns-record-types/)

<br>
읽어주셔서 감사합니다. 😊
