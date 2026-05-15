---
title: "Dockerfile 안티 패턴 총정리"
description: "Dockerfile 작성 시 흔히 저지르는 안티 패턴과 수정 방법을 이미지 크기, 빌드 속도, 보안, 런타임 신뢰성 관점에서 Before/After 예시로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "안티패턴", "anti-pattern", "최적화", "보안"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-best-practices/)에서 Dockerfile 모범 사례를 정리했다. 이번에는 반대로 **하면 안 되는 안티 패턴**을 구체적인 예시와 수정 방법과 함께 살펴본다. 실수를 알아야 모범 사례가 왜 필요한지 이해된다.

## 안티 패턴 목록

![Dockerfile 주요 안티 패턴](/assets/posts/dockerfile-antipatterns-list.svg)

## 1. `latest` 태그 사용

```dockerfile
# 안티 패턴
FROM node:latest
FROM python:3

# 수정
FROM node:20.11.1-alpine3.19
FROM python:3.12.3-slim-bookworm
```

`latest`는 언제 빌드하느냐에 따라 다른 이미지를 사용한다. 오늘 빌드한 이미지와 3개월 후 빌드한 이미지의 동작이 달라질 수 있다. 패치 버전까지 고정해야 재현 가능한 빌드가 된다.

## 2. 레이어 분산 RUN (cache busting anti-pattern)

```dockerfile
# 안티 패턴 — apt update가 캐시되면 최신 패키지가 설치 안 됨
RUN apt-get update
RUN apt-get install -y curl vim
RUN rm -rf /var/lib/apt/lists/*  # 별도 레이어라 효과 없음

# 수정
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl vim && \
    rm -rf /var/lib/apt/lists/*
```

`apt-get update`가 별도 레이어로 캐시되면, 나중에 `install`을 추가할 때 `update`가 캐시 히트해서 오래된 패키지 목록으로 설치가 실패한다. 항상 한 `RUN`에 묶는다.

## 3. 소스코드를 의존성보다 먼저 COPY

```dockerfile
# 안티 패턴 — 코드 한 줄 변경 시 npm install 재실행
COPY . .
RUN npm install

# 수정 — package.json만 먼저
COPY package*.json ./
RUN npm ci
COPY . .
```

`COPY . .`는 소스 파일이 조금이라도 바뀌면 캐시가 무효화된다. 의존성 설치 레이어를 소스보다 앞에 두면 소스 변경 시 설치를 재사용할 수 있다.

## 4. root 사용자로 실행

```dockerfile
# 안티 패턴 — USER 인스트럭션 없음, root로 실행됨
FROM node:20-alpine
WORKDIR /app
COPY . .
CMD ["node", "server.js"]

# 수정
FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node . .
USER node
CMD ["node", "server.js"]
```

컨테이너 내부 root는 호스트 root와 같은 UID(0)다. 컨테이너 취약점이 악용되면 공격자가 호스트 시스템에 대한 root 권한을 얻을 수 있다.

## 5. ARG로 민감 정보 전달

```dockerfile
# 안티 패턴
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && \
    npm ci && rm .npmrc
```

```bash
docker history myapp --no-trunc
# --build-arg NPM_TOKEN=npm_xxx... 값이 노출됨!
```

```dockerfile
# 수정 — BuildKit secret 마운트
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmtoken \
    NPM_TOKEN=$(cat /run/secrets/npmtoken) \
    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && \
    npm ci && rm .npmrc
```

`RUN`에서 `.npmrc`를 삭제해도 이전 레이어에 남는다. secret 마운트는 레이어에 흔적을 전혀 남기지 않는다.

## 6. Shell 폼 CMD/ENTRYPOINT

```dockerfile
# 안티 패턴
CMD python manage.py runserver
ENTRYPOINT /entrypoint.sh

# 수정
CMD ["python", "manage.py", "runserver"]
ENTRYPOINT ["/entrypoint.sh"]
```

Shell 폼은 `/bin/sh -c`를 통해 실행되므로 PID 1이 sh가 된다. `docker stop`의 SIGTERM이 앱에 전달되지 않아 10초 후 강제 종료된다.

## 7. .dockerignore 없음

`.dockerignore` 없이 `COPY . .`를 실행하면 다음 문제가 발생한다.

- `node_modules`(수백 MB), `.git`(전체 히스토리)이 컨텍스트에 포함
- 빌드 컨텍스트 전송 시간 증가
- `node_modules` 변경 시 `COPY . .` 캐시 무효화

```
# .dockerignore
node_modules/
.git/
.env
*.log
dist/
__pycache__/
.pytest_cache/
coverage/
.DS_Store
```

## 8. ADD를 단순 파일 복사에 사용

```dockerfile
# 안티 패턴
ADD . /app
ADD config.json /app/

# 수정
COPY . /app
COPY config.json /app/
```

`ADD`는 URL에서 파일을 다운로드하거나 tar를 자동 압축 해제하는 기능이 있어 동작을 예측하기 어렵다. 단순 파일 복사는 `COPY`가 명확하다. `ADD`는 tar 압축 해제가 필요한 경우에만 사용한다.

## 9. ENV로 민감 정보 설정

```dockerfile
# 안티 패턴
ENV DB_PASSWORD=mysecretpassword
ENV API_KEY=sk-xxx

# 수정 — 런타임 환경변수로 주입
# docker run -e DB_PASSWORD=secret ...
# 또는 docker secret, k8s secret 사용
```

`ENV`로 설정한 값은 `docker inspect`, `docker history`, 이미지 파일시스템에 평문으로 저장된다. 민감 정보는 런타임에 `-e` 플래그나 오케스트레이터의 시크릿으로 주입한다.

## 10. 불필요한 패키지 설치

```dockerfile
# 안티 패턴
RUN apt-get install -y vim nano curl wget git build-essential

# 수정 — 실제 필요한 것만
RUN apt-get install -y --no-install-recommends curl
```

개발 편의를 위한 `vim`, `nano` 등은 프로덕션 이미지에 필요없다. `--no-install-recommends` 플래그로 추가 권장 패키지 설치를 방지한다.

## Before / After 종합

![Before / After — 안티 패턴 수정](/assets/posts/dockerfile-antipatterns-fix.svg)

## 자동 검사 도구

```bash
# hadolint로 Dockerfile 린팅
docker run --rm -i hadolint/hadolint < Dockerfile

# trivy로 이미지 취약점 스캔
trivy image myapp:latest

# docker scout로 보안 검사 (Docker Desktop)
docker scout cves myapp:latest
```

CI 파이프라인에 `hadolint`를 추가하면 PR 단계에서 안티 패턴을 자동으로 차단할 수 있다.

## 핵심 정리

- `latest` 금지 → 버전 고정
- `RUN apt update` 단독 → update + install + cleanup 한 번에
- `COPY . .` 먼저 → 의존성 파일 먼저, 소스 나중
- root 실행 → USER 비루트 전환
- `ARG`로 토큰 전달 → BuildKit secret 마운트
- Shell 폼 CMD → Exec 폼
- `.dockerignore` 없음 → 반드시 추가
- `ADD` 단순 복사 → `COPY` 사용
- `ENV`로 민감 정보 → 런타임 주입 또는 시크릿

---

**지난 글:** [Dockerfile 모범 사례 총정리](/posts/dockerfile-best-practices/)

<br>
읽어주셔서 감사합니다. 😊
