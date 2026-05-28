---
title: "Network Unreachable — 네트워크 연결 불가 트러블슈팅"
description: "ping 실패, Network Unreachable 에러의 원인을 계층별로 추적하는 방법을 설명합니다. ip addr, ip route, ping, traceroute를 이용한 단계별 진단 흐름과 실전 복구 명령을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "network", "troubleshooting", "ip", "ping", "routing"]
featured: false
draft: false
---

서버 접속이 갑자기 끊기거나 curl이 아무 응답 없이 타임아웃될 때, [지난 글](/posts/linux-too-many-open-files/)에서 살펴본 파일 디스크립터 문제와 달리 원인은 네트워크 스택 어딘가에 숨어 있다. "Network Unreachable"이라는 메시지는 커널이 목적지로 향하는 경로를 라우팅 테이블에서 찾지 못했을 때 내보내는 신호다. 이 글에서는 계층을 순서대로 밟으며 원인을 좁혀가는 진단 흐름을 설명한다.

## 왜 "Network Unreachable"인가

ICMP 타입 3 코드 0 메시지가 바로 "Network Unreachable"이다. 커널이 패킷을 전달하려고 라우팅 테이블을 조회했는데, 일치하는 항목이 없을 때 발생한다. 비슷하지만 다른 에러인 "Host Unreachable"(코드 1)은 경로는 있지만 해당 호스트에 ARP 응답이 없을 때 나온다. 둘을 구분하면 어느 계층을 먼저 볼지 빠르게 좁혀진다.

![Network Unreachable 트러블슈팅 흐름](/assets/posts/linux-network-unreachable-flow.svg)

## 1단계 — 루프백으로 TCP/IP 스택 확인

```bash
ping -c 3 127.0.0.1
```

루프백(127.0.0.1)은 물리 NIC와 무관하게 커널 내부에서 처리된다. 여기서 실패하면 TCP/IP 스택 자체가 손상된 것이므로, `systemctl restart NetworkManager` 또는 재부팅 수준의 조치가 필요하다.

## 2단계 — 인터페이스 상태 점검

```bash
ip addr show
ip link show
```

`ip addr show`에서 인터페이스가 `<DOWN>` 상태이거나 IP 주소가 없으면 연결이 불가능하다.

```bash
# 인터페이스 강제 UP
sudo ip link set eth0 up

# DHCP 재요청
sudo dhclient eth0

# 또는 NetworkManager를 통해
nmcli device connect eth0
```

인터페이스가 UP이고 IP가 있다면 3단계로 진행한다.

## 3단계 — 라우팅 테이블 확인

```bash
ip route show
```

출력에 `default via <게이트웨이IP>` 줄이 없으면 외부로 나가는 경로가 없다. 직접 추가하거나 DHCP로 재취득한다.

```bash
# 임시 기본 경로 추가
sudo ip route add default via 192.168.1.1

# 특정 목적지 경로 확인
ip route get 8.8.8.8
```

`ip route get`은 커널이 실제로 선택할 경로를 보여준다. 출력에 `dev eth0` 같은 인터페이스가 표시되면 경로는 존재한다.

## 4단계 — 게이트웨이 도달 가능성 확인

```bash
# 기본 게이트웨이 IP 자동 추출 후 ping
GW=$(ip route | awk '/default/ { print $3; exit }')
ping -c 4 "$GW"
```

게이트웨이 ping이 실패한다면 L2(이더넷) 또는 물리 계층 문제다. 케이블, 스위치 포트, VLAN 설정을 확인한다.

```bash
# ARP 테이블 확인 (게이트웨이 MAC이 있는지)
arp -n
ip neigh show
```

게이트웨이의 MAC 주소가 REACHABLE 상태로 나타나야 한다.

## 5단계 — 외부 인터넷 연결 확인

게이트웨이 ping이 성공했다면 이제 외부 IP로 테스트한다.

```bash
ping -c 3 8.8.8.8
curl -I --max-time 5 https://8.8.8.8
```

이 단계에서 실패한다면 ISP 또는 방화벽 문제로 범위가 좁혀진다. `traceroute 8.8.8.8`로 어느 홉에서 멈추는지 확인한다.

![주요 진단 및 조치 명령어](/assets/posts/linux-network-unreachable-commands.svg)

## 빠른 진단 원라이너

```bash
# 인터페이스·라우팅·게이트웨이를 한 번에 확인
ip a; ip r; ping -c 2 "$(ip r | awk '/default/{print $3; exit}')"
```

## 자주 발생하는 원인 요약

| 증상 | 원인 | 조치 |
|------|------|------|
| ping 127.0.0.1 실패 | TCP/IP 스택 손상 | NetworkManager 재시작 |
| 인터페이스 DOWN | 드라이버 오류, 케이블 분리 | `ip link set eth0 up` |
| IP 주소 없음 | DHCP 실패 | `dhclient eth0` |
| 기본 경로 없음 | DHCP 미취득, 수동 설정 오류 | `ip route add default via GW` |
| 게이트웨이 ping 실패 | L2 문제, VLAN 미설정 | 케이블·스위치 점검 |
| 8.8.8.8 ping 실패 | 방화벽, ISP 차단 | iptables / firewalld 점검 |

## 영구 설정 — /etc/sysconfig/network-scripts

임시 명령은 재부팅 후 사라진다. 영구 설정은 배포판마다 다르다.

```bash
# RHEL/Rocky — nmcli로 저장
nmcli con mod eth0 ipv4.gateway 192.168.1.1
nmcli con up eth0

# Debian/Ubuntu — /etc/netplan/
# netplan apply 후 영구 적용
```

네트워크 연결 불가 문제는 대부분 인터페이스 DOWN, 기본 경로 누락, 게이트웨이 도달 불가 세 가지로 귀결된다. 계층 순서대로 좁혀가면 대부분 5분 안에 원인을 찾을 수 있다.

---

**지난 글:** [Too many open files — 파일 디스크립터 한도 문제 해결](/posts/linux-too-many-open-files/)

**다음 글:** [DNS 이름 해석 실패 트러블슈팅](/posts/linux-dns-resolution-fail/)

<br>
읽어주셔서 감사합니다. 😊
