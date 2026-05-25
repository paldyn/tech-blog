---
title: "OverlayFS 상세 — 컨테이너 이미지 레이어 스토리지의 원리"
description: "OverlayFS의 upperdir·lowerdir·merged 구조, Copy-on-Write 메커니즘, whiteout 파일을 이용한 삭제 표현, Docker 이미지 레이어 구조, 성능 특성과 실전 트러블슈팅을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "overlayfs", "container", "docker", "copy-on-write", "image-layer", "storage", "filesystem"]
featured: false
draft: false
---

[지난 글](/posts/linux-cgroups-v1-vs-v2/)에서 cgroups로 컨테이너의 리소스를 제한하는 방법을 배웠습니다. 이번에는 컨테이너 기술의 세 번째 핵심 기반인 **OverlayFS** — Docker 이미지 레이어의 실제 스토리지 구현을 살펴봅니다.

## OverlayFS란

OverlayFS는 여러 디렉터리를 **하나의 통합된 뷰**로 겹쳐 보이게 하는 리눅스 파일시스템입니다. Linux 3.18(2014년)에 메인라인에 포함됐으며, Docker의 기본 스토리지 드라이버(`overlay2`)로 사용됩니다.

핵심 개념:
- **lowerdir**: 읽기 전용 하위 레이어 (이미지 레이어들)
- **upperdir**: 쓰기 가능한 상위 레이어 (컨테이너 레이어)
- **workdir**: 내부 작업용 디렉터리 (upperdir와 같은 파일시스템)
- **merged**: 최종적으로 보이는 통합 뷰

![OverlayFS 레이어 구조](/assets/posts/linux-overlayfs-detail-layers.svg)

## 마운트 방법

```bash
# 디렉터리 준비
mkdir -p /tmp/overlay/{lower1,lower2,upper,work,merged}
echo "from lower1" > /tmp/overlay/lower1/file1.txt
echo "from lower2" > /tmp/overlay/lower2/file2.txt

# OverlayFS 마운트
sudo mount -t overlay overlay \
  -o lowerdir=/tmp/overlay/lower1:/tmp/overlay/lower2,\
upperdir=/tmp/overlay/upper,\
workdir=/tmp/overlay/work \
  /tmp/overlay/merged

# merged에서 두 lower의 파일이 보임
ls /tmp/overlay/merged/
# file1.txt  file2.txt
```

lowerdir는 콜론(`:`)으로 여러 개를 지정할 수 있습니다. 앞에 쓴 것이 우선순위가 높습니다.

## Copy-on-Write (CoW) 메커니즘

파일을 수정할 때 lowerdir의 원본을 직접 수정하지 않습니다. 대신:

1. lowerdir에서 해당 파일을 upperdir로 **복사**
2. upperdir의 복사본을 수정
3. merged에서는 upperdir의 버전이 보임

![Copy-on-Write와 Whiteout](/assets/posts/linux-overlayfs-detail-cow.svg)

```bash
# merged에서 lowerdir 파일 수정
echo "modified" > /tmp/overlay/merged/file1.txt

# upper에 복사본이 생성됨
ls -la /tmp/overlay/upper/
# file1.txt (수정된 버전)

# lower의 원본은 그대로
cat /tmp/overlay/lower1/file1.txt
# from lower1 (변경 없음)
```

이 덕분에 수백 개의 컨테이너가 같은 이미지 레이어를 공유해도 서로 영향을 주지 않습니다.

## Whiteout — 삭제 표현

lowerdir는 읽기 전용이라 직접 삭제할 수 없습니다. 삭제는 upper에 특수 파일(whiteout)을 생성하여 표현합니다.

```bash
# merged에서 lowerdir 파일 삭제
rm /tmp/overlay/merged/file2.txt

# upper에 whiteout 파일 생성 확인
ls -la /tmp/overlay/upper/
# .wh.file2.txt (char device 0,0)

# merged에서는 안 보임
ls /tmp/overlay/merged/
# file1.txt (file2.txt 없음)

# lower2에는 원본이 그대로
ls /tmp/overlay/lower2/
# file2.txt
```

