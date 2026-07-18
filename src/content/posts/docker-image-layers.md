---
title: "Docker 이미지 레이어 구조 이해하기"
description: "Docker 이미지가 어떻게 레이어로 구성되는지, OverlayFS(UnionFS)가 레이어를 합치는 방식, 읽기 전용 이미지 레이어와 컨테이너 쓰기 레이어의 동작, 레이어 공유로 얻는 디스크 절약 효과를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "layer", "overlayfs", "unionfs", "레이어", "이미지구조"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-import-export/)에서 export/import로 컨테이너 파일 시스템을 다루는 방법을 살펴봤다. export가 레이어를 평탄화한다고 설명했는데, 이번에는 그 '레이어'가 실제로 무엇인지 깊이 살펴본다. 레이어의 동작 원리를 이해하면 Dockerfile 최적화, 빌드 캐시 활용, 이미지 크기 관리가 왜 그렇게 작동하는지 직관적으로 알 수 있다.

## 레이어란 무엇인가

Docker 이미지는 일련의 **변경 집합(Change Set)**으로 이루어진다. 각 변경 집합이 하나의 레이어다. Dockerfile의 `RUN`, `COPY`, `ADD` 같은 파일 시스템을 변경하는 명령은 새로운 레이어를 만든다.

```dockerfile
FROM  debian:bookworm-slim   # → Layer 1: 기반 파일 시스템
RUN   apt-get install nginx  # → Layer 2: 패키지 파일 추가
COPY  nginx.conf /etc/       # → Layer 3: 설정 파일 추가
```

각 레이어는 이전 레이어 대비 추가·수정·삭제된 파일만 기록한다. 완전한 파일 시스템 복사본이 아니다.

## OverlayFS: 레이어를 하나로 합치는 방법

Linux 커널의 **OverlayFS**(또는 그 이전의 AUFS 등 Union File System)가 여러 레이어를 마치 하나의 파일 시스템처럼 보이게 한다.

```text
컨테이너 레이어(RW)    ← 새 파일 쓰기
─────────────────────   ← Union Mount 경계
이미지 Layer 3(RO)
이미지 Layer 2(RO)
이미지 Layer 1(RO)     ← 가장 오래된 베이스
```

OverlayFS는 두 개의 디렉토리를 합친다.

- **lowerdir**: 이미지의 읽기 전용(RO) 레이어들
- **upperdir**: 컨테이너의 쓰기 가능(RW) 레이어 (Container Layer)

파일을 읽을 때는 위에서부터 아래로 검색한다. 상위 레이어에 같은 이름의 파일이 있으면 그것이 우선한다.

![레이어 스택 구조](/assets/posts/docker-image-layers-stack.svg)

## Copy-on-Write (CoW)

컨테이너가 읽기 전용 레이어의 파일을 수정하려 하면 **Copy-on-Write** 방식으로 동작한다.

1. 원본 파일을 컨테이너 쓰기 레이어(upperdir)로 복사한다.
2. 복사된 파일을 수정한다.
3. 이후 읽기는 upperdir의 수정된 파일을 우선 참조한다.
4. 원본 이미지 레이어는 변경되지 않는다.

이 덕분에 같은 이미지를 기반으로 한 컨테이너 100개를 실행해도 이미지 레이어는 하나만 디스크에 존재한다.

## 레이어 공유로 얻는 디스크 절약

같은 베이스 이미지를 사용하는 여러 이미지는 레이어를 공유한다.

```bash
# 두 이미지가 동일한 debian:bookworm-slim 레이어를 공유
docker images
# myapp-web:v1   128MB
# myapp-api:v1   96MB
# (debian:bookworm-slim: 75MB 한 번만 저장)

# 실제 디스크 사용량 확인
docker system df
```

`docker images`의 SIZE 컬럼은 공유 레이어를 중복 합산하므로 실제 디스크보다 더 크게 표시된다. `docker system df -v`로 실제 사용량을 확인할 수 있다.

![레이어 공유 효과](/assets/posts/docker-image-layers-shared.svg)

## 레이어가 생성되지 않는 명령

`CMD`, `ENV`, `EXPOSE`, `LABEL`, `ARG`, `ENTRYPOINT`, `USER`, `WORKDIR`, `VOLUME`(선언만 할 경우)은 파일 시스템을 변경하지 않으므로 크기가 0B인 메타데이터 레이어만 만든다.

```bash
docker image history myapp:latest
# IMAGE    CREATED  CREATED BY           SIZE
# abc123   1 day    CMD ["./app"]         0B   ← 메타데이터
# def456   1 day    COPY app ./          2.1MB
# ghi789   1 day    RUN apt-get install  45MB
```

이 점을 이용해 메타데이터 명령은 자유롭게 사용해도 이미지 크기에 영향을 주지 않는다.

## 레이어를 줄이는 최적화

파일을 추가했다가 같은 `RUN` 안에서 삭제하면 레이어 기록에 남지 않는다. 하지만 별도 `RUN`으로 삭제하면 이전 레이어에는 그 파일이 남아 있어 이미지 크기가 줄지 않는다.

```dockerfile
# 나쁜 예: 캐시 파일이 레이어에 남음
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# 좋은 예: 같은 RUN 안에서 처리
RUN apt-get update \
    && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*
```

레이어 수를 줄이는 것과 레이어를 논리적으로 나누는 것 사이의 균형은 Dockerfile 최적화 글에서 더 자세히 다룬다.

---

**지난 글:** [docker export/import — 컨테이너 스냅샷 활용](/posts/docker-image-import-export/)

**다음 글:** [Docker 이미지 Digest — 불변 참조의 핵심](/posts/docker-image-digest/)

<br>
읽어주셔서 감사합니다. 😊
