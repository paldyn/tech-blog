---
title: "lsblk/blkid — 블록 장치 구조와 UUID 조회"
description: "lsblk로 디스크·파티션 트리 구조를 파악하고, blkid로 UUID·파일시스템 타입을 확인해 /etc/fstab에 안전하게 등록하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "lsblk", "blkid", "uuid", "block-device", "disk"]
featured: false
draft: false
---

[지난 글](/posts/linux-disk-usage-df-du/)에서 `df`와 `du`로 디스크 사용량을 파악하는 방법을 배웠습니다. 이번에는 한 단계 더 내려가 **어떤 블록 장치가 연결돼 있고, 각 파티션의 UUID와 파일시스템 타입이 무엇인지** 조회하는 `lsblk`와 `blkid`를 다룹니다.

새 디스크를 연결하거나 파티션을 새로 만들었을 때, 또는 `/etc/fstab`에 UUID를 등록하기 전에 반드시 이 두 명령을 사용합니다.

## lsblk — 블록 장치 트리 보기

![lsblk 트리 구조](/assets/posts/linux-lsblk-tree.svg)

`lsblk`(List Block devices)는 `/sys/block`을 읽어 시스템에 연결된 블록 장치를 **디스크 → 파티션** 계층 구조로 표시합니다.

```bash
# 기본 출력 (트리 구조)
lsblk

# 파일시스템·UUID·레이블 포함
lsblk -f

# 컬럼 직접 선택
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT

# 특정 장치만
lsblk /dev/sda

# 모델명·시리얼 포함 (장치 식별)
lsblk -o NAME,MODEL,SERIAL,SIZE,TYPE
```

`lsblk` 출력에서 `TYPE` 컬럼이 `disk`이면 물리/가상 디스크, `part`이면 파티션, `lvm`·`raid`이면 논리 볼륨이나 RAID입니다.

## blkid — UUID와 파일시스템 타입 조회

![blkid UUID 출력](/assets/posts/linux-blkid-output.svg)

`blkid`는 각 블록 장치의 슈퍼블록을 읽어 UUID, 파일시스템 타입(FSTYPE), 레이블(LABEL) 등을 출력합니다. `/etc/fstab`에 UUID를 등록할 때 이 명령으로 값을 확인합니다.

```bash
# 모든 장치 UUID/타입 출력 (root 권장)
sudo blkid

# 특정 장치 UUID만 깔끔하게 출력
blkid -s UUID -o value /dev/sdb1

# UUID로 장치 경로 역조회
blkid -U "1a2b3c4d-5e6f-7890-abcd-ef1234567890"

# 파일시스템 타입만 출력
blkid -s TYPE -o value /dev/sda1

# JSON 형식 출력 (스크립트 파싱용)
blkid -o json
```

## fstab 등록 워크플로

새 디스크 `/dev/sdb`를 `/mnt/data`에 마운트하고 fstab에 등록하는 전형적인 절차입니다.

```bash
# 1. 블록 장치 확인
lsblk
# → sdb 디스크가 보이고 파티션이 없는 상태

# 2. 파티션 생성 (다음 글 주제: fdisk/parted)
sudo fdisk /dev/sdb

# 3. 파일시스템 포맷 (mkfs 글 예정)
sudo mkfs.ext4 /dev/sdb1

# 4. UUID 확인
sudo blkid -s UUID -o value /dev/sdb1
# → a3b4c5d6-7890-1234-abcd-ef5678901234

# 5. 마운트 포인트 생성
sudo mkdir -p /mnt/data

# 6. fstab에 등록 (UUID 방식)
echo "UUID=a3b4c5d6-7890-1234-abcd-ef5678901234  /mnt/data  ext4  defaults,nofail  0  2" \
  | sudo tee -a /etc/fstab

# 7. 검증 및 마운트
sudo findmnt --verify
sudo mount -a
```

## NVMe 장치 이름 규칙

NVMe SSD는 `/dev/nvme0n1`, `/dev/nvme0n1p1` 식으로 이름이 붙습니다.

```bash
# NVMe 장치 확인
lsblk -o NAME,TYPE,SIZE,MODEL | grep nvme

# nvme 드라이브 상세 정보 (nvme-cli 필요)
sudo nvme list
sudo nvme smart-log /dev/nvme0
```

`nvme0`는 컨트롤러, `n1`은 첫 번째 네임스페이스, `p1`은 첫 번째 파티션을 의미합니다. SATA 드라이브(`/dev/sda`)와 달리 순서가 바뀌어도 이름이 상대적으로 안정적입니다.

## 장치가 인식되지 않을 때

```bash
# 커널이 감지한 블록 장치 로그
dmesg | grep -E 'sd[a-z]|nvme|usb-storage' | tail -20

# 전체 장치 재스캔 (핫플러그 USB)
sudo udevadm trigger --type=devices --action=add
udevadm settle

# SCSI 장치 재스캔
echo "- - -" | sudo tee /sys/class/scsi_host/host*/scan
```

## 정리

- `lsblk`: 블록 장치 트리(디스크→파티션→마운트포인트) 확인
- `lsblk -f`: 파일시스템 타입·UUID 포함
- `blkid`: UUID·FSTYPE·LABEL 조회
- `blkid -s UUID -o value 장치`: UUID만 깔끔하게 출력 → fstab에 붙여넣기
- NVMe는 `nvme0n1p1` 규칙, SATA는 `sda1` 규칙

---

**지난 글:** [df/du — 디스크 사용량 한눈에 파악하기](/posts/linux-disk-usage-df-du/)

**다음 글:** [fdisk/parted — 파티션 생성과 관리](/posts/linux-fdisk-parted/)

<br>
읽어주셔서 감사합니다. 😊