디렉터리를 삭제하거나 처음부터 새로 만들 때는 **opaque whiteout**을 씁니다.

```bash
# opaque whiteout: 해당 디렉터리 아래 lower 전체 숨김
# upper/.wh..wh..opq 파일 생성
```

## Docker 이미지 레이어와 OverlayFS

```dockerfile
FROM ubuntu:22.04           # Layer 1 (base)
RUN apt install nginx       # Layer 2
ENV NGINX_VERSION=1.24      # Layer 3
COPY ./app /var/www/html    # Layer 4
```

각 `RUN`, `COPY`, `ADD` 명령은 새 레이어를 생성합니다. Docker는 이 레이어들을 lowerdir로 쌓고, 컨테이너 실행 시 upperdir(쓰기 레이어)를 추가합니다.

```bash
# 컨테이너의 OverlayFS 마운트 정보 확인
docker inspect mycontainer | grep -A20 GraphDriver

# 출력 예:
# "LowerDir": "/var/lib/docker/overlay2/abc.../diff:...",
# "UpperDir": "/var/lib/docker/overlay2/xyz.../diff",
# "WorkDir":  "/var/lib/docker/overlay2/xyz.../work",
# "MergedDir":"/var/lib/docker/overlay2/xyz.../merged"

# 실제 overlay 마운트 확인
mount | grep overlay
```

## 이미지 레이어 공유와 절약

```bash
# 두 이미지가 같은 base를 공유하는 경우
docker images --format "table {{.Repository}}\t{{.Size}}"

# 실제 디스크 사용량 (공유 레이어 제외)
docker system df -v

# 레이어 히스토리 (각 레이어 크기)
docker history ubuntu:22.04
```

Ubuntu 22.04(100MB)를 기반으로 한 nginx 이미지(60MB)와 Node.js 이미지(200MB)가 있다면, 실제 디스크 사용량은 360MB가 아니라 360MB - 공유된 ubuntu 레이어 크기입니다.

## 성능 특성과 주의사항

OverlayFS의 CoW는 파일을 처음 수정할 때만 복사 비용이 발생합니다. 이후에는 upperdir에서 직접 읽고 씁니다.

```bash
# 큰 파일 수정 시 CoW 비용 측정
time cp /tmp/large_file /tmp/overlay/merged/

# 데이터베이스처럼 자주 쓰는 경우: bind mount 권장
docker run -v /data/mysql:/var/lib/mysql mysql
```

성능 고려사항:
- **작은 파일 다수**: lower에서 upper로 복사가 많아 느릴 수 있음
- **대용량 파일 수정**: 수 GB 파일의 첫 수정은 전체 복사 발생
- **데이터베이스**: OverlayFS 위에서 운영하면 성능 저하 → volume 마운트 사용

## 컨테이너 레이어 크기 관리

```bash
# 컨테이너 레이어 크기
docker ps -s

# 불필요한 레이어 정리 (Dockerfile 최적화)
# 나쁜 예: 레이어 3개 생성
RUN apt install vim
RUN apt install curl
RUN apt install git

# 좋은 예: 레이어 1개 생성
RUN apt install vim curl git && \
    apt clean && rm -rf /var/lib/apt/lists/*
```

## 언마운트와 정리

```bash
# OverlayFS 언마운트
sudo umount /tmp/overlay/merged

# upper의 변경사항만 확인 (diff)
ls -la /tmp/overlay/upper/

# 컨테이너 삭제 시 upper(컨테이너 레이어)만 삭제
# lower(이미지 레이어)는 이미지가 남아 있는 한 보존
docker rm mycontainer  # upper만 삭제
docker rmi myimage     # lower(이미지 레이어) 삭제
```

---

**지난 글:** [cgroups v1 vs v2 — 리소스 제한의 두 세대 비교](/posts/linux-cgroups-v1-vs-v2/)

<br>
읽어주셔서 감사합니다. 😊
