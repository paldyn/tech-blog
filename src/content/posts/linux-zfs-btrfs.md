---
title: "ZFS · Btrfs — Copy-on-Write 파일시스템 완전 정복"
description: "ZFS와 Btrfs의 핵심 개념인 Copy-on-Write, 스냅샷, 투명 압축, RAID 내장 기능을 비교하고, 각 파일시스템의 실전 운영 명령어를 소개합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "zfs", "btrfs", "filesystem", "snapshot", "cow", "storage"]
featured: false
draft: false
---

[지난 글](/posts/linux-raid-mdadm/)에서 mdadm으로 소프트웨어 RAID를 구성하는 법을 다뤘습니다. 이번에는 RAID·스냅샷·압축을 파일시스템 자체에 통합한 **ZFS와 Btrfs**를 살펴봅니다. 두 파일시스템은 전통적인 ext4/XFS와 근본적으로 다른 설계 철학을 갖고 있습니다.

## Copy-on-Write(CoW)란

일반 파일시스템은 데이터를 제자리(in-place)에 덮어씁니다. 쓰기 도중 전원이 꺼지면 데이터가 반쪽만 기록된 상태로 남을 수 있습니다.

**Copy-on-Write**는 다릅니다. 데이터를 수정할 때 기존 블록을 그대로 두고, 새 블록에 변경 내용을 기록한 뒤 포인터만 바꿉니다. 덕분에:

- **원자성 보장**: 쓰기가 끊겨도 이전 상태가 완전히 보존됨
- **스냅샷 제로 비용**: 현재 포인터만 복사하면 즉시 스냅샷 완성
- **자체 체크섬**: 블록마다 해시를 저장해 묵은 데이터 손상(silent corruption)을 감지

![ZFS vs Btrfs 핵심 기능 비교](/assets/posts/linux-zfs-btrfs-compare.svg)

## ZFS

ZFS는 2006년 Sun Microsystems가 Solaris용으로 개발했고, 현재 **OpenZFS** 프로젝트로 발전했습니다. Ubuntu 20.04부터 공식 설치 대상 파일시스템으로 지원합니다.

### 핵심 개념: zpool과 dataset

ZFS는 2계층 구조입니다.

| 계층 | 명칭 | 역할 |
|------|------|------|
| 하위 | zpool | 물리 디스크를 묶는 스토리지 풀 |
| 상위 | dataset | 마운트 포인트·스냅샷·클론 단위 |

```bash
# OpenZFS 설치 (Ubuntu)
sudo apt install zfsutils-linux

# RAID-Z1(패리티 1개) 풀 생성
sudo zpool create tank raidz /dev/sdb /dev/sdc /dev/sdd

# 풀 상태 확인
sudo zpool status tank
```

### 데이터셋과 속성

```bash
# 데이터셋 생성
sudo zfs create tank/www

# 압축 활성화 (zstd 권장)
sudo zfs set compression=zstd tank/www

# 할당량 설정
sudo zfs set quota=100G tank/www

# 속성 조회
sudo zfs get all tank/www
```

### 스냅샷과 복구

```bash
# 스냅샷 생성 (즉각 완료, 거의 무비용)
sudo zfs snapshot tank/www@backup-20260512

# 스냅샷 목록
sudo zfs list -t snapshot

# 파일 단위 복구 (.zfs/snapshot 경로)
ls /tank/www/.zfs/snapshot/backup-20260512/

# 데이터셋 전체 롤백
sudo zfs rollback tank/www@backup-20260512

# 스냅샷 삭제
sudo zfs destroy tank/www@backup-20260512
```

### Scrub — 데이터 무결성 검사

```bash
# 전체 scrub 시작 (백그라운드, 평균 수 시간)
sudo zpool scrub tank

# 진행 상태 확인
sudo zpool status tank
```

주기적인 scrub(월 1회 이상)으로 묵은 비트 에러를 조기에 발견·복구할 수 있습니다. RAID-Z 구성이면 패리티로 자동 복구됩니다.

## Btrfs

Btrfs(B-tree Filesystem)는 2009년 오라클이 주도해 리눅스 커널에 통합한 파일시스템입니다. ext4의 후계자를 목표로 설계됐으며, 커널 5.x 이후 안정성이 크게 향상됐습니다.

![ZFS · Btrfs 핵심 명령어](/assets/posts/linux-zfs-btrfs-commands.svg)

### 포맷 및 기본 사용

```bash
# 단일 디스크
sudo mkfs.btrfs /dev/sdb

# 여러 디스크 (RAID 1 메타데이터)
sudo mkfs.btrfs -d raid1 -m raid1 /dev/sdb /dev/sdc

# 마운트 (압축 포함)
sudo mount -o compress=zstd /dev/sdb /mnt/data
```

### 서브볼륨 (Subvolume)

Btrfs의 서브볼륨은 ZFS의 dataset에 해당합니다. 스냅샷 단위가 되고, 별도 마운트가 가능합니다.

```bash
# 서브볼륨 생성
sudo btrfs subvolume create /mnt/data/@home
sudo btrfs subvolume create /mnt/data/@root

# 목록
sudo btrfs subvolume list /mnt/data

# 서브볼륨으로 마운트
sudo mount -o subvol=@home /dev/sdb /home
```

### 스냅샷

```bash
# 읽기/쓰기 스냅샷
sudo btrfs subvolume snapshot /mnt/data/@home \
  /mnt/data/.snapshots/home-20260512

# 읽기 전용 스냅샷 (권장)
sudo btrfs subvolume snapshot -r /mnt/data/@home \
  /mnt/data/.snapshots/home-20260512-ro

# 스냅샷 삭제
sudo btrfs subvolume delete \
  /mnt/data/.snapshots/home-20260512
```

### 압축 비율 확인 및 scrub

```bash
# 디스크 사용 통계 (압축 효율)
sudo btrfs filesystem usage /mnt/data

# 데이터 무결성 검사
sudo btrfs scrub start /mnt/data
sudo btrfs scrub status /mnt/data
```

## 선택 가이드

**ZFS가 유리한 경우**:
- 프로덕션 NAS, 파일 서버, 데이터베이스 백업
- 엔터프라이즈 환경에서 검증된 안정성 필요
- 메모리 여유(일반적으로 ECC RAM 권장)가 충분할 때

**Btrfs가 유리한 경우**:
- 데스크탑, 개발 머신, 단일 디스크 환경
- Fedora·openSUSE 등 기본 파일시스템으로 지원하는 배포판
- 가벼운 자원 사용과 커널 통합이 중요할 때

> **주의**: Btrfs RAID 5/6은 알려진 버그가 있어 프로덕션 데이터에 사용하지 마세요. RAID가 필요하면 ZFS RAID-Z 또는 mdadm + Btrfs 조합을 선택하세요.

---

**지난 글:** [소프트웨어 RAID — mdadm으로 고가용성 스토리지 구성하기](/posts/linux-raid-mdadm/)

**다음 글:** [리눅스 파일 권한 — rwx 완전 이해](/posts/linux-permissions-rwx/)

<br>
읽어주셔서 감사합니다. 😊
