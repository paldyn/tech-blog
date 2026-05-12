---
title: "FROM 인스트럭션 완전 정복"
description: "Dockerfile FROM 인스트럭션의 문법, 이미지 참조 형식(태그·digest·플랫폼), ARG와의 결합, 멀티 스테이지 빌드에서 FROM을 여러 번 쓰는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "FROM", "멀티스테이지빌드", "베이스이미지", "digest"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-anatomy/)에서 Dockerfile의 전체 구조와 기본 문법을 살펴봤다. 이제 모든 Dockerfile이 반드시 시작하는 `FROM` 인스트럭션을 깊이 파고든다.

## FROM의 역할

`FROM`은 새 이미지의 **베이스 레이어**를 지정한다. 이후 모든 `COPY`, `RUN`, `ENV` 등의 인스트럭션은 이 베이스 위에 레이어를 추가하는 방식으로 동작한다.

```dockerfile
FROM <이미지>[:<태그>|@<digest>] [AS <alias>]
```

![FROM 인스트럭션 문법](/assets/posts/dockerfile-from-syntax.svg)

## 이미지 참조 형식

### 태그 방식 (권장)

```dockerfile
# 태그 생략 시 latest — 빌드마다 다른 이미지를 가져올 수 있어 위험
FROM node

# 메이저 버전 고정 — 마이너·패치 업데이트는 자동 반영
FROM node:20

# 전체 버전 고정 — 가장 예측 가능
FROM node:20.14.0-alpine3.20
```

태그 없이 `FROM node`를 쓰면 `FROM node:latest`와 동일하다. `latest`는 이미지가 갱신될 때마다 다른 버전을 참조할 수 있어 **재현 불가능한 빌드**를 만든다.

### Digest 방식 (완벽한 고정)

```dockerfile
FROM node@sha256:a1b2c3d4e5f6...
```

digest는 이미지 내용 전체의 해시값이다. 태그가 가리키는 이미지가 교체돼도 digest는 절대 바뀌지 않는다. 보안이 중요한 프로덕션 환경에서 강력히 권장된다.

```bash
# 현재 태그의 digest 확인
docker inspect --format='{{index .RepoDigests 0}}' node:20-alpine
```

### 플랫폼 지정

```dockerfile
FROM --platform=linux/amd64 node:20-alpine
FROM --platform=linux/arm64 node:20-alpine
```

멀티 아키텍처 빌드 또는 M1/M2 Mac에서 x86 이미지를 명시적으로 지정할 때 사용한다.

## ARG와 결합: 동적 FROM

```dockerfile
ARG BASE_IMAGE=node:20-alpine
FROM $BASE_IMAGE

# 빌드 시 오버라이드
# docker build --build-arg BASE_IMAGE=node:18-slim .
```

`FROM` 앞에 선언한 `ARG`만 `FROM` 인스트럭션 안에서 참조할 수 있다. `FROM` 이후의 `ARG`는 별도 스코프이므로 주의한다.

```dockerfile
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS base
# FROM 이후 ARG는 초기화됨 — 다시 선언 필요
ARG NODE_VERSION
RUN echo "Using Node $NODE_VERSION"
```

## FROM scratch: 빈 이미지

```dockerfile
FROM scratch
COPY myapp /myapp
CMD ["/myapp"]
```

`scratch`는 내용이 없는 특수 이미지다. OS나 패키지 관리자 없이 단일 정적 바이너리만 담을 때 사용한다. Go, Rust 등 정적 컴파일 언어의 최종 이미지에 활용된다.

## 멀티 스테이지 빌드

`FROM`이 여러 번 등장하면 각각이 독립된 **빌드 스테이지**가 된다.

![멀티 스테이지 빌드와 FROM](/assets/posts/dockerfile-from-multistage.svg)

```dockerfile
# 스테이지 1: 빌드
FROM golang:1.22 AS builder
WORKDIR /src
COPY . .
RUN go build -o app .

# 스테이지 2: 실행 (바이너리만 복사)
FROM gcr.io/distroless/base
COPY --from=builder /src/app /app
CMD ["/app"]
```

`--from=builder`로 이전 스테이지의 파일을 가져온다. 최종 이미지에는 빌드 도구, 소스 코드, 패키지 캐시가 포함되지 않아 크기가 획기적으로 줄어든다.

### 특정 스테이지만 빌드

```bash
# builder 스테이지까지만 빌드 (CI 캐시 워밍 등에 활용)
docker build --target builder -t myapp:build .
```

## 실전 체크리스트

| 상황 | 권장 형식 |
|---|---|
| 개발·학습 | `FROM node:20-alpine` (태그 고정) |
| CI 파이프라인 | `FROM node:20-alpine` + digest 검증 |
| 프로덕션 배포 | `FROM node@sha256:...` |
| 멀티 아키텍처 | `FROM --platform=$TARGETPLATFORM` |
| 정적 바이너리 | `FROM scratch` 또는 `FROM distroless` |

`FROM`은 단순해 보이지만 보안·재현성·이미지 크기에 직결되는 인스트럭션이다. 태그를 명시하고, 프로덕션에서는 digest를 쓰는 습관을 들이자.

---

**지난 글:** [Dockerfile 해부학 — 구조와 기본 문법](/posts/dockerfile-anatomy/)

**다음 글:** [RUN 인스트럭션 완전 정복](/posts/dockerfile-run/)

<br>
읽어주셔서 감사합니다. 😊
