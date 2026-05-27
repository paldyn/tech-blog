---
title: "커널 모듈과 lsmod — 동적으로 확장되는 Linux 커널의 구조"
description: "커널 모듈(.ko)의 역할과 생명주기, lsmod·insmod·rmmod 명령으로 모듈을 조회·삽입·제거하는 방법을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["Linux", "커널", "모듈", "lsmod", "insmod", "rmmod", "드라이버"]
featured: false
draft: false
---

[지난 글](/posts/linux-initramfs/)에서 initramfs가 실제 루트 파일시스템을 마운트하기까지의 과정을 살펴봤습니다. 부팅 중에 initramfs가 디스크 드라이버나 파일시스템 드라이버를 동적으로 불러오는 장면이 있었는데, 그 핵심 메커니즘이 바로 **커널 모듈(Kernel Module)**입니다.

![커널 모듈 아키텍처](/assets/posts/linux-kernel-modules-lsmod-arch.svg)

## 커널 모듈이란

Linux 커널은 **모놀리식(monolithic)** 구조이면서도 **동적 확장**을 지원합니다. 모든 드라이버를 커널 본체에 정적으로 포함시키면 메모리 낭비가 심해지므로, 필요할 때만 메모리에 올리는 방식으로 설계됐습니다.

커널 모듈은 `.ko`(Kernel Object) 확장자를 가진 바이너리 파일입니다. `/lib/modules/$(uname -r)/` 디렉터리 아래에 커널 버전별로 관리됩니다.

```bash
# 현재 커널 버전 확인
uname -r
# 6.8.0-51-generic

# 해당 버전 모듈 경로 확인
ls /lib/modules/$(uname -r)/kernel/drivers/ | head -10
# acpi  ata  bluetooth  gpu  hid  input  net  scsi  usb ...
```

## lsmod — 현재 로드된 모듈 목록

`lsmod`는 현재 커널 메모리에 올라와 있는 모듈 목록을 보여줍니다. 내부적으로는 `/proc/modules`를 파싱해서 보기 좋게 출력합니다.

```bash
lsmod
# Module                  Size  Used by
# ext4                  974848  2
# mbcache                16384  1 ext4
# jbd2                  147456  1 ext4
# e1000e                315392  0
# usbcore               286720  8 uhci_hcd,ehci_hcd,...
```

![lsmod 출력 해부](/assets/posts/linux-kernel-modules-lsmod-output.svg)

컬럼별 의미:

| 컬럼 | 설명 |
|------|------|
| Module | 모듈 이름 (.ko 제외) |
| Size | 메모리 점유 크기 (bytes) |
| Used by | 참조 카운트 + 의존 모듈 목록 |

**Used by가 0**이면 아무도 사용하지 않으므로 안전하게 언로드할 수 있습니다. `>0`이면 의존 모듈이 있거나 하드웨어가 활성 상태라는 의미입니다.

```bash
# /proc/modules 원본 형식 확인
cat /proc/modules | head -5
# ext4 974848 2 - Live 0xffffffffc0a00000
# jbd2 147456 1 ext4, Live 0xffffffffc09c0000
```

## insmod — 모듈 직접 삽입

`insmod`는 `.ko` 파일 경로를 직접 지정해 모듈을 로드합니다. 의존성을 자동으로 해결하지 않으므로 의존 모듈을 먼저 직접 로드해야 합니다.

```bash
# 절대 경로로 직접 삽입
sudo insmod /lib/modules/$(uname -r)/kernel/drivers/net/e1000e/e1000e.ko

# 로드 확인
lsmod | grep e1000e
```

의존성 문제로 실패할 경우 커널이 에러를 반환합니다:

```bash
sudo insmod nvidia.ko
# insmod: ERROR: could not insert module: Unknown symbol in module
```

## rmmod — 모듈 제거

`rmmod`는 로드된 모듈을 메모리에서 제거합니다. Used by > 0이면 제거가 거부됩니다.

```bash
# 모듈 제거
sudo rmmod e1000e

# 강제 제거 (비권장)
sudo rmmod -f e1000e
```

`-f`(force)는 위험합니다. 하드웨어가 해당 드라이버를 사용 중일 때 강제 제거하면 시스템이 불안정해질 수 있습니다.

## 모듈 정보 조회 — modinfo

모듈을 로드하기 전에 정보를 확인하려면 `modinfo`를 사용합니다.

```bash
modinfo ext4
# filename: /lib/modules/.../kernel/fs/ext4/ext4.ko
# description: Fourth Extended Filesystem
# author: Remy Card, Stephen Tweedie, ...
# license: GPL
# depends: mbcache,jbd2
# vermagic: 6.8.0-51-generic SMP ...
```

`depends` 필드가 핵심입니다. insmod 사용 시 이 의존 모듈들을 먼저 로드해야 합니다.

## 의존성 그래프 확인

```bash
# 모듈 의존성 데이터베이스
cat /lib/modules/$(uname -r)/modules.dep | grep ext4
# kernel/fs/ext4/ext4.ko: kernel/fs/jbd2/jbd2.ko kernel/fs/mbcache.ko

# depmod — 의존성 DB 재생성
sudo depmod -a
```

`modules.dep` 파일은 `depmod` 명령이 생성하며, 커널 업데이트 후 자동으로 재생성됩니다.

## 자동 로드 설정

부팅 시 특정 모듈을 자동으로 로드하려면 `/etc/modules-load.d/` 아래에 설정 파일을 작성합니다.

```bash
# /etc/modules-load.d/custom.conf 예시
echo "loop" | sudo tee /etc/modules-load.d/loop.conf

# 블랙리스트 (로드 금지)
echo "blacklist nouveau" | sudo tee /etc/modprobe.d/blacklist-nouveau.conf
```

## 요약

```
.ko 파일                 lsmod (조회)
    |                        |
    v                  /proc/modules
insmod ──────────────→ 커널 메모리 로드
                             |
rmmod ←──────────────── Used by == 0?
```

커널 모듈은 Linux의 유연성을 뒷받침하는 핵심 기제입니다. `lsmod`로 현황을 파악하고, `insmod`/`rmmod`로 수동 제어하며, 다음 글에서 살펴볼 `modprobe`는 이 과정을 자동화해 줍니다.

---

**지난 글:** [initramfs — 임시 루트 파일시스템의 역할과 커스터마이징](/posts/linux-initramfs/)

**다음 글:** [modprobe와 modinfo — 의존성을 고려한 모듈 관리](/posts/linux-modprobe-modinfo/)

<br>
읽어주셔서 감사합니다. 😊
