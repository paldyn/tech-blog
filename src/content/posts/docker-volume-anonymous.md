---
title: "Anonymous Volume 이해하기: 컨테이너와 함께 사는 볼륨"
description: "Docker Anonymous Volume이 생성·삭제되는 시점을 생명주기 관점에서 설명합니다. Dockerfile VOLUME 지시어와의 관계, 고아 볼륨 문제와 관리 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "volume", "anonymous volume", "익명 볼륨", "dockerfile volume"]
featured: false
draft: false
---

[지난 글](/posts/docker-volume-named/)에서 Named Volume을 깊이 살펴봤다. 이번에는 이름이 없는 **Anonymous Volume(익명 볼륨)**을 다룬다. 익명 볼륨은 공식적으로 덜 주목받지만, Dockerfile에서 `VOLUME` 지시어를 쓰면 자동으로 생성되므로 알지 못하면 디스크를 조용히 채울 수 있다.

## Anonymous Volume이란

이름을 지정하지 않고 생성된 볼륨이다. Docker가 SHA256 해시 일부를 이름으로 자동 부여한다. `docker volume ls`에서 아래처럼 보인다.

```bash
docker volume ls
# DRIVER    VOLUME NAME
# local     3b7c9f2a1e8d4c6f...  ← 익명 볼륨
# local     my-named-data         ← Named Volume
```

## 어떻게 생성되나

```bash
# 방법 1: -v에 컨테이너 경로만 지정
docker run -v /app/cache my-app

# 방법 2: --mount type=volume, source 없음
docker run --mount type=volume,target=/app/cache my-app
```

그리고 가장 흔한 경로는 **Dockerfile의 `VOLUME` 지시어**다.

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
VOLUME /app/node_modules   # 이 줄이 익명 볼륨을 자동 생성한다
CMD ["node", "server.js"]
```

이미지를 `docker run`으로 실행할 때마다 `/app/node_modules`에 해당하는 익명 볼륨이 자동 생성된다.

## 생명주기

![Anonymous Volume 생명주기](/assets/posts/docker-volume-anonymous-lifecycle.svg)

핵심은 `--rm` 유무에 따른 차이다.

```bash
# --rm 있음: 컨테이너 종료 시 익명 볼륨도 함께 삭제
docker run --rm -v /tmp/cache my-app

# --rm 없음: 컨테이너 삭제해도 익명 볼륨은 남는다
docker run -v /tmp/cache my-app
docker rm my-app
# 볼륨은 고아 상태로 남음
```

`--rm`은 컨테이너를 종료할 때 Anonymous Volume도 함께 삭제한다. Named Volume은 `--rm`이 있어도 삭제되지 않는다.

## Named Volume vs Anonymous Volume

![Anonymous Volume vs Named Volume](/assets/posts/docker-volume-anonymous-vs-named.svg)

Named Volume이 훨씬 유연하고 관리하기 쉽다. Anonymous Volume을 의도적으로 사용하는 경우는 거의 없다. 대부분은 Dockerfile `VOLUME` 지시어가 자동 생성하는 부산물이다.

## 고아 볼륨 문제

컨테이너를 `docker rm`하면 익명 볼륨이 남는다. 이를 **고아 볼륨(orphan volume)**이라 한다.

```bash
# 고아 볼륨 확인
docker volume ls --filter dangling=true

# 고아 볼륨 모두 삭제
docker volume prune

# 컨테이너 삭제와 익명 볼륨 함께 삭제 (-v 옵션)
docker rm -v my-container
```

`docker rm -v`는 해당 컨테이너에만 연결된 익명 볼륨을 함께 삭제한다. Named Volume은 영향받지 않는다.

## Dockerfile VOLUME의 함정

```dockerfile
# 이 Dockerfile로 이미지를 빌드하면
FROM mysql:8
VOLUME /var/lib/mysql   # 이미지에 이미 선언되어 있음
```

`docker run mysql:8`을 실행할 때마다 새 익명 볼륨이 `/var/lib/mysql`에 마운트된다. `-v mydb:/var/lib/mysql`처럼 명시적으로 Named Volume을 지정하지 않으면 컨테이너마다 새 볼륨이 생긴다.

```bash
# 잘못된 방법: 매번 새 익명 볼륨 생성
docker run -d --name db mysql:8

# 올바른 방법: Named Volume으로 데이터 보존
docker run -d --name db -v mydb:/var/lib/mysql mysql:8
```

공식 MySQL, PostgreSQL, MongoDB 이미지 모두 `VOLUME` 지시어가 포함되어 있다. 반드시 Named Volume을 명시해야 한다.

## 익명 볼륨을 Named Volume으로 전환

이미 생성된 익명 볼륨의 데이터를 Named Volume으로 옮기려면:

```bash
# 1. 익명 볼륨 이름 확인
docker inspect my-container --format '{{json .Mounts}}'
# [{"Type":"volume","Name":"3b7c9f...","Source":"/var/lib/docker/volumes/3b7c9f.../_data",...}]

# 2. 새 Named Volume 생성 후 데이터 복사
docker run --rm \
  -v 3b7c9f...:/from \
  -v my-named-vol:/to \
  alpine sh -c "cp -a /from/. /to/"

# 3. 이후 Named Volume으로 컨테이너 재실행
docker run -v my-named-vol:/app/data my-app
```

## 핵심 정리

- Anonymous Volume은 이름 없이 생성되는 볼륨, Docker가 해시 이름 부여
- `VOLUME` 지시어 또는 `-v /path`로 자동 생성
- `--rm`이 있으면 컨테이너 종료 시 함께 삭제, 없으면 고아 볼륨으로 남음
- MySQL, PostgreSQL 등 공식 이미지는 `VOLUME` 선언 있음 → Named Volume 명시 필수
- `docker volume prune`으로 주기적으로 고아 볼륨 정리 필요

---

**지난 글:** [Named Volume 완전 정복: 이름 있는 볼륨 생성·관리](/posts/docker-volume-named/)

**다음 글:** [Bind Mount 완전 정복: 호스트 디렉터리를 컨테이너에 마운트](/posts/docker-bind-mount/)

<br>
읽어주셔서 감사합니다. 😊
