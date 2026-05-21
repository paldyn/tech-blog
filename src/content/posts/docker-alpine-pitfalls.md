---
title: "Alpine 이미지 함정: musl libc와 패키지 누락 문제"
description: "Docker Alpine 이미지에서 자주 발생하는 musl vs glibc 호환성 문제, DNS 지연, 패키지 누락, 시간대 오류를 원인부터 해결책까지 체계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "alpine", "musl", "glibc", "이미지최적화", "트러블슈팅", "DNS", "리눅스"]
featured: false
draft: false
---

[지난 글](/posts/docker-distroless/)에서 Distroless 이미지로 공격 표면을 최소화하는 방법을 다뤘다. Alpine Linux도 비슷한 목적으로 쓰이는 경량 베이스 이미지지만, 실무에서 예상치 못한 함정을 자주 만나게 된다. 왜 Alpine에서 잘 돌아가던 앱이 갑자기 이상해지는지, 어떻게 피해야 하는지 살펴본다.

## Alpine이 인기 있는 이유

`ubuntu:22.04`가 약 77MB인 반면 `alpine:3.20`은 약 7MB다. Docker Hub에서 대부분의 공식 이미지가 `-alpine` 태그를 제공한다. `node:20-alpine`, `python:3.12-alpine`, `golang:1.22-alpine` 등이 그 예다.

```bash
$ docker image ls | grep -E "node.*alpine|node.*slim|node.*latest"
node   20-alpine     abc123   7 days ago   136MB
node   20-slim       def456   7 days ago   243MB
node   20            ghi789   7 days ago   1.1GB
```

크기만 보면 Alpine이 압도적이다. 문제는 Alpine이 일반 Linux 배포판과 다른 C 표준 라이브러리를 사용한다는 점이다.

## 함정 1: musl libc vs glibc

Linux 애플리케이션은 시스템 콜을 직접 호출하는 대신 C 표준 라이브러리(libc)를 통해 OS 기능을 사용한다. 대부분의 Linux 배포판은 **glibc**를 쓰지만, Alpine은 크기가 작고 라이선스가 단순한 **musl libc**를 사용한다.

문제는 musl과 glibc가 ABI 호환이 되지 않는다는 점이다. glibc 기반으로 컴파일된 바이너리를 Alpine에서 실행하면:

```bash
# Alpine 컨테이너에서 glibc 바이너리 실행 시
$ /app/my-binary
/app/my-binary: not found

# 또는
$ /app/my-binary
exec /app/my-binary: no such file or directory
# 실제 파일은 있지만 동적 링크 라이브러리를 못 찾는 것
```

`not found` 메시지가 헷갈리는데, 파일이 없는 게 아니라 `/lib64/ld-linux-x86-64.so.2`(glibc 로더)를 찾지 못해서 발생한다.

![Alpine 함정 개요](/assets/posts/docker-alpine-pitfalls-musl.svg)

### 영향 받는 주요 케이스

- **Python C 확장**: `numpy`, `pandas`, `cryptography` 등의 C 확장은 glibc 기반으로 컴파일된 PyPI 휠을 사용한다. Alpine에서는 소스 컴파일이 필요해 빌드 시간이 수 배 늘어난다.
- **Java JVM**: GraalVM native-image로 만든 바이너리가 glibc에 의존하는 경우가 많다.
- **사전 컴파일 도구**: Terraform, Vault 등의 Go 바이너리 중 일부는 CGO를 사용해 glibc에 의존한다.

### 해결책

```dockerfile
# 방법 1: gcompat 레이어 추가 (musl 위에 glibc 에뮬레이션)
FROM alpine:3.20
RUN apk add --no-cache gcompat

# 방법 2: debian:12-slim으로 교체 (musl 이슈 없음)
FROM debian:12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# 방법 3: node:20-slim (Alpine 대신 debian-slim 기반)
FROM node:20-slim
```

## 함정 2: 패키지 기본 미포함

Alpine은 정말 최소한의 패키지만 포함한다. 다음은 자주 누락되어 문제를 일으키는 패키지들이다.

| 패키지 | 누락 시 증상 |
|---|---|
| `ca-certificates` | HTTPS 요청 시 인증서 오류 |
| `tzdata` | 로그 시간이 UTC로 고정 |
| `curl` / `wget` | 헬스체크, 파일 다운로드 실패 |
| `bash` | bash 스크립트 실행 불가 (`/bin/bash: not found`) |
| `bind-tools` | DNS 조회 도구(`dig`, `nslookup`) 없음 |
| `openssl` | SSL 관련 CLI 도구 없음 |

