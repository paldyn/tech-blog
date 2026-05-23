---
title: "컨테이너 DNS 문제 진단과 수정"
description: "Docker 내장 DNS 서버(127.0.0.11)의 동작 방식을 이해하고, 컨테이너 이름 해석 실패·외부 도메인 조회 지연·ndots 설정 문제를 nslookup·dig·resolv.conf로 진단·수정합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "dns", "network", "resolv.conf", "nslookup", "dig", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/docker-debug-networking/)에서 컨테이너 네트워크 연결 문제를 진단하는 방법을 다뤘다. 네트워크 문제 중 자주 마주치는 특수한 유형이 DNS 해석 실패다. 컨테이너 이름으로 통신하는데 갑자기 `Name or service not known`이 뜨거나, 외부 도메인 조회가 느리다면 DNS 계층을 따로 진단해야 한다.

## Docker 내장 DNS 서버

![컨테이너 DNS 해석 흐름](/assets/posts/docker-debug-dns-flow.svg)

user-defined 네트워크의 모든 컨테이너는 `/etc/resolv.conf`에 `nameserver 127.0.0.11`이 자동으로 설정된다. 이 주소는 Docker 데몬이 내장한 DNS 서버 주소다.

```bash
# resolv.conf 내용 확인
docker exec myapp cat /etc/resolv.conf
# nameserver 127.0.0.11
# options ndots:0
# search mynet.svc.cluster.local default.svc.cluster.local svc.cluster.local cluster.local

# DNS 해석 과정 추적
docker exec myapp nslookup db
# Server:    127.0.0.11
# Address 1: 127.0.0.11
# Name:      db
# Address 1: 172.18.0.3
```

내장 DNS가 컨테이너 이름을 알고 있는 경우 바로 IP를 반환하고, 모르면 호스트의 DNS(또는 설정된 외부 DNS)로 전달한다.

## 증상별 진단

![DNS 문제 진단 및 수정](/assets/posts/docker-debug-dns-fix.svg)

### 증상 1: 컨테이너 이름 해석 실패

```bash
docker exec app curl http://db:5432
# curl: (6) Could not resolve host: db

# 진단 1: 같은 네트워크에 있는지 확인
docker network inspect mynet | grep -A3 '"Containers"'

# 진단 2: 컨테이너가 실행 중인지 확인
docker ps --filter name=db

# 진단 3: 직접 DNS 쿼리
docker exec app nslookup db

# 진단 4: resolv.conf 확인
docker exec app cat /etc/resolv.conf
```

기본 bridge 네트워크는 내장 DNS를 제공하지 않는다. `docker run` 시 `--network` 없이 실행하면 기본 bridge에 연결되며, 이 경우 이름 해석이 작동하지 않는다.

```bash
# user-defined 네트워크로 전환
docker network create mynet
docker run --network mynet --name db postgres:16
docker run --network mynet --name app myimage
# 이제 app에서 db 이름으로 접근 가능
```

### 증상 2: 외부 도메인 해석 느림 / 실패

```bash
# 외부 도메인 해석 시간 측정
docker exec app time nslookup google.com

# dig으로 더 자세한 타이밍 확인
docker exec app dig google.com

# resolv.conf ndots 확인
docker exec app cat /etc/resolv.conf | grep ndots
```

`ndots:5`(쿠버네티스 기본값) 또는 `ndots:1` 이상이면 짧은 이름을 search 도메인으로 먼저 시도한다. `google.com`처럼 dot이 1개인 도메인도 search 도메인을 붙여 먼저 시도하기 때문에 느려진다.

```bash
# ndots를 0으로 줄여 직접 조회
docker run \
  --dns-opt "ndots:0" \
  myapp

# 또는 compose.yml
services:
  app:
    dns_opt:
      - "ndots:0"
```

### 증상 3: 특정 DNS 서버로 강제

```bash
# 커스텀 DNS 서버 지정 (run 시)
docker run \
  --dns 8.8.8.8 \
  --dns 1.1.1.1 \
  myapp

# compose.yml
services:
  app:
    dns:
      - 8.8.8.8
      - 1.1.1.1
```

## /etc/hosts 직접 항목 추가

외부 서비스나 테스트 환경에서 특정 이름을 고정 IP로 매핑해야 할 때 `extra_hosts`를 사용한다.

```yaml
# compose.yml
services:
  app:
    image: myapp
    extra_hosts:
      - "legacy-db:192.168.1.10"
      - "internal-api:10.0.0.5"
```

```bash
# 런타임 확인
docker exec app cat /etc/hosts
# 192.168.1.10  legacy-db
# 10.0.0.5      internal-api
```

## DNS 캐시 확인 및 초기화

Docker 내장 DNS는 자체 캐시를 가진다. 컨테이너를 재생성했는데 이전 IP로 해석된다면 컨테이너 자체를 재시작하거나 TTL을 기다려야 한다.

```bash
# 컨테이너 재시작으로 DNS 캐시 초기화
docker restart app

# 컨테이너 내부 nscd가 있다면
docker exec app nscd -i hosts 2>/dev/null || true

# 네트워크 수준에서 강제 확인
docker exec app getent hosts db
```

## 데몬 전역 DNS 설정

`/etc/docker/daemon.json`에서 모든 컨테이너에 적용할 기본 DNS를 설정할 수 있다.

```json
{
  "dns": ["8.8.8.8", "8.8.4.4"],
  "dns-search": ["example.com"]
}
```

```bash
sudo systemctl restart docker
```

---

**지난 글:** [컨테이너 네트워크 연결 문제 디버깅](/posts/docker-debug-networking/)

**다음 글:** [Kubernetes vs Docker Compose: 무엇을 선택해야 할까?](/posts/k8s-vs-docker-compose/)

<br>
읽어주셔서 감사합니다. 😊
