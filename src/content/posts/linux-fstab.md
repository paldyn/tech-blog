---
title: "/etc/fstab — 부팅 자동 마운트 설정 완전 정복"
description: "/etc/fstab 파일의 6개 필드 구조, UUID·LABEL·경로 방식 비교, 안전한 편집 방법과 검증 명령어를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "fstab", "mount", "uuid", "filesystem", "boot"]
featured: false
draft: false
---

[지난 글](/posts/linux-mount-umount/)에서 `mount` 명령으로 파일시스템을 수동으로 연결하는 방법을 배웠습니다. 이번에는 부팅 시마다 자동으로 마운트가 일어나도록 선언하는 `/etc/fstab` 파일을 파헤칩니다.

`/etc/fstab`(File Systems Table)은 시스템 초기화 단계에서 `systemd-fstab-generator`(또는 전통적으로 `mount -a`)가 읽어 들이는 설정 파일입니다. 한 줄에 마운트할 파일시스템 하나를 공백(탭) 구분 **6개 컬럼**으로 기술합니다.

## 6개 필드 구조

![/etc/fstab 구조 — 6개 필드](/assets/posts/linux-fstab-structure.svg)

```
<장치>           <마운트포인트>  <타입>  <옵션>          <dump>  <pass>
UUID=1234-abcd   /              ext4    defaults,noatime  0       1
UUID=5678-efgh   /home          ext4    defaults          0       2
UUID=9999-xxxx   none           swap    sw                0       0
tmpfs            /tmp           tmpfs   nosuid,nodev      0       0
```

| 필드 | 설명 |
|---|---|
| **장치** | UUID=, LABEL=, /dev/sdX, 또는 호스트네임:경로(NFS) |
| **마운트 포인트** | 연결할 디렉터리. swap은 `none` |
| **타입** | ext4, xfs, btrfs, vfat, swap, tmpfs, nfs 등 |
| **옵션** | `defaults` 또는 쉼표 구분 옵션 목록 |
| **dump** | `0` 거의 항상. `1`이면 `dump` 명령이 백업 대상으로 인식 |
| **pass** | fsck 검사 순서. 루트=1, 나머지=2, 건너뜀=0 |

## 장치 식별 방법

![장치 식별 방법 — UUID vs LABEL vs /dev](/assets/posts/linux-fstab-uuid-label.svg)

```bash
# 모든 블록 장치의 UUID·타입 확인
blkid

# 파일시스템·UUID·마운트 포인트 한눈에
lsblk -f
```

UUID는 파일시스템을 생성할 때 자동으로 부여되는 128비트 식별자로, 장치 파일 이름(`/dev/sda1`)이 재정렬되더라도 변하지 않습니다. 특히 USB 장치를 여러 개 꽂거나 디스크를 추가할 때 `/dev/sdb1`이 `/dev/sdc1`로 밀릴 수 있어서, **UUID 방식을 강력히 권장**합니다.

## 자주 쓰는 마운트 옵션

```
defaults   = rw, suid, dev, exec, auto, nouser, async 의 묶음
noatime    = 파일 접근 시 atime 갱신 안 함 — 성능 향상
nodiratime = 디렉터리 atime 갱신 안 함
noexec     = 실행 파일 실행 금지 — /tmp 등 보안 강화
nosuid     = SetUID/SetGID 비트 무시
ro         = 읽기 전용
_netdev    = 네트워크 마운트임을 선언, 네트워크 준비 후 마운트
nofail     = 장치 없을 때 부팅 실패 방지 (USB 외장 드라이브 등)
```

`nofail`은 이동식 미디어를 fstab에 등록할 때 필수입니다. 연결되지 않은 장치가 없으면 부팅 시 90초 타임아웃으로 멈추는 것을 방지합니다.

## fstab 안전하게 편집하기

fstab을 잘못 편집하면 시스템이 **부팅 불가** 상태가 될 수 있습니다. 항상 다음 절차를 따르세요.

```bash
# 1. 편집 전 백업
sudo cp /etc/fstab /etc/fstab.bak

# 2. 편집 (UUID는 blkid로 복사)
sudo nano /etc/fstab

# 3. 문법 검증 — 오류 있으면 즉시 알려줌
sudo findmnt --verify

# 4. 실제 마운트 테스트 (모든 항목 마운트 시도)
sudo mount -a

# 5. 특정 항목만 테스트
sudo mount /mnt/data
```

`findmnt --verify`는 존재하지 않는 장치·중복 마운트 포인트·잘못된 옵션 등을 잡아줍니다. `mount -a` 전에 반드시 실행하세요.

## systemd와 fstab

현대 systemd 시스템에서는 `systemd-fstab-generator`가 부팅 시 fstab 항목을 자동으로 `.mount` 유닛으로 변환합니다.

```bash
# fstab에서 생성된 마운트 유닛 확인
systemctl list-units --type=mount

# 특정 마운트 유닛 상태
systemctl status mnt-data.mount
```

마운트 포인트 경로의 `/`를 `-`로 바꿔 유닛 이름이 됩니다: `/mnt/data` → `mnt-data.mount`.

## swap 항목

```bash
# fstab에 swap 항목 추가 후 활성화
sudo swapon -a          # fstab의 swap 전체 활성화
sudo swapoff -a         # 전체 비활성화
swapon --show           # 현재 swap 목록
```

스왑 파티션뿐 아니라 스왑 파일도 fstab에 등록할 수 있습니다(type `swap`, 옵션 `sw`).

## 정리

- `/etc/fstab`: 6필드(장치·마운트포인트·타입·옵션·dump·pass)
- 장치는 UUID= 방식이 가장 안정적
- 편집 후 `findmnt --verify` → `mount -a`로 반드시 검증
- `nofail` 옵션으로 이동식 미디어 안전하게 등록
- systemd가 fstab을 `.mount` 유닛으로 자동 변환

---

**지난 글:** [mount/umount — 파일시스템을 디렉터리 트리에 연결하기](/posts/linux-mount-umount/)

**다음 글:** [df/du — 디스크 사용량 확인하기](/posts/linux-disk-usage-df-du/)

<br>
읽어주셔서 감사합니다. 😊
