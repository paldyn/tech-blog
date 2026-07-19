---
title: "Named Volume 완전 정복: 이름 있는 볼륨 생성·관리"
description: "Docker Named Volume의 생성부터 마운트, 공유, 삭제까지 생명주기 전반을 실전 명령어와 함께 정리합니다. 여러 컨테이너 간 볼륨 공유 패턴도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "volume", "named volume", "볼륨", "데이터 관리"]
featured: false
draft: false
---

[지난 글](/posts/docker-volume-types/)에서 Docker 마운트 유형 4가지를 비교했다. 이번에는 가장 많이 쓰이는 **Named Volume**을 심도 있게 다룬다. Named Volume은 사람이 읽을 수 있는 이름을 가진 볼륨으로, Docker 데몬이 생명주기를 관리하며 컨테이너와 독립적으로 존재한다.

## Named Volume이란

Named Volume은 `docker volume create` 명령이나 `docker run -v 이름:경로`로 생성하는 볼륨이다. 이름이 있어서 다른 컨테이너가 같은 볼륨을 참조할 수 있고, `docker volume` 명령으로 명시적으로 관리할 수 있다.

![Named Volume 생명주기](/assets/posts/docker-volume-named-lifecycle.svg)

## 볼륨 생성

```bash
# 기본 로컬 드라이버로 생성
docker volume create my-data

# 드라이버와 레이블 지정
docker volume create \
  --driver local \
  --label env=production \
  --label app=myapp \
  my-data
```

`docker volume create` 없이 `docker run -v my-data:/path`를 실행해도 볼륨이 없으면 자동 생성된다.

## 볼륨 목록·상세 조회

```bash
# 전체 볼륨 목록
docker volume ls

# 레이블 필터
docker volume ls --filter label=env=production

# 드라이버 필터
docker volume ls --filter driver=local

# 상세 정보 (JSON)
docker volume inspect my-data
```

`inspect` 출력에서 중요한 필드:

```json
{
  "Name": "my-data",
  "Driver": "local",
  "Mountpoint": "/var/lib/docker/volumes/my-data/_data",
  "Labels": { "env": "production" },
  "Scope": "local"
}
```

`Mountpoint`가 호스트에서 실제 파일이 저장되는 경로다. 루트 권한이 있으면 직접 접근할 수 있다.

## 컨테이너에 마운트

```bash
# -v 문법
docker run -d \
  --name app \
  -v my-data:/app/data \
  my-app-image

# --mount 문법 (더 명시적)
docker run -d \
  --name app \
  --mount type=volume,source=my-data,target=/app/data \
  my-app-image

# 읽기 전용 마운트
docker run -d \
  --name reader \
  -v my-data:/app/data:ro \
  my-app-image
```

## 여러 컨테이너 공유

![Named Volume — 여러 컨테이너 공유](/assets/posts/docker-volume-named-sharing.svg)

같은 Named Volume을 여러 컨테이너가 동시에 마운트할 수 있다.

```bash
# 볼륨 생성
docker volume create shared-data

# 쓰기 컨테이너
docker run -d \
  --name writer \
  -v shared-data:/data \
  ubuntu bash -c "while true; do date >> /data/log.txt; sleep 5; done"

# 읽기 컨테이너 (같은 볼륨)
docker run -it \
  --name reader \
  -v shared-data:/data:ro \
  ubuntu tail -f /data/log.txt
```

동시 쓰기 시 파일 잠금이 없으면 데이터 손상이 발생할 수 있다. 애플리케이션 레벨의 잠금 메커니즘(DB, 파일 잠금 등)을 반드시 구현해야 한다.

## 볼륨 복사 패턴

새 컨테이너가 이전 컨테이너의 볼륨 데이터를 이어받아야 할 때 `--volumes-from`을 사용할 수 있다.

```bash
# 원본 컨테이너 볼륨 마운트 복사
docker run --volumes-from original-container \
  --name new-container \
  ubuntu

# 단, --volumes-from은 deprecated 패턴이다
# 아래처럼 Named Volume을 직접 지정하는 것이 명확하다
docker run -v original-data:/data --name new-container ubuntu
```

## 볼륨 삭제

```bash
# 특정 볼륨 삭제 (사용 중이면 실패)
docker volume rm my-data

# 강제 삭제 (없는 볼륨·드라이버 오류 무시 — 사용 중인 볼륨은 -f로도 삭제 불가)
docker volume rm -f my-data

# 모든 미사용 볼륨 삭제
docker volume prune

# 레이블 기반 선택 삭제
docker volume prune --filter label=env=test
```

사용 중인 볼륨(컨테이너가 마운트한 볼륨)은 컨테이너를 먼저 삭제하지 않는 한 `docker volume rm`으로 삭제되지 않는다.

## Compose에서 Named Volume

Docker Compose에서 Named Volume을 선언하면 서비스 간 공유가 편하다.

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data

  backup:
    image: my-backup-tool
    volumes:
      - pgdata:/backup/source:ro

volumes:
  pgdata:
    driver: local
```

`volumes:` 최상위 섹션에 선언된 볼륨은 Compose 프로젝트 이름 접두사가 붙어 생성된다 (`projectname_pgdata`).

## 핵심 정리

- Named Volume은 `docker volume create` 또는 `-v 이름:경로`로 생성
- 컨테이너 삭제 후에도 볼륨은 자동 삭제되지 않는다
- `docker volume inspect`로 실제 저장 경로 확인
- 여러 컨테이너가 같은 볼륨 공유 가능 → 동시 쓰기에는 잠금 필요
- `docker volume prune`으로 미사용 볼륨 정리

---

**지난 글:** [Docker 볼륨 종류: Named, Anonymous, Bind Mount, tmpfs 비교](/posts/docker-volume-types/)

**다음 글:** [Anonymous Volume 이해하기: 컨테이너와 함께 사는 볼륨](/posts/docker-volume-anonymous/)

<br>
읽어주셔서 감사합니다. 😊
