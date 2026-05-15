---
title: "firewalld & ufw — 방화벽 관리 도구"
description: "firewalld의 존(zone) 개념과 firewall-cmd, ufw의 간편한 규칙 관리, 두 도구의 차이와 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "firewalld", "ufw", "firewall", "zone", "iptables", "nftables", "firewall-cmd", "security"]
featured: false
draft: false
---

[지난 글](/posts/linux-nftables/)에서 nftables의 저수준 명령을 살펴봤습니다. nftables나 iptables를 직접 다루는 것은 강력하지만 복잡합니다. **firewalld**와 **ufw**는 이 복잡함을 추상화한 고수준 방화벽 관리 도구입니다. firewalld는 RHEL/Fedora/CentOS 계열의 기본 방화벽이고, ufw(Uncomplicated Firewall)는 Debian/Ubuntu의 기본 방화벽입니다.

## firewalld: 존(Zone) 기반 방화벽

firewalld의 핵심 개념은 **존(Zone)**입니다. 네트워크 인터페이스나 IP 주소를 특정 존에 할당하면, 그 존의 정책이 적용됩니다. 네트워크 환경이 바뀔 때(예: 사무실 Wi-Fi → 공용 Wi-Fi) 인터페이스를 다른 존으로 옮기는 것만으로 보안 정책을 전환할 수 있습니다.

![firewalld 존 신뢰 수준](/assets/posts/linux-firewalld-ufw-zones.svg)

미리 정의된 존 중 가장 자주 쓰는 것은 `public`(기본값), `trusted`, `home`, `drop`입니다. `firewall-cmd --get-default-zone`으로 현재 기본 존을 확인할 수 있습니다.

## firewall-cmd 기본 명령어

```bash
# 서비스 상태 및 기본 존 확인
firewall-cmd --state
firewall-cmd --get-default-zone
firewall-cmd --get-active-zones

# 기본 존 변경
firewall-cmd --set-default-zone=home

# 현재 존의 규칙 전체 조회
firewall-cmd --list-all
firewall-cmd --zone=public --list-all
```

변경 사항은 기본적으로 **런타임(runtime)**에만 적용됩니다. 재부팅 후에도 유지하려면 `--permanent` 플래그를 추가한 뒤 `--reload`를 실행해야 합니다.

```bash
# 포트 영구 허용
firewall-cmd --zone=public --add-port=8080/tcp --permanent
firewall-cmd --reload

# 서비스 이름으로 허용 (미리 정의된 서비스 목록)
firewall-cmd --zone=public --add-service=http --permanent
firewall-cmd --zone=public --add-service=https --permanent
firewall-cmd --reload

# 미리 정의된 서비스 목록 조회
firewall-cmd --get-services

# 허용 제거
firewall-cmd --zone=public --remove-service=http --permanent
```

## 리치 규칙(Rich Rule)

포트 허용보다 세밀한 제어가 필요할 때는 **리치 규칙**을 씁니다.

```bash
# 특정 IP에서 SSH만 허용
firewall-cmd --zone=public \
  --add-rich-rule='rule family="ipv4" \
  source address="203.0.113.0/24" \
  service name="ssh" accept' --permanent

# 특정 IP 차단
firewall-cmd --zone=public \
  --add-rich-rule='rule family="ipv4" \
  source address="198.51.100.5" drop' --permanent

# 포트 포워딩 (8080 → 80)
firewall-cmd --zone=public \
  --add-forward-port=port=8080:proto=tcp:toport=80 \
  --permanent
firewall-cmd --reload
```

## 마스커레이드(Masquerade)와 NAT

firewalld에서 마스커레이드(IP 위장)는 간단하게 활성화할 수 있습니다.

```bash
# 마스커레이드 활성화 (NAT)
firewall-cmd --zone=public --add-masquerade --permanent
firewall-cmd --reload

# 마스커레이드 확인
firewall-cmd --zone=public --query-masquerade
```

## ufw: 간결한 방화벽

ufw는 iptables(또는 nftables)의 프론트엔드로, 최대한 간단한 문법을 지향합니다.

```bash
# ufw 설치 및 활성화
sudo ufw enable

# 상태 확인
sudo ufw status verbose

# 기본 정책 설정
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

ufw의 규칙 문법은 직관적입니다.

```bash
# 포트 허용
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443

# 서비스 이름으로 허용
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# 특정 IP에서만 허용
sudo ufw allow from 203.0.113.0/24 to any port 22

# IP 차단
sudo ufw deny from 198.51.100.5
```

![firewalld vs ufw 명령어](/assets/posts/linux-firewalld-ufw-commands.svg)

## ufw 규칙 관리

```bash
# 규칙 번호 포함 조회
sudo ufw status numbered

# 번호로 규칙 삭제
sudo ufw delete 3

# 규칙 설명으로 삭제
sudo ufw delete allow 80/tcp

# 포트 범위 허용
sudo ufw allow 8000:8999/tcp

# ufw 비활성화
sudo ufw disable

# 모든 규칙 초기화
sudo ufw reset
```

## firewalld vs ufw 선택 기준

두 도구 모두 내부적으로 iptables/nftables를 사용하지만, 설계 철학이 다릅니다.

**firewalld를 선택하는 경우**
- RHEL, Fedora, CentOS, Rocky Linux, AlmaLinux 사용 시 (기본값)
- 네트워크 환경 변화에 따른 동적 정책 전환이 필요할 때
- 복잡한 NAT, 포트 포워딩, 리치 규칙이 필요할 때
- D-Bus API를 통해 다른 프로그램과 연동할 때

**ufw를 선택하는 경우**
- Ubuntu, Debian 사용 시 (기본값)
- 서버에 단순한 in/out 규칙만 필요할 때
- 빠르게 설정하고 싶을 때

두 도구를 동시에 활성화하면 규칙이 충돌할 수 있으므로, 하나만 활성화하는 것이 원칙입니다.

## firewalld 영구 설정 파일

firewalld의 영구 설정은 `/etc/firewalld/` 디렉터리에 XML 형식으로 저장됩니다.

```bash
# 설정 파일 위치
ls /etc/firewalld/zones/      # 커스텀 존 정의
ls /etc/firewalld/services/   # 커스텀 서비스 정의
ls /usr/lib/firewalld/zones/  # 기본 존 템플릿 (수정 금지)

# 현재 설정을 영구 설정으로 저장
firewall-cmd --runtime-to-permanent
```

방화벽 설정은 시스템 보안의 첫 번째 방어선입니다. firewalld나 ufw를 통해 불필요한 포트를 닫고, 최소 권한 원칙을 적용하는 습관을 들이면 서버 보안이 크게 향상됩니다.

---

**지난 글:** [nftables — iptables의 현대적 후계자](/posts/linux-nftables/)

**다음 글:** [NetworkManager — 네트워크 연결 관리](/posts/linux-network-manager/)

<br>
읽어주셔서 감사합니다. 😊