```dockerfile
# 자주 필요한 패키지를 한 번에 설치하는 패턴
FROM node:20-alpine
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    && cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
    && echo "Asia/Seoul" > /etc/timezone \
    && apk del tzdata
ENV TZ=Asia/Seoul
```

## 함정 3: musl의 DNS 지연

Alpine의 musl libc는 DNS 해석기에서 A 레코드(IPv4)와 AAAA 레코드(IPv6)를 **순차적으로** 조회한다. 반면 glibc는 두 쿼리를 병렬로 보낸다. 이 차이 때문에 Alpine 컨테이너에서 첫 번째 DNS 조회가 눈에 띄게 느릴 수 있다.

```bash
# Alpine 컨테이너 내에서 DNS 조회 시간 측정
$ time nslookup google.com 2>&1
...
real    0m0.543s  # glibc 환경에서는 보통 0.1초 미만

# 해결: /etc/resolv.conf에 ndots 설정
$ echo "options ndots:0" >> /etc/resolv.conf
```

Kubernetes 환경에서 Alpine 기반 파드가 서비스 디스커버리에서 느린 반응을 보이는 원인 중 하나가 이 musl DNS 문제다.

## 함정 4: apk 잘못된 사용으로 캐시 오염

`apk add`를 여러 `RUN` 명령에 나눠 쓰면 레이어가 늘어나고, 인덱스 파일이 레이어마다 들어가 이미지 크기가 증가한다.

```dockerfile
# 나쁜 패턴: RUN 분리
RUN apk update
RUN apk add curl
RUN apk add tzdata

# 좋은 패턴: 한 RUN에, --no-cache로
RUN apk add --no-cache curl tzdata
```

`--no-cache` 플래그는 `/var/cache/apk/` 인덱스 파일을 저장하지 않아 레이어 크기를 줄인다.

![Alpine 함정 해결 가이드](/assets/posts/docker-alpine-pitfalls-fix.svg)

## Alpine을 써도 되는 경우 vs 피해야 하는 경우

### 적합한 경우

- **Go, Rust 정적 바이너리**: `CGO_ENABLED=0`으로 빌드한 Go 바이너리는 musl 이슈가 없다.
- **간단한 Nginx, HAProxy**: 공식 Alpine 태그가 있고 검증된 것들
- **apk로 해결 가능한 의존성**: 필요한 패키지가 Alpine 패키지 저장소에 있는 경우

### 피해야 하는 경우

```bash
# Python C 확장 포함 시: debian-slim 기반이 훨씬 빠름
# Alpine에서 numpy 빌드
FROM python:3.12-alpine
RUN pip install numpy  # 소스 컴파일 → ~5분

# debian-slim에서 numpy 빌드
FROM python:3.12-slim
RUN pip install numpy  # 사전 컴파일 휠 사용 → ~30초
```

Java JVM, Python ML 라이브러리, Node.js 네이티브 바인딩을 쓰는 앱이라면 `node:20-slim`, `python:3.12-slim`, `eclipse-temurin:21-jre-jammy` 같은 debian-slim 기반 이미지가 더 적합하다.

## 정리: 알아두면 좋은 점검 목록

```bash
# Alpine 컨테이너 내부에서 기본 진단
docker run --rm alpine:3.20 sh -c "
  echo '=== libc ===' && ls /lib/ld-musl* 2>/dev/null
  echo '=== DNS ===' && cat /etc/resolv.conf
  echo '=== timezone ===' && date
  echo '=== packages ===' && apk info | wc -l
"
```

Alpine 이미지를 선택할 때는 "단순히 작아서"가 아니라 의존성 호환성을 먼저 확인하는 습관이 필요하다. 크기 이점이 크지 않다면 debian-slim이 훨씬 안정적인 선택이다.

---

**지난 글:** [Distroless 이미지: 셸 없는 경량 보안 컨테이너](/posts/docker-distroless/)

**다음 글:** [Scratch 이미지: 절대 최소 컨테이너 만들기](/posts/docker-scratch-image/)

<br>
읽어주셔서 감사합니다. 😊
