---
title: "NetworkManager — 네트워크 연결 관리"
description: "NetworkManager의 구조와 nmcli·nmtui 사용법, 연결 프로파일 생성·수정, DNS 설정, Wi-Fi 관리 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "networkmanager", "nmcli", "nmtui", "network", "connection", "wifi", "ethernet", "dns", "ip"]
featured: false
draft: false
---

[지난 글](/posts/linux-firewalld-ufw/)에서 firewalld와 ufw로 방화벽 규칙을 관리하는 방법을 살펴봤습니다. 이번에는 네트워크 인터페이스와 연결을 관리하는 **NetworkManager**를 다룹니다. 현대 리눅스 배포판 대부분(Ubuntu, Fedora, RHEL, openSUSE 등)이 NetworkManager를 기본 네트워크 관리자로 사용합니다.

## NetworkManager 개요

NetworkManager는 systemd 서비스로 실행되며, D-Bus를 통해 클라이언트와 통신합니다. 인터페이스를 `up`/`down`할 뿐 아니라, Wi-Fi 스캔, VPN 연결, DNS 설정 등을 통합적으로 처리합니다.

![NetworkManager 구성 요소](/assets/posts/linux-network-manager-arch.svg)

NetworkManager는 네트워크 설정을 **연결 프로파일(Connection Profile)**로 관리합니다. 연결 프로파일은 `/etc/NetworkManager/system-connections/` 디렉터리에 keyfile 형식으로 저장됩니다.

```bash
# NetworkManager 서비스 상태 확인
systemctl status NetworkManager

# 연결 프로파일 저장 위치
ls /etc/NetworkManager/system-connections/
```

## nmcli 기본 명령어

`nmcli`(NetworkManager Command-Line Interface)는 터미널에서 NetworkManager를 제어하는 주요 도구입니다.

```bash
# 장치 상태 조회
nmcli device status
nmcli dev status          # 줄임

# 연결 목록 조회
nmcli connection show
nmcli con show            # 줄임

# 활성화된 연결만 조회
nmcli con show --active

# 특정 연결 상세 조회
nmcli con show "my-connection"
```

## 이더넷 연결 프로파일 생성

```bash
# DHCP 이더넷 연결 추가
nmcli con add type ethernet \
  con-name "home-eth" ifname eth0

# 고정 IP 이더넷 연결 추가
nmcli con add type ethernet \
  con-name "office-eth" ifname eth0 \
  ip4 192.168.1.100/24 gw4 192.168.1.1

# DNS 서버 추가
nmcli con mod "office-eth" \
  ipv4.dns "8.8.8.8 8.8.4.4"

# 연결 활성화
nmcli con up "office-eth"

# 연결 비활성화
nmcli con down "home-eth"
```

`nmcli con mod`로 기존 연결 설정을 변경할 때는 변경 후 `nmcli con up`으로 재연결해야 적용됩니다.

![nmcli 핵심 명령어](/assets/posts/linux-network-manager-nmcli.svg)

## 고정 IP 설정 (ipv4 옵션 상세)

```bash
# 복수 DNS 및 검색 도메인 설정
nmcli con mod "office-eth" \
  ipv4.method manual \
  ipv4.addresses "192.168.1.100/24" \
  ipv4.gateway "192.168.1.1" \
  ipv4.dns "8.8.8.8,1.1.1.1" \
  ipv4.dns-search "example.com,corp.local"

# IPv6 비활성화
nmcli con mod "office-eth" \
  ipv6.method ignore

# 변경 사항 적용 (재연결)
nmcli con up "office-eth"
```

## Wi-Fi 연결

```bash
# Wi-Fi 장치 상태 확인
nmcli radio wifi

# Wi-Fi 켜기/끄기
nmcli radio wifi on
nmcli radio wifi off

# 주변 AP 스캔
nmcli dev wifi list

# 특정 SSID에 연결
nmcli dev wifi connect "MySSID" password "MyPassword"

# 저장된 Wi-Fi 연결 목록
nmcli con show | grep wifi

# 연결 프로파일에 패스워드 저장
nmcli con mod "MySSID" \
  wifi-sec.psk "NewPassword"
```

## nmtui: 텍스트 UI

터미널에서 더 직관적인 인터페이스가 필요하다면 `nmtui`를 씁니다.

```bash
nmtui
```

화살표 키와 Enter로 탐색합니다. "Edit a connection"에서 연결을 편집하고, "Activate a connection"에서 활성화/비활성화할 수 있습니다. SSH 세션에서도 잘 동작합니다.

## 연결 프로파일 파일 직접 편집

keyfile 형식의 연결 프로파일을 직접 편집할 수도 있습니다.

```ini
# /etc/NetworkManager/system-connections/office-eth.nmconnection
[connection]
id=office-eth
type=ethernet
interface-name=eth0

[ipv4]
method=manual
addresses=192.168.1.100/24
gateway=192.168.1.1
dns=8.8.8.8;1.1.1.1;

[ipv6]
method=ignore
```

파일 수정 후에는 NetworkManager에 다시 읽어들이도록 해야 합니다.

```bash
# 변경 사항 리로드
nmcli con reload

# 또는 서비스 재시작
systemctl restart NetworkManager
```

## DNS 관리와 systemd-resolved 연동

NetworkManager는 기본적으로 시스템 DNS를 직접 관리하지만, `systemd-resolved`와 연동하면 DNS 캐싱과 DNSSEC 등 추가 기능을 활용할 수 있습니다.

```bash
# NetworkManager DNS 관리 모드 확인
cat /etc/NetworkManager/NetworkManager.conf

# systemd-resolved 연동 설정
# /etc/NetworkManager/NetworkManager.conf
[main]
dns=systemd-resolved

# 변경 후 재시작
systemctl restart NetworkManager
```

## 자주 사용하는 진단 명령어

```bash
# 연결 이름으로 IP 주소 확인
nmcli -f IP4.ADDRESS,IP4.GATEWAY con show "office-eth"

# 장치별 연결 속도/링크 상태
nmcli dev show eth0

# 네트워크 연결 로그 확인
journalctl -u NetworkManager -n 50

# 특정 연결 삭제
nmcli con delete "old-connection"

# 자동 연결 비활성화
nmcli con mod "office-eth" connection.autoconnect no
```

NetworkManager는 단순한 연결 관리를 넘어 VPN, 모바일 브로드밴드, PPPoE까지 지원합니다. 서버 환경에서는 `nmcli`로, 데스크톱 환경에서는 `nm-applet`(트레이 아이콘) 또는 GNOME 설정 패널로 쉽게 제어할 수 있습니다.

---

**지난 글:** [firewalld & ufw — 방화벽 관리 도구](/posts/linux-firewalld-ufw/)

**다음 글:** [resolv.conf & systemd-resolved — DNS 설정](/posts/linux-resolv-conf-systemd-resolved/)

<br>
읽어주셔서 감사합니다. 😊
