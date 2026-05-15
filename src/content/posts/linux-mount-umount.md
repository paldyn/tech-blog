---
title: "mount/umount — 파일시스템을 디렉터리 트리에 연결하기"
description: "Linux에서 블록 장치의 파일시스템을 마운트 포인트에 연결하고 분리하는 mount/umount 명령어의 원리와 옵션을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "mount", "umount", "filesystem", "block-device"]
featured: false
draft: false
---

[지난 글](/posts/linux-file-types/)에서 리눅스 파일 타입(일반 파일·디렉터리·심볼릭 링크·블록 장치 등)을 살펴봤습니다. 이번에는 블록 장치를 실제로 **디렉터리 트리에 붙이는** 마운트 메커니즘을 다룹니다.

리눅스에는 드라이브 문자(C:, D:)가 없습니다. 대신 모든 파일시스템이 단일 트리 아래 **마운트 포인트(mount point)**라는 디렉터리를 통해 이어집니다. `mount` 명령은 블록 장치(또는 이미지 파일)의 파일시스템을 지정한 빈 디렉터리에 연결하고, `umount`는 그 연결을 끊습니다.

## 마운트란 무엇인가

![마운트 개념 — 장치를 디렉터리 트리에 연결](/assets/posts/linux-mount-umount-concept.svg)

커널은 내부적으로 **VFS(Virtual File System)** 레이어를 통해 파일 접근을 추상화합니다. `mount` 시스템 콜이 호출되면 커널은 장치의 슈퍼블록을 읽고, VFS 레이어에 새 마운트 엔트리를 등록합니다. 이후 `/mnt/data` 경로로 접근하면 커널이 자동으로 해당 장치의 파일시스템으로 요청을 전달합니다.

마운트 정보는 `/proc/mounts`(또는 `/proc/self/mountinfo`)에서 실시간으로 확인할 수 있습니다.

## 기본 사용법

```bash
# 장치를 마운트 포인트에 연결 (파일시스템 자동 감지)
sudo mount /dev/sdb1 /mnt/data

# 파일시스템 타입 명시 (-t)
sudo mount -t ext4 /dev/sdb1 /mnt/data

# ISO 이미지 파일 마운트 (루프백)
sudo mount -o loop image.iso /mnt/iso

# 현재 마운트 상태 확인
mount | grep sdb
findmnt /mnt/data
cat /proc/mounts
```

마운트 포인트 디렉터리가 **미리 존재**해야 합니다. 없으면 `mkdir -p /mnt/data`로 먼저 만들어 두세요.

## 주요 마운트 옵션 (-o)

![mount/umount 명령어 모음](/assets/posts/linux-mount-umount-commands.svg)

`-o` 플래그로 쉼표 구분 옵션을 전달합니다.

| 옵션 | 설명 |
|---|---|
| `ro` / `rw` | 읽기 전용 / 읽기쓰기 |
| `nosuid` | SetUID/SetGID 비트 무시 — 보안 강화 |
| `noexec` | 이 파일시스템의 바이너리 실행 금지 |
| `nodev` | 장치 파일 생성·사용 금지 |
| `remount` | 이미 마운트된 파일시스템 옵션만 변경 |
| `bind` | 디렉터리를 다른 경로에 재노출 |
| `defaults` | `rw,suid,dev,exec,auto,nouser,async`의 묶음 |

```bash
# 읽기 전용으로 재마운트 (언마운트 없이 옵션 변경)
sudo mount -o remount,ro /mnt/data

# 바인드 마운트 — /srv/www 를 /var/www 에도 노출
sudo mount --bind /srv/www /var/www
```

## 언마운트 (umount)

장치가 사용 중(open 파일·cwd 등)이면 언마운트가 실패합니다.

```bash
# 경로 또는 장치로 언마운트
sudo umount /mnt/data
sudo umount /dev/sdb1

# 사용 중인 프로세스 확인
lsof /mnt/data
fuser -m /mnt/data

# lazy 언마운트 — 사용이 끝나는 즉시 분리
sudo umount -l /mnt/data

# 강제 언마운트 (NFS 등 네트워크 파일시스템 장애 시)
sudo umount -f /mnt/nfs
```

`-l` 옵션은 파일시스템을 트리에서 즉시 분리하되, 이미 열린 파일 핸들은 닫힐 때까지 유지합니다. 네트워크 파일시스템처럼 응답이 없는 경우에는 `-f`(force)를 씁니다.

## tmpfs · proc · sysfs 같은 가상 파일시스템

블록 장치 외에도 커널이 제공하는 **가상 파일시스템**을 마운트할 수 있습니다.

```bash
# tmpfs — 메모리 기반 임시 파일시스템
sudo mount -t tmpfs -o size=512m tmpfs /mnt/ram

# proc — 프로세스 정보
sudo mount -t proc proc /proc

# sysfs — 장치·드라이버 정보
sudo mount -t sysfs sysfs /sys
```

부팅 시 커널이 이들을 자동으로 마운트하므로 직접 실행할 일은 드물지만, 컨테이너 환경이나 `chroot` 환경 구성 시 수동으로 마운트해야 할 때 사용합니다.

## /proc/mounts vs /etc/fstab

`/proc/mounts`는 **현재 커널이 인식한 실제 마운트 목록**이고, `/etc/fstab`은 **부팅 시 자동 마운트할 항목을 선언하는 설정 파일**입니다. `/etc/fstab`은 다음 글에서 자세히 다룹니다.

```bash
# 현재 마운트 전체 목록 — 구조적 출력
findmnt --tree

# 특정 장치가 어디에 마운트됐는지 역추적
findmnt -S /dev/sdb1
```

## 정리

- `mount 장치 경로` — 파일시스템을 디렉터리 트리에 연결
- `-t` 타입 지정, `-o` 옵션(ro, nosuid, bind 등)
- `umount 경로` — 연결 해제 · `-l` lazy · `-f` force
- 현재 마운트 상태는 `findmnt` 또는 `/proc/mounts`로 확인
- 부팅 자동 마운트는 `/etc/fstab`에 등록

---

**다음 글:** [/etc/fstab — 부팅 자동 마운트 설정](/posts/linux-fstab/)

<br>
읽어주셔서 감사합니다. 😊
