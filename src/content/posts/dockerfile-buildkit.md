---
title: "BuildKit 완전 정복"
description: "Docker BuildKit의 핵심 기능인 병렬 빌드, 캐시 마운트, 시크릿 마운트, SSH 에이전트, 인라인 캐시, Dockerfile 프론트엔드 버전을 실전 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "BuildKit", "빌드최적화", "시크릿", "캐시"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-multi-stage-build/)에서 멀티 스테이지 빌드로 이미지 크기를 줄이는 방법을 살펴봤다. 이번에는 Docker 빌드 엔진을 완전히 바꾼 **BuildKit**의 핵심 기능을 정리한다.

## BuildKit이란

BuildKit은 Docker 18.09에서 도입된 차세대 빌드 백엔드다. Docker 23.0부터 기본값으로 활성화되었다. 기존 빌더 대비 병렬 빌드, 향상된 캐시, 시크릿 마운트 등 다양한 기능을 제공한다.

```bash
# Docker 23 미만 — 명시적 활성화
DOCKER_BUILDKIT=1 docker build .

# docker buildx 사용 (항상 BuildKit)
docker buildx build .

# Docker 23+ — 이미 기본값
docker build .
```

![BuildKit 핵심 기능](/assets/posts/dockerfile-buildkit-features.svg)

## Dockerfile 프론트엔드 버전 지정

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine
```

첫 줄에 `# syntax=`를 추가하면 최신 Dockerfile 문법을 사용할 수 있다. 이 지시어가 있어야 BuildKit 전용 기능(`--mount` 등)이 활성화된다.

- `docker/dockerfile:1` — 안정 버전 (권장)
- `docker/dockerfile:1.7` — 특정 마이너 버전
- `docker/dockerfile:labs` — 실험적 기능 포함

## 캐시 마운트

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
COPY . .
```

`/root/.cache/pip`는 빌드 간 공유되는 영구 캐시 볼륨이다. 이미지 레이어에 포함되지 않으므로 이미지 크기는 그대로다. `COPY . .`가 변경되어도 pip 캐시는 유지된다.

```bash
# 캐시 볼륨 목록 확인
docker buildx du

# 캐시 정리
docker buildx prune
```

## 시크릿 마운트

![BuildKit 시크릿 마운트](/assets/posts/dockerfile-buildkit-secret.svg)

`ARG`나 `ENV`로 토큰을 전달하면 `docker history`로 노출된다. `--mount=type=secret`은 RUN 실행 중에만 파일을 마운트하고, 레이어에 흔적을 남기지 않는다.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npmtoken \
    NPM_TOKEN=$(cat /run/secrets/npmtoken) \
    npm ci
```

```bash
# 파일에서 시크릿 전달
docker build --secret id=npmtoken,src=.npmtoken .

# 환경변수에서 시크릿 전달
docker build --secret id=npmtoken,env=NPM_TOKEN .
```

## SSH 에이전트 마운트

private Git 리포지터리를 클론할 때 SSH 키를 이미지에 남기지 않고 빌드할 수 있다.

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.22
WORKDIR /src
RUN --mount=type=ssh \
    go env -w GOPRIVATE="github.com/mycompany/*" && \
    go mod download
```

```bash
# SSH 에이전트 시작 및 빌드
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
docker build --ssh default .
```

## 바인드 마운트 (type=bind)

```dockerfile
RUN --mount=type=bind,source=.,target=/src,readonly \
    cp -r /src/config ./config
```

빌드 컨텍스트의 파일을 레이어에 복사하지 않고 읽기 전용으로 마운트한다. 설정 파일을 일시적으로 참조할 때 유용하다.

## 인라인 캐시

```bash
# 이미지에 캐시 메타데이터 포함
docker buildx build \
  --cache-to type=inline \
  -t myregistry/myapp:latest \
  --push .

# 다음 빌드에서 레지스트리 캐시 활용
docker buildx build \
  --cache-from myregistry/myapp:latest \
  -t myregistry/myapp:latest \
  --push .
```

CI 환경에서 별도 캐시 스토리지 없이 레지스트리 이미지 자체를 캐시 소스로 쓸 수 있다.

## 빌드 출력 형식

```bash
# 기본: 로컬 Docker 데몬에 로드
docker buildx build -t myapp .

# 레지스트리에 직접 푸시
docker buildx build --push -t myregistry/myapp .

# 로컬 디렉터리로 내보내기
docker buildx build --output type=local,dest=./output .

# OCI tar 파일로 내보내기
docker buildx build --output type=oci,dest=image.tar .
```

## 진행 상황 표시

```bash
# 상세 로그 (각 단계 타이밍 포함)
docker buildx build --progress=plain .

# 압축 뷰 (기본)
docker buildx build --progress=auto .

# 자동 (터미널이면 tty, CI면 plain)
docker buildx build --progress=auto .
```

## 핵심 정리

- BuildKit은 Docker 23+에서 기본값, 이전 버전은 `DOCKER_BUILDKIT=1` 설정
- `# syntax=docker/dockerfile:1` 지시어로 최신 문법 활성화
- `--mount=type=cache`: 레이어 외부 영구 캐시 → 이미지 크기 불변 + 빌드 속도 향상
- `--mount=type=secret`: 빌드 중 민감 정보 사용, 레이어에 흔적 없음
- `--mount=type=ssh`: private repo 접근 시 호스트 SSH 에이전트 전달
- 멀티 스테이지 빌드와 결합하면 최적의 빌드 파이프라인 구성 가능

---

**지난 글:** [멀티 스테이지 빌드 완전 정복](/posts/dockerfile-multi-stage-build/)

**다음 글:** [빌드 ARG 고급 활용](/posts/dockerfile-build-args/)

<br>
읽어주셔서 감사합니다. 😊
