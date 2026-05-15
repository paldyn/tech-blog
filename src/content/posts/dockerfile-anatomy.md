---
title: "Dockerfile 해부학 — 구조와 기본 문법"
description: "Dockerfile의 전체 구조, 각 인스트럭션의 역할과 실행 순서, 주석·멀티라인·대소문자 규칙, 빌드 컨텍스트와의 관계를 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "빌드", "이미지", "레이어", "빌드컨텍스트"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-base-choice/)에서 FROM에 넣을 베이스 이미지를 어떻게 고르는지 살펴봤다. 이제 그 위에 실제 애플리케이션을 얹는 설계도, Dockerfile을 해부할 차례다.

## Dockerfile이란

Dockerfile은 이미지를 만들기 위한 **순서가 있는 명령 목록**이다. `docker build` 명령이 이 파일을 위에서 아래로 읽으면서 각 인스트럭션을 실행하고, 실행 결과를 **레이어**로 쌓아 최종 이미지를 조립한다. 레이어는 Union 파일시스템(OverlayFS)으로 겹쳐지므로 변경된 레이어만 재빌드된다.

![Dockerfile 전체 구조](/assets/posts/dockerfile-anatomy-structure.svg)

## 기본 문법 규칙

### 인스트럭션과 대소문자

```dockerfile
# 올바른 예 (대문자 — 관례)
FROM node:20-alpine
RUN npm install

# 동작하지만 비권장 (소문자)
from node:20-alpine
run npm install
```

Docker는 인스트럭션 키워드의 대소문자를 가리지 않지만, **관례상 대문자**를 사용한다. 인스트럭션과 인수를 시각적으로 구분하기 쉬워지기 때문이다.

### 주석

```dockerfile
# 이 줄은 주석이다 — 빌드 시 무시됨
FROM ubuntu:24.04  # 인라인 주석은 지원되지 않음 (그냥 인수로 읽힘)
```

`#`으로 시작하는 줄은 주석이다. 단, **줄 중간의 `#`** 은 주석이 아니라 인수의 일부로 처리된다.

### 멀티라인: 백슬래시 이스케이프

```dockerfile
RUN apt-get update && \
    apt-get install -y \
        curl \
        git && \
    rm -rf /var/lib/apt/lists/*
```

백슬래시(`\`)로 줄을 이으면 하나의 인스트럭션으로 처리된다. `RUN` 명령을 여러 줄로 나누면 가독성과 유지보수성이 높아진다.

### 파서 지시자 (parser directive)

```dockerfile
# syntax=docker/dockerfile:1
# escape=`
FROM microsoft/nanoserver
COPY testfile.txt c:\
```

`# key=value` 형식의 주석처럼 생긴 지시자로, Dockerfile의 **첫 줄**에만 위치할 수 있다. `syntax`는 BuildKit 프론트엔드를 지정하고, `escape`는 줄 이음 문자를 변경한다(Windows 경로와 충돌 방지).

## 인스트럭션 실행 순서와 레이어

![빌드 컨텍스트와 이미지 생성](/assets/posts/dockerfile-anatomy-build-context.svg)

`docker build .`를 실행하면 세 단계가 벌어진다.

1. **빌드 컨텍스트 전송**: 현재 디렉터리(`.`) 또는 지정 경로의 파일이 Docker 데몬으로 전송된다. `.dockerignore`에 명시된 파일은 제외된다.
2. **인스트럭션 순서대로 실행**: `FROM` → `ARG` → `ENV` → `WORKDIR` → `COPY` → `RUN` … 순으로 처리. 각 레이어를 캐시와 비교해 변경이 없으면 재사용한다.
3. **최종 이미지 조립**: 모든 레이어를 Union FS로 합쳐 단일 이미지로 저장한다.

### 캐시 무효화 전파

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./   # ← 이 파일이 바뀌면
RUN npm ci              # ← 여기부터 아래 모든 레이어가 재실행됨
COPY . .
CMD ["node", "server.js"]
```

**한 레이어가 바뀌면 그 아래 레이어가 모두 무효화된다.** 변경 빈도가 낮은 파일(패키지 설치)을 위로, 자주 바뀌는 파일(소스 코드)을 아래로 배치하는 이유다.

## 빌드 컨텍스트 크기 관리

```text
# .dockerignore 예시
node_modules/
.git/
*.log
.env
dist/
coverage/
```

빌드 컨텍스트가 크면 전송 시간이 늘어나고 빌드가 느려진다. `.dockerignore` 파일로 불필요한 항목을 제외해야 한다. `node_modules`처럼 수백 MB인 디렉터리가 통째로 데몬에 전송되면 빌드 초반부터 지연이 발생한다.

## 기본 골격 예시

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

ARG APP_PORT=3000
ENV NODE_ENV=production \
    PORT=$APP_PORT

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE $APP_PORT

USER node

CMD ["node", "server.js"]
```

이 골격에는 자주 쓰이는 인스트럭션이 대부분 등장한다. `FROM`, `ARG`, `ENV`, `WORKDIR`, `COPY`, `RUN`, `EXPOSE`, `USER`, `CMD`가 각각 어떤 규칙과 제약을 가지는지는 이후 글에서 하나씩 깊이 파고든다.

## 핵심 정리

- Dockerfile은 **위에서 아래로** 순서대로 실행된다
- 인스트럭션은 관례상 **대문자**로 작성한다
- 줄 이음은 `\`, 주석은 `#`, 파서 지시자는 반드시 첫 줄
- 레이어 캐시는 **변경된 인스트럭션부터 아래 전체 무효화** — 순서가 성능에 직접 영향
- `.dockerignore`로 빌드 컨텍스트 크기를 최소화한다

---

**다음 글:** [FROM 인스트럭션 완전 정복](/posts/dockerfile-from/)

<br>
읽어주셔서 감사합니다. 😊
