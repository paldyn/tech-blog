---
title: "docker image ls — 이미지 목록 조회"
description: "docker images 명령으로 로컬 이미지 목록을 조회하는 방법, 출력 컬럼 해석, 댕글링 이미지 식별, --filter와 --format 옵션 활용, 실제 디스크 사용량 확인 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "image", "ls", "images", "dangling", "filter"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-tag/)에서 이미지 태그 구조와 관리 전략을 살펴봤다. 이번에는 로컬에 저장된 이미지 목록을 조회하는 `docker images` (또는 `docker image ls`)를 자세히 살펴본다. 단순한 목록 조회처럼 보이지만 필터와 포맷을 알면 자동화와 디스크 관리에 강력한 도구가 된다.

## 기본 사용법

```bash
# 전체 이미지 목록
docker images

# docker image ls 동일 (권장 형식)
docker image ls

# 특정 이미지만 조회
docker images nginx
```

출력에는 다섯 개 컬럼이 있다.

| 컬럼 | 설명 |
|------|------|
| REPOSITORY | 이미지 이름 (레지스트리/네임스페이스 포함) |
| TAG | 태그 이름 |
| IMAGE ID | 컨텐츠 해시 앞 12자 |
| CREATED | 생성 시점 (상대적 시간) |
| SIZE | 이미지 전체 크기 |

![출력 컬럼 해석](/assets/posts/docker-image-list-output.svg)

## IMAGE ID와 태그 관계

출력에서 IMAGE ID가 같은 항목이 여러 개 나타날 수 있다. 이는 **같은 이미지에 여러 태그가 붙어 있다**는 의미다.

```
REPOSITORY   TAG       IMAGE ID
nginx        alpine    e5e16e1a5897
nginx        latest    e5e16e1a5897  ← 같은 ID
```

두 태그가 동일한 이미지를 가리키므로 실제 디스크 사용량은 한 번만 계산된다. `docker rmi nginx:alpine`을 하면 레이어가 삭제되는 것이 아니라 태그만 제거된다.

## 댕글링 이미지

`<none>:<none>`으로 표시되는 이미지는 **댕글링(dangling) 이미지**다.

```
REPOSITORY   TAG     IMAGE ID
<none>       <none>  c3d4e5f6a7b8
```

두 가지 경우에 발생한다.
- 동일 태그로 이미지를 재빌드하면 이전 이미지의 태그가 새 이미지로 이동하고, 이전 이미지는 이름 없이 남는다.
- 멀티 스테이지 빌드의 중간 레이어

댕글링 이미지는 사용되지 않으므로 정기적으로 정리하는 것이 좋다.

```bash
# 댕글링 이미지만 필터
docker images --filter 'dangling=true'

# 한 번에 삭제
docker image prune

# 또는
docker rmi $(docker images -qf dangling=true)
```

## 필터 옵션

```bash
# 특정 기준 이후 빌드된 이미지
docker images --filter 'since=nginx:1.25'

# 특정 기준 이전 이미지
docker images --filter 'before=myapp:latest'

# 라벨 기반 필터
docker images --filter 'label=maintainer=myteam'
```

![필터 & 포맷 패턴](/assets/posts/docker-image-list-commands.svg)

## 포맷 커스터마이징

`--format` 옵션으로 Go 템플릿을 사용해 원하는 필드만 출력할 수 있다.

```bash
# 이름:태그 목록
docker images --format '{{.Repository}}:{{.Tag}}'

# JSON으로 파이프
docker images --format '{{json .}}' | jq .

# 테이블 형식 (헤더 자동 추가)
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'
```

사용 가능한 필드: `.Repository`, `.Tag`, `.ID`, `.CreatedAt`, `.CreatedSince`, `.Size`, `.Digest`

## ID만 추출하는 -q 옵션

스크립트에서 이미지 ID만 필요할 때 `-q`(quiet) 옵션을 사용한다.

```bash
# 특정 이미지의 ID만
docker images -q myapp

# 전체 이미지 ID 목록
docker images -q
```

이를 활용해 일괄 삭제하는 패턴이 자주 쓰인다.

```bash
# myapp 관련 이미지 전부 삭제
docker rmi $(docker images -q myapp)
```

## 실제 디스크 사용량 확인

`docker images`의 SIZE 컬럼은 공유 레이어를 중복 합산하므로 실제 디스크 사용량과 다를 수 있다. 정확한 사용량은 `docker system df`로 확인한다.

```bash
docker system df

# TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
# Images          12        5         2.3GB     1.1GB (47%)
# Containers      8         3         245MB     180MB (73%)
# Local Volumes   6         3         1.2GB     600MB (50%)
```

`docker system df -v`는 각 이미지별 실제 사용량도 표시한다.

---

**지난 글:** [docker image tag — 이미지 태그 관리](/posts/docker-image-tag/)

<br>
읽어주셔서 감사합니다. 😊
