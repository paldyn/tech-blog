---
title: "소프트웨어 RAID — mdadm으로 고가용성 스토리지 구성하기"
description: "Linux mdadm을 사용해 소프트웨어 RAID 0/1/5/6/10을 구성하는 방법, 장애 복구 절차, /proc/mdstat 모니터링까지 실무 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "raid", "mdadm", "storage", "redundancy", "disk", "ha"]
featured: false
draft: false
---

[지난 글](/posts/linux-lvm-basics/)에서 LVM으로 논리 볼륨을 유연하게 관리하는 법을 살펴봤습니다. 이번에는 한 단계 더 나아가 **디스크 장애에도 데이터를 보호하는 RAID**를 다룹니다. 서버 환경에서 디스크는 언제든 고장날 수 있고, 소프트웨어 RAID는 별도 하드웨어 없이도 강력한 데이터 가용성을 제공합니다.

## RAID란 무엇인가

**RAID(Redundant Array of Independent Disks)**는 여러 디스크를 하나의 논리 장치로 묶어 성능이나 신뢰성(또는 둘 다)을 높이는 기술입니다. 리눅스에서는 `mdadm`(multiple device admin) 도구로 커널 레벨의 소프트웨어 RAID를 구성합니다.

![RAID 레벨 비교](/assets/posts/linux-raid-mdadm-levels.svg)

핵심 개념을 정리하면:

- **스트라이핑(Striping)**: 데이터를 여러 디스크에 분산 → 성능 향상, 신뢰성 없음
- **미러링(Mirroring)**: 동일 데이터를 복수 디스크에 복제 → 신뢰성 향상, 용량 비효율
- **패리티(Parity)**: 에러 정정 데이터를 별도 저장 → 용량 효율과 신뢰성 균형

## 레벨별 특성 요약

| 레벨 | 용도 | 주의 |
|------|------|------|
| RAID 0 | 임시 데이터, 캐시 | 한 디스크 장애 = 전체 손실 |
| RAID 1 | OS, 부트 파티션 | 용량 50%만 사용 |
| RAID 5 | 범용 파일 서버 | 재구성 중 추가 장애 위험 |
| RAID 6 | 대용량 스토리지 | 쓰기 오버헤드 크다 |
| RAID 10 | 데이터베이스 | 비용 높음, 최고 성능+신뢰성 |

## 설치 및 RAID 배열 생성

`mdadm`은 대부분의 배포판에 포함되어 있습니다.

```bash
# Debian/Ubuntu
sudo apt install mdadm

# RHEL/Rocky
sudo dnf install mdadm
```

RAID 5 배열을 생성하는 예시입니다. 세 개의 추가 디스크(`/dev/sdb`, `/dev/sdc`, `/dev/sdd`)가 있다고 가정합니다.

```bash
# 기존 파티션 서명 제거 (선택)
sudo wipefs -a /dev/sdb /dev/sdc /dev/sdd

# RAID 5 생성
sudo mdadm --create /dev/md0 \
  --level=5 \
  --raid-devices=3 \
  /dev/sdb /dev/sdc /dev/sdd
```

생성 직후 `/proc/mdstat`을 보면 동기화(resync)가 시작됩니다.

```
$ cat /proc/mdstat
Personalities : [raid5]
md0 : active raid5 sdd[2] sdc[1] sdb[0]
      209584128 blocks super 1.2 level 5, 512k chunk, ...
      [====>................]  resync = 22.4% (...)
```

## 파일시스템 생성 및 마운트

배열 초기화가 완료되면 일반 블록 장치처럼 사용합니다.

```bash
# 파일시스템 생성
sudo mkfs.ext4 /dev/md0

# 마운트
sudo mkdir /mnt/raid5
sudo mount /dev/md0 /mnt/raid5

# 부팅 시 자동 마운트 (fstab 등록)
sudo mdadm --detail --scan | sudo tee -a /etc/mdadm/mdadm.conf
sudo update-initramfs -u
echo '/dev/md0 /mnt/raid5 ext4 defaults 0 0' | sudo tee -a /etc/fstab
```

## 배열 모니터링

![mdadm 핵심 명령어 참조](/assets/posts/linux-raid-mdadm-commands.svg)

```bash
# 배열 상세 정보
sudo mdadm --detail /dev/md0

# 모든 배열 한 번에
sudo mdadm --detail --scan

# 실시간 동기화 상태
watch -n1 cat /proc/mdstat
```

`--detail` 출력에서 중요한 항목:

```
State : clean          ← 정상 상태
Active Devices : 3
Rebuild Status : 0% complete   ← 재구성 중
```

`State`가 `clean`이면 정상, `degraded`면 디스크 한 개 이상 이탈한 상태입니다.

## 디스크 교체 — 장애 복구 실습

RAID 5에서 `/dev/sdb`가 고장났다고 가정합니다.

```bash
# 1. 장애 디스크 수동 표시 (자동으로 표시된 경우 생략)
sudo mdadm --fail /dev/md0 /dev/sdb

# 2. 배열에서 제거
sudo mdadm --remove /dev/md0 /dev/sdb

# 3. 새 디스크 삽입 후 추가 → 재구성 자동 시작
sudo mdadm --add /dev/md0 /dev/sde
```

재구성 완료까지 용량·부하에 따라 수십 분~수 시간이 소요됩니다. `/proc/mdstat`으로 진행률을 추적하세요.

## 스페어 디스크 — 자동 복구 구성

핫 스페어를 미리 등록해 두면 장애 발생 시 **자동으로 재구성**이 시작됩니다.

```bash
# RAID 5 생성 시 스페어 포함
sudo mdadm --create /dev/md0 \
  --level=5 \
  --raid-devices=3 \
  --spare-devices=1 \
  /dev/sdb /dev/sdc /dev/sdd /dev/sde

# 기존 배열에 스페어 추가
sudo mdadm --add /dev/md0 /dev/sde
```

## RAID 배열 중지 및 삭제

```bash
# 마운트 해제 후 중지
sudo umount /mnt/raid5
sudo mdadm --stop /dev/md0

# 슈퍼블록 완전 삭제 (디스크 재사용 시)
sudo mdadm --zero-superblock /dev/sdb /dev/sdc /dev/sdd
```

## 실무 팁

**청크 크기 선택**: 기본 512KB는 범용 워크로드에 적합합니다. 랜덤 읽기 중심(DB)이면 더 작게(64KB), 순차 대용량(스트리밍)이면 더 크게(1MB) 설정합니다.

```bash
# 청크 크기 지정
sudo mdadm --create /dev/md0 --level=5 \
  --chunk=128 --raid-devices=3 /dev/sd{b,c,d}
```

**이메일 알림**: `/etc/mdadm/mdadm.conf`에 `MAILADDR root`를 추가하면 장애 시 메일 알림을 받을 수 있습니다.

**RAID vs LVM**: 두 기술은 상호 보완적입니다. 실무에서는 RAID로 물리 디스크를 보호한 뒤, 그 위에 LVM을 올려 유연한 볼륨 관리를 하는 구성(`RAID → LVM → 파일시스템`)이 자주 쓰입니다.

---

**다음 글:** [ZFS·Btrfs — 차세대 파일시스템 비교](/posts/linux-zfs-btrfs/)

<br>
읽어주셔서 감사합니다. 😊
