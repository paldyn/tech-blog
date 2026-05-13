---
title: "Dockerfile 모범 사례 총정리"
description: "Dockerfile 작성 시 반드시 지켜야 할 모범 사례를 베이스 이미지, 레이어 최적화, 캐시, 보안, 런타임 신뢰성 영역으로 분류해 실전 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "모범사례", "베스트프랙티스", "보안", "최적화"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-buildx-multi-arch/)에서 멀티 아키텍처 빌드를 살펴봤다. 이번에는 지금까지 배운 내용을 집대성해서 **Dockerfile 모범 사례**를 한 자리에 정리한다.

## 베이스 이미지

**버전 태그를 고정한다**: `FROM node:20`은 언제 빌드하느냐에 따라 다른 이미지를 사용한다. `FROM node:20.11.1-alpine3.19`처럼 패치 버전까지 고정해야 재현성을 보장한다.

```dockerfile
# 나쁜 예
FROM node:latest
FROM python:3

# 좋은 예
FROM node:20.11.1-alpine3.19
FROM python:3.12.3-slim-bookworm
```

**최소 이미지를 선택한다**: `slim`, `alpine`, `distroless` 순으로 경량화 정도가 높아진다. 작은 이미지는 공격 표면이 줄고 풀/배포가 빠르다.

```bash
# 크기 비교 (node 기준)
node:20           → ~1.1 GB
node:20-slim      → ~230 MB
node:20-alpine    → ~140 MB
```

![Dockerfile 모범 사례 체크리스트](/assets/posts/dockerfile-best-practices-checklist.svg)

## 레이어 최적화

**RUN을 연결해 레이어를 최소화한다**: 특히 패키지 설치 시 update, install, cleanup을 한 `RUN`에 묶어야 이미지 크기가 줄어든다.

```dockerfile
# 나쁜 예 — 3레이어, cleanup 효과 없음
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# 좋은 예 — 1레이어
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl vim && \
    rm -rf /var/lib/apt/lists/*
```

**멀티 스테이지 빌드로 빌드 도구를 분리한다**: 컴파일러, 빌드 도구, 테스트 의존성은 최종 이미지에 포함되어서는 안 된다.

## 캐시 최적화

**변경 빈도 낮은 레이어를 위에 배치한다**: 소스 코드보다 의존성 파일이 훨씬 덜 바뀐다. 의존성을 먼저 설치하면 소스 변경 시에도 설치 레이어를 재사용할 수 있다.

```dockerfile
# 의존성 먼저, 소스 나중
COPY package*.json ./
RUN npm ci
COPY . .
```

**.dockerignore로 빌드 컨텍스트를 최소화한다**: `node_modules`, `.git`, `*.log` 등을 제외하면 컨텍스트 전송 시간과 `COPY . .` 캐시 무효화 위험을 줄인다.

## 보안

**비루트 사용자로 실행한다**: 프로덕션 컨테이너는 절대 root로 실행해서는 안 된다.

```dockerfile
RUN addgroup -S appgroup && adduser -S -G appgroup appuser
COPY --chown=appuser:appgroup . .
USER appuser
```

**민감 정보를 이미지에 담지 않는다**: `ARG`, `ENV`, `COPY .env` 모두 `docker history`나 이미지 메타데이터에 남는다. BuildKit secret 마운트를 사용한다.

```bash
# 위험
RUN --build-arg API_KEY=xxx npm ci

# 안전
RUN --mount=type=secret,id=apikey ...
```

## 종합 예시

![모범 사례 종합 예시 — Node.js](/assets/posts/dockerfile-best-practices-example.svg)

## CMD와 ENTRYPOINT

**항상 Exec 폼을 사용한다**: Shell 폼은 `docker stop`의 SIGTERM을 앱에 전달하지 못해 graceful shutdown이 불가능하다.

```dockerfile
# 나쁜 예
CMD node server.js

# 좋은 예
CMD ["node", "server.js"]
```

## WORKDIR

**절대 경로를 사용한다**: `WORKDIR /app`처럼 명시적으로 지정하고, `RUN cd /app` 방식을 쓰지 않는다. WORKDIR는 없으면 자동 생성한다.

## LABEL로 메타데이터 기록

```dockerfile
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.revision="abc123"
LABEL org.opencontainers.image.created="2026-05-14T00:00:00Z"
LABEL maintainer="team@example.com"
```

OCI 표준 레이블을 사용하면 레지스트리와 도구들이 자동으로 활용한다.

## EXPOSE는 문서화 목적

`EXPOSE`는 실제로 포트를 열지 않는다. `-p` 없이는 외부에서 접근할 수 없다. 그럼에도 Dockerfile에 명시하면 다른 개발자에게 의도를 전달하고, `docker run -P`의 자동 매핑에 사용된다.

## 린터 활용

```bash
# hadolint — Dockerfile 린터
docker run --rm -i hadolint/hadolint < Dockerfile

# dive — 레이어 분석
dive myapp:latest
```

`hadolint`는 공식 Docker best practice 위반을 자동 감지한다. CI 파이프라인에 추가하면 팀 전체에 모범 사례를 강제할 수 있다.

## 핵심 정리

- 베이스 이미지: 버전 고정 + 최소 이미지
- 레이어: RUN 연결, 멀티 스테이지로 빌드 도구 분리
- 캐시: 의존성 먼저 COPY, .dockerignore, BuildKit 캐시 마운트
- 보안: 비루트 USER, secret 마운트, 취약점 스캔
- 런타임: CMD/ENTRYPOINT Exec 폼, HEALTHCHECK, WORKDIR 절대 경로
- 도구: hadolint, dive로 품질 검증

---

**지난 글:** [buildx 멀티 아키텍처 빌드 완전 정복](/posts/dockerfile-buildx-multi-arch/)

**다음 글:** [Dockerfile 안티 패턴 총정리](/posts/dockerfile-anti-patterns/)

<br>
읽어주셔서 감사합니다. 😊
