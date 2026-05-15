---
title: "fdisk/parted — 파티션 생성과 테이블 관리"
description: "MBR과 GPT 파티션 테이블의 차이, fdisk 인터랙티브 세션으로 파티션을 만드는 방법, parted로 스크립트 방식 파티셔닝하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "fdisk", "parted", "partition", "disk", "gpt", "mbr"]
featured: false
draft: false
---

[지난 글](/posts/linux-lsblk-blkid/)에서 `lsblk`와 `blkid`로 블록 장치와 UUID를 조회하는 방법을 배웠습니다. 새 디스크를 연결했다면 파일시스템을 얹기 전에 먼저 **파티션 테이블**을 만들어야 합니다. 여기서 `fdisk`와 `parted`가 필요합니다.

파티션은 물리 디스크를 논리적으로 분할하는 단위입니다. `/`(루트)와 `/home`을 분리하거나, 스왑 파티션을 따로 두거나, 데이터 파티션을 독립적으로 관리할 때 사용합니다.

## MBR vs GPT

![파티션 테이블 구조 비교](/assets/posts/linux-fdisk-layout.svg)

현재 권장 방식은 **GPT**(GUID Partition Table)입니다. 2TB 이상 디스크, UEFI 부팅, 128개 이상 파티션이 필요하다면 반드시 GPT를 써야 합니다. 레거시 BIOS 환경이나 2TB 이하 소용량에서 호환성이 중요할 때만 MBR을 사용합니다.

## fdisk — 대화형 파티션 편집기

![fdisk 세션 흐름](/assets/posts/linux-fdisk-workflow.svg)

```bash
# 디스크 파티션 테이블 확인 (읽기 전용)
sudo fdisk -l /dev/sdb

# 대화형 편집 시작
sudo fdisk /dev/sdb
```

**fdisk 내부 주요 명령**:

| 명령 | 동작 |
|---|---|
| `m` | 도움말 출력 |
| `p` | 현재 파티션 테이블 출력 |
| `g` | GPT 파티션 테이블 생성 |
| `o` | MBR 파티션 테이블 생성 |
| `n` | 새 파티션 생성 |
| `d` | 파티션 삭제 |
| `t` | 파티션 타입 변경 |
| `w` | 변경 저장 후 종료 |
| `q` | 저장 없이 종료 |

`w`를 누르기 전까지는 디스크에 아무것도 쓰이지 않습니다. 실수했다면 `q`로 그냥 나오면 됩니다.

## parted — 스크립트 친화적 파티셔닝

`parted`는 비대화형 모드를 지원해 셸 스크립트에서 자동화하기 좋습니다.

```bash
# 파티션 테이블 확인
sudo parted /dev/sdc print

# GPT 파티션 테이블 생성
sudo parted /dev/sdc mklabel gpt

# EFI 파티션 생성 (100MB)
sudo parted /dev/sdc mkpart ESP fat32 1MiB 101MiB
sudo parted /dev/sdc set 1 esp on

# 루트 파티션 생성 (나머지 전체)
sudo parted /dev/sdc mkpart primary ext4 101MiB 100%

# 결과 확인
sudo parted /dev/sdc print
```

`parted`는 시작/끝 위치에 `MiB`, `GiB`, `%` 단위를 모두 허용합니다. `0%`나 `100%`로 정렬 경고 없이 파티션을 만들려면 `1MiB`처럼 정렬된 주소를 씁니다.

## 파티션 생성 후 커널에 알리기

파티셔닝 후 커널이 변경을 즉시 인식하지 못할 수 있습니다.

```bash
# 파티션 테이블 재로드
sudo partprobe /dev/sdb

# 또는
sudo blockdev --rereadpt /dev/sdb

# 확인
lsblk /dev/sdb
```

## 디스크 정렬(Alignment)

SSD·NVMe는 4K(또는 그 이상) 섹터 경계에 파티션을 정렬해야 성능이 나옵니다. `parted`는 기본적으로 최적 정렬(`optimal`)을 사용합니다.

```bash
# 정렬 정보 확인
cat /sys/block/sdb/queue/optimal_io_size
cat /sys/block/sdb/queue/physical_block_size

# parted 정렬 검사
sudo parted /dev/sdb align-check optimal 1
```

`fdisk`도 최근 버전은 2048 섹터(1MiB) 단위로 자동 정렬합니다. 따로 지정하지 않아도 됩니다.

## 실전: 빈 디스크에 파티션 만들기

```bash
# 1. 현재 상태 확인
sudo fdisk -l /dev/sdb

# 2. GPT 테이블 초기화 + 파티션 생성
sudo fdisk /dev/sdb
# → g (GPT), n (new), 번호 1, 시작 기본값, +50G, w (저장)

# 3. 커널 재인식
sudo partprobe /dev/sdb

# 4. 파일시스템 포맷 (다음 글)
sudo mkfs.ext4 /dev/sdb1
```

`parted`로 같은 작업을 한 줄에:

```bash
sudo parted -s /dev/sdb \
  mklabel gpt \
  mkpart primary ext4 1MiB 100%
sudo partprobe /dev/sdb
```

## 정리

- MBR: 최대 4개 기본 파티션, 2TB 한도 → 레거시 환경용
- GPT: 128개 파티션, 9.4ZB 지원, UEFI 필수 → 현대 표준
- `fdisk -l 장치`: 파티션 테이블 조회
- `fdisk 장치`: 대화형 편집 (`g`→`n`→`w` 기본 흐름)
- `parted 장치 mklabel gpt` → `mkpart`: 스크립트 친화적
- 작업 후 `partprobe`로 커널 재인식

---

**지난 글:** [lsblk/blkid — 블록 장치 구조와 UUID 조회](/posts/linux-lsblk-blkid/)

**다음 글:** [mkfs — 파일시스템 포맷하기](/posts/linux-mkfs-formats/)

<br>
읽어주셔서 감사합니다. 😊
