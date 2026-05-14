---
title: "ip vs ifconfig — 네트워크 인터페이스 도구 비교"
description: "구식 net-tools의 ifconfig·route·arp와 현대 iproute2의 ip 명령어를 비교하고, ip addr show 출력 해석, 임시 IP 설정, ARP 캐시 관리를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "ip", "ifconfig", "iproute2", "net-tools", "network", "arp", "route", "mtu", "network-interface"]
featured: false
draft: false
---

[지난 글](/posts/linux-source-build-make-install/)에서 소스 빌드를 마쳤습니다. 이제 네트워크 진단과 설정을 다루는 섹션으로 넘어갑니다. 리눅스 네트워크 명령어에는 두 세대가 있습니다. 오래된 **net-tools** 패키지(`ifconfig`, `route`, `netstat`, `arp`)와 현대의 **iproute2** 패키지(`ip`, `ss`, `bridge`)입니다. RHEL 7, Debian 9 이후부터 iproute2가 기본이 되었고, 최신 배포판은 net-tools를 기본 설치하지 않습니다.

## iproute2 vs net-tools

두 도구 모두 동일한 네트워크 설정을 수행하지만, `ip` 명령어는 네트워크 네임스페이스, VLAN, 터널, 정책 라우팅 등 고급 기능을 지원합니다.

```bash
# net-tools 설치 (레거시 환경용)
sudo apt install net-tools    # Debian/Ubuntu
sudo dnf install net-tools    # Fedora

# iproute2 확인 (대부분 기본 설치)
ip --version
```

![ip vs ifconfig 명령어 대응표](/assets/posts/linux-ip-vs-ifconfig-compare.svg)

## ip 명령어 구조

`ip` 명령어는 **객체 + 동작** 구조입니다.

```bash
ip [옵션] 객체 동작 [파라미터]

# 객체: link, addr, route, neigh, rule, tunnel, mroute
# 동작: show (list), add, del, set, flush
```

축약도 지원합니다.

```bash
ip a           # ip addr show
ip l           # ip link show
ip r           # ip route show
ip n           # ip neigh show
```

## ip addr — IP 주소 관리

```bash
# 모든 인터페이스 IP 표시
ip addr show
ip -4 addr show   # IPv4만
ip -6 addr show   # IPv6만

# 특정 인터페이스
ip addr show dev eth0

# IP 주소 임시 추가 (재부팅 시 사라짐)
sudo ip addr add 192.168.1.200/24 dev eth0

# IP 주소 제거
sudo ip addr del 192.168.1.200/24 dev eth0

# 브로드캐스트 명시
sudo ip addr add 10.0.0.10/8 brd + dev eth0
```

![ip addr show 출력 해석](/assets/posts/linux-ip-vs-ifconfig-output.svg)

## ip link — 인터페이스 관리

```bash
# 모든 링크 표시
ip link show

# 인터페이스 UP/DOWN
sudo ip link set eth0 up
sudo ip link set eth0 down

# MTU 변경
sudo ip link set eth0 mtu 9000

# MAC 주소 임시 변경
sudo ip link set eth0 address 00:11:22:33:44:55

# 프로미스큐어스 모드 (패킷 캡처용)
sudo ip link set eth0 promisc on
```

링크 통계도 확인할 수 있습니다.

```bash
ip -s link show eth0
# RX/TX 패킷 수, 에러, 드롭 수를 보여줌
```

## ip route — 라우팅 테이블

```bash
# 라우팅 테이블 표시
ip route show

# 기본 게이트웨이 설정
sudo ip route add default via 192.168.1.1 dev eth0

# 특정 네트워크 경로 추가
sudo ip route add 10.0.0.0/8 via 192.168.1.254

# 경로 삭제
sudo ip route del 10.0.0.0/8

# 특정 목적지의 경로 조회
ip route get 8.8.8.8
```

`ip route get`은 실제 어떤 경로를 통해 패킷이 나가는지 확인할 때 유용합니다.

## ip neigh — ARP / NDP 캐시

```bash
# ARP 캐시 표시
ip neigh show

# 특정 인터페이스
ip neigh show dev eth0

# 수동 ARP 항목 추가
sudo ip neigh add 192.168.1.100 lladdr 00:11:22:33:44:55 dev eth0

# ARP 캐시 삭제
sudo ip neigh flush dev eth0
```

## 영구 설정

`ip` 명령어의 변경은 재부팅 후 사라집니다. 영구 설정은 배포판마다 다릅니다.

```bash
# Debian/Ubuntu — /etc/netplan/ (netplan apply 필요)
# RHEL/Fedora   — /etc/NetworkManager/ 또는 nmcli
# Arch          — /etc/systemd/network/*.network

# NetworkManager로 IP 설정 (RHEL/Ubuntu 모두)
nmcli con mod eth0 ipv4.addresses 192.168.1.100/24
nmcli con mod eth0 ipv4.gateway 192.168.1.1
nmcli con up eth0
```

## ifconfig 호환 출력

기존 스크립트나 문서에서 `ifconfig`를 써야 한다면:

```bash
# net-tools 설치
sudo apt install net-tools

ifconfig                # 활성 인터페이스 목록
ifconfig -a             # 모든 인터페이스 (down 포함)
ifconfig eth0 up
ifconfig eth0 192.168.1.10 netmask 255.255.255.0
```

## 정리

`ifconfig`는 간결하지만 iproute2에 비해 기능이 부족합니다. `ip` 명령어는 링크/주소/라우트/이웃을 일관된 `객체 + 동작` 구조로 다루며, VLAN·터널·네임스페이스 같은 고급 기능까지 지원합니다. 새로운 스크립트를 작성할 때는 `ip`를 기본으로 삼으세요.

---

**지난 글:** [소스에서 빌드하기 — ./configure·make·make install](/posts/linux-source-build-make-install/)

**다음 글:** [ip addr·link·route — 현대 리눅스 네트워크 설정](/posts/linux-ip-addr-link-route/)

<br>
읽어주셔서 감사합니다. 😊
