---
title: "Linux 부팅 과정 — BIOS/UEFI에서 systemd까지"
description: "Linux 시스템이 전원 켜짐부터 로그인 프롬프트까지 도달하는 6단계 부팅 과정, BIOS vs UEFI, GRUB2, initramfs, systemd 순서를 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "boot", "bios", "uefi", "grub", "initramfs", "systemd", "kernel"]
featured: false
draft: false
---

[지난 글](/posts/linux-iptables-nat-docker/)에서 iptables NAT로 컨테이너 네트워크가 어떻게 동작하는지 살펴봤습니다. 이번에는 Linux 시스템이 전원이 켜지는 순간부터 로그인 프롬프트가 뜰 때까지 거치는 **6단계 부팅 과정** 전체를 단계별로 따라가 봅니다.

## 부팅 전체 흐름

![Linux 부팅 단계](/assets/posts/linux-boot-process-stages.svg)

## ① BIOS / UEFI — 하드웨어 초기화

전원이 켜지면 CPU는 정해진 메모리 주소(x86: `0xFFFFFFF0`)에 있는 펌웨어 코드를 실행합니다.

**BIOS(Legacy)**:
- POST(Power-On Self Test): RAM, CPU, 키보드 등 하드웨어 자가진단
- MBR(Master Boot Record): 첫 번째 부팅 디스크의 첫 512바이트에 부트로더 코드 위치
- 512바이트 제한으로 GRUB는 2단계로 분리됨 (stage 1 → stage 1.5 → stage 2)

**UEFI(현대)**:
- GPT 파티션 테이블 지원
- EFI System Partition(ESP, FAT32, 일반적으로 `/boot/efi`)에서 부트로더 로드
- Secure Boot: 디지털 서명으로 부트로더·커널 무결성 검증
- 더 빠른 초기화, 대용량 디스크 지원

```bash
# UEFI 또는 BIOS 확인
ls /sys/firmware/efi && echo "UEFI" || echo "BIOS/Legacy"

# UEFI 부팅 항목 확인
efibootmgr -v
```

## ② 부트로더 — GRUB2

**GRUB2(GRand Unified Bootloader 2)**는 현재 대부분의 Linux 배포판이 사용하는 부트로더입니다.

```bash
# GRUB 설정 파일 위치
# BIOS: /boot/grub/grub.cfg
# UEFI: /boot/efi/EFI/ubuntu/grub.cfg

# GRUB 설정 재생성 (수정 후 반드시 실행)
sudo update-grub              # Debian/Ubuntu
sudo grub2-mkconfig -o /boot/grub2/grub.cfg  # RHEL/Fedora

# 기본 설정 파일
cat /etc/default/grub
```

주요 GRUB 설정:

```bash
# /etc/default/grub
GRUB_DEFAULT=0            # 기본 부팅 항목
GRUB_TIMEOUT=5            # 선택 대기 시간
GRUB_CMDLINE_LINUX="quiet splash"  # 커널 파라미터
GRUB_DISABLE_RECOVERY="true"
```

GRUB 메뉴에서 `e` 키를 누르면 커널 파라미터를 임시로 수정할 수 있습니다. 복구 목적으로 `init=/bin/bash`를 추가해 직접 셸을 얻거나, `rd.break`로 initramfs 단계에서 멈출 수 있습니다.

## ③ 커널 초기화

GRUB가 `vmlinuz`(압축된 커널 이미지)를 메모리에 로드하면 커널이 자신을 압축 해제하고 초기화를 시작합니다.

```
vmlinuz 압축 해제
    → start_kernel() 함수 실행
    → 메모리 관리자 초기화 (MMU, 페이지 테이블)
    → 인터럽트 컨트롤러 초기화
    → 스케줄러 초기화
    → 드라이버 서브시스템 초기화 (PCI, USB, ...)
    → initramfs 마운트 및 /init 실행
```

커널에 전달되는 파라미터 확인:

```bash
# 현재 부팅에 사용된 커널 파라미터
cat /proc/cmdline
# BOOT_IMAGE=/vmlinuz-6.8.0 root=/dev/sda2 ro quiet splash

# 실행 중인 커널 버전
uname -r
```

## ④ initramfs — 임시 루트 파일시스템

initramfs(initial RAM filesystem)는 실제 루트 파일시스템을 마운트하기 전에 필요한 드라이버와 도구를 제공하는 **임시 루트 환경**입니다.

왜 필요한가:
- 루트 파일시스템이 LVM, RAID, LUKS 암호화, NFS 위에 있을 수 있음
- 해당 드라이버를 커널 내장이 아닌 모듈로 처리

```bash
# initramfs 이미지 위치
ls -lh /boot/initrd.img-$(uname -r)

# initramfs 내용 확인
lsinitramfs /boot/initrd.img-$(uname -r) | head -30

# initramfs 재생성 (Ubuntu/Debian)
sudo update-initramfs -u

# initramfs 재생성 (RHEL/Fedora)
sudo dracut -f
```

initramfs 내의 `/init` 스크립트가 실제 루트 파일시스템을 마운트하고 `pivot_root`로 루트를 전환한 뒤 systemd를 실행합니다.

## ⑤ systemd — PID 1

실제 루트 파일시스템이 마운트되면 커널이 `/sbin/init` → `/lib/systemd/systemd`를 PID 1로 실행합니다.

```bash
# PID 1 확인
ps -p 1 -o pid,comm
# PID  COMMAND
#   1  systemd

# 부팅 타겟 (런레벨) 확인
systemctl get-default
# graphical.target 또는 multi-user.target

# 부팅 순서 분석
systemd-analyze
systemd-analyze blame   # 각 서비스 시작 시간
systemd-analyze plot > boot.svg  # 타임라인 그래프
```

## 부팅 진단

![부팅 진단 명령어](/assets/posts/linux-boot-process-timing.svg)

```bash
# 커널 초기화 메시지 (타임스탬프 포함)
dmesg -T

# 부팅 실패 서비스 찾기
journalctl -b -p err

# 이전 부팅 로그 (비정상 종료 시 유용)
journalctl -b -1

# 특정 서비스 부팅 시 로그
journalctl -b -u NetworkManager
```

## BIOS vs UEFI 요약

| 항목 | BIOS | UEFI |
|------|------|------|
| 파티션 | MBR (최대 2TB) | GPT (최대 9.4 ZB) |
| 부팅 코드 위치 | MBR 첫 512B | ESP FAT32 파티션 |
| Secure Boot | 미지원 | 지원 |
| 부팅 속도 | 상대적으로 느림 | 빠름 |
| 네트워크 부팅 | BIOS PXE | UEFI PXE / HTTP Boot |

---

**지난 글:** [iptables NAT와 Docker 네트워크 — 컨테이너 트래픽 흐름](/posts/linux-iptables-nat-docker/)

**다음 글:** [GRUB 기초 — 부트로더 설정과 복구](/posts/linux-grub-basics/)

<br>
읽어주셔서 감사합니다. 😊
