---
title: "Docker Context — 여러 Docker 환경을 손쉽게 전환하기"
description: "docker context 명령어로 로컬, 원격 SSH, TLS, Rootless 등 여러 Docker 호스트를 관리하고 전환하는 방법, buildx와의 연동, 그리고 실무 활용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["Docker", "context", "원격 Docker", "SSH", "docker context"]
featured: false
draft: false
---

[지난 글](/posts/docker-rootless-mode/)에서 Rootless 모드로 Docker를 더 안전하게 실행하는 방법을 알아봤습니다. 실무에서는 로컬 개발 환경, 스테이징 서버, 프로덕션 서버 등 여러 Docker 환경을 동시에 다루는 경우가 많습니다. 매번 `DOCKER_HOST` 환경 변수를 바꾸거나 SSH 터널을 설정하는 것은 번거롭습니다. `docker context`는 이 문제를 우아하게 해결합니다.

## docker context란

**Context**는 Docker CLI가 연결할 Docker 데몬의 엔드포인트와 관련 설정(TLS 인증서 등)을 이름으로 저장한 것입니다. 한 번 정의해 두면 `docker context use [이름]` 한 줄로 연결 대상을 전환할 수 있습니다.

```bash
# 현재 등록된 context 목록
docker context ls

# NAME              DESCRIPTION                     DOCKER ENDPOINT
# default *         Current DOCKER_HOST based...    unix:///var/run/docker.sock
# desktop-linux     Docker Desktop                  npipe:////...
```

`*` 표시가 현재 활성 context입니다.

![Docker Context 개념도](/assets/posts/docker-context-concept.svg)

## Context 생성

### SSH 기반 원격 Docker

가장 많이 쓰는 패턴입니다. SSH를 통해 원격 서버의 Docker 데몬에 접근합니다. 별도의 TCP 포트 개방 없이 기존 SSH 접속만 있으면 됩니다.

```bash
# SSH context 생성
docker context create dev-server \
  --description "개발 서버" \
  --docker "host=ssh://user@dev.example.com"

# SSH config의 Host alias도 사용 가능
# ~/.ssh/config에 Host dev-server 설정이 있다면:
docker context create dev-server \
  --docker "host=ssh://dev-server"
```

### TLS 기반 원격 Docker

보안이 필요하고 고성능 연결이 필요한 경우 TCP + TLS를 사용합니다.

```bash
docker context create prod \
  --description "프로덕션 서버 (TLS)" \
  --docker "host=tcp://prod.example.com:2376,ca=/path/ca.pem,cert=/path/cert.pem,key=/path/key.pem"
```

### Rootless Docker context

로컬에 rootless Docker가 설치된 경우:

```bash
docker context create rootless \
  --description "Rootless Docker" \
  --docker "host=unix://${XDG_RUNTIME_DIR}/docker.sock"
```

## Context 전환 및 사용

```bash
# 전역 전환 (이후 모든 docker 명령에 적용)
docker context use dev-server

# 특정 명령만 다른 context로 실행 (환경 변수 사용)
DOCKER_CONTEXT=production docker ps
DOCKER_CONTEXT=production docker logs -f webapp

# 기본(로컬)으로 돌아오기
docker context use default
```

![Docker Context 주요 명령어](/assets/posts/docker-context-commands.svg)

## Context 관리 명령어

```bash
# context 상세 정보 확인
docker context inspect dev-server

# context 이름 변경 (불가 — 삭제 후 재생성)
docker context rm dev-server
docker context create dev-server-new ...

# 현재 활성 context 확인
docker context show
# dev-server
```

## 실무 패턴

### 배포 스크립트에서 활용

```bash
#!/bin/bash
# deploy.sh — context를 활용한 배포 스크립트

# 환경에 따라 context 선택
ENV=${1:-staging}

DOCKER_CONTEXT=$ENV \
  docker compose -f docker-compose.yml -f docker-compose.$ENV.yml up -d

echo "Deployed to $ENV"
DOCKER_CONTEXT=$ENV docker ps
```

### buildx와 context 연동

`docker buildx`도 context를 인식합니다. 원격 서버를 빌드 노드로 사용할 수 있습니다.

```bash
# 원격 서버를 buildx 빌더로 등록
docker buildx create \
  --name remote-builder \
  --use \
  --context dev-server

# 빌드 시 원격 서버의 CPU를 활용
docker buildx build --push -t myimage:latest .
```

### 여러 아키텍처 빌드에 응용

```bash
# ARM64 서버와 AMD64 서버를 각각 context로 등록
docker context create arm-builder --docker "host=ssh://user@arm-server"
docker context create amd-builder --docker "host=ssh://user@amd-server"

# 두 context를 빌더 노드로 등록해 multi-arch 빌드
docker buildx create --name multiarch \
  --platform linux/arm64 arm-builder
docker buildx create --append --name multiarch \
  --platform linux/amd64 amd-builder
```

## Context 저장 위치

Context 설정은 `~/.docker/contexts/` 디렉터리에 저장됩니다.

```bash
~/.docker/
├── config.json          # 현재 활성 context 정보 포함
└── contexts/
    ├── meta/            # context 메타데이터 (JSON)
    └── tls/             # TLS 인증서 파일
```

`config.json`에 `"currentContext": "dev-server"`와 같이 활성 context가 기록됩니다.

## DOCKER_HOST vs docker context

| 방법 | 특징 |
|------|------|
| `DOCKER_HOST=...` | 일회성, 환경 변수로 즉시 적용 |
| `docker context use` | 영속적, 이름으로 관리, TLS/SSH 설정 포함 |
| `DOCKER_CONTEXT=...` | 현재 세션만 오버라이드 (context use 무시) |

기존 `DOCKER_HOST` 환경 변수가 설정돼 있으면 `docker context use` 설정보다 우선합니다. 혼용 시 혼란이 생길 수 있으니 하나의 방식으로 통일하는 것을 권장합니다.

## 정리

`docker context`는 여러 Docker 환경을 이름 기반으로 관리하고 단일 CLI로 전환하며 사용하는 강력한 기능입니다. SSH context를 사용하면 추가 포트 개방 없이 원격 Docker에 안전하게 접근할 수 있고, `DOCKER_CONTEXT` 환경 변수로 스크립트에서 유연하게 활용할 수 있습니다. 이것으로 Docker 기초 설치·환경 파트를 마무리하고, 다음 편부터는 컨테이너 실행의 핵심인 `docker run` 명령어부터 본격적으로 다룹니다.

---

**지난 글:** [Docker Rootless 모드 — root 없이 안전하게 실행하기](/posts/docker-rootless-mode/)

<br>
읽어주셔서 감사합니다. 😊
