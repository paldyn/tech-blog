---
title: "RUN 인스트럭션 완전 정복"
description: "Dockerfile RUN 인스트럭션의 shell form과 exec form 차이, 레이어 최소화 전략, apt/apk 캐시 정리, BuildKit의 --mount=type=cache 옵션까지 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "RUN", "레이어", "캐시", "BuildKit", "패키지설치"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-from/)에서 베이스 이미지를 지정하는 `FROM`을 살펴봤다. 이번에는 빌드 시 셸 명령을 실행해 레이어를 만드는 `RUN` 인스트럭션을 파고든다.

## RUN의 역할

`RUN`은 `docker build` 중 명령을 실행하고, 그 결과를 **새 레이어로 커밋**한다. 패키지 설치, 파일 생성, 권한 변경 등 이미지를 준비하는 모든 작업이 여기에 담긴다.

```dockerfile
# 패키지 설치
RUN apt-get update && apt-get install -y curl

# 디렉터리 생성
RUN mkdir -p /app/data

# 퍼미션 설정
RUN chmod 755 /app/entrypoint.sh
```

## Shell Form vs Exec Form

![RUN Shell Form vs Exec Form](/assets/posts/dockerfile-run-forms.svg)

### Shell Form

```dockerfile
RUN apt-get update && apt-get install -y curl
```

`/bin/sh -c "명령"`으로 실행된다. 파이프(`|`), 리다이렉션(`>`), 변수 치환(`$VAR`)이 모두 동작한다. 대부분의 상황에서 더 자연스럽다.

### Exec Form

```dockerfile
RUN ["apt-get", "install", "-y", "curl"]
```

셸을 거치지 않고 `exec()` 시스템 콜로 직접 실행한다. 셸 없는 distroless나 scratch 이미지에서도 동작한다. 단, 환경 변수 치환이 필요하면 직접 셸을 호출해야 한다.

```dockerfile
# exec form에서 파이프 사용 — sh를 명시적으로 래핑
RUN ["/bin/sh", "-c", "echo $HOME | tee /tmp/home.txt"]
```

## 레이어 최적화 전략

### 1. 관련 명령을 하나의 RUN으로 합치기

![RUN 레이어 최적화 Before/After](/assets/posts/dockerfile-run-best-practice.svg)

```dockerfile
# 권장: 업데이트·설치·캐시 삭제를 한 레이어로
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        git && \
    rm -rf /var/lib/apt/lists/*
```

`apt-get update`와 `apt-get install`을 **같은 `RUN`에 묶어야** 한다. 분리하면 `install`이 오래된 캐시를 읽어 패키지를 못 찾는 상황이 발생할 수 있다(캐시 버스팅 문제).

### 2. 패키지 캐시를 같은 레이어에서 삭제

`rm -rf /var/lib/apt/lists/*`를 별도 `RUN`으로 실행하면 이미 커밋된 이전 레이어의 캐시는 사라지지 않는다. **반드시 같은 `RUN` 명령 안에서** 삭제해야 실제 이미지 크기가 줄어든다.

### 3. Alpine 패키지 관리자

```dockerfile
FROM alpine:3.20
RUN apk add --no-cache curl git
```

Alpine의 `apk`는 `--no-cache` 옵션으로 캐시 디렉터리 자체를 생성하지 않는다. 별도 삭제가 필요 없다.

## BuildKit: --mount=type=cache

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci
```

BuildKit의 캐시 마운트를 사용하면 `npm ci`가 내려받은 패키지를 **빌드 간에 영구 캐시**로 저장한다. 레이어에 캐시가 포함되지 않으면서도 재빌드 속도가 빠르다.

## 비밀 주입: --mount=type=secret

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci
```

```bash
# 빌드 시
docker build --secret id=npmrc,src=$HOME/.npmrc .
```

비공개 레지스트리 인증 토큰 같은 민감 정보를 이미지 레이어에 남기지 않고 주입할 수 있다.

## 자주 하는 실수

```dockerfile
# 실수: ARG가 RUN에서 자동으로 환경 변수가 되지 않음
ARG BUILD_ENV=production
RUN echo $BUILD_ENV   # 빈 문자열 출력

# 수정: ENV로 노출하거나 ARG를 shell 변수로 전달
ARG BUILD_ENV=production
ENV BUILD_ENV=$BUILD_ENV
RUN echo $BUILD_ENV   # "production" 출력
```

`ARG`로 선언한 값은 `RUN` 안에서 직접 `$ARG_NAME`으로 참조할 수 있지만, `ENV`로 설정하지 않으면 **런타임 컨테이너에는 전달되지 않는다**.

## 핵심 정리

- `RUN`은 빌드 시에만 실행되고 결과를 레이어로 저장한다
- 관련 명령은 `&&`로 묶어 **레이어 수를 최소화**한다
- 패키지 캐시 삭제는 **같은 `RUN` 안**에서 처리한다
- BuildKit의 `--mount=type=cache`로 레이어 크기 없이 빌드 캐시를 활용한다
- 민감 정보는 `--mount=type=secret`을 사용해 레이어에서 제외한다

---

**지난 글:** [FROM 인스트럭션 완전 정복](/posts/dockerfile-from/)

**다음 글:** [COPY vs ADD: 무엇을 써야 하는가](/posts/dockerfile-copy-vs-add/)

<br>
읽어주셔서 감사합니다. 😊
