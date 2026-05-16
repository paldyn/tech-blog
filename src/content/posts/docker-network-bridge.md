---
title: "Docker bridge 네트워크 완전 분석: veth, docker0, NAT"
description: "Docker bridge 네트워크가 내부적으로 어떻게 작동하는지 veth pair, docker0 브리지, iptables NAT까지 원리를 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "bridge", "veth", "iptables", "NAT", "docker0"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-overview/)에서 Docker 네트워크 드라이버 종류를 훑었다. 이번에는 가장 기본이자 가장 많이 쓰이는 **bridge 드라이버**의 내부 동작을 깊이 파고든다.

## bridge 네트워크란

bridge 드라이버는 호스트에 **가상 브리지(L2 스위치)**를 만들고, 컨테이너들을 `veth pair`로 해당 브리지에 연결한다. 컨테이너 내부에서는 `eth0` 인터페이스가 보이고, 호스트에서는 `vethXXX` 형태의 짝 인터페이스가 브리지에 연결된다.

```bash
# 호스트에서 확인
ip link show type bridge    # docker0, br-XXXX 등
ip link show type veth      # 컨테이너당 vethXXX 인터페이스

# 컨테이너 안에서 확인
docker exec -it mycontainer ip addr show eth0
```

## 구조 다이어그램

![Docker bridge 네트워크 구조](/assets/posts/docker-network-bridge-diagram.svg)

컨테이너 A, B는 같은 bridge 네트워크에 속해 직접 통신할 수 있다. 컨테이너 C는 다른 네트워크에 있으므로 격리된다. 외부 인터넷으로 나가는 트래픽은 iptables MASQUERADE(SNAT) 규칙을 통해 호스트 IP로 변환된다.

## 기본 bridge vs 사용자 정의 bridge

![기본 bridge vs 사용자 정의 bridge](/assets/posts/docker-network-bridge-custom.svg)

기본 `bridge` 네트워크와 직접 만든 bridge 네트워크의 차이는 **DNS 이름 해석** 여부다.

```bash
# 사용자 정의 네트워크 생성
docker network create --driver bridge \
  --subnet 172.20.0.0/16 \
  --gateway 172.20.0.1 \
  my-app-net

# 두 컨테이너를 같은 네트워크에 배치
docker run -d --network my-app-net --name db postgres:15
docker run -d --network my-app-net --name api myapp

# api 컨테이너 내부에서 db를 이름으로 접근 가능
docker exec -it api ping db
```

기본 `bridge`(docker0)는 컨테이너 이름 기반 DNS가 동작하지 않는다. 사용자 정의 bridge를 만들면 Docker의 내장 DNS 서버(`127.0.0.11`)가 컨테이너 이름을 자동으로 등록한다.

## iptables와 NAT

Docker는 bridge 네트워크를 만들 때 iptables 규칙을 자동으로 추가한다.

```bash
# 호스트에서 Docker가 추가한 iptables 규칙 확인
sudo iptables -t nat -L -n
# POSTROUTING 체인에 MASQUERADE 규칙 → 외부 트래픽을 호스트 IP로 SNAT

sudo iptables -L DOCKER -n
# 포트 포워딩(DNAT) 규칙들
```

`docker run -p 8080:80`을 실행하면 Docker가 iptables에 DNAT 규칙을 추가해 호스트 8080 포트로 들어오는 트래픽을 컨테이너의 80 포트로 전달한다.

## 주요 옵션

```bash
# 서브넷과 게이트웨이 지정
docker network create \
  --subnet 192.168.100.0/24 \
  --gateway 192.168.100.1 \
  --ip-range 192.168.100.128/25 \
  custom-net

# 컨테이너에 고정 IP 할당
docker run --network custom-net \
  --ip 192.168.100.200 \
  --name fixed-ip-container \
  nginx

# ICC(컨테이너 간 통신) 비활성화 — 격리 강화
docker network create \
  --opt com.docker.network.bridge.enable_icc=false \
  isolated-net
```

## 네트워크 디버깅

```bash
# 네트워크에 속한 컨테이너 목록
docker network inspect my-app-net \
  --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}'

# 컨테이너 간 통신 확인
docker exec -it api curl http://db:5432

# 컨테이너의 라우팅 테이블
docker exec -it api ip route
# default via 172.20.0.1 dev eth0
# 172.20.0.0/16 dev eth0 proto kernel
```

## 컨테이너가 여러 네트워크에 동시 연결

하나의 컨테이너를 두 개 이상의 네트워크에 동시에 연결할 수 있다. 이 경우 컨테이너는 각 네트워크의 인터페이스(eth0, eth1 …)를 갖는다.

```bash
docker network create frontend-net
docker network create backend-net

docker run -d --network frontend-net --name proxy nginx

# 실행 중인 컨테이너에 추가 네트워크 연결
docker network connect backend-net proxy

# 이제 proxy는 frontend-net과 backend-net 양쪽에 속함
docker exec proxy ip addr
# eth0: frontend-net IP
# eth1: backend-net IP
```

---

**지난 글:** [Docker 네트워크 완전 정복: 드라이버 종류와 동작 원리](/posts/docker-network-overview/)

**다음 글:** [Docker host 네트워크: 격리 없는 최고 성능](/posts/docker-network-host/)

<br>
읽어주셔서 감사합니다. 😊
