---
title: "mkfs — 파티션에 파일시스템 포맷하기"
description: "mkfs.ext4·xfs·btrfs·vfat 등 주요 파일시스템 생성 명령어와 옵션, 파일시스템 타입별 용도와 특징을 비교 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "mkfs", "ext4", "xfs", "btrfs", "filesystem", "format"]
featured: false
draft: false
---

[지난 글](/posts/linux-fdisk-parted/)에서 `fdisk`와 `parted`로 파티션을 만드는 방법을 배웠습니다. 파티션은 아직 빈 공간입니다. 파일을 저장하려면 그 위에 **파일시스템**(파일 이름·권한·블록 위치를 기록하는 구조)을 초기화해야 합니다. 이 과정이 "포맷"이고, 명령어는 `mkfs`(Make Filesystem)입니다.

## mkfs 기본 구조

`mkfs`는 실제로는 얇은 래퍼이고, 내부에서 `mkfs.ext4`, `mkfs.xfs` 같은 개별 프로그램을 호출합니다. 직접 사용하는 형태는 다음과 같습니다.

![mkfs 명령어 모음](/assets/posts/linux-mkfs-commands.svg)

```bash
# ext4 기본 포맷
sudo mkfs.ext4 /dev/sdb1

# 레이블 지정 + 루트 예약 1%로 줄이기 (데이터 드라이브)
sudo mkfs.ext4 -L mydata -m 1 /dev/sdb1

# XFS 포맷
sudo mkfs.xfs -L mydata /dev/sdc1

# FAT32 (USB 드라이브, EFI 파티션)
sudo mkfs.vfat -F 32 /dev/sdd1

# btrfs
sudo mkfs.btrfs -L mydata /dev/sde1
```

**경고**: `mkfs`는 기존 데이터를 덮어 씁니다. 반드시 올바른 파티션을 지정하고 있는지 `lsblk`로 재확인하세요.

## 파일시스템 타입 비교

![파일시스템 타입 비교](/assets/posts/linux-mkfs-comparison.svg)

**ext4**는 Linux 데스크톱과 서버에서 가장 널리 쓰입니다. 저널링으로 비정상 종료 후에도 데이터 무결성을 보장하고, 10년 이상 프로덕션에서 검증됐습니다.

**XFS**는 대용량 파일·병렬 I/O에 강하며, Red Hat Enterprise Linux의 기본 파일시스템입니다. 파일시스템을 축소할 수 없다는 제약이 있으니 처음부터 크기를 넉넉히 잡아야 합니다.

**btrfs**는 스냅샷, 서브볼륨, Copy-on-Write를 기본 지원합니다. Fedora와 openSUSE의 기본 파일시스템으로 채택됐지만, RAID 5/6 구현에 아직 버그가 있어 중요 데이터에는 신중히 써야 합니다.

## ext4 루트 예약 블록

```bash
# 현재 루트 예약 비율 확인
sudo tune2fs -l /dev/sdb1 | grep "Reserved block"
# Reserved block count: 4915 (약 5%)

# 데이터 전용 파티션은 1%로 줄여 공간 확보
sudo tune2fs -m 1 /dev/sdb1
```

기본 5% 예약은 루트 파일시스템이 꽉 찰 때도 루트 사용자가 작업할 수 있도록 확보한 공간입니다. `/home`이나 데이터 전용 파티션에는 1%나 0%로 줄여도 됩니다.

## 포맷 후 확인

```bash
# 파일시스템 정보 확인
sudo tune2fs -l /dev/sdb1 | head -20   # ext4
sudo xfs_info /dev/sdc1                 # xfs
sudo btrfs filesystem show /dev/sde1    # btrfs

# blkid로 포맷 확인
blkid /dev/sdb1
# /dev/sdb1: UUID="..." TYPE="ext4" LABEL="mydata"
```

## 마운트까지 한 번에

```bash
# 1. 파티션 확인
lsblk /dev/sdb

# 2. 포맷
sudo mkfs.ext4 -L mydata -m 1 /dev/sdb1

# 3. 마운트 포인트 생성
sudo mkdir -p /mnt/mydata

# 4. 임시 마운트
sudo mount /dev/sdb1 /mnt/mydata

# 5. fstab에 영구 등록 (UUID 사용)
UUID=$(blkid -s UUID -o value /dev/sdb1)
echo "UUID=$UUID  /mnt/mydata  ext4  defaults,nofail  0  2" \
  | sudo tee -a /etc/fstab
```

## tmpfs — 메모리 파일시스템

tmpfs는 포맷 없이 바로 마운트하는 가상 파일시스템입니다. 재부팅하면 내용이 사라집니다.

```bash
sudo mount -t tmpfs -o size=512m tmpfs /mnt/ram
df -h /mnt/ram
```

CI/CD 빌드 캐시, 임시 파일, 테스트 데이터 등에 유용합니다.

## 정리

- `mkfs.ext4 파티션`: Linux 범용 포맷
- `-L 레이블`: 이름 부여 (fstab에서 LABEL= 활용)
- `-m 1`: 루트 예약 1% (데이터 파티션 공간 절약)
- `mkfs.xfs`: 대용량 서버, RHEL 환경
- `mkfs.vfat -F 32`: USB·EFI 파티션
- 포맷 후 `blkid`로 UUID 확인 → fstab에 등록

---

**지난 글:** [fdisk/parted — 파티션 생성과 테이블 관리](/posts/linux-fdisk-parted/)

**다음 글:** [tune2fs — ext 파일시스템 파라미터 조정](/posts/linux-tune2fs/)

<br>
읽어주셔서 감사합니다. 😊
