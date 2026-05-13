---
title: "빌드 ARG 고급 활용"
description: "Dockerfile ARG 인스트럭션의 스코프 규칙, ENV와의 차이, 베이스 이미지 버전 매트릭스, CI 메타데이터 내장, 보안 주의사항을 실전 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "ARG", "빌드변수", "ENV", "멀티버전빌드"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-buildkit/)에서 BuildKit의 핵심 기능을 살펴봤다. 이번에는 빌드 시점에 외부에서 값을 주입할 수 있는 `ARG` 인스트럭션을 고급 활용 관점에서 정리한다.

## ARG 기본 문법

```dockerfile
ARG <이름>[=<기본값>]
```

`ARG`로 선언된 변수는 `--build-arg` 플래그로 오버라이드할 수 있다. 기본값이 있으면 플래그를 생략해도 기본값이 사용된다.

```dockerfile
ARG NODE_VERSION=20
ARG APP_PORT=3000

FROM node:${NODE_VERSION}-alpine
EXPOSE ${APP_PORT}
```

```bash
docker build --build-arg NODE_VERSION=22 -t myapp .
```

## 스코프 규칙 — 가장 많이 헷갈리는 부분

![ARG 스코프와 유효 범위](/assets/posts/dockerfile-build-args-scope.svg)

**핵심 규칙**: `FROM` 이전의 `ARG`는 `FROM`에서만 사용 가능하다. `FROM` 이후에는 스코프가 리셋되어, 재선언 없이는 사용할 수 없다.

```dockerfile
# FROM 앞: 베이스 이미지 선택에 사용 가능
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}

# FROM 이후: NODE_VERSION이 비어있음
RUN echo $NODE_VERSION  # "" 출력

# 재선언 필요
ARG NODE_VERSION
RUN echo $NODE_VERSION  # "20" 출력
```

멀티 스테이지 빌드에서도 각 스테이지는 독립적인 ARG 스코프를 가진다. 전역 ARG를 각 스테이지에서 재선언해야 한다.

```dockerfile
ARG BASE_IMAGE=alpine:3.19

FROM ${BASE_IMAGE} AS builder
ARG BASE_IMAGE  # 재선언
RUN echo "Building on ${BASE_IMAGE}"

FROM ${BASE_IMAGE} AS runner
ARG BASE_IMAGE  # 다시 재선언
```

## ARG vs ENV

| 특성 | ARG | ENV |
|---|---|---|
| 빌드 시 사용 | ✓ | ✓ |
| 런타임 유지 | ✗ | ✓ |
| docker inspect 노출 | ✗ (빌드 후) | ✓ (항상) |
| 캐시 영향 | 값 변경 시 이후 레이어 무효화 | 동일 |
| `--build-arg` 오버라이드 | ✓ | ✗ |

ARG를 런타임에도 사용하려면 ENV로 변환한다.

```dockerfile
ARG APP_VERSION=1.0.0
ENV APP_VERSION=${APP_VERSION}

# 이제 컨테이너 실행 시에도 $APP_VERSION 사용 가능
```

## 실전 패턴

![ARG 실전 패턴](/assets/posts/dockerfile-build-args-patterns.svg)

### 버전 매트릭스 빌드

여러 언어 버전으로 같은 Dockerfile을 빌드할 때 유용하다.

```dockerfile
ARG PYTHON_VERSION=3.12
FROM python:${PYTHON_VERSION}-slim
```

```bash
# CI에서 버전별 빌드
for VERSION in 3.11 3.12 3.13; do
  docker build --build-arg PYTHON_VERSION=$VERSION \
    -t myapp:py${VERSION} .
done
```

### CI 메타데이터 내장

```dockerfile
ARG GIT_COMMIT=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_DATE
ARG VERSION=dev

LABEL org.opencontainers.image.revision=$GIT_COMMIT
LABEL org.opencontainers.image.source=$GIT_BRANCH
LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.version=$VERSION
```

```bash
docker build \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg GIT_BRANCH=$(git branch --show-current) \
  --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --build-arg VERSION=$(git describe --tags --always) \
  -t myapp .
```

### 프록시 설정 (사전 정의 ARG)

Docker는 다음 ARG를 자동으로 사전 정의한다:

```bash
HTTP_PROXY, HTTPS_PROXY, FTP_PROXY, NO_PROXY
http_proxy, https_proxy, ftp_proxy, no_proxy
```

```bash
# Dockerfile에 ARG 선언 없이도 사용 가능
docker build --build-arg HTTP_PROXY=http://proxy:3128 .
```

## 캐시 무효화 주의

ARG 값이 변경되면 해당 ARG가 처음 사용되는 레이어부터 캐시가 무효화된다.

```dockerfile
ARG CACHE_BUST=1
RUN apt-get update  # CACHE_BUST 변경 시 이후 모두 재빌드
```

이 패턴을 의도적으로 사용하면 특정 시점부터 캐시를 강제로 무효화할 수 있다.

```bash
docker build --build-arg CACHE_BUST=$(date +%s) -t myapp .
```

## 보안 주의사항

**ARG는 `docker history`에서 노출된다.**

```bash
docker history myapp --no-trunc | grep build-arg
# --build-arg PASSWORD=mysecret 가 보임!
```

토큰, 비밀번호, API 키 등 민감한 값은 절대 `ARG`로 전달하지 않는다. 대신 BuildKit의 `--mount=type=secret`을 사용한다.

```bash
# 위험
docker build --build-arg NPM_TOKEN=xxx .

# 안전
docker build --secret id=npmtoken,env=NPM_TOKEN .
```

## Docker Compose에서 ARG

```yaml
services:
  app:
    build:
      context: .
      args:
        NODE_VERSION: "20"
        GIT_COMMIT: ${GIT_COMMIT:-unknown}
```

`.env` 파일이나 셸 환경변수에서 값을 가져올 수 있다.

## 핵심 정리

- `ARG`는 빌드 시점 변수, `ENV`는 런타임까지 유지
- `FROM` 이전 ARG는 베이스 이미지 선택에만, `FROM` 이후 스코프 리셋 → 재선언 필요
- 멀티 스테이지: 각 스테이지에서 ARG를 개별 재선언
- 민감 정보는 절대 `--build-arg`로 전달 금지 → BuildKit secret 마운트 사용
- `CACHE_BUST` 패턴으로 특정 레이어부터 캐시 강제 무효화 가능

---

**지난 글:** [BuildKit 완전 정복](/posts/dockerfile-buildkit/)

**다음 글:** [buildx 멀티 아키텍처 빌드](/posts/dockerfile-buildx-multi-arch/)

<br>
읽어주셔서 감사합니다. 😊
