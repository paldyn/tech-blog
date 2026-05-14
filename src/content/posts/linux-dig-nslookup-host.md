---
title: "dig·nslookup·host — DNS 질의 도구 완전 가이드"
description: "dig의 출력 구조와 레코드 타입 조회, +trace로 DNS 위임 경로 추적, nslookup 인터랙티브 모드, host 간단 조회, 역방향 DNS 조회 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "dig", "nslookup", "host", "dns", "a-record", "mx", "cname", "txt", "ptr", "reverse-dns"]
featured: false
draft: false
---

[지난 글](/posts/linux-netstat-ss/)에서 소켓과 연결 상태를 분석했습니다. 네트워크 문제의 상당수는 DNS에서 시작됩니다. 도메인이 틀린 IP로 해석되거나, 캐시가 만료되지 않거나, 특정 네임서버에서만 잘못된 응답을 주는 경우가 있습니다. **dig**, **nslookup**, **host**는 이런 DNS 문제를 진단하는 도구입니다.

## dig — DNS 질의의 표준

`dig`(Domain Information Groper)는 가장 강력한 DNS 질의 도구입니다. 출력이 상세하고 스크립트 자동화에도 적합합니다.

```bash
# 설치
sudo apt install dnsutils   # Debian/Ubuntu
sudo dnf install bind-utils  # RHEL/Fedora

# 기본: A 레코드 조회
dig google.com

# 특정 레코드 타입
dig A google.com
dig AAAA google.com
dig MX gmail.com
dig TXT google.com
dig NS google.com
dig CNAME www.github.com
```

![DNS 레코드 타입](/assets/posts/linux-dig-nslookup-host-records.svg)

### dig 출력 해석

![dig 출력 해석](/assets/posts/linux-dig-nslookup-host-output.svg)

```
;; ANSWER SECTION:
google.com.   300  IN  A  142.250.196.142
```

- 첫 번째 컬럼: 질의한 이름
- `300`: TTL(초) — 캐시 유지 시간
- `IN`: 인터넷 클래스
- `A`: 레코드 타입
- 마지막: 응답값

### 자주 쓰는 옵션

```bash
# 간결 출력 (IP만)
dig +short google.com

# 특정 네임서버 지정
dig @8.8.8.8 google.com
dig @1.1.1.1 google.com

# ANSWER 섹션만 출력
dig +noall +answer google.com

# 역방향 조회 (IP → 도메인)
dig -x 8.8.8.8

# TCP 사용 (UDP 512바이트 초과 응답)
dig +tcp google.com

# DNSSEC 검증 포함
dig +dnssec google.com
```

### +trace — DNS 위임 경로 추적

DNS 해석이 어떤 경로로 이루어지는지 루트 서버부터 추적합니다.

```bash
dig +trace google.com
# .  → com.  → google.com. 순서로 위임 확인
```

DNS 캐시 오염이나 잘못된 위임 설정을 진단할 때 유용합니다.

### 배치 조회

```bash
# 여러 도메인을 파일에서 읽어 조회
cat domains.txt | while read d; do
    dig +short "$d" A
done

# 또는 dig -f 옵션
dig -f domains.txt +short
```

## nslookup — 대화형 조회

`nslookup`은 대화형 모드와 단일 명령 모드를 모두 지원합니다.

```bash
# 단일 명령 모드
nslookup google.com
nslookup google.com 8.8.8.8   # 특정 서버 지정

# 대화형 모드
nslookup
> server 8.8.8.8
> set type=MX
> gmail.com
> exit
```

`nslookup` 출력에서 `Non-authoritative answer`는 캐시에서 응답한 것을 의미합니다. 권한(authoritative) 응답이 필요하면 `dig @NS레코드 +norec`을 씁니다.

## host — 간단한 조회

`host`는 가장 간단한 DNS 도구로, 빠른 확인에 적합합니다.

```bash
# 기본 (A + MX + NS)
host google.com

# 특정 타입만
host -t MX gmail.com
host -t TXT google.com

# 역방향 조회
host 8.8.8.8

# 특정 서버 지정
host google.com 1.1.1.1
```

## 실전 DNS 트러블슈팅

### 캐시 상태 확인

```bash
# 현재 사용 중인 DNS 서버
cat /etc/resolv.conf
resolvectl status | grep DNS

# systemd-resolved 캐시 확인
resolvectl query google.com

# 캐시 플러시
sudo resolvectl flush-caches
```

### 내 DNS가 다른 응답을 주는지 비교

```bash
# 시스템 기본 DNS vs 공공 DNS 비교
dig +short google.com
dig +short @8.8.8.8 google.com
dig +short @1.1.1.1 google.com

# 차이가 나면 로컬 DNS 문제 또는 CDN 지역 차이
```

### 스팸 방지 레코드 확인

```bash
# SPF 레코드 (이메일 발신 허용 서버)
dig TXT example.com | grep spf

# DKIM
dig TXT selector._domainkey.example.com

# DMARC
dig TXT _dmarc.example.com
```

### 역방향 DNS

```bash
# PTR 레코드 조회
dig -x 8.8.8.8 +short
# dns.google.

# nslookup으로
nslookup 8.8.8.8
```

## dig 출력 최소화 패턴

```bash
# IP 목록만 추출
dig +noall +answer A google.com | awk '{print $5}'

# TTL 확인
dig +noall +answer google.com | awk '{print $1, $2}'

# 모든 A 레코드 한 줄
dig +short A google.com | tr '\n' ','
```

## 정리

`dig`는 레코드 타입, TTL, 응답 서버, DNSSEC 검증까지 완전히 제어할 수 있는 전문 도구입니다. `+short`로 간결하게, `+trace`로 위임 경로를, `-x`로 역방향 조회를 합니다. `nslookup`은 대화형 디버깅에, `host`는 빠른 확인에 씁니다. DNS 문제를 만나면 반드시 여러 서버에서 `dig @서버 도메인`으로 비교해보세요.

---

**지난 글:** [netstat·ss — 소켓과 연결 상태 분석](/posts/linux-netstat-ss/)

**다음 글:** [curl·wget — HTTP 요청과 파일 다운로드](/posts/linux-curl-wget/)

<br>
읽어주셔서 감사합니다. 😊
