---
title: "initramfs — 임시 루트 파일시스템의 역할과 커스터마이징"
description: "initramfs의 필요성, cpio 구조, 드라이버 로드와 pivot_root 동작, mkinitramfs/dracut으로 재생성하는 방법, rd.break를 이용한 패스워드 복구를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "initramfs", "initrd", "dracut", "mkinitramfs", "boot", "pivot-root", "password-recovery"]
featured: false
draft: false
---

[지난 글](/posts/linux-grub-basics/)에서 GRUB2가 커널과 initramfs를 메모리에 로드하는 과정을 살펴봤습니다. 이번에는 커널이 initramfs를 받아 실제 루트 파일시스템으로 전환하기 전 임시 환경인 **initramfs**의 구조와 역할을 심층적으로 다룹니다.

## initramfs가 필요한 이유

초기 Linux는 `initrd`(initial RAM disk) — 가상 블록 장치를 루프백으로 마운트하는 방식을 사용했습니다. 현재는 더 유연한 **initramfs(initial RAM filesystem)** — `tmpfs` 위에 압축 해제되는 cpio 아카이브로 대체됐습니다.

왜 별도의 임시 루트가 필요한가:

1. **복잡한 루트 장치 지원**: LVM, mdraid, LUKS 암호화, iSCSI, NFS 위에 루트를 두면 해당 드라이버가 커널 모듈 형태일 때 먼저 로드해야 함
2. **유연한 루트 전환**: `pivot_root` 또는 `switch_root`로 실제 루트로 교체
3. **모듈화**: 모든 드라이버를 커널에 내장하지 않아도 됨

![initramfs 동작 원리](/assets/posts/linux-initramfs-structure.svg)

## initramfs 내부 구조

initramfs는 `gzip`(또는 zstd, xz)으로 압축된 `cpio` 아카이브입니다.

```bash
# 파일 확인
file /boot/initrd.img-$(uname -r)
# /boot/initrd.img-6.8.0: gzip compressed data

# 내용 목록
lsinitramfs /boot/initrd.img-$(uname -r) | head -40

# 직접 압축 해제해서 탐색
mkdir /tmp/initramfs-inspect
cd /tmp/initramfs-inspect
zcat /boot/initrd.img-$(uname -r) | cpio -idm
ls -la
```

주요 구성:
```
/init           ← 진입점 (셸 스크립트 또는 systemd)
/bin/sh         ← BusyBox 셸
/sbin/          ← 기본 도구 (mount, umount, modprobe, ...)
/lib/modules/   ← 커널 모듈 (스토리지, 파일시스템 드라이버)
/etc/           ← udev 규칙, 설정
/usr/lib/       ← cryptsetup, lvm2, mdadm 등
```

## 부팅 과정에서 initramfs의 역할

```
커널이 initramfs cpio를 tmpfs에 압축 해제
    → /init 실행 (또는 systemd)
    → udev 시작, 장치 탐색
    → 필요한 커널 모듈 로드 (modprobe)
    → LUKS 암호화 해제 (필요 시 passphrase 입력)
    → LVM 볼륨 활성화 (필요 시)
    → 실제 루트 파일시스템 마운트 (/sysroot)
    → pivot_root (또는 switch_root)
    → /sbin/init (systemd) 실행
```

```bash
# 커널 파라미터로 루트 장치 지정
# cat /proc/cmdline
BOOT_IMAGE=/vmlinuz root=/dev/mapper/ubuntu--vg-ubuntu--lv ro quiet

# LVM 루트: 커널에 직접 LVM 드라이버 포함 불가 → initramfs 필요
```

## initramfs 재생성

![initramfs 관리 명령어](/assets/posts/linux-initramfs-commands.svg)

### Ubuntu / Debian — update-initramfs

```bash
# 현재 실행 중인 커널의 initramfs 갱신
sudo update-initramfs -u

# 특정 커널 버전용 새로 생성
sudo update-initramfs -c -k 6.8.0-45-generic

# 모든 설치된 커널 갱신
sudo update-initramfs -u -k all

# 자세한 로그로 생성
sudo update-initramfs -u -v 2>&1 | grep -i error
```

### RHEL / Fedora / CentOS — dracut

```bash
# 현재 커널 initramfs 강제 재생성
sudo dracut -f

# 특정 커널 버전
sudo dracut -f --kver 5.14.0-427.el9.x86_64

# 내용 확인 (dracut 방식)
sudo lsinitrd /boot/initramfs-$(uname -r).img | head -30

# 추가 모듈 포함
sudo dracut -f --add-drivers "nvme xfs"
```

## 커스텀 파일/모듈 추가

```bash
# Debian/Ubuntu: /etc/initramfs-tools/
# 추가할 모듈 목록
echo "nvme" >> /etc/initramfs-tools/modules

# 추가할 스크립트
cp myscript.sh /etc/initramfs-tools/scripts/local-top/
chmod +x /etc/initramfs-tools/scripts/local-top/myscript.sh

# dracut (RHEL): /etc/dracut.conf.d/
cat > /etc/dracut.conf.d/custom.conf <<'EOF'
add_drivers+="nvme btrfs"
install_items+="/usr/bin/jq"
EOF
sudo dracut -f
```

## rd.break로 패스워드 복구

root 패스워드를 잊었을 때 initramfs 단계에서 멈춰 복구할 수 있습니다.

```bash
# 1. GRUB 메뉴에서 'e' 키 → linux 행 끝에 추가:
#    rd.break
# Ctrl+X로 부팅

# 2. initramfs 셸에서:
# 실제 루트가 /sysroot에 읽기 전용으로 마운트됨
mount -o remount,rw /sysroot
chroot /sysroot

# 3. 패스워드 변경
passwd root

# 4. SELinux 레이블 재지정 (RHEL 계열)
touch /.autorelabel

# 5. 종료 및 재부팅
exit
exit   # initramfs 셸로 돌아감
# 이후 자동 재부팅 또는:
reboot -f
```

RHEL 계열에서는 `rd.break` 대신 `init=/bin/bash` 방식도 사용하지만, SELinux가 활성화된 경우 `rd.break` + `chroot` 방식이 더 안전합니다.

## initramfs 크기 최적화

```bash
# 현재 initramfs 크기
ls -lh /boot/initrd.img-$(uname -r)

# Ubuntu: 최소 모드 (필요한 것만 포함)
# /etc/initramfs-tools/initramfs.conf
MODULES=dep   # 의존성 분석으로 필요한 모듈만

# dracut: 호스트 전용 모드 (배포 이미지가 아닌 로컬 부팅 전용)
dracut -f --hostonly

# 압축 방식 변경 (xz는 더 작지만 느림, zstd는 빠름)
# /etc/dracut.conf.d/compression.conf
compress="zstd"
```

---

**지난 글:** [GRUB 기초 — 부트로더 설정과 복구](/posts/linux-grub-basics/)

<br>
읽어주셔서 감사합니다. 😊
