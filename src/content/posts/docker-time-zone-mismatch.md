---
title: "Docker 컨테이너 시간대(Timezone) 불일치 해결"
description: "컨테이너가 UTC를 기본 시간대로 사용해 호스트와 9시간 차이가 생기는 문제를 TZ 환경변수, /etc/localtime 마운트, tzdata 설치로 해결하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "timezone", "TZ", "tzdata", "localtime", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-build-fails-cache/)에서 빌드 캐시 문제를 해결했다. 이번에는 컨테이너 안에서 시간이 호스트와 다른 **시간대 불일치** 문제를 다룬다. 특히 한국에서 서버를 운영할 때, 컨테이너 로그가 UTC 기준으로 찍혀 실제 시각과 9시간 차이가 나면 로그 분석이 어려워진다.

## 증상 확인

```bash
# 호스트 시간
date
# Tue May 26 18:00:00 KST 2026

# 컨테이너 시간
docker exec <컨테이너명> date
# Tue May 26 09:00:00 UTC 2026  ← 9시간 차이

# 컨테이너 시간대 확인
docker exec <컨테이너명> cat /etc/timezone
# (파일 없음 또는 UTC)
```

컨테이너 이미지는 대부분 UTC를 기본 시간대로 설정한다. 이미지 자체가 `/etc/localtime`이나 `/etc/timezone` 설정을 포함하지 않으면 UTC가 적용된다.

## 해결 방법

![컨테이너 시간대 불일치 원인과 해결](/assets/posts/docker-time-zone-mismatch-overview.svg)

### 방법 1: TZ 환경변수 (가장 간단)

```bash
# 실행 시 환경변수로 시간대 지정
docker run -e TZ=Asia/Seoul myapp

# 시간대 목록 확인
docker run --rm alpine tzselect
# 또는
ls /usr/share/zoneinfo/Asia/
```

`TZ` 환경변수는 대부분의 언어 런타임(Go, Python, Java, Node.js 등)이 인식한다. tzdata가 이미지에 없어도 일부 경우엔 동작한다. 가장 빠른 해결책이다.

### 방법 2: /etc/localtime 바인드 마운트

```bash
# 호스트의 localtime을 컨테이너에 공유 (읽기 전용)
docker run \
  -v /etc/localtime:/etc/localtime:ro \
  -e TZ=Asia/Seoul \
  myapp
```

호스트의 시간대 설정을 그대로 컨테이너에 주입한다. 호스트가 `Asia/Seoul`로 설정되어 있다면 컨테이너도 같은 시간대를 쓴다.

### 방법 3: Dockerfile에서 tzdata 설치

```dockerfile
FROM node:20-alpine

RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
    && echo "Asia/Seoul" > /etc/timezone \
    && apk del tzdata

ENV TZ=Asia/Seoul
```

이미지에 시간대를 영구 포함한다. Alpine에서는 `tzdata`를 설치 후 링크 파일을 복사하고 패키지를 삭제해 이미지 크기를 줄인다.

![Alpine/Distroless 시간대 설정](/assets/posts/docker-time-zone-mismatch-alpine.svg)

```dockerfile
# Debian/Ubuntu
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Asia/Seoul

RUN apt-get update \
    && apt-get install -y tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
    && echo "Asia/Seoul" > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*
```

`DEBIAN_FRONTEND=noninteractive`을 설정하지 않으면 tzdata 설치 중 대화형 프롬프트가 뜨면서 빌드가 멈춘다.

## Compose에서 시간대 설정

```yaml
# docker-compose.yml
services:
  app:
    image: myapp
    environment:
      - TZ=Asia/Seoul
    volumes:
      - /etc/localtime:/etc/localtime:ro

  db:
    image: postgres:16
    environment:
      - TZ=Asia/Seoul
      - POSTGRES_TZ=Asia/Seoul
```

또는 `.env` 파일로 공통 적용:

```bash
# .env
TZ=Asia/Seoul
```

```yaml
# docker-compose.yml
services:
  app:
    image: myapp
    env_file:
      - .env
```

## Java 시간대 주의사항

Java는 JVM 자체의 기본 시간대를 사용한다. `TZ` 환경변수 외에 JVM 옵션으로도 설정할 수 있다.

```bash
# JVM 옵션으로 시간대 설정
java -Duser.timezone=Asia/Seoul -jar app.jar

# 환경변수
TZ=Asia/Seoul java -jar app.jar

# Spring Boot 확인
@Value("${user.timezone:UTC}")
String timezone;
```

```dockerfile
ENV TZ=Asia/Seoul
ENV JAVA_TOOL_OPTIONS="-Duser.timezone=Asia/Seoul"
```

## 데이터베이스 시간대

컨테이너 시간대와 별개로 데이터베이스의 시간대도 설정해야 한다.

```bash
# MySQL
docker run -e TZ=Asia/Seoul \
  -e MYSQL_ROOT_PASSWORD=secret mysql:8.0

# 또는 my.cnf에서
# [mysqld]
# default-time-zone = '+09:00'

# PostgreSQL
docker run -e TZ=Asia/Seoul \
  -e PGTZ=Asia/Seoul postgres:16
```

애플리케이션과 데이터베이스의 시간대가 다르면 날짜/시간 쿼리 결과가 기대와 다를 수 있다. 모든 서비스를 동일한 시간대로 맞추는 게 안전하다.

## 권장 설정 요약

```bash
# 빠른 해결 (실행 시)
docker run -e TZ=Asia/Seoul myapp

# 영구 적용 (Dockerfile)
ENV TZ=Asia/Seoul
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/$TZ /etc/localtime \
    && apk del tzdata
```

UTF 기반 이미지를 UTC로 유지하고 `TZ` 환경변수만 바꾸는 방법이 이미지 재빌드 없이 유연하게 시간대를 변경할 수 있어 실무에서 가장 많이 쓰인다.

---

**지난 글:** [Docker 빌드 캐시 실패 트러블슈팅](/posts/docker-build-fails-cache/)

**다음 글:** [Docker BuildKit 심화 — 내부 구조와 고급 기능](/posts/docker-buildkit-deepdive/)

<br>
읽어주셔서 감사합니다. 😊
