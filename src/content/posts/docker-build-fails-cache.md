---
title: "Docker 빌드 캐시 실패 트러블슈팅"
description: "docker build가 낡은 캐시, 손상된 캐시, 패키지 캐시 오염으로 실패하는 패턴을 분석하고, --no-cache, CACHEBUST ARG, BuildKit 캐시 마운트로 해결하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "build", "cache", "buildkit", "dockerfile", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-killed-oom/)에서 OOM Kill 문제를 해결했다. 이번에는 `docker build`가 캐시 때문에 실패하거나 기대와 다르게 동작하는 상황을 다룬다. "분명히 코드를 수정했는데 반영이 안 된다", "apt-get install이 갑자기 실패한다" 같은 증상이 이 범주에 해당한다.

## 빌드 캐시 동작 원리

```bash
# 빌드 레이어별 캐시 히트 확인
docker build --progress=plain -t myapp . 2>&1 | grep -E "CACHED|RUN|COPY"

# 출력 예시
# => CACHED [2/5] RUN apt-get update             0.0s
# => [3/5] COPY . .                              0.1s
# => [4/5] RUN npm install                       23.4s
```

Docker는 각 Dockerfile 명령을 레이어로 캐시한다. `COPY`나 `ADD`에서 파일 내용이 바뀌면 그 이후 레이어는 캐시를 무효화한다. `RUN`은 명령어 문자열이 바뀌어야 무효화된다.

![빌드 캐시 문제 유형과 해결](/assets/posts/docker-build-fails-cache-types.svg)

## 유형 1: 낡은 캐시 — 코드 변경이 반영되지 않음

```bash
# 증상: 소스를 수정했는데 예전 결과가 나옴
docker build -t myapp .

# 해결: 캐시 완전 무시
docker build --no-cache -t myapp .
```

대부분의 경우는 Dockerfile 구조 문제다. `COPY . .`을 `RUN npm install` **전에** 하면 소스가 바뀔 때마다 `npm install`도 다시 실행된다. 의존성 파일만 먼저 복사하고 `npm install`을 실행한 뒤 나머지 소스를 복사하면 캐시를 효율적으로 쓸 수 있다.

```dockerfile
# 나쁜 패턴 — 소스 변경 시 npm install 재실행
COPY . .
RUN npm install

# 좋은 패턴 — package.json만 먼저 복사
COPY package.json package-lock.json ./
RUN npm install
COPY . .
```

## 유형 2: 손상된 캐시

디스크 부족이나 빌드 중단으로 캐시가 중간에 깨진 경우다.

```bash
# BuildKit 캐시 전체 확인
docker builder du

# 전체 제거
docker builder prune --all -f

# 특정 날짜 이전 캐시만 제거
docker builder prune --filter "until=72h" -f
```

## 유형 3: 패키지 캐시 오염 — CACHEBUST 패턴

`apt-get update`는 네트워크에서 패키지 목록을 가져오지만 Dockerfile 명령어가 바뀌지 않으면 캐시를 쓴다. 오래된 캐시 레이어에 최신 패키지가 없어서 설치가 실패하기도 한다.

```dockerfile
# CACHEBUST ARG로 특정 레이어부터 강제 재실행
ARG CACHEBUST=1
RUN echo $CACHEBUST \
    && apt-get update \
    && apt-get install -y curl wget \
    && rm -rf /var/lib/apt/lists/*
```

```bash
# CACHEBUST 값을 바꿔서 빌드하면 이 레이어부터 재실행
docker build --build-arg CACHEBUST=$(date +%s) -t myapp .
```

## 유형 4: 상세 로그로 원인 추적

```bash
# 상세 빌드 로그 출력 (어느 단계에서 실패하는지)
DOCKER_BUILDKIT=1 docker build --progress=plain -t myapp . 2>&1 | tee build.log

# 실패 레이어 전후만 필터
grep -A 5 -B 2 "ERROR\|failed" build.log
```

`--progress=plain`은 BuildKit의 압축된 출력 대신 각 단계의 전체 로그를 보여준다. `grep`과 조합하면 실패 원인을 빠르게 찾을 수 있다.

## BuildKit 캐시 마운트로 패키지 다운로드 최적화

![BuildKit 캐시 마운트 전략](/assets/posts/docker-build-fails-cache-strategy.svg)

BuildKit의 `--mount=type=cache`는 빌드 레이어 캐시와 별개로 패키지 캐시를 유지한다. 이미지에 포함되지 않지만 재빌드 시 재사용된다.

```dockerfile
# Node.js npm 캐시 마운트
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --cache /root/.npm

COPY . .
RUN npm run build
```

```dockerfile
# Python pip 캐시 마운트
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

COPY . .
```

```dockerfile
# apt 패키지 캐시 마운트
FROM ubuntu:24.04
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install -y curl build-essential
```

캐시 마운트는 이미지 레이어에 포함되지 않으므로 이미지 크기가 늘어나지 않는다.

## CI/CD에서 캐시 전략

```yaml
# GitHub Actions: 레이어 캐시를 GHA 캐시에 저장
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
    push: true
    tags: myapp:latest
```

```bash
# 로컬에서 레지스트리 캐시 사용
docker build \
  --cache-from type=registry,ref=myregistry.com/myapp:cache \
  --cache-to type=registry,ref=myregistry.com/myapp:cache,mode=max \
  -t myapp:latest .
```

## 빠른 판단 가이드

| 증상 | 원인 | 해결 |
|---|---|---|
| 코드 수정이 반영 안 됨 | 캐시 히트 | `--no-cache` 또는 COPY 순서 조정 |
| apt install 실패 | 낡은 패키지 목록 캐시 | CACHEBUST ARG |
| 빌드 중간에 에러 | 손상된 캐시 | `docker builder prune` |
| 빌드가 느림 | 패키지 매번 다운로드 | BuildKit 캐시 마운트 |

---

**지난 글:** [Docker OOM Kill 해결 — 컨테이너 메모리 부족](/posts/docker-killed-oom/)

**다음 글:** [Docker 컨테이너 시간대(Timezone) 불일치 해결](/posts/docker-time-zone-mismatch/)

<br>
읽어주셔서 감사합니다. 😊
