---
title: "Docker 스토리지 드라이버: overlay2 완전 정복"
description: "overlay2·vfs·btrfs·zfs 드라이버 비교, OverlayFS의 upper/lower/merged 디렉터리 구조, CoW 동작, 드라이버 확인 및 변경 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "storage-driver", "overlay2", "overlayfs", "CoW", "레이어", "스토리지드라이버"]
featured: false
draft: false
---

[지난 글](/posts/docker-logging-drivers/)에서 로그 드라이버를 살펴봤다. 이번에는 Docker 이미지와 컨테이너 데이터가 실제 디스크에 어떻게 저장되는지 제어하는 **스토리지 드라이버**를 정리한다.

## 스토리지 드라이버란

Docker 이미지는 레이어(layer)로 구성된다. 스토리지 드라이버는 이 레이어들을 디스크에 관리하고 컨테이너가 실행될 때 하나의 통합 파일 시스템으로 제공하는 역할을 한다.

현재 권장되는 기본 드라이버는 **overlay2**다. 리눅스 커널에 내장된 OverlayFS를 사용하며, 성능과 안정성 모두 좋다.

## overlay2 구조

overlay2는 이미지 레이어를 **lower directories**(읽기 전용), 컨테이너 쓰기 레이어를 **upper directory**(읽기/쓰기), 그리고 이 둘을 합성한 **merged view**로 구성한다.

![overlay2 레이어 구조](/assets/posts/docker-storage-drivers-overlay2.svg)

컨테이너가 파일을 읽으면 merged view에서 상위 레이어(upper)부터 순서대로 찾는다. upper에 없으면 하위 lower 레이어에서 찾는다.

## Copy-on-Write (CoW)

읽기 전용 레이어의 파일을 수정하면 **전체 파일을 upper directory로 복사한 다음 수정**한다. 이것이 CoW(Copy-on-Write)다.

이 덕분에 여러 컨테이너가 같은 이미지 레이어를 공유할 수 있다. 100개의 nginx 컨테이너를 실행해도 nginx 바이너리는 디스크에 한 번만 저장된다.

**파일 삭제**는 lower 레이어에서 실제로 제거하지 않고 upper 디렉터리에 **whiteout 파일**을 생성해 merged view에서 숨긴다.

## 실제 디렉터리 구조

```bash
# overlay2 저장 위치
ls /var/lib/docker/overlay2/

# 특정 컨테이너의 레이어 확인
docker inspect <container> \
  --format '{{json .GraphDriver.Data}}' | python3 -m json.tool

# 출력 예시
{
  "LowerDir": "/var/lib/docker/overlay2/abc.../diff:...",
  "MergedDir": "/var/lib/docker/overlay2/xyz.../merged",
  "UpperDir": "/var/lib/docker/overlay2/xyz.../diff",
  "WorkDir": "/var/lib/docker/overlay2/xyz.../work"
}
```

`WorkDir`은 OverlayFS 내부 작업 디렉터리로 파일 이동 원자성을 위해 필요하다.

## 드라이버 확인 및 변경

```bash
# 현재 사용 중인 스토리지 드라이버 확인
docker info --format '{{.Driver}}'

# 상세 정보
docker info | grep -A 5 "Storage Driver"
```

변경이 필요하면 `/etc/docker/daemon.json`에서 설정한다.

```json
{
  "storage-driver": "overlay2"
}
```

변경 후 `sudo systemctl restart docker`가 필요하다. **기존 이미지와 컨테이너 데이터가 이전되지 않으므로** 변경 전 데이터를 백업하거나 `docker system prune`으로 정리한다.

## 드라이버별 특징

![스토리지 드라이버 비교](/assets/posts/docker-storage-drivers-compare.svg)

**overlay2가 작동하지 않는 경우** — XFS를 사용하는데 `ftype=0`으로 포맷된 경우다.

```bash
# xfs ftype 확인
xfs_info /var/lib/docker | grep ftype

# ftype=0이면 overlay2 불가 — 재포맷 또는 vfs로 변경
```

## 성능 고려사항

**쓰기 집중 작업** — 데이터베이스처럼 파일을 자주 수정하는 서비스는 CoW 오버헤드가 있다. 이런 경우 데이터를 Docker volume에 저장하면 스토리지 드라이버를 거치지 않아 성능이 좋다.

**레이어 수** — Dockerfile 레이어가 많을수록 LowerDir 스택이 깊어진다. overlay2는 최대 128개 lower layer를 지원한다. 실제로는 수십 개 정도면 성능 차이가 거의 없다.

**메모리 사용** — OverlayFS는 페이지 캐시를 공유한다. 같은 파일을 여러 컨테이너가 읽으면 캐시도 공유되어 메모리 효율이 좋다.

## 레이어 디스크 사용량 확인

```bash
# 이미지별 레이어 크기
docker image ls --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# 이미지 레이어 상세 (각 레이어 크기 포함)
docker image history <image>

# 전체 Docker 디스크 사용량
docker system df
docker system df -v   # 상세 (이미지·컨테이너·볼륨별)
```

---

**지난 글:** [Docker 로깅 드라이버: 로그 수집·전달 완전 정복](/posts/docker-logging-drivers/)

**다음 글:** [docker system prune: 사용하지 않는 리소스 일괄 정리](/posts/docker-system-prune/)

<br>
읽어주셔서 감사합니다. 😊
