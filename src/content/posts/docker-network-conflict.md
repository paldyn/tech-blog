---
title: "Docker 네트워크 서브넷 충돌 해결"
description: "Docker가 자동 할당하는 172.17.0.0/16 서브넷이 VPN·회사 네트워크와 충돌하는 문제를 daemon.json bip 설정과 Compose 서브넷 지정으로 해결하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "subnet", "conflict", "VPN", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-pull-rate-limit/)에서 Docker Hub Rate Limit 문제를 해결했다. 이번에는 사무실 VPN을 켤 때 Docker 컨테이너가 인터넷에 접근하지 못하는 **네트워크 서브넷 충돌** 문제를 다룬다. 원인을 알면 설정 몇 줄로 해결된다.

## 문제 상황

VPN을 연결하면 Docker 컨테이너에서 외부로 요청이 나가지 않거나, 회사 내부 서비스에 접근이 안 된다. 또는 `docker-compose up` 시 아래 에러가 발생한다.

```text
Error response from daemon: could not find an available,
non-overlapping IPv4 address pool among the defaults
to assign to the network
```

## 원인 파악

```bash
# 라우팅 테이블 확인
ip route show

# Docker 기본 브릿지 서브넷 확인
docker network inspect bridge | grep -A3 '"Config"'
```

Docker의 기본 `bridge` 네트워크(docker0)는 **172.17.0.0/16**을 사용하고, Compose로 생성하는 네트워크는 172.18.0.0/16, 172.19.0.0/16 순서로 자동 할당된다. VPN이 같은 대역을 사용하면 라우팅이 충돌한다.

![Docker 네트워크 서브넷 충돌 구조](/assets/posts/docker-network-conflict-diagram.svg)

## 해결 방법 1: daemon.json에서 기본 주소 풀 변경

```json
// /etc/docker/daemon.json
{
  "bip": "192.168.100.1/24",
  "default-address-pools": [
    {
      "base": "192.168.0.0/16",
      "size": 24
    }
  ]
}
```

```bash
# 설정 적용
sudo systemctl restart docker

# 변경 확인
docker network inspect bridge | grep Subnet
```

`bip`는 `docker0` 인터페이스(기본 브릿지)의 IP/서브넷을 설정한다. `default-address-pools`는 Compose 등으로 새 네트워크를 만들 때 사용할 기본 서브넷 풀을 정의한다. 회사 VPN이 `10.x.x.x`를 쓴다면 `192.168.x.x` 대역으로 바꾸면 된다.

## 해결 방법 2: Compose 파일에 서브넷 직접 지정

```yaml
# docker-compose.yml
services:
  app:
    image: myapp
    networks:
      - app_net

  db:
    image: postgres:16
    networks:
      - app_net

networks:
  app_net:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 10.10.1.0/24
          gateway: 10.10.1.1
```

프로젝트마다 서브넷을 명시하면 자동 할당으로 인한 충돌을 사전에 방지할 수 있다.

![Compose 네트워크 서브넷 지정 방법](/assets/posts/docker-network-conflict-fix.svg)

## 해결 방법 3: 충돌 중인 기존 네트워크 제거

```bash
# 사용하지 않는 네트워크 목록
docker network ls --filter driver=bridge

# 특정 네트워크 제거
docker network rm <네트워크명>

# 사용하지 않는 네트워크 전체 제거
docker network prune -f
```

이미 생성된 충돌 네트워크를 정리하고, 이후 `daemon.json`이나 Compose 설정으로 예방한다.

## VPN과 Docker 공존 팁

```bash
# VPN 연결 후 라우팅 테이블 확인
ip route show | grep "172\|10\|192.168"

# Docker 네트워크 목록과 서브넷 확인
docker network ls -q | xargs docker network inspect \
  --format '{{.Name}}: {{range .IPAM.Config}}{{.Subnet}}{{end}}'
```

VPN을 설치하기 전에 미리 Docker의 기본 서브넷을 `192.168.100.0/24`처럼 VPN과 겹치지 않는 대역으로 설정해 두면 충돌 자체를 예방할 수 있다. 회사 네트워크 담당자에게 VPN이 사용하는 서브넷 대역을 확인하고 그 외 대역을 Docker에 배정한다.

## 자주 쓰이는 비충돌 서브넷 예시

| 용도 | 서브넷 예시 |
|---|---|
| Docker 기본 브릿지 | 192.168.100.0/24 |
| Compose 프로젝트 1 | 10.100.1.0/24 |
| Compose 프로젝트 2 | 10.100.2.0/24 |
| 회사 VPN (확인 필요) | 10.x.x.x 또는 172.x.x.x |

회사마다 VPN 대역이 다르므로 반드시 사용 중인 대역을 확인하고 Docker 서브넷을 겹치지 않게 배정해야 한다.

---

**지난 글:** [Docker Hub 이미지 Pull Rate Limit 해결](/posts/docker-image-pull-rate-limit/)

**다음 글:** [Docker Port Already in Use 에러 해결](/posts/docker-port-already-in-use/)

<br>
읽어주셔서 감사합니다. 😊
