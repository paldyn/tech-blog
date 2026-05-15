---
title: "iptables — 리눅스 방화벽 기초"
description: "iptables의 테이블·체인·타겟 구조, filter/nat 테이블 규칙 추가, conntrack Stateful 방화벽, MASQUERADE·DNAT 포트포워딩, 규칙 저장 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "iptables", "netfilter", "firewall", "nat", "dnat", "snat", "masquerade", "conntrack", "filter"]
featured: false
draft: false
---

[지난 글](/posts/linux-tcpdump-basics/)에서 tcpdump로 패킷을 관찰했습니다. 이번에는 패킷을 **제어**하는 **iptables**를 다룹니다. iptables는 리눅스 커널의 Netfilter 프레임워크를 사용자 공간에서 조작하는 도구입니다. 방화벽, NAT, 포트 포워딩, 패킷 수정이 모두 iptables 하나에 통합되어 있습니다.

## 핵심 개념: 테이블 · 체인 · 타겟

**테이블(Table)**: 기능별로 나뉜 규칙 집합
- `filter`: 허용/차단 (기본 테이블)
- `nat`: 주소 변환 (DNAT/SNAT/MASQUERADE)
- `mangle`: 패킷 필드 수정
- `raw`: conntrack 제외

**체인(Chain)**: 패킷이 통과하는 규칙 목록
- `INPUT`: 로컬 프로세스로 들어오는 패킷
- `OUTPUT`: 로컬 프로세스에서 나가는 패킷
- `FORWARD`: 라우팅으로 통과하는 패킷
- `PREROUTING`: 라우팅 전 처리
- `POSTROUTING`: 라우팅 후 처리

**타겟(Target)**: 규칙 일치 시 수행할 동작
- `ACCEPT`: 패킷 허용
- `DROP`: 패킷 무시 (응답 없음)
- `REJECT`: 패킷 거부 (ICMP 오류 반환)
- `LOG`: 로그 기록 후 다음 규칙 계속
- `RETURN`: 호출 체인으로 복귀

![iptables 테이블 · 체인 구조](/assets/posts/linux-iptables-basics-chains.svg)

## 기본 명령어

```bash
# -t: 테이블 (생략 시 filter)
# -A: 끝에 추가 (Append)
# -I: 앞에 삽입 (Insert)
# -D: 삭제 (Delete)
# -L: 목록 조회 (List)
# -F: 전체 삭제 (Flush)
# -P: 기본 정책 설정 (Policy)
# -n: 이름 해석 안 함, -v: 상세, --line-numbers: 번호

# 현재 규칙 조회
sudo iptables -L -n -v --line-numbers

# filter 테이블 명시
sudo iptables -t filter -L -n -v
```

## filter 테이블 — 방화벽 설정

```bash
# 루프백 허용 (항상 먼저)
sudo iptables -A INPUT -i lo -j ACCEPT

# 기존 연결 응답 허용 (Stateful)
sudo iptables -A INPUT \
  -m conntrack \
  --ctstate ESTABLISHED,RELATED \
  -j ACCEPT

# SSH 허용
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 웹 서버
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# ICMP(ping) 허용
sudo iptables -A INPUT -p icmp -j ACCEPT

# 나머지 모두 차단 (맨 마지막에)
sudo iptables -A INPUT -j DROP
```

`-m conntrack --ctstate ESTABLISHED,RELATED` 없이 기본 정책을 DROP으로 바꾸면 기존 연결도 끊깁니다. 반드시 ESTABLISHED 허용을 먼저 추가하세요.

![iptables 규칙 관리](/assets/posts/linux-iptables-basics-rules.svg)

### 특정 IP 차단/허용

```bash
# 특정 IP 차단 (앞에 삽입)
sudo iptables -I INPUT 1 -s 1.2.3.4 -j DROP

# IP 대역 허용
sudo iptables -A INPUT -s 192.168.1.0/24 -j ACCEPT

# 포트 범위
sudo iptables -A INPUT -p tcp --dport 8000:8080 -j ACCEPT
```

### 기본 정책

```bash
# INPUT 기본 DROP (화이트리스트 방화벽)
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# 주의: SSH 규칙 없이 DROP 설정하면 접속 불가
```

## nat 테이블 — 주소 변환

### MASQUERADE (인터넷 공유)

리눅스 PC를 라우터로 사용할 때 내부 네트워크를 외부로 연결합니다.

```bash
# IP 포워딩 활성화
echo 1 > /proc/sys/net/ipv4/ip_forward

# 영구 설정
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sudo sysctl -p

# MASQUERADE (eth0 = 외부 인터페이스)
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
```

### DNAT (포트 포워딩)

외부에서 8080 포트로 오는 요청을 내부 서버 10.0.0.5:80으로 전달합니다.

```bash
sudo iptables -t nat -A PREROUTING \
  -p tcp --dport 8080 \
  -j DNAT --to-destination 10.0.0.5:80

# FORWARD도 허용해야 함
sudo iptables -A FORWARD \
  -d 10.0.0.5 -p tcp --dport 80 \
  -m conntrack --ctstate NEW,ESTABLISHED,RELATED \
  -j ACCEPT
```

## 규칙 관리

```bash
# 번호로 삭제
sudo iptables -D INPUT 3

# 조건으로 삭제
sudo iptables -D INPUT -p tcp --dport 8080 -j ACCEPT

# 체인 전체 삭제
sudo iptables -F INPUT

# 모든 테이블 초기화 (주의)
sudo iptables -F
sudo iptables -t nat -F
sudo iptables -X
```

## 규칙 저장과 복원

iptables 규칙은 재부팅 시 사라집니다.

```bash
# 저장
sudo iptables-save > /etc/iptables/rules.v4

# 복원
sudo iptables-restore < /etc/iptables/rules.v4

# 자동 복원 패키지 설치
sudo apt install iptables-persistent
# 설치 시 현재 규칙을 자동 저장, 부팅 시 복원
```

## iptables vs 현대 도구

| 도구 | 특징 |
|------|------|
| `iptables` | 전통적, 가장 널리 문서화 |
| `nftables` | 현대, 더 간결한 문법 |
| `ufw` | Ubuntu 기본, 쉬운 CLI |
| `firewalld` | RHEL 기본, zone 기반 |

커널 내부는 iptables도 nftables도 Netfilter를 사용합니다. 최신 시스템에서 `iptables`는 nftables 위에 호환 레이어로 동작하는 경우가 많습니다.

## 정리

iptables는 **테이블 → 체인 → 규칙 → 타겟** 순서로 패킷을 처리합니다. `filter`로 방화벽을, `nat`으로 주소 변환을 합니다. `-m conntrack`으로 Stateful 방화벽을 구성하면 ESTABLISHED 연결을 자동 허용해 규칙 수를 크게 줄일 수 있습니다. `iptables-save`로 반드시 규칙을 영구 저장해두세요.

---

**지난 글:** [tcpdump — 패킷 캡처 기초](/posts/linux-tcpdump-basics/)

<br>
읽어주셔서 감사합니다. 😊
