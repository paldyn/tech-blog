---
title: "Docker 볼륨 기초: 데이터를 컨테이너 밖에서 관리하기"
description: "컨테이너가 삭제되면 데이터도 사라지는 문제를 Docker 볼륨으로 해결하는 방법을 기초부터 정리합니다. 볼륨 생성·마운트·삭제 명령어와 -v, --mount 차이를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "volume", "볼륨", "데이터 영속성", "storage"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-anti-patterns/)에서 Dockerfile 안티 패턴을 살펴봤다. 이번 글부터는 **볼륨(Volume)** 섹션으로 넘어간다. 컨테이너는 기본적으로 에페메럴(ephemeral)하다. 컨테이너를 삭제하면 그 안에 쌓인 데이터도 함께 사라진다. 데이터베이스 파일, 업로드된 이미지, 로그 같이 컨테이너 생명 주기와 무관하게 보존해야 하는 데이터를 다루려면 볼륨이 필요하다.

## 문제: 컨테이너 레이어는 임시다

Docker 이미지는 읽기 전용 레이어로 구성된다. 컨테이너를 실행하면 그 위에 얇은 쓰기 가능 레이어가 추가된다. 컨테이너 안에서 파일을 생성하거나 변경하면 이 레이어에 기록된다. 문제는 `docker rm`으로 컨테이너를 지우면 이 쓰기 레이어도 함께 삭제된다는 점이다.

```bash
# 컨테이너 안에서 파일 생성
docker run --name test-container ubuntu bash -c "echo 'hello' > /data/test.txt"

# 컨테이너 삭제
docker rm test-container

# 다시 실행해도 test.txt는 없다
docker run --name test-container ubuntu ls /data/
# ls: cannot access '/data/': No such file or directory
```

![볼륨이 필요한 이유](/assets/posts/docker-volume-basics-concept.svg)

## 볼륨이란

볼륨은 Docker가 관리하는 호스트 파일시스템 내의 특정 디렉터리다. 컨테이너와 독립적으로 존재하므로 컨테이너가 삭제되어도 볼륨은 남는다. 여러 컨테이너가 같은 볼륨을 동시에 마운트할 수도 있다.

- 컨테이너 생명주기와 분리된 독립적인 데이터 저장소
- Docker 데몬이 `/var/lib/docker/volumes/` 경로에서 관리 (Linux 기준)
- Windows·Mac에서는 Docker Desktop 내부 VM이 해당 경로를 관리

## 볼륨 기본 명령어

![볼륨 기본 명령어](/assets/posts/docker-volume-basics-commands.svg)

```bash
# 볼륨 생성
docker volume create my-data

# 볼륨 목록 확인
docker volume ls
# DRIVER    VOLUME NAME
# local     my-data

# 볼륨 상세 정보
docker volume inspect my-data
# [
#   {
#     "Name": "my-data",
#     "Driver": "local",
#     "Mountpoint": "/var/lib/docker/volumes/my-data/_data",
#     ...
#   }
# ]

# 볼륨 삭제
docker volume rm my-data

# 사용 중이 아닌 볼륨 일괄 삭제
docker volume prune
```

## 볼륨을 컨테이너에 마운트하기

볼륨을 컨테이너에 연결하는 방법은 두 가지다.

### `-v` 플래그 (단축 문법)

```bash
docker run -d \
  -v my-data:/app/data \
  --name web \
  nginx
```

형식은 `볼륨이름:컨테이너경로`다. 볼륨이 없으면 자동으로 생성된다.

### `--mount` 플래그 (명시적 문법)

```bash
docker run -d \
  --mount type=volume,source=my-data,target=/app/data \
  --name web \
  nginx
```

`--mount`는 키=값 형식으로 파라미터를 명시해 의도가 명확하다. 특히 여러 사람이 작업하는 프로젝트나 스크립트에서 가독성이 높다.

## 볼륨 데이터 확인

마운트한 볼륨에 실제로 데이터가 저장되는지 확인해보자.

```bash
# 볼륨을 마운트해서 컨테이너 실행
docker run --name writer \
  -v my-data:/app/data \
  ubuntu \
  bash -c "echo 'persistent data' > /app/data/test.txt"

# 컨테이너 삭제
docker rm writer

# 새 컨테이너에서 같은 볼륨을 마운트하면 데이터가 살아있다
docker run --rm \
  -v my-data:/app/data \
  ubuntu \
  cat /app/data/test.txt
# persistent data
```

컨테이너가 삭제된 뒤에도 볼륨에 기록한 파일은 그대로 남아있다.

## 볼륨 vs 이미지 내장 데이터

볼륨을 마운트하는 경로에 이미지 안에 파일이 있으면 어떻게 될까?

```bash
# nginx 이미지는 /usr/share/nginx/html에 기본 HTML이 있다
docker run -d -v my-data:/usr/share/nginx/html nginx
```

- 볼륨이 **비어있으면**: 이미지의 기존 파일이 볼륨으로 복사된다 (초기화)
- 볼륨에 이미 데이터가 있으면: 볼륨 내용이 이미지 내용보다 우선한다

이 동작은 named volume에서만 적용된다. bind mount는 호스트 디렉터리를 그대로 덮어씌운다.

## 실습: PostgreSQL 데이터 보존

볼륨의 실제 사용 예시로 PostgreSQL을 들어보자.

```bash
# 볼륨 생성
docker volume create pgdata

# PostgreSQL 컨테이너 실행
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16

# DB에 데이터 추가 후 컨테이너 삭제 및 재시작해도 데이터 유지
docker stop postgres && docker rm postgres

docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16
# 이전 데이터가 그대로 남아있다
```

## 핵심 정리

- 컨테이너 쓰기 레이어는 컨테이너와 함께 삭제된다 → 볼륨으로 해결
- `docker volume create` → `docker run -v` 또는 `--mount`로 마운트
- 볼륨은 컨테이너 삭제 후에도 독립적으로 존재
- 비어있는 볼륨에는 이미지의 기존 파일이 초기화됨
- 프로덕션에서 DB·파일 업로드·설정 등 중요 데이터는 반드시 볼륨 사용

---

**다음 글:** [Docker 볼륨 종류: Named, Anonymous, Bind Mount, tmpfs 비교](/posts/docker-volume-types/)

<br>
읽어주셔서 감사합니다. 😊
