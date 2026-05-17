---
title: "Docker Compose networks: 멀티 네트워크로 서비스 격리"
description: "compose.yaml의 networks 키로 frontend/backend 네트워크를 분리하는 방법, aliases, internal, external, IPAM 설정을 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "networks", "격리", "internal", "aliases", "IPAM"]
featured: false
draft: false
---

[지난 글](/posts/compose-volumes/)에서 Compose 볼륨 유형을 살펴봤다. 이번에는 `compose.yaml`의 `networks` 키로 서비스 간 통신을 세밀하게 제어하는 방법을 정리한다.

## 기본 동작: 자동 default 네트워크

`networks` 키를 선언하지 않으면 Compose는 `프로젝트명_default` 네트워크를 자동 생성하고 모든 서비스를 연결한다. 서비스 이름이 DNS 이름이 되어 `http://api:3000` 처럼 바로 통신할 수 있다.

```yaml
# networks 선언 없이도 통신 가능
services:
  web:
    image: nginx
  api:
    image: node:20
    # web에서 http://api 로 접근 가능
```

## 멀티 네트워크로 서비스 격리

보안 상 `web`이 직접 `db`에 접근하지 못하도록 두 네트워크로 분리한다.

```yaml
services:
  web:
    image: nginx
    networks:
      - frontend

  api:
    build: ./api
    networks:
      - frontend    # web과 통신
      - backend     # db, cache와 통신

  db:
    image: postgres:16
    networks:
      - backend

  cache:
    image: redis:7
    networks:
      - backend

networks:
  frontend:
  backend:
    internal: true   # 인터넷 접근 차단
```

![멀티 네트워크 구조](/assets/posts/compose-networks-diagram.svg)

이 구성에서 `web`은 `db`에 직접 접근할 수 없다. `api`만 양쪽 네트워크에 속해 게이트웨이 역할을 한다.

## networks 키 옵션

```yaml
networks:
  frontend:
    driver: bridge        # 기본값 (로컬)
    driver_opts:
      com.docker.network.bridge.name: mybridge

  backend:
    internal: true        # 외부 인터넷 차단

  shared:
    external: true        # 기존 네트워크 참조 (Compose가 생성 안 함)

  custom-net:
    ipam:                 # IP 대역 수동 지정
      config:
        - subnet: 172.28.0.0/16
          gateway: 172.28.0.1
```

## aliases: 네트워크별 DNS 별칭

같은 컨테이너를 여러 이름으로 접근해야 할 때 `aliases`를 쓴다.

```yaml
services:
  api:
    networks:
      frontend:
        aliases:
          - app
          - service-api   # frontend 네트워크에서 세 이름 모두 사용 가능
      backend:
        aliases:
          - internal-api  # backend 네트워크에서는 이 이름
```

## ipv4_address: 고정 IP 할당

```yaml
services:
  proxy:
    networks:
      mynet:
        ipv4_address: 172.28.0.10   # 고정 IP

networks:
  mynet:
    ipam:
      config:
        - subnet: 172.28.0.0/24
```

고정 IP는 주로 리버스 프록시나 레거시 연동 시 쓴다. 대부분의 경우 이름 기반 DNS로 충분하다.

## 네트워크 고급 옵션

![네트워크 고급 옵션](/assets/posts/compose-networks-options.svg)

## external: 기존 네트워크 참조

다른 Compose 프로젝트나 수동으로 생성한 네트워크를 공유할 때 쓴다.

```yaml
networks:
  shared-monitoring:
    external: true
    name: monitoring_default   # 실제 네트워크 이름
```

`external: true`인 네트워크가 없으면 `docker compose up` 시 오류가 발생한다. 반드시 미리 생성되어 있어야 한다.

## 실전: 3티어 아키텍처

```yaml
services:
  nginx:
    image: nginx
    ports:
      - "80:80"
    networks:
      - dmz

  app:
    build: .
    networks:
      - dmz
      - app-tier

  db:
    image: postgres:16
    networks:
      - app-tier

networks:
  dmz:
    # 외부 접근 허용
  app-tier:
    internal: true   # DB는 외부 접근 완전 차단
```

인터넷 → nginx(dmz) → app(dmz+app-tier) → db(app-tier) 형태로 트래픽이 흐른다. db는 인터넷에서 직접 접근 불가능하다.

## 정리

- `networks` 키가 없으면 `프로젝트명_default` 네트워크에 전체 서비스가 연결된다.
- 멀티 네트워크로 서비스 간 통신을 세밀하게 제어할 수 있다.
- `internal: true`로 특정 네트워크의 인터넷 접근을 완전 차단한다.
- `aliases`로 네트워크별 DNS 별칭을 부여하고, `ipv4_address`로 고정 IP를 할당한다.
- `external: true`로 기존 네트워크를 참조해 여러 Compose 프로젝트 간 통신할 수 있다.

---

**지난 글:** [Docker Compose volumes](/posts/compose-volumes/)

**다음 글:** [Docker Compose environment: 환경 변수 완전 정복](/posts/compose-environment/)

<br>
읽어주셔서 감사합니다. 😊
