---
title: "BuildKit 캐시 마운트: RUN --mount=type=cache 완전 정복"
description: "Docker BuildKit의 RUN --mount=type=cache, secret, bind 옵션으로 빌드 시간을 획기적으로 줄이는 방법을 Python, Node.js, Go, apt 등 언어별 예시로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "buildkit", "cache", "build", "최적화", "빌드속도", "dockerfile", "CI"]
featured: false
draft: false
---

[지난 글](/posts/docker-slim-tools/)에서 빌드 결과 이미지를 최적화하는 도구들을 살펴봤다. 이번에는 **빌드 과정 자체를 빠르게** 하는 방법인 BuildKit 캐시 마운트를 다룬다. 이미지 레이어 캐시와는 다른 개념으로, 패키지 다운로드를 건너뛰어 빌드 시간을 수 배 단축할 수 있다.

## 레이어 캐시 vs 캐시 마운트

기존 Dockerfile의 레이어 캐시는 `RUN` 명령어와 그 이전 레이어들이 변경되지 않으면 재실행하지 않는다. 하지만 `requirements.txt`가 조금이라도 바뀌면 `pip install` 전체를 다시 실행한다. 이미 다운로드된 패키지도 다시 받는다.

`RUN --mount=type=cache`는 다르다. 캐시를 이미지 레이어 외부의 별도 공간에 영구 저장하고, 빌드 간에 공유한다. `requirements.txt`가 바뀌어도 이미 다운로드된 패키지는 다시 받지 않는다.

```bash
# 캐시 마운트 없이 (기존)
$ time docker build .
# pip install: 2분 32초 (매번 PyPI 다운로드)

# 캐시 마운트 적용 후 (두 번째 빌드~)
$ time docker build .
# pip install: 8초 (로컬 캐시 히트)
```

## 사전 준비: BuildKit 활성화

`--mount=type=cache`는 BuildKit이 있어야 작동한다.

```bash
# Docker 23.0 이상에서는 기본 활성화
$ docker buildx version
github.com/docker/buildx v0.14.0

# Dockerfile 첫 줄에 syntax 선언 (권장)
# syntax=docker/dockerfile:1
```

또는 빌드 시 환경변수로 강제 활성화할 수 있다:

```bash
DOCKER_BUILDKIT=1 docker build .
```

## --mount 타입 총정리

![BuildKit RUN --mount 타입](/assets/posts/docker-build-cache-mount-types.svg)

## 언어별 cache 마운트 적용 예시

![언어별 cache 마운트 예시](/assets/posts/docker-build-cache-mount-examples.svg)

### Python (pip)

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
COPY . .
CMD ["python", "app.py"]
```

pip의 캐시 디렉터리는 `/root/.cache/pip` (루트 사용자 기준). 패키지를 처음 다운로드한 이후에는 인터넷 요청 없이 캐시에서 직접 설치한다.

### Node.js (npm/pnpm/yarn)

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
# npm 글로벌 캐시 마운트
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
CMD ["node", "server.js"]
```

pnpm을 쓴다면 `target=/root/.local/share/pnpm/store`가 캐시 경로다.

### Go (go build)

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -o server .

FROM scratch
COPY --from=builder /app/server /server
CMD ["/server"]
```

`/go/pkg/mod`는 모듈 캐시, `/root/.cache/go-build`는 컴파일 캐시다. 두 개를 모두 마운트하면 코드 변경 시에도 변경되지 않은 패키지는 재컴파일하지 않는다.

### Debian/Ubuntu (apt)

```dockerfile
# syntax=docker/dockerfile:1
FROM ubuntu:22.04
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

`sharing=locked`는 병렬 빌드 시 캐시 충돌을 방지한다. apt 캐시는 두 경로를 함께 마운트해야 한다.

## type=secret으로 빌드 비밀값 주입

npm 프라이빗 레지스트리 토큰이나 pip 인증 정보를 이미지 레이어에 노출하지 않고 빌드에 전달할 수 있다.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci
COPY . .
```

빌드 시 시크릿 파일을 지정:

```bash
# .npmrc 파일을 이미지에 남기지 않고 npm ci에서 사용
docker build \
  --secret id=npmrc,src=$HOME/.npmrc \
  .
```

이 방식에서 `.npmrc` 내용은 빌드 중에만 존재하고, `docker history`나 `docker inspect`로 확인해도 이미지 레이어에 남아 있지 않다.

## 캐시 관리

```bash
# BuildKit 캐시 사용량 확인
docker buildx du

# 특정 빌드 캐시 정리
docker buildx prune

# 전체 빌드 캐시 정리
docker buildx prune --all

# 캐시 확인 (상세)
docker system df -v | grep "Build Cache"
```

## CI에서의 캐시 마운트

GitHub Actions에서 BuildKit 캐시는 `--cache-from`/`--cache-to`와 함께 사용할 수 있다.

```yaml
- name: Build
  uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: myapp:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

`type=gha`는 GitHub Actions의 캐시 저장소를 사용해 런너 간에 레이어 캐시를 공유한다.

---

**지난 글:** [Docker Slim과 이미지 최적화 도구 활용법](/posts/docker-slim-tools/)

**다음 글:** [Docker 레이어 캐싱 전략과 실전 팁](/posts/docker-layer-caching-tips/)

<br>
읽어주셔서 감사합니다. 😊
