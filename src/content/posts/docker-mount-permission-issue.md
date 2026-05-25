---
title: "Docker 볼륨 마운트 권한 문제 해결"
description: "컨테이너 프로세스의 UID와 호스트 디렉터리 소유자가 달라서 발생하는 Permission Denied를 chown, --user 플래그, Dockerfile ARG, ENTRYPOINT gosu 패턴으로 해결합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "volume", "bind-mount", "permission", "uid", "gosu", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-port-already-in-use/)에서 포트 충돌 문제를 해결했다. 이번에는 볼륨을 마운트했을 때 컨테이너 내부에서 파일을 읽거나 쓰지 못하는 **마운트 권한 문제**를 다룬다. 보안을 위해 non-root 유저로 실행하도록 Dockerfile을 작성하면 필연적으로 마주치는 문제다.

## 에러 패턴

```
open /app/data/config.json: permission denied

또는

mkdir: cannot create directory '/app/data': Permission denied
```

컨테이너는 정상 실행됐지만 마운트된 디렉터리나 파일에 접근할 때 권한 에러가 발생한다.

## 원인: UID 불일치

![UID 불일치로 인한 마운트 권한 문제](/assets/posts/docker-mount-permission-issue-uid.svg)

Docker는 **이름이 아닌 UID/GID 번호**로 권한을 판단한다. 호스트의 `alice`(UID 1000)와 컨테이너의 `appuser`(UID 999)는 이름이 달라도 번호가 다르면 별개의 사용자다.

```bash
# 호스트 사용자 UID 확인
id
# uid=1000(alice) gid=1000(alice)

# 컨테이너 내부에서 확인
docker exec <컨테이너명> id
# uid=999(appuser) gid=999(appgroup)

# 마운트된 디렉터리 권한
docker exec <컨테이너명> ls -la /app/data
# drwxr-xr-x 1000 1000 data  ← 컨테이너의 999가 쓸 수 없음
```

## 해결 방법

### 방법 1: 호스트 디렉터리 소유권 변경

```bash
# 컨테이너의 appuser UID(999)로 소유권 변경
sudo chown -R 999:999 ./data

# 실행
docker run -v $(pwd)/data:/app/data myapp
```

가장 직접적인 방법이지만 호스트 파일의 소유자가 바뀐다.

### 방법 2: --user 플래그로 호스트 UID 사용

```bash
# 현재 호스트 사용자 UID로 컨테이너 실행
docker run --user $(id -u):$(id -g) \
  -v $(pwd)/data:/app/data \
  myapp
```

호스트 UID와 컨테이너 프로세스 UID를 맞춰서 권한 충돌을 없앤다. 단, 컨테이너 내 앱이 루트 권한을 요구하는 경우에는 쓸 수 없다.

### 방법 3: Dockerfile에서 ARG로 UID를 빌드 시 주입

```dockerfile
FROM node:20-alpine

ARG UID=1000
ARG GID=1000

RUN addgroup -g $GID appgroup \
    && adduser -u $UID -G appgroup -S appuser

WORKDIR /app
RUN chown appuser:appgroup /app

USER appuser
```

```bash
# 빌드 시 호스트 UID 전달
docker build --build-arg UID=$(id -u) --build-arg GID=$(id -g) -t myapp .
```

빌드 시점에 UID를 맞추는 가장 깔끔한 방법이다. 팀원마다 UID가 다를 수 있는 환경에서 유용하다.

### 방법 4: ENTRYPOINT에서 gosu로 권한 처리

```bash
# gosu 설치
RUN apk add --no-cache gosu  # alpine
# 또는
RUN apt-get install -y gosu   # debian
```

```bash
#!/bin/sh
# entrypoint.sh
set -e

# Named volume이 root로 생성됐을 때 소유자 수정
chown -R appuser:appgroup /app/data

# 이후 appuser로 프로세스 전환 (PID 1 유지)
exec gosu appuser "$@"
```

```dockerfile
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
```

Named Volume은 처음 생성될 때 root 소유로 만들어진다. entrypoint에서 `chown`으로 소유권을 바꾸고 `gosu`로 non-root 사용자로 전환하면 이 문제를 해결할 수 있다.

## Named Volume 권한 문제

![Named Volume 권한 초기화 패턴](/assets/posts/docker-mount-permission-issue-volume.svg)

```bash
# Named Volume 내부 권한 확인
docker run --rm -v myvolume:/data alpine ls -la /data

# root 소유인 경우
# drwxr-xr-x    2 root     root          4096 ...

# 임시 컨테이너로 소유권 변경
docker run --rm -v myvolume:/data alpine chown -R 999:999 /data
```

## Compose에서의 권한 설정

```yaml
services:
  app:
    image: myapp
    user: "${UID:-1000}:${GID:-1000}"
    volumes:
      - ./data:/app/data
```

```bash
# 실행 시 호스트 UID/GID 전달
UID=$(id -u) GID=$(id -g) docker compose up
```

또는 `.env` 파일에 미리 저장한다:

```bash
# .env
UID=1000
GID=1000
```

## SELinux 환경에서의 마운트

RHEL/Fedora에서 SELinux를 사용하는 경우 bind mount에 `:z` 또는 `:Z` 레이블을 추가해야 한다.

```bash
# :z — 볼륨을 컨테이너간 공유 가능하게 레이블
docker run -v $(pwd)/data:/app/data:z myapp

# :Z — 볼륨을 이 컨테이너 전용으로 레이블
docker run -v $(pwd)/data:/app/data:Z myapp
```

SELinux 없는 환경에서는 `:z`, `:Z`를 쓰지 않아도 된다.

---

**지난 글:** [Docker Port Already in Use 에러 해결](/posts/docker-port-already-in-use/)

**다음 글:** [Docker OOM Kill 해결 — 컨테이너 메모리 부족](/posts/docker-killed-oom/)

<br>
읽어주셔서 감사합니다. 😊
