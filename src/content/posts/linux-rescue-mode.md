---
title: "복구 모드와 emergency 타겟 — 부팅 실패 시 살아남기"
description: "rescue.target과 emergency.target으로 부팅 실패를 복구하는 방법, GRUB에서 복구 모드 진입, 라이브 USB chroot를 이용한 완전 복구 절차를 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["Linux", "복구모드", "rescue", "emergency", "GRUB", "chroot", "troubleshooting"]
featured: false
draft: false
---

[지난 글](/posts/linux-runlevels-vs-targets/)에서 systemd 타겟 체계를 살펴봤습니다. 타겟 중 `rescue.target`과 `emergency.target`은 시스템이 정상 부팅되지 않을 때 최소한의 환경을 제공하는 안전망입니다.

![복구 모드 진입 방법](/assets/posts/linux-rescue-mode-boot.svg)

## rescue.target vs emergency.target

두 타겟은 서로 다른 수준의 최소 환경을 제공합니다.

| 구분 | rescue.target | emergency.target |
|------|---------------|-----------------|
| 파일시스템 마운트 | 루트 FS (read-only) | 없음 (initramfs만) |
| 네트워크 | 없음 | 없음 |
| 서비스 | 최소 | 없음 |
| 사용 시점 | 서비스 실패, 설정 오류 | 루트 FS 마운트 실패 |

`rescue.target`은 루트 파일시스템이 마운트는 되지만 다른 서비스들이 시작되지 않는 상태입니다. 대부분의 복구 작업은 여기서 처리됩니다.

## GRUB에서 복구 모드 진입

시스템이 부팅 중 멈출 때 GRUB 화면에서 직접 타겟을 지정할 수 있습니다.

1. 부팅 중 **`e`** 키를 눌러 GRUB 편집 모드 진입
2. `linux ...` 줄 끝에 다음을 추가:

```bash
# rescue 모드 (대부분의 복구 작업)
systemd.unit=rescue.target

# emergency 모드 (최후 수단)
systemd.unit=emergency.target

# 또는 init=/bin/bash (systemd 없이 직접 쉘)
init=/bin/bash
```

3. **`Ctrl+X`** 또는 **`F10`**으로 부팅

## rescue 모드에서 복구 작업

진입하면 root 비밀번호를 요구합니다. (없으면 Enter로 통과 가능한 배포판도 있습니다.)

```bash
# 파일시스템을 읽기/쓰기로 리마운트 (필수!)
mount -o remount,rw /

# 파일시스템 검사 (읽기 전용 상태에서)
fsck /dev/sda2

# fstab 오류 수정 (잘못된 마운트 항목 제거)
vi /etc/fstab

# root 비밀번호 재설정
passwd root

# 깨진 패키지 복구 (Debian 계열)
apt --fix-broken install

# systemd 서비스 비활성화 (무한 재시도 서비스)
systemctl disable problem-service.service

# 정상 부팅으로 전환
systemctl default
# 또는 재부팅
reboot
```

## emergency.target에서 파일시스템 수동 마운트

루트 파일시스템 마운트 자체가 실패할 때 사용합니다.

```bash
# 현재 마운트 상태 확인
mount

# 수동으로 루트 파일시스템 마운트
mount -o rw /dev/sda2 /

# proc 마운트 (필수)
mount -t proc proc /proc

# sysfs 마운트
mount -t sysfs sysfs /sys

# 이후 파일 수정 작업 진행
```

## 라이브 USB를 이용한 chroot 복구

부팅 자체가 전혀 되지 않거나 GRUB도 깨진 경우, 라이브 USB로 부팅 후 chroot 환경을 만들어 복구합니다.

![라이브 USB chroot 복구](/assets/posts/linux-rescue-mode-chroot.svg)

```bash
# chroot 진입 후 할 수 있는 일:

# GRUB 재설치
grub-install /dev/sda
update-grub

# initramfs 재생성
update-initramfs -u

# 패키지 복구
apt update && apt --fix-broken install

# root 비밀번호 재설정
passwd root

# 손상된 서비스 비활성화
systemctl disable broken-service

# 복구 완료 후 chroot 탈출
exit
umount -R /mnt
reboot
```

## SELinux/AppArmor 임시 비활성화

보안 모듈 때문에 부팅이 안 될 때 GRUB 커널 파라미터에 추가합니다.

```bash
# SELinux 강제 모드 → 비활성
selinux=0

# AppArmor 비활성
apparmor=0

# 또는 단일 사용자 모드
single
```

## 비밀번호 없이 root 접근 (보안 우선)

일부 환경에서는 root 비밀번호 없이 rescue 진입을 막고 싶을 수 있습니다.

```bash
# GRUB 비밀번호 설정 (/etc/grub.d/40_custom)
set superusers="admin"
password_pbkdf2 admin <해시>

# 해시 생성
grub-mkpasswd-pbkdf2
```

복구 모드는 강력하지만 그만큼 물리적 접근이 보안 위협이 될 수 있습니다. 데이터센터 환경에서는 GRUB 비밀번호 설정이 권장됩니다.

---

**지난 글:** [런레벨과 systemd 타겟 — SysV에서 systemd로의 전환](/posts/linux-runlevels-vs-targets/)

**다음 글:** [로그인이 안 될 때 — 계정·PAM·쉘 문제 진단](/posts/linux-cant-login/)

<br>
읽어주셔서 감사합니다. 😊
