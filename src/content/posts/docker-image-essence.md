---
title: "Docker 이미지의 본질 — 레이어와 유니온 마운트"
description: "Docker 이미지가 무엇인지 레이어 스택, OverlayFS 유니온 마운트, Copy-on-Write 원리를 중심으로 깊이 이해하고, 이미지와 컨테이너의 관계를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "image", "layers", "overlayfs", "copy-on-write"]
featured: false
draft: false
---

[지난 글](/posts/docker-rename/)에서 컨테이너 이름 변경을 다뤘다. 이번부터는 Docker **이미지**를 집중적으로 파헤친다. `docker run`, `docker build` 같은 명령은 이미 익숙하겠지만, 이미지가 내부적으로 어떻게 구성되고 동작하는지 이해하면 최적화와 트러블슈팅이 훨씬 쉬워진다.

## 이미지란?

Docker 이미지는 **읽기 전용 파일시스템 레이어들의 스택**이다. 가장 단순하게 말하면, 여러 개의 tar 아카이브가 쌓인 구조로 컨테이너 실행에 필요한 파일 시스템과 메타데이터(환경 변수, 기본 명령, 포트 등)를 포함한다.

이미지 자체는 **불변(immutable)** 아티팩트다. 이미지를 실행하면 컨테이너가 생성되고, 컨테이너는 이미지 위에 **쓰기 가능한 레이어를 하나 추가**해 파일 수정을 처리한다.

## 레이어 스택

Dockerfile의 각 명령(FROM, RUN, COPY 등)은 새 레이어를 생성한다.

```dockerfile
FROM python:3.11-slim          # Layer 0: 베이스 이미지 레이어들
RUN apt-get install -y curl    # Layer 1: apt 변경분
RUN pip install fastapi        # Layer 2: pip 설치 변경분
COPY ./app /app                # Layer 3: 앱 코드
```

각 레이어는 이전 레이어 대비 **파일시스템 변경분(diff)**만 담는다. 레이어는 내용 기반 해시(SHA-256)로 식별되므로 동일한 레이어는 여러 이미지가 공유할 수 있다. 같은 베이스 이미지를 사용하는 100개의 이미지가 있어도 베이스 레이어는 디스크에 한 번만 저장된다.

```bash
# 레이어 목록 확인
docker image history myapp:latest

# IMAGE          CREATED BY                    SIZE
# d4e5f6...      COPY ./app /app               12MB
# a1b2c3...      RUN pip install fastapi        85MB
# 7e8f9a...      RUN apt-get install -y curl   45MB
# 2b3c4d...      /bin/sh -c #(nop) FROM...    130MB
```

![이미지 레이어 스택과 OverlayFS](/assets/posts/docker-image-essence-layers.svg)

## OverlayFS와 유니온 마운트

Docker는 여러 레이어를 하나의 파일시스템으로 합쳐 컨테이너에 제공하기 위해 **OverlayFS**를 사용한다. OverlayFS는 Linux 커널의 유니온 마운트 구현체다.

```text
merged = upperdir (쓰기 레이어) + lowerdir (이미지 레이어들)
```

컨테이너 안에서 파일을 보면 마치 단일 파일시스템처럼 보이지만, 실제로는 레이어들이 겹쳐 있다. 조회 시 upperdir를 먼저 확인하고, 없으면 lowerdir를 순서대로 탐색한다.

```bash
# 호스트에서 OverlayFS 마운트 정보 확인
docker inspect <CONTAINER_ID> \
  --format '{{json .GraphDriver.Data}}' | jq .
```

## Copy-on-Write (CoW)

이미지 레이어(lowerdir)는 읽기 전용이다. 컨테이너 안에서 기존 파일을 수정하면 어떻게 될까?

**CoW 동작 과정:**
1. 컨테이너가 lowerdir의 파일을 수정하려 함
2. OverlayFS가 해당 파일을 upperdir로 복사
3. upperdir의 복사본을 수정
4. 이후 읽기는 upperdir 버전을 반환

```bash
# 컨테이너에서 이미지 파일 수정
docker exec myapp sed -i 's/foo/bar/' /etc/app/config.txt

# lowerdir의 원본은 그대로, upperdir에 수정된 복사본 생성
# 이미지 레이어는 변경되지 않음
```

CoW 덕분에 이미지 레이어는 완전히 변경되지 않고, 컨테이너들이 안전하게 공유할 수 있다.

## 이미지 구성 요소

![이미지 개념과 구성 요소](/assets/posts/docker-image-essence-concepts.svg)

Docker 이미지는 세 가지 핵심 요소로 구성된다.

**Manifest:** 레이어 목록과 설정 파일의 다이제스트를 담은 JSON 문서. 레지스트리에서 이미지를 식별하는 인덱스 역할을 한다.

**Config JSON:** ENV, CMD, EXPOSE, ENTRYPOINT, 레이어 히스토리 등 이미지 메타데이터. `docker inspect`로 확인할 수 있는 내용이 여기 있다.

**Layers:** 실제 파일시스템 변경분을 담은 tar.gz 아카이브들. 각각 SHA-256 해시로 식별되며 content-addressable 방식으로 저장된다.

## 이미지 vs 컨테이너

```text
이미지 (불변)
  ├── Layer 0 (읽기 전용)
  ├── Layer 1 (읽기 전용)
  └── Layer N (읽기 전용)
        │
        ▼ docker run
컨테이너 (실행 인스턴스)
  ├── Layer 0 (공유, 읽기 전용)
  ├── Layer 1 (공유, 읽기 전용)
  ├── Layer N (공유, 읽기 전용)
  └── Container Layer (전용, 쓰기 가능) ← 컨테이너 삭제 시 소멸
```

하나의 이미지에서 수십 개의 컨테이너를 실행해도 이미지 레이어는 공유되므로 디스크와 메모리를 효율적으로 사용한다.

컨테이너가 삭제되면 쓰기 레이어(upperdir)도 함께 사라진다. 컨테이너 내부에서 생성한 파일을 영구 보존하려면 반드시 **볼륨** 또는 **바인드 마운트**를 사용해야 한다.

---

**지난 글:** [docker rename — 컨테이너 이름 변경](/posts/docker-rename/)

**다음 글:** [docker image pull — 이미지 내려받기](/posts/docker-image-pull/)

<br>
읽어주셔서 감사합니다. 😊
