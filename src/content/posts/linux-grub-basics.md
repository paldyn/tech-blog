---
title: "GRUB 기초 — 부트로더 설정과 복구"
description: "GRUB2의 BIOS/UEFI 구조 차이, grub.cfg 설정, 커스텀 부팅 항목 추가, grub rescue 탈출과 Live USB chroot 복구 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "grub", "bootloader", "uefi", "bios", "grub-rescue", "boot-repair", "grub.cfg"]
featured: false
draft: false
---

[지난 글](/posts/linux-boot-process/)에서 Linux 부팅 6단계 전체 흐름을 살펴봤습니다. 이번에는 그 두 번째 단계 — **GRUB2(GRand Unified Bootloader 2)** 의 구조와 설정, 그리고 부팅 실패 시 복구 방법을 상세히 다룹니다.

## GRUB2 파일 구조

![GRUB2 구조와 파일 배치](/assets/posts/linux-grub-basics-structure.svg)

GRUB2는 BIOS와 UEFI에서 파일 배치 방식이 다릅니다.

**BIOS 방식**: MBR(512바이트) → MBR gap의 core.img → `/boot/grub/` 모듈

**UEFI 방식**: ESP(EFI System Partition) → `/boot/efi/EFI/ubuntu/grubx64.efi` → `/boot/grub/grub.cfg`

공통 파일들:
- `/boot/grub/grub.cfg` — 자동 생성되는 부팅 메뉴 (직접 편집 금지)
- `/etc/default/grub` — 사용자 설정 (수정 후 `update-grub` 실행)
- `/etc/grub.d/` — 메뉴 항목 생성 스크립트
- `/boot/vmlinuz-*` — 커널 이미지
- `/boot/initrd.img-*` — initramfs 이미지

## /etc/default/grub 설정

```bash
# 주요 설정 항목
GRUB_DEFAULT=0                      # 기본 부팅 항목 번호 (0부터 시작)
GRUB_TIMEOUT=5                      # 메뉴 대기 시간 (초)
GRUB_TIMEOUT_STYLE=menu             # menu / countdown / hidden
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"  # 기본 커널 파라미터
GRUB_CMDLINE_LINUX=""               # 모든 항목(복구 포함) 파라미터
GRUB_DISABLE_RECOVERY="false"       # 복구 모드 숨기기
GRUB_GFXMODE="1920x1080"           # 해상도 (UEFI)

# 설정 변경 후 반드시 실행
sudo update-grub         # Debian/Ubuntu
sudo grub2-mkconfig -o /boot/grub2/grub.cfg  # RHEL/Fedora/CentOS
```

## 자주 쓰는 커널 파라미터

```bash
# /etc/default/grub → GRUB_CMDLINE_LINUX_DEFAULT에 추가

# 조용한 부팅 / 자세한 부팅 메시지
quiet splash        # 스플래시 화면
                    # (제거하면 커널 메시지 표시)

# root 장치 지정 (UUID 권장)
root=UUID=1234-5678

# 복구/디버깅용
init=/bin/bash      # 직접 bash 실행 (systemd 건너뜀)
rd.break            # initramfs에서 중단 (패스워드 복구 등)
single              # 단일 사용자 모드
systemd.unit=rescue.target  # rescue 타겟으로 부팅

# SELinux 임시 비활성
selinux=0
enforcing=0
```

## 커스텀 부팅 항목 추가

```bash
# /etc/grub.d/40_custom 파일에 추가
cat >> /etc/grub.d/40_custom <<'EOF'
menuentry "Custom Boot" {
    set root=(hd0,gpt2)
    linux /boot/vmlinuz-$(uname -r) root=/dev/sda2 ro quiet
    initrd /boot/initrd.img-$(uname -r)
}
EOF

sudo update-grub
```

## GRUB 설치 / 재설치

```bash
# BIOS 방식으로 /dev/sda에 설치
sudo grub-install /dev/sda

# UEFI 방식으로 설치
sudo grub-install \
    --target=x86_64-efi \
    --efi-directory=/boot/efi \
    --bootloader-id=ubuntu

# 설치 후 grub.cfg 재생성
sudo update-grub

# UEFI 부팅 항목 확인
efibootmgr -v
```

## grub rescue 모드에서 탈출

GRUB 설정이 깨지면 `grub rescue>` 프롬프트로 빠집니다.

![GRUB 복구 — grub rescue 탈출](/assets/posts/linux-grub-basics-rescue.svg)

```bash
# 1. 파티션 탐색
grub rescue> ls
# (hd0) (hd0,gpt1) (hd0,gpt2) ...

# 2. /boot/grub이 있는 파티션 찾기
grub rescue> ls (hd0,gpt2)/boot/grub/

# 3. root와 prefix 설정
grub rescue> set root=(hd0,gpt2)
grub rescue> set prefix=(hd0,gpt2)/boot/grub

# 4. 모듈 로드 후 일반 모드 진입
grub rescue> insmod normal
grub rescue> normal

# 5. 부팅 성공 후 grub 재설치
sudo update-grub
```

## Live USB로 GRUB 복구

grub rescue에서 복구가 어려울 때는 Live USB로 부팅해 chroot로 수리합니다.

```bash
# Live 환경에서:
# 1. 시스템 파티션 마운트
sudo mount /dev/sda2 /mnt
sudo mount /dev/sda1 /mnt/boot/efi    # UEFI라면

# 2. 가상 파일시스템 바인드 마운트
for d in dev proc sys; do
    sudo mount --bind /$d /mnt/$d
done

# 3. chroot 진입
sudo chroot /mnt

# 4. GRUB 재설치
grub-install /dev/sda                       # BIOS
# 또는
grub-install --target=x86_64-efi \
    --efi-directory=/boot/efi               # UEFI

update-grub

# 5. 나가기
exit
sudo umount -R /mnt
reboot
```

## GRUB 비밀번호 설정

부팅 메뉴 수정이나 특정 항목 실행에 비밀번호를 요구할 수 있습니다.

```bash
# 비밀번호 해시 생성
grub-mkpasswd-pbkdf2
# 출력: grub.pbkdf2.sha512.10000.XXXX...

# /etc/grub.d/40_custom에 추가
cat >> /etc/grub.d/40_custom <<'EOF'
set superusers="admin"
password_pbkdf2 admin grub.pbkdf2.sha512.10000.XXXX...
EOF

sudo update-grub
```

---

**지난 글:** [Linux 부팅 과정 — BIOS/UEFI에서 systemd까지](/posts/linux-boot-process/)

**다음 글:** [initramfs — 임시 루트 파일시스템의 역할과 커스터마이징](/posts/linux-initramfs/)

<br>
읽어주셔서 감사합니다. 😊
