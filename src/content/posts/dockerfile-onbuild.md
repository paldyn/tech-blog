---
title: "ONBUILD 인스트럭션 완전 정복"
description: "Dockerfile ONBUILD 인스트럭션의 동작 원리, 팀 표준 베이스 이미지 구축 패턴, 주의사항, 현대 멀티 스테이지 빌드와의 비교를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "ONBUILD", "베이스이미지", "빌드 자동화"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-healthcheck/)에서 컨테이너 상태를 자동 감지하는 HEALTHCHECK를 살펴봤다. 이번에는 빌드 시점에 동작을 '예약'하는 독특한 인스트럭션 `ONBUILD`를 정리한다.

## ONBUILD란

`ONBUILD`는 **이 이미지를 FROM으로 상속받는 자식 이미지를 빌드할 때** 자동으로 실행될 명령을 예약하는 인스트럭션이다. 현재 빌드에서는 아무 일도 하지 않고, 이미지 메타데이터에 트리거로 저장된다.

```dockerfile
ONBUILD <인스트럭션> [인수...]
```

뒤에 올 수 있는 인스트럭션은 `FROM`과 `MAINTAINER`를 제외한 모든 Dockerfile 인스트럭션이다.

![ONBUILD 트리거 동작 원리](/assets/posts/dockerfile-onbuild-trigger.svg)

## 탄생 배경: 팀 표준 이미지 문제

여러 팀이 같은 기술 스택을 쓸 때, 각 서비스의 Dockerfile이 똑같은 보일러플레이트를 반복하는 문제가 발생한다.

```dockerfile
# 모든 Node.js 서비스가 반복하는 코드
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
CMD ["node", "server.js"]
```

ONBUILD를 쓰면 이 반복을 베이스 이미지 하나로 캡슐화하고, 각 앱은 `FROM` 한 줄만 작성하면 된다.

## 실전 패턴

![ONBUILD 실전 워크플로](/assets/posts/dockerfile-onbuild-workflow.svg)

### 베이스 이미지 정의

```dockerfile
# 팀 공통 Node.js 베이스 이미지
FROM node:20-alpine
WORKDIR /app
ONBUILD COPY package*.json ./
ONBUILD RUN npm ci --omit=dev
ONBUILD COPY . .
CMD ["node", "server.js"]
```

### 자식 이미지

```dockerfile
# 각 서비스 — 이 한 줄이 전부
FROM mycompany/node-base:20
```

`docker build`를 실행하면 이 한 줄이 베이스 이미지의 모든 ONBUILD 트리거를 순서대로 주입·실행한다.

### 언어별 패턴

```dockerfile
# Python 베이스
FROM python:3.12-slim
WORKDIR /app
ONBUILD COPY requirements*.txt ./
ONBUILD RUN pip install --no-cache-dir -r requirements.txt
ONBUILD COPY . .
CMD ["python", "app.py"]
```

```dockerfile
# Go 베이스
FROM golang:1.22-alpine AS builder
WORKDIR /src
ONBUILD COPY go.mod go.sum ./
ONBUILD RUN go mod download
ONBUILD COPY . .
ONBUILD RUN go build -o /app .
```

## 트리거 확인 및 순서

```bash
# 저장된 트리거 목록 확인
docker inspect mycompany/node-base:20 \
  --format '{{json .Config.OnBuild}}' \
  | python3 -m json.tool

# 빌드 로그에서 트리거 실행 확인
# "Step N/M : ONBUILD ..." 형태로 출력됨
docker build --no-cache -t my-service .
```

트리거는 정의된 순서대로 실행된다. 여러 ONBUILD가 있다면 순서가 중요하다 — `COPY package.json`이 `RUN npm install` 전에 와야 한다.

## 주의사항

**단 한 단계만 전달된다**: ONBUILD 트리거는 직계 자식에게만 전달된다. 손자 이미지에는 전달되지 않는다. `ONBUILD ONBUILD`는 허용되지 않는다.

**FROM과 MAINTAINER는 사용 불가**: 재귀적 상속이 발생하거나 의미가 없어서 금지된다.

**컨텍스트 의존성**: 트리거에서 `COPY . .`를 쓰면 자식 빌드의 빌드 컨텍스트를 기준으로 동작한다. 자식 Dockerfile이 있는 디렉터리의 파일을 복사하게 된다.

**투명성 문제**: 자식 Dockerfile만 보면 무슨 일이 일어나는지 알기 어렵다. 팀원이 예상치 못한 동작에 혼란을 겪을 수 있다.

## ONBUILD vs 멀티 스테이지 빌드

현대적인 패턴에서는 ONBUILD보다 멀티 스테이지 빌드를 선호하는 경향이 있다.

| 특성 | ONBUILD | 멀티 스테이지 |
|---|---|---|
| 명시성 | 낮음 (숨겨진 동작) | 높음 (명시적) |
| 복잡도 | 낮음 (FROM 한 줄) | 높음 (명시적 작성) |
| 유연성 | 낮음 (고정 구조) | 높음 (자유로운 구성) |
| 디버깅 | 어려움 | 쉬움 |

ONBUILD는 모든 서비스가 정확히 같은 빌드 구조를 가져야 하는 강한 표준화 환경에서 유용하다. 유연성이 필요하다면 멀티 스테이지 빌드가 낫다.

## 핵심 정리

- `ONBUILD`는 자식 이미지 빌드 시 자동 실행될 트리거를 이미지 메타데이터에 저장
- 현재 빌드에서는 실행되지 않고, `FROM`으로 상속받은 자식 빌드에서만 실행
- 손자에게는 전달되지 않으며, `FROM`과 `MAINTAINER`는 ONBUILD와 함께 쓸 수 없음
- 팀 공통 베이스 이미지 표준화에 유용하나, 투명성이 낮아 복잡한 프로젝트에는 멀티 스테이지가 더 적합

---

**지난 글:** [HEALTHCHECK 인스트럭션 완전 정복](/posts/dockerfile-healthcheck/)

**다음 글:** [Shell 폼 vs Exec 폼 완전 정복](/posts/dockerfile-shell-vs-exec-form/)

<br>
읽어주셔서 감사합니다. 😊
