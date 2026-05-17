---
title: "Docker Compose 개요: 멀티 컨테이너 앱 관리"
description: "Docker Compose가 무엇인지, 단일 compose.yaml로 전체 스택을 어떻게 정의하고 관리하는지 개념과 핵심 명령어를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "멀티컨테이너", "스택", "개요", "docker-compose"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-troubleshoot/)에서 네트워크 트러블슈팅 방법을 살펴봤다. 이번부터는 멀티 컨테이너 애플리케이션을 단일 파일로 정의하고 관리하는 **Docker Compose** 시리즈를 시작한다.

## Docker Compose란

웹 서버, API 서버, DB, 캐시를 각각 `docker run` 명령으로 실행하면 네트워크 연결, 볼륨 마운트, 환경 변수, 실행 순서 등을 모두 손으로 관리해야 한다. 명령이 길어지고 실수가 잦아지며 팀원과 환경을 맞추기 어렵다.

Docker Compose는 이 모든 구성을 **`compose.yaml` 하나에 선언**하고, `docker compose up` 한 줄로 전체 스택을 시작한다. 네트워크와 볼륨은 자동 생성되고, 컨테이너 이름으로 DNS가 바로 동작한다.

```yaml
# compose.yaml 최소 예시
services:
  web:
    image: nginx:1.25
    ports:
      - "80:80"
  api:
    build: ./api
    depends_on:
      - db
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

이 파일 하나로 세 개의 컨테이너, 공유 네트워크, 영속 볼륨이 모두 준비된다.

## 아키텍처

![Compose 아키텍처](/assets/posts/compose-overview-diagram.svg)

Compose는 `compose.yaml`을 읽어 Docker Engine API에 요청을 보낸다. 각 서비스는 컨테이너가 되고, 프로젝트 이름(`COMPOSE_PROJECT_NAME` 또는 디렉터리 이름)이 접두사로 붙는다.

- **프로젝트 이름**: `myapp`이면 컨테이너는 `myapp-web-1`, `myapp-api-1` 등
- **기본 네트워크**: `myapp_default`가 자동 생성, 모든 서비스가 연결됨
- **볼륨**: `myapp_pgdata` 형태로 네임스페이스 분리

## 핵심 명령어

![Compose 명령어](/assets/posts/compose-overview-commands.svg)

```bash
# 모든 서비스 백그라운드 시작
docker compose up -d

# 이미지를 강제 재빌드하고 시작
docker compose up --build -d

# 전체 서비스 중지 및 컨테이너·네트워크 제거
docker compose down

# 볼륨까지 함께 제거 (데이터 삭제 주의)
docker compose down -v

# 서비스 상태 확인
docker compose ps

# 특정 서비스 로그 팔로우
docker compose logs -f api

# 실행 중인 서비스에 명령 실행
docker compose exec db psql -U postgres
```

## v1 vs v2 차이

Compose v1은 `docker-compose` (하이픈)이었고 Python으로 작성된 별도 바이너리였다. 2023년 지원이 종료되었다.

v2는 `docker compose` (공백, 하이픈 없음)로 Docker CLI 플러그인으로 통합되었다. 현재 표준이며 `compose.yaml`(기존 `docker-compose.yaml`도 인식)이 권장 파일명이다.

```bash
# v2 확인
docker compose version
# Docker Compose version v2.x.x
```

## 언제 Compose를 쓰는가

| 상황 | Compose 적합 여부 |
|------|-----------------|
| 개발 환경 (DB + 앱) | 매우 적합 |
| CI 테스트 환경 | 적합 |
| 단일 서버 프로덕션 | 적합 (소규모) |
| 멀티 노드 클러스터 | Kubernetes 사용 권장 |

## 정리

- Docker Compose는 `compose.yaml` 단일 파일로 멀티 컨테이너 스택을 선언·관리한다.
- 네트워크와 볼륨이 자동 생성되어 컨테이너 이름 기반 통신이 즉시 가능하다.
- `docker compose up/down/ps/logs/exec`가 핵심 명령어다.
- v2(`docker compose`)가 현재 표준이며 v1(`docker-compose`)은 2023년 EOL이다.

---

**지난 글:** [Docker 네트워크 트러블슈팅](/posts/docker-network-troubleshoot/)

**다음 글:** [Docker Compose YAML 기초 문법](/posts/compose-yaml-basics/)

<br>
읽어주셔서 감사합니다. 😊
