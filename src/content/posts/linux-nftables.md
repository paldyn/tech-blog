---
title: "nftables — iptables의 현대적 후계자"
description: "nftables의 테이블·체인·훅 구조, 기본 규칙 추가, 세트(set)와 맵(map), iptables와의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "nftables", "netfilter", "firewall", "nft", "iptables", "set", "map", "chain", "hook"]
featured: false
draft: false
---

[지난 글](/posts/linux-iptables-basics/)에서 iptables로 패킷을 제어하는 방법을 살펴봤습니다. iptables는 강력하지만 테이블마다 별개의 명령(`iptables`, `ip6tables`, `arptables`)을 써야 하고, 원자적 규칙 갱신이 불가능하다는 한계가 있었습니다. 이를 해결하기 위해 리눅스 커널 3.13부터 도입된 것이 **nftables**입니다. 2014년 이후 대부분의 주요 배포판이 기본 방화벽 백엔드를 nftables로 전환했으며, iptables는 내부적으로 `iptables-nft` 레이어를 거쳐 실행됩니다.

## nftables가 iptables보다 나은 점

nftables는 단일 `nft` 명령으로 IPv4, IPv6, ARP, 브리지 패킷을 모두 제어합니다. 가장 눈에 띄는 차이는 규칙 평가 방식입니다.

| 항목 | iptables | nftables |
|------|----------|----------|
| 명령 | `iptables`, `ip6tables`, `arptables` | `nft` 하나 |
| 원자적 갱신 | 불가 (규칙 하나씩) | 가능 (`nft -f batch.nft`) |
| 세트/맵 | 없음 (ipset 별도) | 내장 세트·맵 지원 |
| 규칙 카운터 | 모든 규칙에 부착 | 명시적으로만 부착 |
| 표현식 언어 | 제한적 | 산술·비트 연산 등 풍부 |

iptables는 체인 내 모든 규칙을 선형으로 스캔하지만, nftables는 세트(해시/레드블랙 트리)와 맵을 활용해 O(1) 또는 O(log n) 조회가 가능합니다.

## 핵심 구조: 테이블 · 체인 · 훅

nftables의 핵심 개념은 세 가지입니다.

**테이블(Table)**: 주소 패밀리별 규칙 컨테이너입니다. `ip`, `ip6`, `inet`, `arp`, `bridge`, `netdev` 중 하나를 지정합니다. `inet`을 쓰면 IPv4와 IPv6를 함께 처리할 수 있어 가장 많이 씁니다.

**체인(Chain)**: 테이블 안에 규칙을 담는 목록입니다. Netfilter 훅에 연결된 **기본 체인(base chain)**과, 다른 체인에서 `jump`/`goto`로 호출하는 **일반 체인(regular chain)**으로 나뉩니다.

**훅(Hook)**: 커널이 패킷을 처리하는 시점을 나타냅니다. 다섯 가지 주요 훅이 있습니다.

![nftables 5개 훅 포인트](/assets/posts/linux-nftables-hooks.svg)

체인을 훅에 연결할 때는 **우선순위(priority)**도 지정해야 합니다. 같은 훅을 여러 체인이 공유할 때 처리 순서를 결정합니다. 일반적으로 filter 체인은 우선순위 `0`, nat 체인은 `-100`(PREROUTING) 또는 `100`(POSTROUTING)을 씁니다.

## 기본 명령어

```bash
# 테이블 목록 조회
nft list tables

# 규칙 전체 조회
nft list ruleset

# 테이블 생성
nft add table inet filter

# 기본 체인 생성 (INPUT, policy drop)
nft add chain inet filter INPUT \
  '{ type filter hook input priority 0; policy drop; }'

# 규칙 추가
nft add rule inet filter INPUT tcp dport 22 accept
nft add rule inet filter INPUT ct state established,related accept

# 규칙 번호로 삽입 (앞에)
nft insert rule inet filter INPUT position 0 \
  iifname lo accept

# 규칙 삭제 (핸들 번호 확인 후)
nft list ruleset -a
nft delete rule inet filter INPUT handle 4
```

규칙 파일을 만들어 `nft -f rules.nft`로 원자적으로 적용하는 것이 운영 환경에서 권장되는 방법입니다.

![nftables 기본 명령어](/assets/posts/linux-nftables-syntax.svg)

