---
title: "ip addr·link·route — 현대 리눅스 네트워크 설정"
description: "iproute2의 ip addr, ip link, ip route, ip neigh 세부 사용법, VLAN 인터페이스 생성, 정책 라우팅, 네트워크 네임스페이스 진입까지 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "iproute2", "ip-addr", "ip-link", "ip-route", "vlan", "namespace", "routing", "network", "neigh"]
featured: false
draft: false
---

[지난 글](/posts/linux-ip-vs-ifconfig/)에서 `ip`와 `ifconfig`의 차이를 비교했습니다. 이번에는 `ip`의 세 핵심 서브커맨드인 **ip addr**, **ip link**, **ip route**를 깊이 파봅니다. 이 세 가지를 자유롭게 다루면 리눅스 네트워크 설정의 90%를 처리할 수 있습니다.

## ip 명령어 전역 옵션

```bash
ip -4  # IPv4만 표시
ip -6  # IPv6만 표시
ip -s  # 통계(statistics) 포함
ip -br # 브리프(간단) 출력
ip -c  # 컬러 출력
ip -j  # JSON 출력 (스크립트에 유용)

# 예: JSON으로 파싱
ip -j addr show | python3 -m json.tool
```

![ip 명령어 객체 구조](/assets/posts/linux-ip-addr-link-route-objects.svg)

## ip addr — IP 주소 관리

### 주소 조회

```bash
ip addr show              # 전체
ip addr show dev eth0     # 특정 인터페이스
ip -br addr show          # 간략 출력: eth0 UP 192.168.1.10/24

# 특정 주소 패밀리
ip -4 addr show
ip -6 addr show
```

### 주소 추가·삭제

```bash
# /24 = 255.255.255.0
sudo ip addr add 192.168.1.50/24 dev eth0

# 같은 인터페이스에 IP 여러 개 (secondary)
sudo ip addr add 192.168.1.51/24 dev eth0

# 삭제
sudo ip addr del 192.168.1.51/24 dev eth0

# 모든 주소 한 번에 삭제
sudo ip addr flush dev eth0
```

`flush`는 인터페이스의 모든 주소를 한 번에 제거합니다. 사용 전 주의가 필요합니다.

## ip link — 인터페이스 관리

### 기본 조작

```bash
ip link show              # 전체 인터페이스
ip -br link show          # 간략: eth0 UP ...
ip -s link show eth0      # RX/TX 통계 포함

sudo ip link set eth0 up
sudo ip link set eth0 down
sudo ip link set eth0 mtu 9000    # Jumbo Frame
sudo ip link set eth0 address 00:11:22:33:44:55
```

### VLAN 인터페이스 생성

```bash
# 802.1Q VLAN 서브인터페이스
sudo ip link add link eth0 name eth0.100 type vlan id 100
sudo ip link set eth0.100 up
sudo ip addr add 192.168.100.1/24 dev eth0.100

# 확인
ip link show type vlan
```

### 가상 인터페이스

```bash
# 루프백 추가 (테스트·컨테이너)
sudo ip link add dummy0 type dummy
sudo ip link set dummy0 up

# veth pair (컨테이너 네트워킹)
sudo ip link add veth0 type veth peer name veth1

# 브리지 생성
sudo ip link add br0 type bridge
sudo ip link set eth0 master br0
sudo ip link set br0 up
```

![ip route / ip link 실전 예제](/assets/posts/linux-ip-addr-link-route-examples.svg)

## ip route — 라우팅 관리

### 라우팅 테이블 조회

```bash
ip route show           # 기본 테이블
ip route show table all # 모든 라우팅 테이블

# 출력 예
# default via 192.168.1.1 dev eth0 proto dhcp
# 192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100
```

### 경로 추가·삭제

```bash
# 기본 게이트웨이
sudo ip route add default via 192.168.1.1

# 특정 네트워크로 다른 게이트웨이
sudo ip route add 10.0.0.0/8 via 192.168.1.254 dev eth0

# 특정 경로 삭제
sudo ip route del 10.0.0.0/8

# 기본 게이트웨이 삭제
sudo ip route del default
```

### ip route get — 실제 경로 확인

```bash
# 8.8.8.8으로 나가는 실제 경로
ip route get 8.8.8.8
# 출력: 8.8.8.8 via 192.168.1.1 dev eth0 src 192.168.1.100

# 소스 IP 지정
ip route get 8.8.8.8 from 192.168.2.1
```

### 정책 라우팅 (여러 테이블)

```bash
# 테이블 100에 경로 추가
sudo ip route add default via 10.0.0.1 table 100

# 소스 IP에 따라 테이블 선택
sudo ip rule add from 192.168.2.0/24 table 100

# 규칙 목록
ip rule show
```

## ip neigh — ARP 캐시

```bash
ip neigh show
ip neigh show dev eth0
sudo ip neigh flush dev eth0    # ARP 캐시 초기화
```

## ip netns — 네트워크 네임스페이스

```bash
# 네임스페이스 생성
sudo ip netns add testns

# 네임스페이스 내에서 명령 실행
sudo ip netns exec testns ip addr

# veth pair로 호스트-네임스페이스 연결
sudo ip link add veth-host type veth peer name veth-ns
sudo ip link set veth-ns netns testns
sudo ip netns exec testns ip link set veth-ns up
sudo ip netns exec testns ip addr add 10.0.0.2/24 dev veth-ns

# 네임스페이스 삭제
sudo ip netns del testns
```

## 영구 설정 방법

`ip` 명령어는 재부팅 후 리셋됩니다. 영구 설정은 배포판 도구를 씁니다.

```bash
# NetworkManager (대부분 배포판)
nmcli con show
nmcli con mod "Wired connection 1" ipv4.addresses 192.168.1.100/24
nmcli con mod "Wired connection 1" ipv4.gateway 192.168.1.1
nmcli con up "Wired connection 1"

# systemd-networkd (/etc/systemd/network/10-eth0.network)
# [Match]
# Name=eth0
# [Network]
# Address=192.168.1.100/24
# Gateway=192.168.1.1
```

## 정리

`ip link`는 L2 인터페이스를, `ip addr`는 L3 주소를, `ip route`는 경로를 관리합니다. `-br`로 간략 출력, `-j`로 JSON, `-s`로 통계를 추가할 수 있습니다. `ip route get`으로 특정 목적지에 실제 어떤 경로를 쓰는지 확인하는 습관을 들이면 네트워크 트러블슈팅이 훨씬 빨라집니다.

---

**지난 글:** [ip vs ifconfig — 네트워크 인터페이스 도구 비교](/posts/linux-ip-vs-ifconfig/)

**다음 글:** [ping·traceroute — 네트워크 연결성 진단](/posts/linux-ping-traceroute/)

<br>
읽어주셔서 감사합니다. 😊
