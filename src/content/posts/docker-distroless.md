---
title: "Distroless 이미지: 셸 없는 경량 보안 컨테이너"
description: "Google의 Distroless 이미지 개념, 일반 이미지와의 차이, Java·Node.js·Python별 사용법, 멀티 스테이지 빌드 패턴, 디버그 방법까지 실전 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "distroless", "security", "image", "multi-stage", "google", "보안", "경량이미지"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-size-reduction/)에서 이미지 크기를 줄이는 다양한 전략을 살펴봤다. 그 전략들 중 가장 극단적인 선택지가 **Distroless 이미지**다. 셸도 없고, 패키지 관리자도 없고, OS 유틸리티도 없다 — 오직 런타임과 앱만 남긴다.

## Distroless란 무엇인가

Distroless는 Google이 만든 컨테이너 이미지 시리즈로, 이름 그대로 "배포판 없는(distro-less)" 이미지다. 일반적인 Linux 배포판 이미지(ubuntu, debian, centos)에는 bash, sh, apt, dpkg, coreutils 같은 수백 개의 OS 레벨 패키지가 포함되어 있다. 이 중 실제로 앱 실행에 필요한 것은 극히 일부다.

Distroless는 그 "극히 일부"만 남긴다. 구체적으로:
- CA 인증서 (HTTPS 통신용)
- 시간대(timezone) 데이터
- glibc (C 런타임)
- 선택한 언어 런타임 (JRE, Node.js, Python 등)

그 외 모든 것은 이미지에 없다. `ls`, `cat`, `ps`도 없고, 셸(`/bin/sh`)도 없다.

![일반 이미지 vs Distroless 이미지 레이어 비교](/assets/posts/docker-distroless-layers.svg)

## 왜 Distroless를 사용하는가

**보안**: 셸이 없으면 공격자가 컨테이너에 침투하더라도 명령어를 실행하기 어렵다. 역방향 셸(reverse shell) 공격의 첫 번째 단계가 차단된다. 또한 패키지 수가 적으면 CVE 취약점 수도 급감한다.

```bash
# 일반 debian:12 이미지의 CVE 수 (예시)
$ trivy image debian:12
Total: 97 (CRITICAL: 1, HIGH: 8, MEDIUM: 37, LOW: 51)

# distroless/java21 기준
$ trivy image gcr.io/distroless/java21
Total: 3 (CRITICAL: 0, HIGH: 0, MEDIUM: 2, LOW: 1)
```

**크기**: ubuntu:22.04가 약 77MB인 반면, `gcr.io/distroless/java21`은 약 190MB(JRE 포함), `gcr.io/distroless/static`은 약 2MB다.

**CI/CD 속도**: 이미지가 작으면 레지스트리에서 pull하는 시간이 줄어 배포 사이클이 빨라진다.

## 멀티 스테이지 빌드와 함께 사용하기

Distroless 이미지에는 빌드 도구가 없으므로, 반드시 멀티 스테이지 빌드를 함께 써야 한다. 빌드 환경(builder stage)에서 결과물을 만들고, 런타임 환경(distroless stage)에 복사하는 패턴이다.

![Distroless 멀티 스테이지 Dockerfile 예시](/assets/posts/docker-distroless-dockerfile.svg)

### Java 앱 예시

```dockerfile
# Stage 1: 빌드 (Maven + JDK)
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:resolve -q
COPY src ./src
RUN mvn package -DskipTests -q

# Stage 2: 런타임 (Distroless)
FROM gcr.io/distroless/java21
WORKDIR /app
COPY --from=builder /app/target/my-app.jar app.jar
EXPOSE 8080
CMD ["app.jar"]
```

### Node.js 앱 예시

```dockerfile
# Stage 1: 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: 런타임
FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["/app/server.js"]
```

### Go 바이너리 예시 (static 이미지)

Go는 정적 바이너리를 만들 수 있어 가장 가벼운 `distroless/static`을 쓸 수 있다.

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

FROM gcr.io/distroless/static
COPY --from=builder /app/server /server
EXPOSE 8080
CMD ["/server"]
```

## 주요 Distroless 이미지 목록

| 이미지 | 용도 | 크기 |
|---|---|---|
| `gcr.io/distroless/static` | Go, Rust 정적 바이너리 | ~2MB |
| `gcr.io/distroless/base` | glibc 필요한 바이너리 | ~20MB |
| `gcr.io/distroless/java21` | Java 21 앱 | ~190MB |
| `gcr.io/distroless/nodejs20-debian12` | Node.js 20 앱 | ~120MB |
| `gcr.io/distroless/python3` | Python 3 앱 | ~50MB |
| `gcr.io/distroless/cc` | C/C++ 앱 (libstdc++ 포함) | ~24MB |

`:nonroot` 접미사를 붙이면 non-root 사용자(uid=65532)로 실행된다. 프로덕션에서는 `:nonroot` 태그를 기본으로 사용할 것을 권장한다.

```bash
FROM gcr.io/distroless/java21-debian12:nonroot
```

## 디버깅: :debug 태그

프로덕션에서는 셸이 없어 편리하지만, 개발/트러블슈팅 중에는 불편하다. Google은 이를 위해 `:debug` 태그를 제공한다. busybox 기반의 최소 셸이 포함되어 있다.

```bash
# 디버그 이미지로 셸 접속 (개발 환경 전용)
docker run --rm -it \
  gcr.io/distroless/java21:debug \
  /busybox/sh

# 실행 중인 컨테이너 디버그 (Kubernetes ephemeral container 방식)
kubectl debug -it my-pod \
  --image=gcr.io/distroless/java21:debug \
  --target=my-container
```

`:debug` 태그는 절대로 프로덕션 이미지로 배포하면 안 된다. Dockerfile에서 최종 `FROM`에 `:debug`가 남아 있지 않은지 CI에서 검증하는 것이 좋다.

## Dockerfile에서 흔히 하는 실수

### RUN 명령어 사용 시도

```dockerfile
# 잘못된 예: distroless에서 RUN 불가
FROM gcr.io/distroless/java21
RUN apt-get install -y curl  # 빌드 실패 — 셸 없음
```

Distroless stage에서는 `RUN` 명령어를 쓸 수 없다. 모든 설정과 파일 복사는 builder stage에서 처리해야 한다.

### 셸 형태의 CMD

```dockerfile
# 잘못된 예: 셸 형태 CMD
CMD java -jar app.jar  # 셸이 없어서 동작 안 함

# 올바른 예: exec 형태 CMD
CMD ["java", "-jar", "app.jar"]
```

Distroless에는 `/bin/sh`가 없으므로 `CMD`와 `ENTRYPOINT`는 반드시 exec 형태(JSON 배열)로 작성해야 한다.

## Google의 Bazel distroless vs. Chainguard

최근에는 **Chainguard Images**가 Distroless의 대안으로 주목받고 있다. Wolfi OS 기반으로 apk 패키지 관리자를 지원하면서도 최소 CVE를 유지한다. 패키지 설치가 필요한 경우 Chainguard를 고려할 수 있다.

```bash
# Chainguard Java 이미지
FROM cgr.dev/chainguard/jre:latest
```

---

**지난 글:** [Docker 이미지 크기 줄이기: 경량 이미지 최적화 전략](/posts/docker-image-size-reduction/)

**다음 글:** [Alpine 이미지 함정: musl libc와 패키지 누락 문제](/posts/docker-alpine-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
