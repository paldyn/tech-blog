---
title: "Docker 볼륨 권한 관리: 컨테이너 내 파일 접근 제어"
description: "Docker 볼륨의 UID/GID 권한 문제 원인과 해결 방법을 설명합니다. entrypoint chown 패턴, --user 플래그, Dockerfile USER 지시어와 볼륨 권한의 관계를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "volume", "권한", "permission", "UID", "GID", "보안"]
featured: false
draft: false
---

[지난 글](/posts/docker-volume-backup-restore/)에서 볼륨 데이터를 백업하고 복원하는 방법을 살펴봤다. 이번에는 볼륨 사용 시 자주 마주치는 **권한(Permission) 문제**를 다룬다. `Permission denied` 에러는 컨테이너 권한을 이해하면 대부분 해결된다.

## 권한 문제의 근원: UID는 숫자다

Linux 파일 시스템의 소유권은 UID(User ID)와 GID(Group ID) 숫자로 관리된다. Docker 컨테이너도 같은 원칙을 따른다. 컨테이너 안의 `app` 사용자와 호스트의 `ubuntu` 사용자가 동일한 UID `1000`이라면 서로의 파일에 접근할 수 있다. 반대로 이름이 같아도 UID가 다르면 접근이 거부된다.

![볼륨 권한: UID/GID 매핑](/assets/posts/docker-volume-permissions-uid.svg)

## 흔한 문제 시나리오

### 시나리오 1: root가 만든 볼륨에 비루트 컨테이너가 쓰기 시도

```bash
# Named Volume 생성 (Docker가 root 소유로 초기화)
docker volume create mydata

# 비루트 사용자로 실행하는 컨테이너
docker run --user 1000 -v mydata:/app/data my-app
# Permission denied: /app/data 에 쓰기 실패
```

`docker volume create`로 만든 빈 볼륨의 마운트 포인트는 기본적으로 root(UID 0) 소유다.

### 시나리오 2: 호스트 디렉터리 소유자와 컨테이너 사용자 불일치

```bash
# 호스트에서 root로 만든 디렉터리
sudo mkdir /data && sudo chmod 700 /data

# 컨테이너가 UID 1000으로 쓰기 시도
docker run -v /data:/app/data --user 1000 my-app
# Permission denied
```

## 해결 방법

![권한 설정 패턴 예시](/assets/posts/docker-volume-permissions-patterns.svg)

### 방법 1: entrypoint에서 chown (가장 보편적)

컨테이너를 root로 시작해 볼륨 디렉터리 소유권을 변경한 뒤 비루트 사용자로 전환한다.

```bash
# Dockerfile
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --chown=app:app . .
VOLUME /app/data
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
```

```bash
# entrypoint.sh
#!/bin/sh
chown -R app:app /app/data
exec su-exec app "$@"
```

`su-exec`(alpine) 또는 `gosu`(debian/ubuntu)는 신호 전달을 올바르게 처리하는 `sudo exec` 대체품이다.

### 방법 2: `--user` 플래그로 UID 주입

```bash
# 현재 사용자 UID로 컨테이너 실행
docker run \
  --user $(id -u):$(id -g) \
  -v $(pwd)/data:/app/data \
  my-app
```

호스트 파일 소유자의 UID와 컨테이너 실행 UID를 일치시킨다. CI 환경에서 유용하다.

### 방법 3: Named Volume 초기화 시 소유권 설정

볼륨을 처음 마운트할 때 올바른 소유자로 초기화한다.

```bash
# 초기화 전용 컨테이너로 소유자 설정
docker run --rm \
  -v mydata:/data \
  alpine \
  chown -R 1000:1000 /data

# 이후 컨테이너는 UID 1000으로 접근 가능
docker run --user 1000 -v mydata:/app/data my-app
```

### 방법 4: Dockerfile에서 볼륨 마운트 포인트 생성 후 소유권 설정

```dockerfile
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

# VOLUME 선언 전에 디렉터리를 해당 사용자 소유로 생성
RUN mkdir -p /app/data && chown app:app /app/data
USER app
VOLUME /app/data
```

`VOLUME` 선언 **전에** `mkdir + chown`을 실행해야 볼륨이 빈 상태로 마운트될 때 올바른 소유권으로 초기화된다.

## Bind Mount에서의 권한

Bind Mount는 호스트 파일의 소유권을 그대로 가져온다.

```bash
# 호스트에서 현재 사용자 소유로 디렉터리 생성
mkdir -p ./data

# 컨테이너가 동일 UID(1000)이면 접근 가능
docker run --user 1000 -v $(pwd)/data:/app/data my-app

# 호스트 사용자 UID 확인
id -u  # 예: 1000
```

## 읽기 전용 마운트로 쓰기 차단

애플리케이션이 설정 파일을 수정할 수 없도록 `:ro`로 마운트한다.

```bash
docker run -v $(pwd)/config.yml:/app/config.yml:ro my-app
```

## Docker Desktop (rootless) 환경

Docker Desktop은 rootless 모드로 동작하므로 UID 매핑이 다를 수 있다. 일반적으로 호스트 사용자가 컨테이너 내부의 UID로 자동 매핑된다.

## 핵심 정리

- Docker는 UID/GID 숫자로 파일 소유권 판단 (사용자 이름 무관)
- `Permission denied`: 컨테이너 UID와 볼륨 파일 소유 UID 불일치
- 해결 ①: entrypoint에서 `chown` + `gosu`/`su-exec`로 전환
- 해결 ②: `docker run --user $(id -u):$(id -g)` 로 UID 일치
- 해결 ③: `VOLUME` 선언 전 `mkdir + chown`으로 초기화
- Bind Mount: 호스트 파일 소유권 그대로 상속

---

**지난 글:** [Docker 볼륨 백업과 복원: 데이터 보호 전략](/posts/docker-volume-backup-restore/)

**다음 글:** [Docker 볼륨 함정과 해결책: 자주 만나는 문제들](/posts/docker-volume-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
