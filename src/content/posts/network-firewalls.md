---
title: "방화벽 완전 정복 — 패킷 필터링부터 NGFW까지"
description: "방화벽 세대별 진화(패킷 필터, 스테이트풀, 애플리케이션 레이어, NGFW), iptables 규칙 작성, DMZ 아키텍처, WAF의 역할을 실무 위주로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["방화벽", "iptables", "NGFW", "WAF", "DMZ", "네트워크보안", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-https/)에서 HTTPS의 동작과 보안 강화 메커니즘을 살펴봤습니다. 이번 글에서는 네트워크 보안의 기본 구성 요소인 **방화벽(Firewall)**을 세대별로 살펴보고, 실제 운영 환경의 DMZ 설계까지 알아봅니다.

## 방화벽이란?

방화벽은 네트워크 트래픽을 감시하고 **사전 정의된 보안 규칙에 따라 허용 또는 차단**하는 시스템입니다. 물리적 장치(하드웨어 방화벽)나 소프트웨어(iptables, nftables, Windows Firewall) 형태로 존재합니다.

## 방화벽 세대별 진화

![방화벽 세대별 진화](/assets/posts/network-firewalls-types.svg)

### 1세대: 패킷 필터링

IP 주소, 포트, 프로토콜만 보고 판단합니다. 각 패킷을 독립적으로 처리합니다.

```bash
# iptables 패킷 필터링 예시
# 기본 정책: 모든 INPUT 차단
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# 허용 규칙 추가
iptables -A INPUT -p tcp --dport 22 -s 192.168.1.0/24 -j ACCEPT  # SSH: 내부망만
iptables -A INPUT -p tcp --dport 443 -j ACCEPT                    # HTTPS: 전체
iptables -A INPUT -p tcp --dport 80 -j ACCEPT                     # HTTP: 전체
iptables -A INPUT -i lo -j ACCEPT                                  # 루프백

# 현재 규칙 조회
iptables -L -n -v --line-numbers
```

**한계**: 연결 상태를 추적하지 않아 응답 패킷도 명시적으로 허용해야 합니다.

### 2세대: 스테이트풀 인스펙션

연결 상태 테이블을 유지해 기존 연결의 응답 패킷을 자동으로 허용합니다.

```bash
# 연결 상태 기반 규칙 (iptables conntrack 모듈)
# ESTABLISHED: 기존 연결, RELATED: 연관 연결 (FTP passive 등)
iptables -A INPUT -m conntrack \
  --ctstate ESTABLISHED,RELATED -j ACCEPT

# SYN flood 방어
iptables -A INPUT -p tcp --syn -m limit \
  --limit 1/s --limit-burst 20 -j ACCEPT
iptables -A INPUT -p tcp --syn -j DROP
```

### 3세대: 애플리케이션 레이어 방화벽

HTTP URL, 메서드, 헤더 등 L7 내용을 검사합니다.

```bash
# nftables로 L7 패턴 매칭 예시
# (실제로는 DPI 엔진 필요)
# HTTP method 기반 차단은 WAF 역할
```

**WAF (Web Application Firewall)**가 이 계층의 대표입니다.

### 4세대: NGFW (Next Generation Firewall)

DPI, IPS/IDS, 앱 인식, 사용자 기반 정책, SSL 검사까지 통합합니다.

```
NGFW 주요 기능:
  - Deep Packet Inspection (DPI): 페이로드 내용 검사
  - Application Identification: Facebook, YouTube 등 앱 인식
  - User Identity: AD/LDAP 연동, 사용자별 정책
  - SSL/TLS Inspection: HTTPS 복호화 후 검사
  - IPS: 공격 시그니처 매칭
  - URL 필터링: 카테고리별 웹 차단
```

## DMZ 아키텍처

![방화벽 DMZ 아키텍처](/assets/posts/network-firewalls-zonepolicy.svg)

DMZ(Demilitarized Zone)는 외부망과 내부망 사이의 **중립 지대**입니다.

```
트래픽 정책:

외부망 → DMZ:
  - TCP 80, 443 허용 (웹 서버)
  - TCP 25, 587 허용 (메일 서버)
  - 나머지 차단

DMZ → 내부망:
  - TCP 3306/5432 허용 (DB 접근, 특정 서버에서만)
  - TCP 6379 허용 (Redis, 특정 IP)
  - 나머지 차단

외부망 → 내부망 직접:
  - 전면 차단

내부망 → 외부망:
  - HTTP/HTTPS (프록시 경유) 허용
  - DNS 허용
  - 나머지 차단 또는 로그
```

## iptables 실무 규칙 예시

```bash
#!/bin/bash
# 서버 방화벽 스크립트

# 기존 규칙 초기화
iptables -F
iptables -X
iptables -Z

# 기본 정책
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# 루프백 허용
iptables -A INPUT -i lo -j ACCEPT

# 기존 연결 허용
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# SSH (관리 네트워크에서만)
iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 -j ACCEPT

# 웹 서버
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# ICMP (ping) 허용 (rate limit)
iptables -A INPUT -p icmp --icmp-type echo-request \
  -m limit --limit 5/s -j ACCEPT

# 로그 후 차단
iptables -A INPUT -m limit --limit 5/min -j LOG \
  --log-prefix "IPTABLES-DROP: " --log-level 7
iptables -A INPUT -j DROP

# 영구 저장
iptables-save > /etc/iptables/rules.v4
```

## WAF (Web Application Firewall)

```bash
# ModSecurity (Nginx 연동) 기본 설정
# nginx.conf
modsecurity on;
modsecurity_rules_file /etc/nginx/modsec/main.conf;

# OWASP Core Rule Set 활성화
# /etc/nginx/modsec/main.conf
Include /usr/share/modsecurity-crs/crs-setup.conf
Include /usr/share/modsecurity-crs/rules/*.conf

# SQL Injection 차단 예시 (모든 파라미터 검사)
# OWASP CRS가 자동으로 적용
```

## 클라우드 방화벽

```bash
# AWS Security Group (상태 기반 방화벽)
aws ec2 authorize-security-group-ingress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# AWS Network ACL (상태 비저장, 서브넷 수준)
aws ec2 create-network-acl-entry \
  --network-acl-id acl-12345678 \
  --ingress \
  --rule-number 100 \
  --protocol tcp \
  --port-range From=443,To=443 \
  --cidr-block 0.0.0.0/0 \
  --rule-action allow
```

## 방화벽 로그 분석

```bash
# iptables 로그 (syslog)
tail -f /var/log/syslog | grep IPTABLES-DROP

# 차단된 IP 집계
grep "IPTABLES-DROP" /var/log/syslog | \
  awk '{for(i=1;i<=NF;i++){if($i~/^SRC=/){print substr($i,5)}}}' | \
  sort | uniq -c | sort -rn | head -20

# 포트 스캔 탐지
grep "IPTABLES-DROP" /var/log/syslog | \
  awk '{for(i=1;i<=NF;i++){if($i~/^DST=/||$i~/^DPT=/){printf $i" "}};print ""}' | \
  sort | uniq -c | sort -rn | head -20
```

---

**지난 글:** [HTTPS 완전 정복 — HTTP에 TLS를 더하면](/posts/network-https/)

**다음 글:** [VPN 완전 정복 — 터널링과 암호화로 안전한 통신](/posts/network-vpn/)

<br>
읽어주셔서 감사합니다. 😊
