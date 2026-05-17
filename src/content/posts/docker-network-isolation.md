---
title: "Docker 네트워크 격리: 컨테이너 간 통신 제어"
description: "사용자 정의 네트워크로 컨테이너를 격리하는 방법, --internal 옵션, 멀티 네트워크 컨테이너 패턴을 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "격리", "보안", "internal", "브리지", "컨테이너통신"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-publish-vs-expose/)에서 `-p`와 `EXPOSE`의 차이를 살펴봤다. 이번에는 컨테이너 사이의 통신을 네트워크 단위로 제어하는 **격리** 전략을 다룬다.

## 왜 격리가 필요한가

기본 `bridge` 네트워크에 컨테이너를 모두 연결하면 모든 컨테이너가 서로 IP로 통신할 수 있다. 웹 서버가 DB에 직접 접근할 수 있고, 프론트엔드가 내부 마이크로서비스에 접근할 수도 있다. 보안 사고 발생 시 횡이동(lateral movement) 경로가 열려 있는 셈이다.

사용자 정의 네트워크를 생성하면 **서로 다른 네트워크에 속한 컨테이너는 기본적으로 통신이 차단**된다. iptables의 FORWARD 체인이 다른 브리지 간 패킷을 거부한다.

## 사용자 정의 네트워크 격리

```bash
# 두 개의 독립 네트워크 생성
docker network create network-a
docker network create network-b

# 각 네트워크에 컨테이너 배치
docker run -d --name web --network network-a nginx
docker run -d --name db  --network network-a postgres
docker run -d --name monitor --network network-b grafana/grafana
```

`web`과 `db`는 서로 이름으로 통신할 수 있지만, `monitor`에서 `web`이나 `db`로는 ping도 되지 않는다.

```bash
# network-b의 monitor에서 network-a의 web 접근 시도
docker exec monitor ping web
# ping: bad address 'web'  ← DNS 조회 자체 실패
```

![네트워크 격리 다이어그램](/assets/posts/docker-network-isolation-diagram.svg)

## --internal: 인터넷 접근까지 차단

DB 같은 민감한 서비스는 컨테이너 간 통신은 허용하되 인터넷 접근은 완전히 막고 싶을 때 `--internal` 플래그를 쓴다.

```bash
docker network create --internal db-net

docker run -d --name postgres \
  --network db-net \
  -e POSTGRES_PASSWORD=secret \
  postgres

# db-net 소속 컨테이너에서 인터넷 접근 불가
docker exec postgres curl https://example.com
# curl: (6) Could not resolve host: example.com
```

`--internal` 네트워크는 기본 게이트웨이를 설정하지 않아 외부 라우팅이 발생하지 않는다.

## 멀티 네트워크 컨테이너 (게이트웨이 패턴)

API 서버처럼 프론트엔드 네트워크와 DB 네트워크 모두에 접근해야 하는 컨테이너는 두 네트워크에 동시에 연결한다.

```bash
# api 컨테이너를 frontend-net으로 시작
docker run -d --name api \
  --network frontend-net \
  my-api:latest

# 실행 중인 api를 db-net에도 연결
docker network connect db-net api

# api의 네트워크 상태 확인
docker inspect api --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool
```

이 패턴으로 `api`는 양쪽 네트워크에 모두 속해 `frontend-net`의 `web`과도, `db-net`의 `postgres`와도 통신할 수 있다.

## 격리 설정 커맨드

![격리 커맨드 모음](/assets/posts/docker-network-isolation-commands.svg)

## 네트워크 연결 해제

```bash
# 특정 네트워크에서 컨테이너 제거
docker network disconnect db-net api

# 네트워크에 연결된 컨테이너 목록 확인
docker network inspect db-net --format '{{range .Containers}}{{.Name}} {{end}}'
```

## Docker Compose에서의 격리

Compose는 기본적으로 서비스 전체를 하나의 네트워크에 연결한다. 명시적으로 네트워크를 분리하면 된다.

```yaml
services:
  web:
    networks: [frontend]
  api:
    networks: [frontend, backend]
  db:
    networks: [backend]

networks:
  frontend:
  backend:
    internal: true   # DB 네트워크는 외부 차단
```

이 구성에서 `web`은 `db`에 직접 접근할 수 없고, 반드시 `api`를 거쳐야 한다.

## 정리

- 사용자 정의 네트워크를 분리하면 다른 네트워크 컨테이너는 기본으로 통신 불가다.
- `--internal` 플래그로 인터넷 접근까지 차단할 수 있다.
- 두 네트워크에 동시 연결된 컨테이너가 게이트웨이(라우터) 역할을 한다.
- `docker network connect/disconnect`로 실행 중에도 네트워크 멤버십을 변경할 수 있다.

---

**지난 글:** [Docker -p (publish)와 EXPOSE의 차이: 포트 공개의 진실](/posts/docker-network-publish-vs-expose/)

**다음 글:** [Docker 네트워크 트러블슈팅](/posts/docker-network-troubleshoot/)

<br>
읽어주셔서 감사합니다. 😊
