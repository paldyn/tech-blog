---
title: "Docker 레이어 캐싱 전략과 실전 팁"
description: "Docker 레이어 캐시 동작 원리, COPY 순서 최적화, .dockerignore, BuildKit 캐시 전략, GitHub Actions·레지스트리 캐시까지 빌드 속도를 최대한 높이는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "cache", "layer", "buildkit", "dockerfile", "CI", "최적화", "빌드속도"]
featured: false
draft: false
---

[지난 글](/posts/docker-build-cache-mount/)에서 BuildKit의 `--mount=type=cache`로 패키지 다운로드를 캐싱하는 방법을 다뤘다. 이번에는 Docker 레이어 캐시 전반을 체계적으로 정리한다. 레이어 순서 설계부터 CI 환경에서 캐시를 공유하는 방법까지 커버한다.

## 레이어 캐시 동작 원리

Docker는 이미지를 빌드할 때 각 `RUN`, `COPY`, `ADD` 명령마다 레이어를 생성한다. 이전 빌드에서 동일한 명령과 동일한 파일이 있으면 캐시 히트가 발생해 그 레이어를 재사용한다. 한 레이어의 캐시가 깨지면 이후의 모든 레이어 캐시도 깨진다.

```bash
# 캐시 히트 확인
$ docker build .
Step 3/7 : COPY package*.json ./
 ---> Using cache  ← 캐시 히트
Step 4/7 : RUN npm ci
 ---> Using cache  ← 캐시 히트
Step 5/7 : COPY . .
 ---> abc123       ← 캐시 미스 (소스 변경됨)
Step 6/7 : RUN npm run build
 ---> 새로 실행    ← 앞 레이어 깨지면 여기도 새로 실행
```

이 원리를 이해하면 레이어 순서를 최적화하는 방법이 자명해진다.

## 핵심 원칙: 변경 빈도 낮은 것을 먼저

![레이어 순서 최적화](/assets/posts/docker-layer-caching-tips-order.svg)

자주 변하는 파일일수록 Dockerfile 아래에 배치한다. 소스 코드(`COPY . .`)는 항상 마지막 근처에 와야 하고, 의존성 설치(`npm ci`, `pip install`)는 의존성 명세 파일만 먼저 복사한 뒤 실행한다.

```dockerfile
# 나쁜 예: 소스 먼저 복사
FROM node:20-slim
WORKDIR /app
COPY . .          # 소스 변경 시 여기서 캐시 깨짐
RUN npm ci        # 매번 재실행
RUN npm run build

# 좋은 예: 의존성 명세만 먼저
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./  # 자주 안 바뀜
RUN npm ci                              # 위가 안 바뀌면 캐시 유지
COPY . .                                # 소스는 여기
RUN npm run build
```

## .dockerignore로 불필요한 캐시 무효화 방지

`.dockerignore`가 없으면 `COPY . .` 시 `node_modules`, `.git`, `*.log` 등 빌드에 불필요한 파일도 컨텍스트에 포함된다. 이 파일들이 바뀌면 캐시가 불필요하게 깨진다.

```gitignore
# .dockerignore
node_modules
.git
*.log
.DS_Store
dist
.env
.env.*
coverage
.nyc_output
```

```bash
# 빌드 컨텍스트 크기 확인
docker build --no-cache -t test . 2>&1 | grep "Sending build context"
# Sending build context to Docker daemon  2.048kB  ← .dockerignore 적용 후
# Sending build context to Docker daemon  145.2MB  ← 미적용 시
```

## ARG 위치 주의

`ARG`는 선언 위치부터 캐시를 무효화한다. 자주 바뀌는 `ARG`(버전, 날짜 등)를 상단에 두면 모든 레이어 캐시가 깨진다.

```dockerfile
# 나쁜 예: ARG가 상단
ARG GIT_COMMIT=unknown    # 매 빌드마다 달라짐
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci                # GIT_COMMIT이 바뀌면 여기 캐시도 깨짐

# 좋은 예: ARG를 실제 사용 직전으로 내림
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci                # ARG 영향 없음, 캐시 유지
COPY . .
ARG GIT_COMMIT=unknown    # 여기서 선언
ENV GIT_COMMIT=${GIT_COMMIT}
```

## 멀티 스테이지 빌드에서 캐시 활용

멀티 스테이지 빌드는 스테이지별로 독립적인 캐시를 가진다. builder 스테이지의 캐시는 런타임 스테이지 변경에 영향 받지 않는다.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 런타임 스테이지가 바뀌어도 deps, builder 캐시는 유지
FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/server.js"]
```

## CI 환경 캐시 전략

![CI 환경별 레이어 캐시 전략](/assets/posts/docker-layer-caching-tips-ci.svg)

### GitHub Actions: type=gha

```yaml
name: Build
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

`mode=max`는 모든 레이어를 캐시에 저장해 최대 히트율을 보장하지만 저장 공간을 더 사용한다. `mode=min`은 최종 이미지 레이어만 저장한다.

### 레지스트리 캐시

```bash
# 레지스트리에 캐시 저장
docker buildx build \
  --cache-from type=registry,ref=ghcr.io/myorg/myapp:cache \
  --cache-to type=registry,ref=ghcr.io/myorg/myapp:cache,mode=max \
  --push --tag ghcr.io/myorg/myapp:latest .
```

## 캐시 디버깅

```bash
# 캐시 히트/미스 상세 로그
BUILDKIT_PROGRESS=plain docker build .

# 캐시 없이 빌드 (전체 시간 측정)
time docker build --no-cache .

# 캐시 있는 빌드 시간 (최적화 후)
time docker build .

# 빌드 캐시 사용량 확인
docker buildx du --verbose

# 빌드 캐시 정리
docker buildx prune --filter type=exec.cachemount
```

## 주의: 캐시 무효화가 필요한 경우

레이어 캐시는 파일 내용 변화만 감지한다. 외부 API 응답이나 시간에 의존하는 `RUN` 명령은 파일이 바뀌지 않아도 결과가 달라질 수 있다.

```dockerfile
# 이 레이어는 apt 저장소가 바뀌어도 캐시 히트됨 (위험할 수 있음)
RUN apt-get update && apt-get install -y curl

# 강제 무효화: ARG로 날짜 주입
ARG CACHE_DATE=2026-01-01
RUN apt-get update && apt-get install -y curl
```

보안 업데이트를 반드시 포함해야 하는 경우 주기적으로 `--no-cache`로 빌드하거나 `CACHE_DATE` ARG를 업데이트한다.

---

**지난 글:** [BuildKit 캐시 마운트: RUN --mount=type=cache 완전 정복](/posts/docker-build-cache-mount/)

**다음 글:** [Docker 이미지에서 시크릿 유출 방지하기](/posts/docker-secret-leak-prevention/)

<br>
읽어주셔서 감사합니다. 😊
