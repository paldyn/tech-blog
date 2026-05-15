---
title: "멀티 스테이지 빌드 완전 정복"
description: "Dockerfile 멀티 스테이지 빌드로 이미지 크기를 대폭 줄이는 방법, 언어별 패턴(Go, Node.js, Python, Java), 테스트 스테이지 분리, --target 활용을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "멀티스테이지빌드", "이미지최적화", "빌드패턴"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-cache-strategy/)에서 레이어 캐시 전략을 살펴봤다. 이번에는 Docker 이미지 크기를 극적으로 줄이는 핵심 기법인 **멀티 스테이지 빌드**를 정리한다.

## 멀티 스테이지 빌드란

하나의 Dockerfile 안에 여러 `FROM` 인스트럭션을 쓸 수 있다. 각 `FROM`이 하나의 **스테이지**를 시작한다. 최종 이미지에는 마지막 스테이지만 포함되고, 이전 스테이지의 레이어는 포함되지 않는다. 대신 `COPY --from=<스테이지>`로 이전 스테이지의 파일만 골라 복사할 수 있다.

```dockerfile
FROM node:20 AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/server.js"]
```

빌드 도구(`node_modules` 포함 수백 MB)가 최종 이미지에서 완전히 제거된다.

![멀티 스테이지 빌드 흐름](/assets/posts/dockerfile-multistage-flow.svg)

## 스테이지 이름 지정

```dockerfile
FROM golang:1.22 AS builder
FROM alpine:3.19 AS runner
```

`AS <이름>`으로 스테이지에 이름을 붙인다. 이름 없이 인덱스(0, 1, 2...)로도 참조할 수 있지만, 이름을 쓰는 게 명확하다.

```dockerfile
COPY --from=builder /app/bin /usr/local/bin   # 이름 참조
COPY --from=0 /app/bin /usr/local/bin         # 인덱스 참조
COPY --from=nginx:alpine /etc/nginx/nginx.conf /etc/nginx/  # 외부 이미지 참조
```

## 언어별 패턴

![멀티 스테이지 — 언어별 패턴](/assets/posts/dockerfile-multistage-patterns.svg)

### Go — scratch 이미지 활용

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s" -o /app .

FROM scratch
COPY --from=builder /app /app
COPY --from=builder /etc/ssl/certs/ca-certificates.crt \
     /etc/ssl/certs/
USER 65534:65534
CMD ["/app"]
```

`CGO_ENABLED=0`으로 정적 링킹된 바이너리를 만들면 `scratch`(비어있는 이미지) 위에서 실행 가능하다. 최종 이미지는 수 MB 수준이다.

### Java — JRE로 분리

```dockerfile
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
USER 1001:1001
CMD ["java", "-jar", "app.jar"]
```

JDK(개발 도구 포함)에서 빌드하고, JRE(런타임만)로 실행하면 수백 MB를 절약한다.

## 테스트 스테이지 분리

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS test
COPY . .
RUN npm test

FROM deps AS builder
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/server.js"]
```

`test` 스테이지가 실패하면 `builder` 스테이지로 진행하지 않는다. CI에서 테스트와 빌드를 하나의 Dockerfile로 관리할 수 있다.

## --target 옵션

```bash
# 특정 스테이지까지만 빌드
docker build --target test -t myapp:test .

# CI에서 테스트만 실행
docker build --target test --no-cache .

# 개발용 이미지 (dev 스테이지)
docker build --target dev -t myapp:dev .
```

개발/테스트/프로덕션 이미지를 하나의 Dockerfile에서 관리할 수 있다.

## 병렬 빌드

BuildKit은 의존 관계가 없는 스테이지를 자동으로 병렬 빌드한다.

```dockerfile
# deps-backend와 deps-frontend는 서로 독립적 → 동시 빌드
FROM node:20 AS deps-frontend
RUN npm ci

FROM python:3.12 AS deps-backend
RUN pip install ...

FROM nginx:alpine AS production
COPY --from=deps-frontend /app/dist /usr/share/nginx/html
COPY --from=deps-backend /app/api ./api
```

## 캐시 공유와 --mount

멀티 스테이지 + 캐시 마운트를 결합하면 최강의 캐시 전략이 완성된다.

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.22 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    go build -o /app .
```

## 핵심 정리

- 멀티 스테이지: 하나의 Dockerfile에 여러 `FROM`, 최종 이미지엔 마지막 스테이지만
- `COPY --from=<스테이지>` 로 이전 스테이지 파일 선택 복사
- Go: `scratch`, Java: JRE, Python: slim + 가상환경 복사
- `--target` 으로 특정 스테이지까지만 빌드 (CI 테스트에 활용)
- BuildKit이 의존성 없는 스테이지를 자동 병렬 실행

---

**지난 글:** [Dockerfile 레이어 캐시 전략](/posts/dockerfile-cache-strategy/)

**다음 글:** [BuildKit 완전 정복](/posts/dockerfile-buildkit/)

<br>
읽어주셔서 감사합니다. 😊