## 실전: 기본 방화벽 ruleset

```nft
#!/usr/sbin/nft -f
# /etc/nftables.conf

flush ruleset

table inet filter {
  chain INPUT {
    type filter hook input priority 0
    policy drop

    iifname lo accept
    ct state invalid drop
    ct state established,related accept
    tcp dport { 22, 80, 443 } accept
    icmp type echo-request accept
    icmpv6 type { echo-request, nd-neighbor-solicit,
                  nd-router-advert } accept
    reject with icmpx admin-prohibited
  }

  chain FORWARD {
    type filter hook forward priority 0
    policy drop
  }

  chain OUTPUT {
    type filter hook output priority 0
    policy accept
  }
}
```

이 설정은 SSH, HTTP/HTTPS만 허용하고 나머지는 모두 차단합니다. `flush ruleset`이 있으므로 `nft -f /etc/nftables.conf`를 실행하면 기존 규칙이 원자적으로 교체됩니다.

## 세트(Set)와 맵(Map)

세트를 쓰면 여러 IP나 포트를 하나의 규칙으로 처리할 수 있습니다.

```bash
# 익명 세트 (인라인)
nft add rule inet filter INPUT \
  tcp dport { 22, 80, 443, 8080 } accept

# 명명 세트 생성
nft add set inet filter ALLOWED_IPS \
  '{ type ipv4_addr; flags interval; }'

# 세트에 IP 추가
nft add element inet filter ALLOWED_IPS { 203.0.113.0/24, 198.51.100.5 }

# 세트를 규칙에서 참조
nft add rule inet filter INPUT \
  ip saddr @ALLOWED_IPS tcp dport 22 accept
```

**맵(Map)**은 키-값 쌍으로, DNAT 포트 매핑 등에 활용합니다.

```bash
# 포트별 DNAT 맵
nft add map nat DNAT_MAP \
  '{ type inet_service : ipv4_addr . inet_service; }'
nft add element nat DNAT_MAP { 80 : 192.168.1.10 . 8080 }
nft add rule nat PREROUTING \
  tcp dport @DNAT_MAP dnat to tcp dport map @DNAT_MAP
```

## iptables에서 마이그레이션

iptables 규칙을 nftables 문법으로 자동 변환하는 도구가 있습니다.

```bash
# iptables 규칙을 nft 문법으로 변환 (실행하지 않음)
iptables-restore-translate -f /tmp/iptables.rules

# ip6tables 포함 변환
ip6tables-restore-translate -f /tmp/ip6tables.rules

# 변환 결과를 파일로 저장
iptables-restore-translate -f /tmp/rules.v4 > /etc/nftables.conf
```

## 규칙 영구 저장

```bash
# 현재 규칙을 파일로 저장
nft list ruleset > /etc/nftables.conf

# systemd 서비스 활성화 (부팅 시 자동 로드)
systemctl enable --now nftables

# 즉시 적용
nft -f /etc/nftables.conf
```

Debian/Ubuntu에서는 `nftables.service`가 시작 시 `/etc/nftables.conf`를 읽습니다. RHEL/Fedora에서는 `firewalld`가 내부적으로 nftables를 사용합니다.

## conntrack과 상태 추적

nftables에서 **연결 추적(conntrack)**은 `ct` 표현식으로 접근합니다.

```bash
# 상태 기반 규칙
ct state established,related accept
ct state invalid drop

# 연결당 패킷 수 제한 (rate limit)
tcp dport 22 ct state new \
  limit rate 3/minute accept
```

`established`는 이미 확립된 연결, `related`는 FTP 데이터 채널처럼 기존 연결에서 파생된 연결을 뜻합니다. `invalid`는 추적 불가능한 이상 패킷입니다.

nftables는 현재 리눅스 방화벽의 표준입니다. iptables를 직접 쓰던 분도 nftables의 표현식 언어와 세트/맵 기능을 익히면 훨씬 간결하고 빠른 방화벽을 구성할 수 있습니다.

---

**지난 글:** [iptables — 리눅스 방화벽 기초](/posts/linux-iptables-basics/)

**다음 글:** [firewalld & ufw — 방화벽 관리 도구](/posts/linux-firewalld-ufw/)

<br>
읽어주셔서 감사합니다. 😊
