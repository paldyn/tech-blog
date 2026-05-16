---
title: "Docker overlay 네트워크: 멀티호스트 컨테이너 통신"
description: "Docker Swarm에서 overlay 네트워크가 VXLAN 터널링으로 여러 호스트에 걸친 가상 L2 네트워크를 어떻게 구현하는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "overlay", "swarm", "VXLAN", "멀티호스트", "클러스터"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-none/)에서 완전 격리 네트워크인 none을 살펴봤다. 이번에는 방향을 크게 틀어 **여러 호스트를 하나로 묶는** overlay 네트워크를 다룬다.

## overlay 네트워크란

bridge는 단일 호스트 내에서만 컨테이너를 연결한다. 규모가 커져 여러 서버에 컨테이너를 분산시키면 bridge만으로는 서버 간 통신이 불가능하다.

overlay 드라이버는 **VXLAN(Virtual Extensible LAN) 터널링**으로 이 문제를 해결한다. 물리적으로 다른 서버에 있는 컨테이너들이 마치 같은 L2 스위치에 연결된 것처럼 통신할 수 있다.

```bash
# overlay는 Swarm 모드가 필요 (또는 --attachable 옵션)
docker swarm init --advertise-addr <manager-ip>

docker network create \
  --driver overlay \
  --subnet 10.0.1.0/24 \
  my-overlay
```

## VXLAN 동작 원리

![Docker overlay 네트워크 VXLAN 터널링](/assets/posts/docker-network-overlay-diagram.svg)

각 호스트에는 VTEP(VXLAN Tunnel Endpoint)가 생성된다. 컨테이너 A(Host 1)가 컨테이너 C(Host 2)로 패킷을 보낼 때의 흐름은 다음과 같다.

1. 컨테이너 A → eth0 → VXLAN 인터페이스
2. VTEP이 원본 L2 프레임을 UDP 패킷으로 캡슐화
3. Host 1의 물리 네트워크(UDP/4789)를 통해 Host 2로 전송
4. Host 2의 VTEP에서 역캡슐화 → 컨테이너 C의 eth0로 전달

컨테이너 입장에서는 평범한 L2 통신처럼 보인다.

## 설정 및 서비스 배포

![overlay 네트워크 설정 및 사용](/assets/posts/docker-network-overlay-setup.svg)

```bash
# Worker 노드 추가
docker swarm join --token <token> 192.168.1.10:2377

# overlay 네트워크에 서비스 배포
docker service create \
  --name api \
  --network my-overlay \
  --replicas 3 \
  myapp:latest

# 서비스가 여러 노드에 분산되어도 'api'라는 이름으로 접근
docker service create \
  --name frontend \
  --network my-overlay \
  nginx
# frontend 컨테이너 내부에서: curl http://api:8080
```

## DNS와 로드밸런싱

overlay 네트워크에서 서비스 이름은 두 가지 방식으로 해석된다.

**VIP(Virtual IP) 방식** — 기본값. 서비스 이름이 하나의 가상 IP로 해석되고, 내부 로드밸런서가 실제 컨테이너 중 하나로 트래픽을 분배한다.

```bash
# VIP 모드 (기본)
docker service create --name web --endpoint-mode vip nginx

# DNSRR 모드 — DNS가 컨테이너 IP 목록을 직접 반환
docker service create --name web --endpoint-mode dnsrr nginx
```

VIP 모드에서는 서비스 IP가 안정적이고, 특정 컨테이너가 재시작되어도 IP가 유지된다. DNSRR 모드는 클라이언트 사이드 로드밸런싱을 원할 때 사용한다.

## Swarm 없이 overlay 사용 — attachable

```bash
# --attachable 플래그를 추가하면 일반 컨테이너도 연결 가능
docker network create \
  --driver overlay \
  --attachable \
  my-overlay

# 일반 컨테이너를 overlay 네트워크에 연결
docker run -d \
  --network my-overlay \
  --name standalone-app \
  myimage
```

단, `--attachable` 없는 overlay 네트워크는 Swarm 서비스만 연결할 수 있다.

## 암호화

```bash
# 데이터 플레인 트래픽 암호화 (IPsec)
docker network create \
  --driver overlay \
  --opt encrypted \
  secure-overlay
```

`--opt encrypted`를 추가하면 VXLAN 터널 트래픽이 IPsec으로 암호화된다. 성능 오버헤드가 있지만 민감한 데이터를 다루는 서비스에 권장된다.

## 포트 요구사항

overlay 네트워크가 동작하려면 호스트 간 다음 포트가 열려 있어야 한다.

| 포트 | 프로토콜 | 용도 |
|---|---|---|
| 2377 | TCP | Swarm 관리 (manager만) |
| 7946 | TCP/UDP | 노드 간 통신 |
| 4789 | UDP | VXLAN 데이터 플레인 |

방화벽 설정을 반드시 확인해야 한다.

## Kubernetes와의 관계

Kubernetes는 자체 CNI(Container Network Interface)를 사용하며 Docker overlay를 직접 사용하지 않는다. Flannel, Calico, Cilium 등이 유사한 역할을 수행하는데, 그 기반 개념(VXLAN 터널링, 가상 L2)은 동일하다. Docker overlay를 이해하면 Kubernetes 네트워킹도 쉽게 이해할 수 있다.

---

**지난 글:** [Docker none 네트워크: 완전한 네트워크 격리](/posts/docker-network-none/)

**다음 글:** [Docker macvlan 네트워크: 물리 네트워크 직접 연결](/posts/docker-network-macvlan/)

<br>
읽어주셔서 감사합니다. 😊
