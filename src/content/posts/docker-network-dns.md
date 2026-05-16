---
title: "Docker 네트워크 DNS: 컨테이너 이름 해석 원리"
description: "Docker 내장 DNS(127.0.0.11)가 컨테이너 이름을 IP로 변환하는 원리와 --network-alias, --dns, --add-host 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "DNS", "127.0.0.11", "alias", "이름해석", "resolv.conf"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-inspect/)에서 네트워크 상태를 분석하는 방법을 다뤘다. 이번에는 Docker 컨테이너 통신에서 이름이 IP로 변환되는 **DNS 원리**를 파헤친다.

## Docker 내장 DNS 서버

사용자 정의 네트워크에서 컨테이너를 실행하면, Docker는 각 컨테이너의 `/etc/resolv.conf`를 자동으로 다음과 같이 설정한다.

```bash
# 컨테이너 내부에서 확인
docker exec myapp cat /etc/resolv.conf
# nameserver 127.0.0.11
# options ndots:0
```

`127.0.0.11`이 Docker의 내장 DNS 서버 주소다. 컨테이너가 도메인을 조회하면 먼저 이 서버에 질의한다.

## DNS 동작 흐름

![Docker 내장 DNS 동작 흐름](/assets/posts/docker-network-dns-flow.svg)

1. `api` 컨테이너에서 `curl http://db:5432` 실행
2. OS가 `/etc/resolv.conf`의 nameserver(127.0.0.11)에 DNS 질의
3. Docker DNS 서버가 같은 네트워크의 컨테이너 DB(`db`) → IP 변환 후 반환
4. `api`가 해당 IP로 연결

등록되지 않은 외부 도메인(예: `google.com`)은 호스트의 `/etc/resolv.conf`에 설정된 외부 DNS로 포워딩된다.

## 기본 bridge에서 동작하지 않는 이유

기본 `bridge` 네트워크(docker0)에서는 내장 DNS가 작동하지 않는다. 컨테이너 이름을 DNS로 찾을 수 없고, `--link` 옵션(deprecated)을 써야만 했다.

```bash
# 기본 bridge에서 — 실패
docker run -d --name db postgres
docker run -d --name api myapp
docker exec api ping db  # ping: bad address 'db'

# 사용자 정의 네트워크에서 — 성공
docker network create my-net
docker run -d --network my-net --name db postgres
docker run -d --network my-net --name api myapp
docker exec api ping db  # 정상 동작
```

## --network-alias: DNS 별칭

```bash
# 두 컨테이너가 같은 DNS 이름을 공유
docker run -d --network my-net \
  --network-alias backend \
  --name app1 myapp

docker run -d --network my-net \
  --network-alias backend \
  --name app2 myapp

# 다른 컨테이너에서 'backend'로 접근하면
# app1 또는 app2 중 하나로 DNSRR 로드밸런싱
```

같은 `--network-alias`를 여러 컨테이너에 지정하면 DNS Round Robin이 적용된다. 단순한 로드밸런싱 효과를 얻을 수 있다.

## 커스텀 DNS 설정

![DNS 별칭과 커스텀 DNS 설정](/assets/posts/docker-network-dns-alias.svg)

```bash
# 커스텀 DNS 서버 지정
docker run \
  --dns 8.8.8.8 \
  --dns 1.1.1.1 \
  --dns-search company.internal \
  myapp

# 컨테이너 /etc/hosts에 직접 항목 추가
docker run \
  --add-host db.internal:192.168.1.50 \
  --add-host cache.internal:192.168.1.51 \
  myapp
```

`--add-host`는 컨테이너의 `/etc/hosts`에 직접 항목을 추가한다. DNS 서버가 없는 환경이나 특정 호스트만 오버라이드할 때 유용하다.

## Compose에서 DNS 설정

```yaml
services:
  api:
    image: myapp
    networks:
      - my-net
    dns:
      - 8.8.8.8
      - 1.1.1.1
    dns_search:
      - company.internal
    extra_hosts:
      - "db.internal:192.168.1.50"

networks:
  my-net:
    driver: bridge
```

## DNS 동작 확인 및 디버깅

```bash
# 컨테이너 내부에서 DNS 해석 확인
docker exec myapp nslookup db
docker exec myapp dig db

# resolv.conf 내용 확인
docker exec myapp cat /etc/resolv.conf

# Docker DNS 서버 포트 확인 (호스트에서)
sudo ss -ulnp | grep :53
# 컨테이너 네트워크 내부에만 127.0.0.11:53 존재

# 컨테이너가 DNS 조회에 실패할 때
docker exec myapp ping 8.8.8.8        # IP 직접 통신 가능?
docker exec myapp nslookup google.com # 외부 DNS 해석 가능?
docker exec myapp nslookup db         # 내부 DNS 해석 가능?
```

## 서비스 디스커버리 패턴

Docker의 내장 DNS는 기본적인 서비스 디스커버리로 사용할 수 있다. 컨테이너가 재시작되어 IP가 바뀌어도 이름으로 항상 찾을 수 있다.

```bash
# 환경변수로 host를 주입하는 대신 DNS 이름 직접 사용
# 코드에서: postgres://db:5432/mydb  (IP 하드코딩 불필요)
docker run -d \
  --network my-net \
  --name db \
  -e POSTGRES_DB=mydb \
  postgres:15

docker run -d \
  --network my-net \
  -e DATABASE_URL="postgres://db:5432/mydb" \
  myapp
```

---

**지난 글:** [docker network inspect: 네트워크 상태 분석](/posts/docker-network-inspect/)

**다음 글:** [Docker 포트 매핑 완전 정복: -p와 --expose](/posts/docker-network-port-mapping/)

<br>
읽어주셔서 감사합니다. 😊
