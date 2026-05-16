---
title: "Docker macvlan 네트워크: 물리 네트워크 직접 연결"
description: "Docker macvlan 드라이버로 컨테이너에 실제 MAC 주소를 부여하고 물리 네트워크에 직접 연결하는 방법과 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "macvlan", "MAC", "물리네트워크", "레거시", "마이그레이션"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-overlay/)에서 멀티호스트 통신을 위한 overlay 네트워크를 살펴봤다. 이번에는 아예 다른 접근법으로 — 컨테이너를 **물리 네트워크의 독립 장치처럼** 만드는 macvlan 드라이버를 다룬다.

## macvlan이란

macvlan은 하나의 물리 NIC(eth0) 위에 여러 개의 가상 인터페이스를 만들고, 각각에 **고유한 MAC 주소를 부여**한다. 물리 스위치에서 보면 하나의 서버에 여러 장치가 꽂혀 있는 것처럼 보인다.

컨테이너에 물리 네트워크의 실제 IP를 직접 할당할 수 있어, NAT 없이 물리 네트워크와 직접 통신한다.

```bash
# macvlan 네트워크 생성
docker network create \
  --driver macvlan \
  --subnet 192.168.1.0/24 \
  --gateway 192.168.1.1 \
  --ip-range 192.168.1.128/25 \
  -o parent=eth0 \
  macvlan-net
```

`-o parent=eth0`는 어떤 물리 인터페이스 위에 macvlan을 만들지 지정한다.

## 구조 다이어그램

![macvlan 네트워크 구조](/assets/posts/docker-network-macvlan-diagram.svg)

컨테이너 A, B, C는 각각 독립적인 MAC 주소를 갖고, 물리 스위치를 통해 직접 통신한다. NAT도, 포트 포워딩도 없다.

## 설정과 호스트 통신

![macvlan 설정 및 호스트 통신](/assets/posts/docker-network-macvlan-setup.svg)

```bash
# 컨테이너 실행 — 고정 IP 지정
docker run -d \
  --network macvlan-net \
  --ip 192.168.1.200 \
  --name legacy-app \
  mylegacyapp
```

### 핵심 제약: 호스트 ↔ 컨테이너 통신

macvlan의 가장 흔한 함정이다. **macvlan 인터페이스를 통해 호스트는 같은 macvlan 네트워크의 컨테이너와 직접 통신할 수 없다.** 이는 macvlan 드라이버의 설계 특성이다.

해결책은 호스트에도 macvlan 인터페이스를 추가하는 것이다.

```bash
# 호스트에 macvlan 인터페이스 추가
ip link add macvlan0 link eth0 type macvlan mode bridge
ip addr add 192.168.1.254/32 dev macvlan0
ip link set macvlan0 up
ip route add 192.168.1.128/25 dev macvlan0

# 이제 호스트에서 컨테이너에 접근 가능
ping 192.168.1.200
```

## Promiscuous 모드

물리 NIC가 자신의 MAC이 아닌 다른 MAC 주소의 패킷도 받아들이려면 **Promiscuous 모드**가 활성화되어 있어야 한다.

```bash
# Promiscuous 모드 확인
ip link show eth0
# PROMISC가 보이면 활성화된 상태

# 수동 활성화
ip link set eth0 promisc on
```

클라우드 환경(AWS, GCP)에서는 Promiscuous 모드를 VM 수준에서 허용하지 않는 경우가 많아 macvlan이 제대로 동작하지 않을 수 있다.

## 802.1q VLAN 트렁킹

물리 스위치가 VLAN 태깅을 지원하면 macvlan을 VLAN별로 분리할 수 있다.

```bash
# VLAN 100을 위한 macvlan 네트워크
ip link add link eth0 name eth0.100 type vlan id 100
docker network create \
  --driver macvlan \
  --subnet 10.100.0.0/24 \
  --gateway 10.100.0.1 \
  -o parent=eth0.100 \
  vlan100-net

# VLAN 200
ip link add link eth0 name eth0.200 type vlan id 200
docker network create \
  --driver macvlan \
  --subnet 10.200.0.0/24 \
  --gateway 10.200.0.1 \
  -o parent=eth0.200 \
  vlan200-net
```

## 언제 macvlan을 쓰는가

- **레거시 앱 마이그레이션**: 물리 서버에 직접 연결된 것처럼 고정 IP를 기대하는 애플리케이션
- **DHCP 직접 할당**: DHCP 서버가 컨테이너에 직접 IP를 줘야 하는 경우
- **네트워크 성능**: NAT 없는 직접 연결이 필요한 고성능 네트워킹
- **물리 장치처럼 취급**: 방화벽이나 네트워크 장비가 개별 MAC/IP로 정책을 관리하는 환경

클라우드 환경에서는 보통 ipvlan(L3 모드)이 더 적합하다. macvlan은 온프레미스 환경에서 더 자연스럽게 동작한다.

---

**지난 글:** [Docker overlay 네트워크: 멀티호스트 컨테이너 통신](/posts/docker-network-overlay/)

**다음 글:** [docker network create: 사용자 정의 네트워크 만들기](/posts/docker-network-create/)

<br>
읽어주셔서 감사합니다. 😊
