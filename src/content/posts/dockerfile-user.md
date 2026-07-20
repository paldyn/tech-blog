---
title: "USER 인스트럭션 완전 정복"
description: "Dockerfile USER 인스트럭션으로 컨테이너를 비루트로 실행하는 방법, 사용자 생성 패턴, UID/GID 지정, 멀티 스테이지 빌드에서의 활용, 파일 소유권 문제 해결을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "USER", "보안", "비루트", "권한", "UID"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-volume/)에서 데이터 영속성을 위한 VOLUME 인스트럭션을 살펴봤다. 이번에는 컨테이너 보안의 핵심 인스트럭션인 `USER`를 정리한다.

## 왜 비루트 사용자인가

Docker 컨테이너는 기본적으로 **root(UID 0)** 로 실행된다. 이 상태에서 컨테이너 취약점이 익스플로잇되어 탈출하면 공격자가 호스트의 root 권한을 얻는다. 비루트 사용자로 실행하면 피해 범위를 대폭 줄일 수 있다.

![USER 인스트럭션 — 루트 탈피의 보안 효과](/assets/posts/dockerfile-user-security.svg)

## USER 문법

```dockerfile
USER <사용자명>[:<그룹명>]
USER <UID>[:<GID>]
```

`USER` 이후의 모든 `RUN`, `CMD`, `ENTRYPOINT`는 지정한 사용자 권한으로 실행된다.

```dockerfile
USER node          # 사용자명만
USER node:node     # 사용자:그룹
USER 1001          # UID만
USER 1001:1001     # UID:GID
```

## 실전 패턴

![USER 인스트럭션 실전 패턴](/assets/posts/dockerfile-user-pattern.svg)

### 패턴 1: Alpine에서 사용자 직접 생성

```dockerfile
FROM node:20-alpine
RUN addgroup -S appgroup && \
    adduser -S -G appgroup appuser

WORKDIR /app
COPY --chown=appuser:appgroup . .
RUN npm ci

USER appuser
CMD ["node", "server.js"]
```

- `-S`: 시스템 사용자 (로그인 쉘 없음, `/bin/false`)
- `-G appgroup`: 주 그룹 지정
- `COPY --chown`으로 파일 소유권을 미리 설정한다

### 패턴 2: Debian/Ubuntu에서 사용자 생성

```dockerfile
FROM python:3.12-slim
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid 1001 \
            --no-create-home \
            --shell /bin/false appuser

WORKDIR /app
COPY --chown=1001:1001 . .
RUN pip install --no-cache-dir -r requirements.txt

USER appuser
CMD ["python", "app.py"]
```

### 패턴 3: 이미 내장된 사용자 활용

```dockerfile
# node:* 이미지에는 기본으로 node 사용자(UID 1000)가 있음
FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node . .
RUN npm ci

USER node
CMD ["node", "server.js"]
```

공식 이미지 대부분은 비루트 사용자를 미리 만들어 둔다. `node`, `nginx`, `postgres`, `redis` 이미지 등이 대표적이다.

### 패턴 4: UID 직접 지정 (Kubernetes 친화적)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY . .

# 이미지에 사용자가 없어도 UID로 지정 가능
# Kubernetes SecurityContext의 runAsUser와 일치시킬 때 유용
USER 1001:1001
```

Kubernetes `SecurityContext.runAsUser`와 맞출 때 UID 숫자를 직접 쓰는 방법이 간편하다.

## 멀티 스테이지에서의 USER

```dockerfile
# 빌드 스테이지 — root 권한 필요 (패키지 설치 등)
FROM golang:1.22 AS builder
WORKDIR /src
COPY . .
RUN go build -o app .

# 실행 스테이지 — 비루트로 전환
FROM gcr.io/distroless/base
COPY --from=builder /src/app /app
USER 65534:65534   # nobody:nogroup
CMD ["/app"]
```

멀티 스테이지 빌드에서 각 스테이지는 독립적인 USER 컨텍스트를 가진다. 빌드 스테이지는 root 그대로 두고, **최종 실행 스테이지에서만** 비루트로 전환하면 빌드 복잡성 없이 보안을 달성할 수 있다.

## 파일 권한 문제와 해결

```dockerfile
# 잘못된 예 — appuser가 /app을 쓸 수 없음
FROM node:20-alpine
RUN adduser -S appuser
USER appuser
WORKDIR /app       # root 소유로 만들어져 appuser가 쓸 수 없음
COPY . .           # 실패할 수 있음

# 올바른 예 — WORKDIR과 COPY를 root 상태에서 처리 후 USER 전환
FROM node:20-alpine
RUN adduser -S appuser
WORKDIR /app
COPY --chown=appuser:appuser . .
USER appuser
```

`WORKDIR`은 `USER` 전환 전에 만들고, `COPY`에 `--chown`을 적용해 소유권을 미리 설정해야 한다. USER 전환 후에는 root 소유 파일에 쓰기가 불가능하다.

## 임시 root 복귀

```dockerfile
USER root
RUN apt-get install -y somepackage
USER appuser
```

특정 `RUN` 에서만 root 권한이 필요하면 `USER root`로 일시 전환하고 작업 후 다시 비루트 사용자로 되돌린다.

## 핵심 정리

- `USER`는 이후 `RUN`, `CMD`, `ENTRYPOINT`의 실행 사용자를 변경
- 기본값은 root(UID 0) — **프로덕션에서는 반드시 비루트로 전환**
- 사용자명 또는 UID/GID 숫자 형식 모두 가능
- `COPY --chown` + `USER` 조합으로 파일 권한 문제 예방
- 멀티 스테이지 빌드: 빌드 스테이지는 root, 최종 스테이지만 비루트

---

**지난 글:** [VOLUME 인스트럭션 완전 정복](/posts/dockerfile-volume/)

**다음 글:** [HEALTHCHECK 인스트럭션 완전 정복](/posts/dockerfile-healthcheck/)

<br>
읽어주셔서 감사합니다. 😊
