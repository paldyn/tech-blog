---
title: "파일 시스템 읽기 전용 복구"
description: "Read-only file system 에러의 원인인 I/O 오류, 파일 시스템 손상, 잘못된 마운트 옵션을 dmesg, mount, tune2fs로 진단하고 remount·fsck·복구 모드로 쓰기 가능 상태로 복구하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "filesystem", "readonly", "fsck", "recovery", "ext4", "troubleshooting"]
featured: false
draft: false
---

[지난 글](/posts/linux-shutdown-reboot-fail/)에서 종료 실패 문제를 살펴봤다. 이번에는 갑자기 모든 파일 쓰기가 실패하고 "Read-only file system" 에러가 발생하는 상황을 다룬다. 이 에러는 커널이 파일 시스템을 읽기 전용으로 전환했음을 의미한다. 커널은 디스크 I/O 오류나 파일 시스템 불일치를 감지하면 데이터 손상을 막기 위해 자동으로 읽기 전용으로 강등한다.

## 읽기 전용 전환이 발생하는 원인

1. **하드 디스크 I/O 오류** — 배드 섹터, 케이블 불량, 컨트롤러 오류
2. **파일 시스템 손상** — 갑작스러운 전원 차단 후 저널 불일치
3. **잘못된 마운트 옵션** — `/etc/fstab`에 `ro` 명시
4. **디스크 공간 부족** — 쓰기 실패로 일부 배포판이 읽기 전용 전환
5. **오버레이 파일 시스템** — 컨테이너/chroot 환경의 읽기 전용 레이어

![파일 시스템 읽기 전용 복구 흐름](/assets/posts/linux-fs-readonly-recover-flow.svg)

## 1단계 — dmesg로 원인 파악

```bash
dmesg | grep -E "I/O error|EXT4-fs error|Buffer I/O|SCSI error" | tail -20
```

출력 예:

```
EXT4-fs error (device sda1): ext4_journal_check_start:61: Detected aborted journal
EXT4-fs (sda1): Remounting filesystem read-only
Buffer I/O error on device sda1, logical block 12345
```

첫 번째 줄은 저널 손상으로 인한 자동 읽기 전용 전환이고, 두 번째 줄은 하드웨어 I/O 오류를 나타낸다.

## 2단계 — 현재 마운트 상태 확인

```bash
mount | grep "(ro"
findmnt -o TARGET,OPTIONS
```

루트 파일 시스템이 `(ro,relatime)` 상태로 표시되면 읽기 전용 마운트가 확인된 것이다.

```bash
# 임시 remount (H/W 오류 없을 때 시도)
sudo mount -o remount,rw /

# 특정 파티션
sudo mount -o remount,rw /var/log
```

remount 성공 후 테스트:

```bash
touch /tmp/test_write && echo "쓰기 가능 확인" && rm /tmp/test_write
```

## 3단계 — SMART 디스크 상태 점검

I/O 오류 로그가 있으면 하드웨어 상태를 확인한다.

```bash
# SMART 개요
sudo smartctl -a /dev/sda | grep -E "overall|Reallocated|Uncorrectable"

# 단기 자가 진단 실행
sudo smartctl -t short /dev/sda
```

SMART가 "FAILED" 또는 `Reallocated_Sector_Ct`가 높으면 디스크 교체를 고려한다.

![파일 시스템 복구 명령어](/assets/posts/linux-fs-readonly-recover-commands.svg)

## 4단계 — fsck로 파일 시스템 점검

루트 파티션이 아닌 경우 언마운트 후 실행:

```bash
sudo umount /dev/sdb1
sudo fsck -y /dev/sdb1
sudo mount /dev/sdb1 /data
```

루트 파티션(`/dev/sda1`)은 실행 중에 언마운트할 수 없다. 복구 모드(Recovery Mode)를 사용한다.

### 복구 모드에서 fsck

1. 재부팅 → GRUB 메뉴에서 "Advanced options" 선택
2. "Recovery mode" 커널 선택
3. 루트 셸 진입 후:

```bash
# 읽기-쓰기로 remount
mount -o remount,rw /

# 파일 시스템 점검 및 자동 수정
fsck -y /dev/sda1

# 강제 점검 (오류 없어도 실행)
fsck -f -y /dev/sda1
```

## 5단계 — fstab 옵션 확인

```bash
cat /etc/fstab | grep -v "^#"
```

마운트 옵션 컬럼에 `ro`가 있으면 `defaults`로 변경한다.

```
# 수정 전
/dev/sda1  /  ext4  ro,relatime  0 1

# 수정 후
/dev/sda1  /  ext4  defaults  0 1
```

## 저널 불일치 수동 복구

```bash
# 저널 상태 확인
sudo tune2fs -l /dev/sda1 | grep -E "state|journal"

# 저널 강제 재생성 (데이터 손실 위험 있음)
sudo tune2fs -O ^has_journal /dev/sda1
sudo mke2fs -O journal /dev/sda1
```

## 자주 발생하는 패턴 요약

| 원인 | dmesg 메시지 | 조치 |
|------|-------------|------|
| 전원 차단 후 저널 손상 | Detected aborted journal | fsck -y |
| 하드웨어 I/O 오류 | Buffer I/O error | SMART 점검 후 디스크 교체 |
| fstab 설정 오류 | (없음) | mount/fstab 수정 |
| 파일 시스템 가득 참 | No space left on device | 파일 삭제 후 remount |

파일 시스템이 읽기 전용으로 전환된 직후에는 `dmesg`가 가장 먼저 확인해야 할 정보다. I/O 오류 로그가 있으면 하드웨어 상태를 선행 점검하고, 소프트웨어 원인이라면 `fsck`로 복구한다.

---

**지난 글:** [종료 실패 — shutdown/reboot 멈춤 트러블슈팅](/posts/linux-shutdown-reboot-fail/)

**다음 글:** [SSH 설정 파손 복구](/posts/linux-corrupt-ssh-config/)

<br>
읽어주셔서 감사합니다. 😊
