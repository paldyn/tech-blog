---
title: "OverlayFS — 컨테이너 파일시스템의 비밀"
description: "Docker가 이미지 레이어를 어떻게 쌓고 공유하는지, OverlayFS의 lowerdir·upperdir·merged 구조와 Copy-on-Write 메커니즘을 실습과 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "overlayfs", "storage-driver", "layer", "copy-on-write", "container-internals"]
featured: false
draft: false
---

[지난 글](/posts/docker-namespaces-cgroups/)에서 Namespace와 cgroups로 컨테이너가 격리되는 원리를 살펴봤다. 이번에는 그 격리된 공간에 파일시스템을 제공하는 **OverlayFS**를 들여다본다. `docker pull`로 받은 이미지가 어떻게 레이어로 나뉘고, 여러 컨테이너가 같은 이미지를 공유하면서도 각자 독립적인 파일 변경을 가질 수 있는지를 이해한다.

## OverlayFS란

OverlayFS는 Linux 3.18에 커널 메인라인에 포함된 **유니온 파일시스템**이다. 여러 디렉터리(레이어)를 하나의 마운트 포인트처럼 겹쳐서 보이게 한다. Docker의 기본 스토리지 드라이버로 사용된다.

```bash
# 현재 스토리지 드라이버 확인
docker info | grep "Storage Driver"
# Storage Driver: overlay2

# overlay2 레이어 위치
ls /var/lib/docker/overlay2/
```

## 세 가지 핵심 디렉터리

OverlayFS는 세 개의 디렉터리 개념으로 동작한다.

| 디렉터리 | 역할 | 읽기/쓰기 |
|---|---|---|
| **lowerdir** | 이미지 레이어들 (여러 개 가능) | 읽기 전용 |
| **upperdir** | 컨테이너 변경 레이어 | 읽기/쓰기 |
| **merged** | 통합 뷰 (컨테이너가 실제로 보는 파일시스템) | 읽기/쓰기 |

![OverlayFS 레이어 구조](/assets/posts/docker-overlayfs-layers.svg)

## 마운트 명령으로 직접 이해하기

```bash
# OverlayFS 직접 마운트 실험
mkdir -p /tmp/overlay/{lower1,lower2,upper,work,merged}
echo "base file" > /tmp/overlay/lower1/base.txt
echo "layer2 file" > /tmp/overlay/lower2/layer2.txt

mount -t overlay overlay \
  -o lowerdir=/tmp/overlay/lower2:/tmp/overlay/lower1,\
upperdir=/tmp/overlay/upper,\
workdir=/tmp/overlay/work \
  /tmp/overlay/merged

# merged에서 모든 레이어 파일이 통합되어 보임
ls /tmp/overlay/merged/
# base.txt  layer2.txt

# merged에서 파일 수정 → upperdir에만 기록됨
echo "modified" > /tmp/overlay/merged/base.txt
cat /tmp/overlay/upper/base.txt  # 복사본이 생성됨
cat /tmp/overlay/lower1/base.txt # 원본 불변
```

## Copy-on-Write (CoW)

파일 수정 시 OverlayFS는 다음 단계를 수행한다.

1. lowerdir에서 파일을 **upperdir로 복사** (읽기-복사-수정 순서)
2. upperdir의 복사본을 수정
3. merged 뷰에서는 upperdir 버전이 lowerdir보다 우선 표시

이 덕분에 **이미지 레이어 원본은 절대 변경되지 않는다**. 컨테이너를 삭제하면 upperdir만 제거되고 lowerdir(이미지)는 그대로 남는다.

![OverlayFS CoW 공유 구조](/assets/posts/docker-overlayfs-cow.svg)

## 파일 삭제 — Whiteout

lowerdir에 있는 파일을 컨테이너에서 삭제하면 OverlayFS는 실제로 파일을 지울 수 없다(lowerdir은 읽기 전용). 대신 upperdir에 **whiteout 파일**을 생성한다.

```bash
# 컨테이너에서 파일 삭제 후 upperdir 확인
docker run --name test ubuntu bash -c "rm /etc/hostname"
docker diff test
# D /etc/hostname  (Deleted)

# 실제로는 upperdir에 whiteout 파일 존재
ls -la $(docker inspect test --format '{{.GraphDriver.Data.UpperDir}}')/etc/
# c--------- 1 root root 0,0 ... .wh.hostname
```

`c---------`는 character device(0,0)로 표시되는 whiteout 마커다.

## docker diff — 레이어 변경 확인

```bash
# 컨테이너에서 변경된 파일 목록
docker diff mycontainer
# A /app/output.log   (Added)
# C /etc/config.json  (Changed)
# D /tmp/cache        (Deleted)

# 변경 크기 확인
docker inspect mycontainer \
  --format '{{.SizeRootFs}} {{.SizeRw}}'
# SizeRootFs: 전체 크기 (이미지 + 변경)
# SizeRw: upperdir에 쌓인 쓰기 레이어 크기만

# overlay2 실제 디렉터리 구조
docker inspect mycontainer \
  --format '{{json .GraphDriver.Data}}' | python3 -m json.tool
# {
#   "LowerDir": "/var/lib/docker/overlay2/abc.../diff:...",
#   "MergedDir": "/var/lib/docker/overlay2/xyz.../merged",
#   "UpperDir": "/var/lib/docker/overlay2/xyz.../diff",
#   "WorkDir": "/var/lib/docker/overlay2/xyz.../work"
# }
```

## 이미지 레이어 공유의 디스크 효율

동일한 이미지 기반 컨테이너 10개를 띄워도 lowerdir은 **한 번만 디스크에 저장**된다. 1GB 이미지를 기반으로 한 컨테이너 10개의 실제 디스크 사용량은 1GB + 각 컨테이너의 upperdir 크기(보통 수 MB)에 불과하다.

```bash
# 레이어별 디스크 사용량
du -sh /var/lib/docker/overlay2/*/diff | sort -rh | head -10

# 전체 Docker 디스크 사용 요약
docker system df -v
```

## 성능 고려사항

| 작업 | 성능 특성 |
|---|---|
| 읽기 (lowerdir) | 직접 접근, 빠름 |
| 첫 쓰기 (CoW 트리거) | lowerdir→upperdir 복사 비용 발생 |
| 이후 쓰기 (upperdir) | 일반 파일시스템과 동일 |
| 대용량 파일 CoW | 느림 — 볼륨 사용 권장 |

데이터베이스처럼 대용량 파일을 자주 수정하는 워크로드는 컨테이너 레이어 대신 **Docker 볼륨**을 써서 OverlayFS CoW 오버헤드를 피해야 한다.

```bash
# 볼륨으로 CoW 오버헤드 회피
docker run -v pgdata:/var/lib/postgresql/data postgres
```

---

**지난 글:** [Linux Namespaces & cgroups — Docker 격리의 진짜 원리](/posts/docker-namespaces-cgroups/)

**다음 글:** [runc & containerd — Docker 런타임 스택](/posts/docker-runc-containerd/)

<br>
읽어주셔서 감사합니다. 😊
