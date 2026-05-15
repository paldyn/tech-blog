---
title: "resolv.conf & systemd-resolved — DNS 설정"
description: "/etc/resolv.conf 구조, systemd-resolved 동작 원리, DNSSEC·DNS-over-TLS 설정, resolvectl 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "dns", "resolv.conf", "systemd-resolved", "resolvectl", "dnssec", "nsswitch", "nameserver"]
featured: false
draft: false
---

[지난 글](/posts/linux-network-manager/)에서 NetworkManager로 네트워크 연결을 설정하는 방법을 살펴봤습니다. 이번에는 그 연결 위에서 이름 해석(DNS resolution)이 어떻게 이루어지는지, **`/etc/resolv.conf`**와 **`systemd-resolved`**를 중심으로 살펴봅니다. DNS 설정 오류는 가장 흔한 네트워크 장애 원인 중 하나이므로, 동작 원리를 정확히 이해하는 것이 중요합니다.

## 이름 해석 흐름

애플리케이션이 `getaddrinfo("example.com")` 같은 호출을 하면, glibc는 `/etc/nsswitch.conf`의 `hosts` 항목을 읽어 해석 순서를 결정합니다.

```
hosts: files mdns4_minimal [NOTFOUND=return] dns myhostname
```

이 설정은 다음 순서를 뜻합니다.
1. `/etc/hosts` (files) — 발견되면 즉시 반환
2. mDNS (`.local` 도메인) — 미발견 시 계속
3. DNS 서버 — `resolv.conf`를 통해 질의
4. 호스트명 자체 (myhostname)

![DNS 이름 해석 흐름](/assets/posts/linux-resolv-conf-dns-flow.svg)

## /etc/resolv.conf 구조

`/etc/resolv.conf`는 DNS 질의에 쓸 네임서버와 옵션을 지정합니다.

```
# /etc/resolv.conf
nameserver 127.0.0.53        # systemd-resolved가 관리하는 경우
nameserver 8.8.8.8           # 직접 지정하는 경우
nameserver 1.1.1.1
search example.com corp.local  # 검색 도메인
options ndots:5 timeout:2 attempts:3
```

**주요 옵션:**
- `nameserver`: 사용할 DNS 서버 IP (최대 3개)
- `search`: 부분 호스트명 검색 도메인 (예: `host` → `host.example.com` 시도)
- `ndots`: 점이 몇 개 미만일 때 검색 도메인을 먼저 붙여서 시도할지 결정
- `timeout`: 응답 대기 시간(초)
- `attempts`: 재시도 횟수

## systemd-resolved 개요

현대 리눅스 배포판(Ubuntu 18.04+, Fedora, RHEL 9+)은 `systemd-resolved`가 DNS 캐싱 프록시로 동작합니다. 이 경우 `/etc/resolv.conf`는 `127.0.0.53`(스텁 리졸버)를 가리키는 심볼릭 링크입니다.

```bash
# resolv.conf 형태 확인
ls -la /etc/resolv.conf
# → /etc/resolv.conf -> ../run/systemd/resolve/stub-resolv.conf

# 실제 DNS 설정 확인
cat /run/systemd/resolve/resolv.conf      # 상위 DNS 목록
cat /run/systemd/resolve/stub-resolv.conf # 스텁(127.0.0.53)
```

`systemd-resolved`는 다음 세 가지 인터페이스를 제공합니다.
- **스텁 인터페이스** (127.0.0.53:53): 애플리케이션이 사용하는 DNS 프록시
- **DNS-SD/mDNS**: 로컬 네트워크 서비스 디스커버리
- **D-Bus API**: 다른 서비스와의 연동

## resolvectl — 상태 확인 및 진단

```bash
# 전체 DNS 상태 조회
resolvectl status

# 특정 인터페이스의 DNS 설정
resolvectl status eth0

# 이름 해석 테스트
resolvectl query example.com

# DNSSEC 검증 포함 조회
resolvectl query --type=DNSKEY example.com

# 캐시 플러시
resolvectl flush-caches

# 통계 조회 (캐시 히트율 등)
resolvectl statistics
```

`resolvectl status`는 인터페이스별로 사용 중인 DNS 서버, DNSSEC 상태, 검색 도메인을 보여줍니다.

## /etc/systemd/resolved.conf 설정

```ini
# /etc/systemd/resolved.conf
[Resolve]
# 전역 DNS 서버 (인터페이스별 DNS보다 낮은 우선순위)
DNS=8.8.8.8 1.1.1.1
FallbackDNS=8.8.4.4 9.9.9.9

# DNSSEC 검증 (allow-downgrade: 지원하는 경우만)
DNSSEC=allow-downgrade

# DNS-over-TLS
DNSOverTLS=opportunistic

# LLMNR (Link-Local Multicast Name Resolution)
LLMNR=no

# mDNS
MulticastDNS=no

# 캐시 크기 (0=비활성)
Cache=yes
```

변경 후에는 서비스를 재시작해야 합니다.

```bash
systemctl restart systemd-resolved
```

![resolv.conf 설정 파일](/assets/posts/linux-resolv-conf-config.svg)

## DNSSEC와 DNS-over-TLS

**DNSSEC**는 DNS 응답의 위변조를 방지하는 서명 검증 메커니즘입니다. `DNSSEC=yes`로 설정하면 검증 실패 시 해석이 거부됩니다. 서버나 ISP가 DNSSEC를 지원하지 않는 환경에서는 `allow-downgrade`가 안전합니다.

**DNS-over-TLS(DoT)**는 DNS 쿼리를 TLS로 암호화합니다. `DNSOverTLS=opportunistic`으로 설정하면 서버가 지원하는 경우 TLS를 사용하고, 그렇지 않으면 평문으로 폴백합니다.

## 직접 resolv.conf 관리 (systemd-resolved 없이)

서버에서 `systemd-resolved` 없이 직접 DNS를 설정해야 한다면, 심볼릭 링크를 제거하고 직접 파일을 작성합니다.

```bash
# 심볼릭 링크 제거 후 직접 파일 생성
sudo unlink /etc/resolv.conf
sudo tee /etc/resolv.conf <<EOF
nameserver 8.8.8.8
nameserver 1.1.1.1
search example.com
options ndots:5
EOF
```

단, NetworkManager가 활성화된 환경에서는 NetworkManager가 resolv.conf를 덮어쓸 수 있으므로, NetworkManager의 DNS 관리도 함께 설정해야 합니다.

```bash
# NetworkManager가 resolv.conf를 건드리지 않도록 설정
# /etc/NetworkManager/NetworkManager.conf
[main]
dns=none
```

## 문제 진단

DNS 문제가 생겼을 때 다음 순서로 진단합니다.

```bash
# 1. systemd-resolved 동작 여부 확인
systemctl is-active systemd-resolved

# 2. 스텁 리졸버 응답 확인
dig @127.0.0.53 example.com

# 3. 상위 DNS 서버 직접 질의
dig @8.8.8.8 example.com

# 4. 캐시 플러시 후 재시도
resolvectl flush-caches

# 5. nsswitch.conf 확인
grep hosts /etc/nsswitch.conf
```

DNS 해석이 안 된다고 해서 곧바로 서버 설정을 의심하기 전에, 먼저 로컬 설정(`resolv.conf`, `nsswitch.conf`, `systemd-resolved`)을 확인하는 것이 올바른 진단 순서입니다.

---

**지난 글:** [NetworkManager — 네트워크 연결 관리](/posts/linux-network-manager/)

**다음 글:** [/etc/hosts — 정적 호스트 매핑](/posts/linux-hosts-file/)

<br>
읽어주셔서 감사합니다. 😊
