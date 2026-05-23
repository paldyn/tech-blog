---
title: "마운트 유형 완전 정리 — 블록·바인드·루프·tmpfs·NFS"
description: "리눅스의 모든 마운트 유형(블록 디바이스·bind·loopback·tmpfs·NFS·procfs·FUSE·overlayfs), mount -o 옵션, /etc/fstab 보안 설정, findmnt 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "filesystem", "mount", "fstab", "tmpfs", "nfs", "bindmount", "loopback", "overlayfs"]
featured: false
draft: false
---

[지난 글](/posts/linux-cve-monitoring/)에서 CVE 모니터링과 패치 전략을 살펴봤습니다. 이번 글부터는 리눅스 마운트 시스템을 심화 탐구합니다. `mount` 명령은 단순히 디스크를 연결하는 도구가 아닙니다. 디렉터리 재배치, 가상 파일시스템, 컨테이너 격리까지 리눅스 파일시스템의 핵심 메커니즘입니다.

## 마운트란 무엇인가

리눅스 파일시스템은 단일 디렉터리 트리로 구성됩니다. `mount`는 다양한 소스(블록 디바이스, 파일, 네트워크, 가상 FS)를 이 트리의 특정 지점(마운트포인트)에 연결합니다. 마운트포인트 아래의 내용은 소스의 내용으로 가려집니다.

![리눅스 마운트 유형 한눈에 보기](/assets/posts/linux-mount-types-overview.svg)

## 마운트 유형별 개요

### 1. 블록 디바이스 마운트

가장 기본적인 마운트입니다. 물리 디스크, SSD, 파티션을 파일시스템으로 연결합니다.

```bash
# 파티션 마운트
sudo mount /dev/sdb1 /mnt/data

# 파일시스템 유형 명시
sudo mount -t ext4 /dev/sdb1 /mnt/data

# 자동 마운트 확인
lsblk -f
```

### 2. Bind Mount

디렉터리를 다른 경로에 다시 연결합니다. 복사가 아니라 **같은 inode를 두 경로로 접근**하는 것입니다.

```bash
sudo mount --bind /var/www/html /mnt/web
```

### 3. Loopback Mount (루프 디바이스)

파일을 블록 디바이스처럼 취급합니다. ISO 이미지, 디스크 이미지를 마운트할 때 사용합니다.

```bash
sudo mount -o loop ubuntu.iso /mnt/iso
sudo mount -o loop disk.img /mnt/disk
```

### 4. tmpfs

RAM을 파일시스템으로 사용합니다. 재부팅하면 내용이 사라집니다.

```bash
sudo mount -t tmpfs -o size=512m tmpfs /mnt/ramdisk
```

### 5. 가상 파일시스템 (procfs/sysfs/devtmpfs)

커널이 실시간 정보를 파일 인터페이스로 노출합니다.

```bash
mount | grep "^/dev\|^proc\|^sys"
```

### 6. NFS / CIFS

네트워크를 통해 원격 서버의 디렉터리를 마운트합니다.

```bash
sudo mount -t nfs 192.168.1.10:/exports/data /mnt/nfs
sudo mount -t cifs //server/share /mnt/cifs -o user=alice
```

### 7. FUSE (Filesystem in Userspace)

커널 모듈 없이 유저스페이스에서 파일시스템을 구현합니다.

```bash
# sshfs: SSH 원격 파일시스템
sshfs user@server:/home/user /mnt/remote
```

### 8. OverlayFS

여러 레이어를 합쳐 하나의 파일시스템으로 보이게 합니다. Docker 이미지 레이어의 기반 기술입니다.

```bash
sudo mount -t overlay overlay \
    -o lowerdir=/lower,upperdir=/upper,workdir=/work \
    /merged
```

## mount 명령 옵션 (`-o`)

![마운트 옵션 목록과 보안 마운트 예시](/assets/posts/linux-mount-types-options.svg)

### 자주 쓰는 옵션 조합

```bash
# 읽기 전용 마운트
sudo mount -o ro /dev/sdb1 /mnt/ro

# 성능 최적화 (atime 갱신 최소화)
sudo mount -o relatime,noatime /dev/sdb1 /mnt/data

# 보안 강화 (실행·SUID·dev 금지)
sudo mount -o noexec,nosuid,nodev /dev/sdb1 /mnt/uploads

# 옵션 변경 (재마운트)
sudo mount -o remount,ro /mnt/data
```

## findmnt — 현대적 마운트 조회

`mount` 명령보다 `findmnt`가 더 읽기 편합니다.

```bash
# 트리 형태로 전체 마운트
findmnt

# 특정 마운트포인트 정보
findmnt /

# 옵션 포함 확인
findmnt -o TARGET,SOURCE,FSTYPE,OPTIONS

# /etc/fstab 검증
findmnt --verify

# 특정 소스 검색
findmnt /dev/sda1
```

## /etc/fstab — 영구 마운트 설정

```
# <device>    <mountpoint>  <type>    <options>           <dump> <pass>
/dev/sda1     /             ext4      defaults            1      1
/dev/sda2     /home         ext4      defaults,nodev,nosuid 0   2
/dev/sda3     swap          swap      defaults            0      0
tmpfs         /tmp          tmpfs     nodev,nosuid,noexec,size=2G 0 0
```

### fstab 주요 필드

| 필드 | 의미 |
|---|---|
| device | `/dev/sdaN`, UUID=, LABEL= |
| mountpoint | 마운트 경로 또는 `none` (swap) |
| type | ext4, xfs, nfs, tmpfs 등 |
| options | 마운트 옵션, `defaults` = rw,suid,dev,exec,auto,nouser,async |
| dump | 0=백업 안 함, 1=dump 대상 |
| pass | 0=fsck 건너뜀, 1=루트, 2=나머지 |

### UUID 기반 설정 (권장)

디바이스 이름(`/dev/sda1`)은 부팅 환경에 따라 바뀔 수 있습니다.

```bash
# UUID 확인
blkid /dev/sda1
# UUID="550e8400-e29b-41d4-a716-446655440000" TYPE="ext4"

# fstab 에서
UUID=550e8400-e29b-41d4-a716-446655440000  /  ext4  defaults  1  1
```

## 보안 마운트 강화

```bash
# /tmp, /var/tmp, /dev/shm 에 noexec 적용
sudo mount -o remount,noexec,nosuid,nodev /tmp

# 현재 옵션 확인
grep "/tmp" /proc/mounts
```

## 임시 마운트 vs 영구 마운트

| 방법 | 재부팅 후 | 사용 시점 |
|---|---|---|
| `mount` 명령 | 사라짐 | 테스트, 일회성 |
| `/etc/fstab` | 유지됨 | 영구 마운트 |
| `systemd .mount` | 유지됨 | 조건부 마운트, 의존성 관리 |

systemd mount 유닛은 `/etc/systemd/system/mnt-data.mount` 형식으로 작성합니다. fstab 항목은 systemd가 자동으로 `.mount` 유닛으로 변환합니다.

다음 글에서는 Bind Mount의 실전 활용과 주의사항을 더 자세히 살펴봅니다.

---

**지난 글:** [CVE 모니터링 — 취약점 추적과 패치 전략](/posts/linux-cve-monitoring/)

**다음 글:** [Bind Mount — 디렉터리 재마운트](/posts/linux-bind-mount/)

<br>
읽어주셔서 감사합니다. 😊
