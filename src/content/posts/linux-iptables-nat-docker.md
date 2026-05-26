---
title: "iptables NAT와 Docker 네트워크 — 컨테이너 트래픽 흐름"
description: "Docker가 iptables를 이용해 컨테이너 NAT(MASQUERADE)와 포트 포워딩(DNAT)을 구현하는 원리, DOCKER 커스텀 체인, ip_forward 설정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "iptables", "nat", "docker", "masquerade", "dnat", "netfilter", "network"]
featured: false
draft: false
---

[지난 글](/posts/linux-qemu-overview/)에서 QEMU의 에뮬레이션과 가상화 가속 원리를 살펴봤습니다. 이번에는 컨테이너 네트워킹의 핵심 — Docker가 **iptables NAT** 규칙을 어떻게 설정해 컨테이너와 외부 세계를 연결하는지 들여다봅니다.

## 왜 iptables인가

Docker 컨테이너는 `docker0`라는 가상 브리지에 veth 페어로 연결됩니다. 컨테이너의 기본 IP는 `172.17.0.0/16` 대역이라 외부에서 직접 라우팅할 수 없습니다. Docker는 Linux 커널의 **Netfilter(iptables)** 를 이용해 두 가지 NAT를 자동 구성합니다.

- **MASQUERADE**: 컨테이너 → 외부 트래픽에서 출발지 IP를 호스트 IP로 치환
- **DNAT**: 외부 → 컨테이너 포트 포워딩(-p)에서 목적지 IP:포트를 컨테이너 IP:포트로 변환

![Docker 컨테이너 트래픽 흐름](/assets/posts/linux-iptables-nat-docker-flow.svg)

## Docker 브리지 네트워크 구조

```bash
# docker0 브리지 확인
ip addr show docker0
# inet 172.17.0.1/16

# 컨테이너 실행 후 veth 페어 확인
docker run -d --name web nginx
ip link show type veth
# veth abc123@if3: ... master docker0

# 컨테이너 내부 IP 확인
docker inspect web | grep IPAddress
# "IPAddress": "172.17.0.2"
```

## iptables 규칙 확인

```bash
# nat 테이블 전체 보기
sudo iptables -t nat -L -n -v

# POSTROUTING: MASQUERADE 규칙
sudo iptables -t nat -L POSTROUTING -n
# MASQUERADE  all -- 172.17.0.0/16  !172.17.0.0/16

# PREROUTING: 포트 포워딩 DNAT
sudo iptables -t nat -L DOCKER -n
# DNAT  tcp -- 0.0.0.0/0  0.0.0.0/0  tcp dpt:8080 to:172.17.0.2:80

# filter 테이블: FORWARD 허용
sudo iptables -t filter -L FORWARD -n
```

## Docker 커스텀 체인

Docker는 기본 체인에 직접 규칙을 추가하지 않고 커스텀 체인을 만들어 관리합니다.

![iptables 체인과 Docker 커스텀 체인](/assets/posts/linux-iptables-nat-docker-chains.svg)

| 체인 | 테이블 | 역할 |
|------|--------|------|
| DOCKER | nat | DNAT 포트 포워딩 규칙 |
| DOCKER | filter | 컨테이너로의 연결 허용 |
| DOCKER-USER | filter | 사용자 커스텀 규칙 삽입 위치 |
| DOCKER-ISOLATION-STAGE-1 | filter | 네트워크 간 격리 1단계 |
| DOCKER-ISOLATION-STAGE-2 | filter | 네트워크 간 격리 2단계 |

## 사용자 정의 방화벽 규칙

Docker 컨테이너에 방화벽 규칙을 추가할 때는 반드시 **DOCKER-USER** 체인에 추가해야 합니다. Docker가 재시작되면 DOCKER 체인은 재생성되지만 DOCKER-USER 체인은 보존됩니다.

```bash
# 특정 IP만 컨테이너 포트 접근 허용
sudo iptables -I DOCKER-USER -i eth0 \
    ! -s 203.0.113.0/24 \
    -j DROP

# 특정 포트 외부 접근 차단
sudo iptables -I DOCKER-USER \
    -p tcp --dport 5432 \
    -j DROP

# 규칙 저장 (Ubuntu)
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

## 포트 포워딩 원리 상세

```bash
# docker run -p 8080:80 시 생성되는 규칙
# 1. PREROUTING DNAT: 목적지 포트 8080 → 172.17.0.2:80
# 2. FORWARD ACCEPT: docker0 → eth0 양방향 허용
# 3. POSTROUTING MASQUERADE: 응답 패킷 변환

# 규칙 수동 추가 예 (Docker 없이 NAT 구성)
sudo iptables -t nat -A PREROUTING \
    -p tcp --dport 8080 \
    -j DNAT --to-destination 172.17.0.2:80

sudo iptables -t nat -A POSTROUTING \
    -s 172.17.0.0/16 ! -d 172.17.0.0/16 \
    -j MASQUERADE

sudo iptables -A FORWARD -i docker0 -j ACCEPT
sudo iptables -A FORWARD -o docker0 -j ACCEPT

# ip_forward 활성화 (필수)
echo 1 > /proc/sys/net/ipv4/ip_forward
# 영구 설정: /etc/sysctl.conf → net.ipv4.ip_forward = 1
```

## iptables vs nftables

Docker 최신 버전(23+)은 시스템에 따라 nftables 백엔드를 사용할 수 있습니다. `iptables-nft`가 설치된 환경에서는 nftables 규칙이 생성됩니다.

```bash
# nftables로 확인
sudo nft list ruleset | grep docker

# Docker가 iptables-legacy 사용하도록 강제 (호환성)
sudo update-alternatives --set iptables /usr/sbin/iptables-legacy
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy
sudo systemctl restart docker
```

## 네트워크 격리 확인

```bash
# 서로 다른 Docker 네트워크 간 격리 확인
docker network create net1
docker network create net2
docker run -d --network net1 --name c1 alpine sleep 3600
docker run -d --network net2 --name c2 alpine sleep 3600

# c2에서 c1으로 ping 불가 (DOCKER-ISOLATION 체인이 차단)
docker exec c2 ping -c 1 c1

# 두 네트워크를 연결하려면
docker network connect net2 c1
```

---

**지난 글:** [QEMU 개요 — 범용 에뮬레이터이자 가상화 가속기](/posts/linux-qemu-overview/)

**다음 글:** [Linux 부팅 과정 — BIOS에서 systemd까지](/posts/linux-boot-process/)

<br>
읽어주셔서 감사합니다. 😊
