---
title: "fsck — 파일시스템 검사와 손상 복구"
description: "e2fsck의 5단계 검사 과정, 주요 옵션, 종료 코드 활용, lost+found 파일 처리, xfs_repair·btrfs check 등 파일시스템별 검사 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "fsck", "e2fsck", "filesystem", "recovery", "ext4"]
featured: false
draft: false
---

[지난 글](/posts/linux-tune2fs/)에서 `tune2fs`로 ext 파일시스템 파라미터를 조정하는 방법을 배웠습니다. 이번에는 파일시스템이 손상됐을 때 검사하고 복구하는 `fsck`(File System Check)를 다룹니다.

갑작스러운 전원 차단, 커널 패닉, 하드웨어 오류 후 재부팅하면 파일시스템이 `dirty` 상태일 수 있습니다. 이때 fsck가 실행되어 불일치를 찾아 수정합니다. 최신 저널링 파일시스템(ext4, xfs, btrfs)은 저널 덕분에 전체 fsck 없이도 빠른 복구가 가능하지만, 하드웨어 오류나 심각한 손상은 여전히 fsck가 필요합니다.

## e2fsck 5단계 검사 흐름

![e2fsck 5단계 검사 흐름](/assets/posts/linux-fsck-phases.svg)

각 단계는 이전 단계의 결과를 바탕으로 진행됩니다. `Phase 1`에서 inode 구조를 검증하고, `Phase 2`에서 디렉터리 엔트리가 유효한 inode를 가리키는지 확인합니다. `Phase 3`에서 부모 디렉터리가 없는 고아 inode를 `lost+found`에 배치하고, `Phase 4`에서 링크 카운트 불일치를 수정합니다. `Phase 5`에서 블록·inode 비트맵을 갱신합니다.

## 기본 사용법

```bash
# 파일시스템 강제 검사 (-f: clean 상태도 강제 실행)
sudo e2fsck -f /dev/sdb1

# 자동 수정 모드 (-p: 안전한 수정만 자동으로)
sudo e2fsck -fp /dev/sdb1

# 대화형 수정 (-y: 모든 질문에 yes, -n: no로 시뮬레이션)
sudo e2fsck -y /dev/sdb1

# 백업 슈퍼블록 사용 (슈퍼블록 손상 시)
sudo dumpe2fs /dev/sdb1 | grep "Backup superblock" | head -3
sudo e2fsck -b 32768 /dev/sdb1
```

**중요**: `e2fsck`는 반드시 **언마운트된** 파일시스템에서 실행해야 합니다. 마운트된 파일시스템에 실행하면 데이터 손상이 발생할 수 있습니다. 루트 파일시스템은 재부팅 후 단일 사용자 모드에서 실행합니다.

## fsck 종료 코드

![fsck 종료 코드](/assets/posts/linux-fsck-exit-codes.svg)

```bash
# 스크립트에서 결과 판별
sudo e2fsck -fp /dev/sdb1
rc=$?
if (( rc & 4 )); then
    echo "수동 수정 필요 — 관리자 개입"
elif (( rc & 2 )); then
    echo "재부팅 필요"
elif (( rc & 1 )); then
    echo "오류 수정됨 — 재부팅 권장"
else
    echo "파일시스템 정상"
fi
```

종료 코드는 비트마스크입니다. 코드 `5`(=1+4)처럼 복합될 수 있어 `==` 대신 비트 AND(`&`)로 확인합니다.

## lost+found 파일 처리

```bash
# lost+found 내용 확인
ls -la /mnt/data/lost+found/

# 파일 타입 추측 (file 명령으로)
file /mnt/data/lost+found/#12345

# inode 번호로 원래 경로 찾기 (삭제 전 로그나 lsof 필요)
find /mnt/data -inum 12345 2>/dev/null
```

`lost+found`의 파일 이름은 inode 번호입니다. `file` 명령으로 내용 타입을 확인한 뒤 적절한 위치로 옮기세요.

## 파일시스템별 검사 도구

```bash
# XFS 검사 및 복구
sudo xfs_repair /dev/sdc1
sudo xfs_repair -n /dev/sdc1   # 드라이 런 (수정 없이 확인만)

# btrfs 검사
sudo btrfs check /dev/sde1
sudo btrfs check --repair /dev/sde1   # 복구 (위험 — 데이터 백업 필수)

# 마운트된 btrfs 스크럽 (온라인 가능)
sudo btrfs scrub start /mnt/data
sudo btrfs scrub status /mnt/data
```

`xfs_repair`는 xfs 파일시스템을 자동으로 복구하고, `btrfs scrub`은 마운트된 상태에서 체크섬 오류를 검사합니다.

## 부팅 시 자동 fsck 강제

```bash
# 다음 부팅 시 루트 FS 강제 검사 (전통적 방법)
sudo touch /forcefsck

# tune2fs로 마운트 횟수 기반 검사 설정
sudo tune2fs -c 30 /dev/sda1   # 30번 마운트마다 fsck

# systemd 환경에서 부팅 시 fsck 로그 확인
journalctl -b | grep fsck
```

## 정리

- `e2fsck -f 장치`: ext 파일시스템 강제 검사
- `-fp`: 자동 수정(안전한 항목만)
- `-y`: 모든 질문에 yes로 자동 수정
- 종료 코드는 비트마스크: 0=정상, 1=수정됨, 4=미수정 오류
- `lost+found`: 고아 inode 보관 — 복구 후 수동 확인
- XFS: `xfs_repair`, btrfs: `btrfs check` 또는 `scrub`
- 마운트된 파일시스템에 절대 실행 금지

---

**지난 글:** [tune2fs — ext 파일시스템 슈퍼블록 조정과 resize2fs](/posts/linux-tune2fs/)

**다음 글:** [swap — 가상 메모리 스왑 완전 정복](/posts/linux-swap/)

<br>
읽어주셔서 감사합니다. 😊
