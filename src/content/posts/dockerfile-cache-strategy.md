---
title: "Dockerfile 레이어 캐시 전략"
description: "Docker 빌드 캐시 동작 원리, 인스트럭션 순서 최적화, BuildKit 캐시 마운트, .dockerignore 활용, CI 환경 캐시 전략을 실전 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "레이어캐시", "BuildKit", "빌드최적화", "CI"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-shell-vs-exec-form/)에서 Shell 폼과 Exec 폼의 차이를 살펴봤다. 이번에는 Docker 빌드 속도와 이미지 크기에 직결되는 **레이어 캐시 전략**을 체계적으로 정리한다.

## 캐시 동작 원리

Docker는 각 인스트럭션의 결과를 레이어로 저장하고, 동일한 조건이라면 재사용(캐시 히트)한다. 캐시 히트 판단 기준은 인스트럭션에 따라 다르다.

- `FROM`: 베이스 이미지 다이제스트
- `RUN`: 명령 문자열
- `COPY`, `ADD`: 파일 내용 해시 (inode·타임스탬프 무관)
- `ENV`, `ARG`, `WORKDIR` 등: 명령 문자열

**결정적 규칙**: 어떤 레이어의 캐시가 무효화되면 그 이후 모든 레이어의 캐시도 자동으로 무효화된다.

![레이어 캐시 무효화 원리](/assets/posts/dockerfile-cache-invalidation.svg)

## 황금률: 변경 빈도 낮은 것을 위로

```dockerfile
# 나쁜 예 — 소스 변경 시 npm ci 매번 재실행
FROM node:20-alpine
WORKDIR /app
COPY . .                     # 소스 변경 → 캐시 무효화
RUN npm ci                   # 항상 재실행

# 좋은 예 — 의존성 변경 시에만 npm ci 재실행
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./        # package.json만 먼저
RUN npm ci                   # 의존성 캐시
COPY . .                     # 소스 코드는 나중에
```

동일한 패턴을 언어별로 적용하면:

```dockerfile
# Python
COPY requirements*.txt ./
RUN pip install -r requirements.txt
COPY . .

# Go
COPY go.mod go.sum ./
RUN go mod download
COPY . .

# Java / Maven
COPY pom.xml ./
RUN mvn dependency:go-offline -q
COPY src ./src
```

## .dockerignore로 캐시 보호

```
# .dockerignore
node_modules/
.git/
.env
*.log
__pycache__/
.pytest_cache/
```

`COPY . .` 시 `node_modules`나 `.git`이 포함되면 빌드마다 캐시가 무효화된다. `.dockerignore`로 빌드 컨텍스트에서 제외해야 한다.

## BuildKit 캐시 마운트

![BuildKit 캐시 마운트 활용](/assets/posts/dockerfile-cache-mount.svg)

BuildKit(`DOCKER_BUILDKIT=1` 또는 Docker 23+ 기본값)은 `RUN --mount=type=cache`로 레이어 바깥에 영구 캐시를 유지할 수 있다. 이 캐시는 이미지에 포함되지 않고, 빌드 간 공유된다.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline
COPY . .
CMD ["node", "server.js"]
```

`COPY . .`가 변경되어도 `npm ci` 캐시는 유지된다. 기존 방법보다 훨씬 강력하다.

## RUN 레이어 최소화

```dockerfile
# 나쁜 예 — 3개의 레이어 생성
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# 좋은 예 — 1개의 레이어
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        vim && \
    rm -rf /var/lib/apt/lists/*
```

`apt-get update`와 `install`을 분리하면 `update` 레이어가 캐시되어 패키지 목록이 오래되는 문제가 생긴다 (Docker 문서에서 `cache busting` 안티패턴으로 명시). 항상 한 `RUN`에 묶는다.

## --no-cache 와 캐시 강제 무효화

```bash
# 캐시 완전 무시하고 빌드
docker build --no-cache -t myapp .

# 특정 시점부터 무효화하기 — ARG 트릭
ARG CACHE_BUST=1
RUN apt-get update  # CACHE_BUST 변경 시 이후 레이어 모두 재빌드

# 빌드 시
docker build --build-arg CACHE_BUST=$(date +%s) -t myapp .
```

## CI 환경에서의 캐시 전략

### GitHub Actions

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

`type=gha`는 GitHub Actions Cache API를 사용한다. 브랜치 간 캐시 공유도 지원한다.

### 레지스트리 캐시

```bash
# 레지스트리에 캐시 저장
docker buildx build \
  --cache-from type=registry,ref=myregistry/myapp:cache \
  --cache-to type=registry,ref=myregistry/myapp:cache,mode=max \
  -t myregistry/myapp:latest .
```

`mode=max`는 모든 레이어를 캐시에 저장한다. 멀티 스테이지 빌드에서 중간 스테이지도 캐시할 수 있다.

## 캐시 분석 도구

```bash
# 빌드 히스토리와 레이어 크기 확인
docker history myapp:latest

# BuildKit 빌드 타이밍 확인
docker buildx build --progress=plain . 2>&1 | grep -E "CACHED|#[0-9]"

# 레이어별 크기 분석
docker image inspect myapp:latest \
  --format '{{range .RootFS.Layers}}{{println .}}{{end}}'
```

## 핵심 정리

- 캐시 무효화는 연쇄적 — 한 레이어가 바뀌면 이후 전부 재빌드
- **의존성 파일만 COPY → 설치 → 소스 COPY** 순서 유지
- `.dockerignore`로 불필요한 파일을 컨텍스트에서 제거
- BuildKit `--mount=type=cache`로 레이어 바깥에 패키지 캐시 영속
- `apt-get update && install`은 항상 한 `RUN`에 묶기
- CI에서는 `type=gha` 또는 레지스트리 캐시로 빌드 속도 향상

---

**지난 글:** [Shell 폼 vs Exec 폼 완전 정복](/posts/dockerfile-shell-vs-exec-form/)

**다음 글:** [멀티 스테이지 빌드 완전 정복](/posts/dockerfile-multi-stage-build/)

<br>
읽어주셔서 감사합니다. 😊
