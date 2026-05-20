---
title: "Docker 이미지 크기 줄이기: 경량 이미지 최적화 전략"
description: "베이스 이미지 선택, 멀티 스테이지 빌드, apt/apk 캐시 삭제, .dockerignore, RUN 명령 최적화, distroless/scratch 이미지 활용까지 Docker 이미지 크기를 1GB에서 수십 MB로 줄이는 실전 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "image", "optimization", "alpine", "distroless", "multi-stage", "이미지최적화", "경량화"]
featured: false
draft: false
---

[지난 글](/posts/docker-rootless-security/)에서 Rootless Mode로 daemon 자체를 비루트로 실행하는 방법을 살펴봤다. 이번에는 보안과 성능 모두에 영향을 주는 **이미지 크기 최적화**를 다룬다. 작은 이미지는 pull 속도가 빠르고, 공격 표면(attack surface)이 작으며, 취약점 수도 줄어든다.

## 이미지 크기와 보안의 관계

이미지에 불필요한 패키지가 많을수록 CVE 노출 면적이 넓어진다.

```bash
# ubuntu:22.04 기반 이미지의 취약점 수
trivy image ubuntu:22.04
# → Total: 47 (HIGH: 8, ...)

# alpine:3.19 기반 이미지
trivy image alpine:3.19
# → Total: 0 (or very few)
```

## 1. 올바른 베이스 이미지 선택

```dockerfile
# ubuntu: ~77MB OS, 패키지 풀 포함
FROM ubuntu:22.04

# debian-slim: 최소 패키지만 포함
FROM debian:12-slim

# alpine: 5MB musl libc 기반 최소 이미지
FROM alpine:3.19

# 공식 slim 변형 이용
FROM node:20-alpine       # vs node:20 (300MB 차이)
FROM python:3.12-slim     # vs python:3.12 (400MB 차이)
```

Alpine은 크기가 매우 작지만 musl libc를 사용해 glibc 기반 바이너리와 호환성 문제가 생길 수 있다.

## 2. RUN 명령 최적화

각 `RUN`은 별도의 레이어를 만든다. 레이어에서 삭제한 파일도 이전 레이어에 남는다.

```dockerfile
# 잘못된 예: 각 RUN이 별도 레이어, 캐시가 다른 레이어에 남음
RUN apt-get update
RUN apt-get install -y gcc
RUN rm -rf /var/lib/apt/lists/*   # 이전 레이어의 캐시 삭제 불가

# 올바른 예: 한 레이어에서 설치와 정리
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      gcc \
      libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Alpine
RUN apk add --no-cache gcc musl-dev
```

`--no-install-recommends`는 의존성 추천 패키지를 설치하지 않아 수십 MB를 절약한다.

## 3. 멀티 스테이지 빌드

빌드 도구(gcc, npm, maven 등)가 최종 이미지에 포함되지 않도록 한다.

![이미지 크기 최적화 전략 비교](/assets/posts/docker-image-size-reduction-layers.svg)

### Node.js 예시

```dockerfile
# Stage 1: 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: 프로덕션 (dev dependencies 없음)
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force
USER node
CMD ["node", "dist/server.js"]
```

### Java/Maven 예시

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
CMD ["java", "-jar", "app.jar"]
```

### Go 예시 (가장 극적인 크기 감소)

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o myapp .

# scratch: 완전히 빈 이미지
FROM scratch
COPY --from=builder /app/myapp /myapp
# 인증서가 필요하면:
# COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
CMD ["/myapp"]
# 결과: ~15MB
```

`-ldflags="-s -w"`는 디버그 정보와 DWARF 테이블을 제거해 바이너리 크기를 더 줄인다.

## 4. .dockerignore

빌드 컨텍스트에서 불필요한 파일을 제외한다.

```
# .dockerignore
node_modules/
dist/
.git/
.gitignore
.env
*.log
*.md
Dockerfile*
docker-compose*
tests/
__tests__/
.nyc_output/
coverage/
```

`node_modules`가 빌드 컨텍스트에 포함되면 수백 MB가 전송된다.

## 5. distroless 이미지

Google이 관리하는 distroless 이미지는 OS 패키지 관리자, 셸, 유틸리티가 없는 최소 이미지다.

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# distroless Node.js
FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app .
CMD ["server.js"]
```

셸이 없으므로 `docker exec mycontainer sh`가 작동하지 않는다. 디버깅을 위해 `:debug` 태그를 쓰면 busybox shell이 포함된다.

```dockerfile
# 디버그용 (일시적으로만 사용)
FROM gcr.io/distroless/nodejs20-debian12:debug
```

## 6. 이미지 분석 도구

```bash
# dive: 레이어별 파일 시스템 변경 시각화
brew install dive
dive myimage:latest

# docker history: 레이어 크기 확인
docker history myimage:latest
# IMAGE         CREATED      CREATED BY                    SIZE
# abc123        2 days ago   CMD ["node", "server.js"]     0B
# def456        2 days ago   COPY --from=builder /app ...  45MB

# docker image inspect: 전체 메타데이터
docker image inspect myimage:latest | \
  python3 -c "import sys,json; d=json.load(sys.stdin)[0]; \
  print('Size:', d['Size']//1024//1024, 'MB')"
```

![이미지 크기 절감 핵심 팁](/assets/posts/docker-image-size-reduction-tips.svg)

## 7. npm/pip 캐시 완전 제거

```dockerfile
# npm
RUN npm ci --only=production && \
    npm cache clean --force

# pip
RUN pip install --no-cache-dir -r requirements.txt

# pip wheel 빌드 후 제거 패턴
RUN pip install --no-cache-dir wheel && \
    pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y wheel
```

## 크기 절감 결과 요약

| 접근법 | Node.js 앱 예시 크기 |
|--------|---------------------|
| ubuntu:22.04 (단순) | ~1.2 GB |
| node:20 (alpine 아님) | ~450 MB |
| node:20-alpine | ~200 MB |
| multi-stage + alpine | ~100 MB |
| distroless | ~80 MB |
| Go + scratch | ~15 MB |

이미지 크기를 줄이면 CI 빌드 속도, 레지스트리 스토리지 비용, 배포 시간, 보안 취약점 수가 모두 개선된다. 멀티 스테이지 빌드와 slim/alpine 베이스 이미지 선택이 가장 큰 효과를 낸다.

---

**지난 글:** [Docker Rootless Mode: daemon 자체를 비루트로 실행](/posts/docker-rootless-security/)

<br>
읽어주셔서 감사합니다. 😊
