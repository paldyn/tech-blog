---
title: "tune2fs — ext 파일시스템 슈퍼블록 조정과 resize2fs"
description: "tune2fs로 ext2/3/4 파일시스템의 레이블·예약 블록·저널·fsck 주기를 변경하고, resize2fs로 파일시스템 크기를 조정하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "tune2fs", "resize2fs", "ext4", "filesystem", "superblock"]
featured: false
draft: false
---

[지난 글](/posts/linux-mkfs-formats/)에서 `mkfs`로 파일시스템을 생성했습니다. 이번에는 이미 만들어진 ext2/3/4 파일시스템의 파라미터를 **재포맷 없이** 조정하는 `tune2fs`와, 파일시스템 크기를 늘리거나 줄이는 `resize2fs`를 다룹니다.

`tune2fs`는 파일시스템의 **슈퍼블록**(메타데이터 헤더)을 직접 수정합니다. 슈퍼블록에는 블록 크기, inode 수, 레이블, 저널 유무, fsck 검사 주기 등이 저장됩니다.

## 슈퍼블록 정보 조회

![tune2fs 슈퍼블록 파라미터](/assets/posts/linux-tune2fs-params.svg)

```bash
# 슈퍼블록 전체 정보 출력
sudo tune2fs -l /dev/sdb1

# 주요 항목만 확인
sudo tune2fs -l /dev/sdb1 | grep -E "volume|state|Reserved|Mount|Check"
```

`Filesystem state: clean`이면 마지막 마운트가 정상 해제됐다는 뜻입니다. `errors`이면 비정상 종료 후 fsck가 필요한 상태입니다.

## 자주 쓰는 tune2fs 조정

```bash
# 레이블 변경
sudo tune2fs -L newlabel /dev/sdb1

# 루트 예약 블록 비율 변경 (기본 5% → 1%)
sudo tune2fs -m 1 /dev/sdb1

# fsck 주기 비활성화 (마운트 횟수, 시간 모두)
sudo tune2fs -c 0 -i 0 /dev/sdb1

# 오류 발생 시 동작 설정
sudo tune2fs -e remount-ro /dev/sdb1  # 읽기 전용 재마운트
sudo tune2fs -e panic /dev/sdb1       # 커널 패닉 (데이터 보호)

# 저널 비활성화 (ext2로 다운그레이드)
sudo tune2fs -O ^has_journal /dev/sdb1

# 저널 재활성화 (ext3/4로 업그레이드)
sudo tune2fs -O has_journal /dev/sdb1
sudo e2fsck -f /dev/sdb1  # 변경 후 검사 권장
```

저널을 비활성화하면 쓰기 성능이 소폭 향상되지만, 비정상 종료 시 파일시스템 손상 위험이 커집니다. 임베디드나 읽기 전용 루트 환경이 아니라면 저널은 켜두는 것이 좋습니다.

## ext4 기능 플래그

`-O` 옵션으로 기능을 켜고(`+`) 끌(`^`) 수 있습니다.

```bash
# dir_index (HTree 디렉터리 인덱스) 활성화
sudo tune2fs -O dir_index /dev/sdb1
sudo e2fsck -fD /dev/sdb1   # 디렉터리 인덱스 재구성

# extents (연속 블록 할당) 활성화
sudo tune2fs -O extents /dev/sdb1

# 현재 활성화된 기능 확인
sudo tune2fs -l /dev/sdb1 | grep features
```

## resize2fs — 파일시스템 크기 조정

![resize2fs 파일시스템 확장](/assets/posts/linux-tune2fs-resize.svg)

파티션 크기를 바꿨다면 파일시스템도 함께 조정해야 새 공간이 인식됩니다.

```bash
# 파티션 전체를 채우도록 확장 (마운트 상태에서도 가능 — ext4)
sudo resize2fs /dev/sdb1

# 특정 크기로 확장
sudo resize2fs /dev/sdb1 50G

# LVM 논리 볼륨 확장 + FS 동시 처리 (lvresize -r)
sudo lvresize -L +10G -r /dev/vg0/lv_data
```

`lvresize -r`은 LVM 볼륨 확장과 `resize2fs`를 한 번에 처리해 줘서 편리합니다.

**축소 시 주의**: 파일시스템 축소는 반드시 **언마운트 후** 진행해야 합니다. 또한 현재 사용 중인 데이터보다 작게 줄이면 데이터 손실이 발생합니다.

```bash
# 축소 절차 (매우 신중하게)
sudo umount /dev/sdb1
sudo e2fsck -f /dev/sdb1      # 검사 필수
sudo resize2fs /dev/sdb1 20G  # 파일시스템 축소
# 그 다음 fdisk/parted로 파티션 자체도 축소
```

## 슈퍼블록 백업 복구

ext 파일시스템은 슈퍼블록 백업 사본을 여러 블록 그룹에 분산 저장합니다. 슈퍼블록이 손상됐을 때 백업으로 복구할 수 있습니다.

```bash
# 백업 슈퍼블록 위치 확인
sudo dumpe2fs /dev/sdb1 | grep "Backup superblock"

# 백업 슈퍼블록으로 fsck
sudo e2fsck -b 32768 /dev/sdb1
```

## 정리

- `tune2fs -l 장치`: 슈퍼블록 정보 조회
- `tune2fs -L 레이블`: 이름 변경
- `tune2fs -m 1`: 루트 예약 1%
- `tune2fs -c 0 -i 0`: fsck 자동 주기 비활성화
- `tune2fs -O ^has_journal`: 저널 토글
- `resize2fs 장치`: 파티션에 맞게 파일시스템 확장
- 축소는 반드시 언마운트 후, 데이터 백업 후 진행

---

**지난 글:** [mkfs — 파티션에 파일시스템 포맷하기](/posts/linux-mkfs-formats/)

**다음 글:** [fsck — 파일시스템 검사와 복구](/posts/linux-fsck/)

<br>
읽어주셔서 감사합니다. 😊
