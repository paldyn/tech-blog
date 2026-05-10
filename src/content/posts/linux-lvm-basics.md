---
title: "LVM 기초 — 유연한 논리 볼륨 관리자 완전 정복"
description: "LVM의 PV/VG/LV 3계층 구조 이해, pvcreate·vgcreate·lvcreate로 볼륨 생성, 온라인 확장·스냅샷까지 LVM 기초를 체계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "lvm", "logical-volume", "storage", "pv", "vg", "disk"]
featured: false
draft: false
---

[지난 글](/posts/linux-swap/)에서 스왑 메모리를 다뤘습니다. 이번에는 리눅스 스토리지 관리의 핵심인 **LVM(Logical Volume Manager)**을 소개합니다. LVM은 물리 디스크를 추상화해 서비스 중단 없이 볼륨 크기를 유연하게 조정할 수 있게 해주는 커널 레이어입니다.

전통적인 파티션 방식의 가장 큰 단점은 `/ 파티션이 꽉 찼는데 옆 파티션에 공간이 남아있어도 못 쓴다`는 점입니다. LVM은 이 문제를 해결합니다. 여러 물리 디스크를 하나의 **볼륨 그룹**으로 통합하고, 그 안에서 **논리 볼륨**을 필요에 따라 동적으로 할당합니다.

## LVM 3계층 구조

![LVM 아키텍처 — PV → VG → LV](/assets/posts/linux-lvm-architecture.svg)

| 계층 | 이름 | 설명 |
|---|---|---|
| **PV** | Physical Volume | 물리 디스크·파티션을 LVM에 등록 |
| **VG** | Volume Group | PV를 통합한 논리적 저장 풀 |
| **LV** | Logical Volume | VG에서 할당한 실제 사용 단위 (파티션 역할) |

## LVM 설치 확인 및 현황 파악

```bash
# LVM 도구 설치 확인
which pvcreate vgcreate lvcreate

# 현재 PV/VG/LV 전체 현황
sudo pvs    # Physical Volumes
sudo vgs    # Volume Groups
sudo lvs    # Logical Volumes

# 상세 정보
sudo pvdisplay
sudo vgdisplay
sudo lvdisplay
```

## LVM 구성 실습 — 처음부터 만들기

![LVM 명령어 모음](/assets/posts/linux-lvm-commands.svg)

```bash
# 1. 파티션 또는 디스크를 PV로 초기화
sudo pvcreate /dev/sdb1 /dev/sdc1

# 2. PV를 하나의 VG로 묶기
sudo vgcreate vg_data /dev/sdb1 /dev/sdc1

# 3. VG에서 LV 생성
sudo lvcreate -L 50G -n lv_root vg_data
sudo lvcreate -L 100G -n lv_home vg_data
# 남은 공간 전부 사용
sudo lvcreate -l 100%FREE -n lv_extra vg_data

# 4. LV에 파일시스템 생성
sudo mkfs.ext4 /dev/vg_data/lv_root
sudo mkfs.xfs /dev/vg_data/lv_home

# 5. 마운트
sudo mount /dev/vg_data/lv_root /
```

LV의 장치 경로는 `/dev/VG이름/LV이름` 또는 `/dev/mapper/VG이름-LV이름` 두 가지 형식으로 접근합니다.

## 온라인 LV 확장 (서비스 무중단)

ext4 파일시스템은 마운트 상태에서 확장할 수 있습니다.

```bash
# 방법 1: lvextend + resize2fs 분리
sudo lvextend -L +20G /dev/vg_data/lv_home
sudo resize2fs /dev/vg_data/lv_home

# 방법 2: -r 옵션으로 한 번에
sudo lvresize -L +20G -r /dev/vg_data/lv_home

# XFS는 xfs_growfs 사용
sudo lvextend -L +20G /dev/vg_data/lv_xfs
sudo xfs_growfs /mnt/xfs_mount
```

## VG 확장 — 새 디스크 추가

VG에 공간이 부족하면 새 물리 디스크를 추가해 확장합니다.

```bash
# 새 디스크를 PV로 초기화
sudo pvcreate /dev/sdd

# 기존 VG에 추가
sudo vgextend vg_data /dev/sdd

# 이제 LV 확장 가능
sudo lvresize -l +100%FREE -r /dev/vg_data/lv_home

# 확인
sudo vgs
df -h /home
```

## LVM 스냅샷

스냅샷은 LV의 순간 상태를 보존합니다. 백업이나 업그레이드 전 안전망으로 활용합니다.

```bash
# 스냅샷 생성 (5G 스냅샷 공간 할당)
sudo lvcreate -s -L 5G -n lv_home_snap /dev/vg_data/lv_home

# 스냅샷 마운트 (읽기 전용)
sudo mount -o ro /dev/vg_data/lv_home_snap /mnt/snap

# 스냅샷으로 복원 (원본이 손상됐을 때)
sudo lvconvert --merge /dev/vg_data/lv_home_snap

# 스냅샷 삭제
sudo lvremove /dev/vg_data/lv_home_snap
```

스냅샷은 원본 LV와 같은 VG에 생성됩니다. 변경된 블록만 스냅샷 공간에 COW(Copy-on-Write)로 저장하므로 스냅샷 직후에는 거의 공간을 쓰지 않습니다. 하지만 원본이 많이 변경될수록 스냅샷 공간이 소모되니 크기를 넉넉히 잡으세요.

## LVM 축소 (위험 — 신중하게)

LV 축소는 데이터 손실 위험이 있어 세심한 절차가 필요합니다.

```bash
# 1. 언마운트
sudo umount /home

# 2. 파일시스템 검사
sudo e2fsck -f /dev/vg_data/lv_home

# 3. 파일시스템 먼저 축소 (80G로)
sudo resize2fs /dev/vg_data/lv_home 80G

# 4. LV 축소 (파일시스템보다 크게)
sudo lvreduce -L 80G /dev/vg_data/lv_home

# 5. 재마운트
sudo mount /home
```

XFS는 파일시스템 축소를 지원하지 않습니다. LV 축소가 필요하면 데이터를 백업 후 재포맷해야 합니다.

## 정리

- **PV**: `pvcreate` → **VG**: `vgcreate` → **LV**: `lvcreate`
- `pvs / vgs / lvs`: 각 계층 현황 확인
- `lvresize -L +크기 -r 장치`: 온라인 확장 (ext4 기준)
- `vgextend VG PV`: VG에 새 디스크 추가
- `lvcreate -s`: 스냅샷 생성
- 축소는 언마운트 + fsck + resize2fs(먼저) + lvreduce 순서

---

**지난 글:** [swap — 리눅스 가상 메모리 스왑 완전 정복](/posts/linux-swap/)

<br>
읽어주셔서 감사합니다. 😊
