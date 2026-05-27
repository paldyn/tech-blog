---
title: "dmesg와 부트 로그 — 커널 링 버퍼 읽기"
description: "dmesg 명령으로 커널 printk 링 버퍼를 조회하는 방법, 로그 레벨 필터링, 타임스탬프 해석, 그리고 부팅 과정의 주요 메시지를 읽는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["Linux", "dmesg", "커널로그", "부트로그", "printk", "링버퍼", "troubleshooting"]
featured: false
draft: false
---

[지난 글](/posts/linux-proc-sys-tour/)에서 `/proc/sys`와 `/proc` 파일시스템을 탐방했습니다. 커널이 부팅하면서 내뱉는 메시지들은 `dmesg`를 통해 볼 수 있습니다. 하드웨어 에러나 드라이버 문제를 진단할 때 가장 먼저 열어보는 로그입니다.

![커널 링 버퍼 구조](/assets/posts/linux-dmesg-boot-logs-ringbuf.svg)

## dmesg란

`dmesg`는 커널의 **printk 링 버퍼** 내용을 출력합니다. 링 버퍼는 메모리에 상주하며 새 메시지가 들어오면 오래된 메시지부터 덮어씁니다. 기본 크기는 컴파일 시 `CONFIG_LOG_BUF_SHIFT`로 결정되며 보통 512KB~2MB입니다.

```bash
# 기본 출력
dmesg | head -20

# 사람이 읽기 좋은 형식 (타임스탬프 변환)
dmesg -T | tail -30
```

## 출력 형식 이해

![dmesg 출력 형식 해부](/assets/posts/linux-dmesg-boot-logs-format.svg)

타임스탬프 `[숫자]`는 부팅 후 경과 초(seconds since boot)입니다. `-T` 옵션을 쓰면 실제 날짜/시간으로 변환됩니다.

```bash
# 실제 시각으로 출력
dmesg -T
# [Thu May 28 09:00:01 2026] Linux version 6.8.0-51-generic ...

# 좀 더 짧게 (ISO 형식)
dmesg --time-format=iso
```

## 로그 레벨 필터링

커널 메시지에는 0(KERN_EMERG)부터 7(KERN_DEBUG)까지 로그 레벨이 붙습니다.

```bash
# 에러 이상만 출력 (장애 진단 첫 번째 단계)
dmesg -l err,crit,alert,emerg

# 경고 포함
dmesg -l warn,err,crit

# 특정 서브시스템 (facility) 지정
dmesg -f kern,daemon
```

실제 진단 시나리오:

```bash
# 디스크 I/O 에러 확인
dmesg -T | grep -i 'error\|fail\|warn' | grep -i 'sd\|nvme\|ata'

# OOM Killer 발동 확인
dmesg | grep -i 'out of memory\|oom_kill'

# 하드웨어 에러 (MCE)
dmesg | grep -i 'machine check\|mce'

# USB 연결/해제 이벤트
dmesg | grep -i 'usb\|hub'
```

## 실시간 모니터링

```bash
# 커널 메시지 실시간 추적
dmesg --follow
# 또는
dmesg -w

# 새로운 드라이버 로드 시 즉시 확인
sudo modprobe usbnet & dmesg -w
```

## 부팅 과정 주요 메시지

부팅 로그를 시간 순서대로 읽으면 전체 초기화 과정을 추적할 수 있습니다.

```bash
# 부트 로그 전체 조회
dmesg | less

# 커널 파라미터 확인 (GRUB에서 넘긴 cmdline)
dmesg | grep 'Command line'

# CPU 감지
dmesg | grep -i 'cpu\|processor' | head -5

# 메모리 감지
dmesg | grep -i 'memory\|RAM' | head -10

# PCI 장치 감지
dmesg | grep -i pci | head -10

# 네트워크 인터페이스 초기화
dmesg | grep -i 'eth\|ens\|enp\|wlan'

# SCSI/NVMe/SATA 디스크 감지
dmesg | grep -i 'sd\|nvme\|ata'

# 파일시스템 마운트
dmesg | grep -i 'mount\|ext4\|xfs\|btrfs'
```

## 링 버퍼 초기화와 크기 확인

```bash
# 버퍼 크기 확인
dmesg --buffer-size 2>&1 | head -1
# 또는
cat /proc/sys/kernel/dmesg_restrict

# 링 버퍼 초기화 (루트 권한)
sudo dmesg --clear

# 마지막 100줄만
dmesg | tail -100

# 특정 시간 이후 메시지만
dmesg --since "2026-05-28 09:00"
dmesg --until "2026-05-28 09:30"
```

## journald와의 관계

systemd 환경에서는 `journald`가 `/dev/kmsg`를 구독해 커널 메시지를 영구 저장합니다.

```bash
# journalctl로도 커널 로그 조회 가능
journalctl -k          # 이번 부팅 커널 로그
journalctl -k -b -1    # 이전 부팅 커널 로그
journalctl -k -p err   # 에러 이상만

# 이전 부팅 기록 목록
journalctl --list-boots
```

`dmesg`는 현재 부팅 세션의 링 버퍼만 보여주지만, `journalctl -k -b -1`로 이전 부팅의 커널 메시지까지 확인할 수 있습니다. 시스템 패닉 직전 로그를 분석할 때 특히 유용합니다.

## 보안 설정

```bash
# 일반 사용자의 dmesg 읽기 제한 확인
cat /proc/sys/kernel/dmesg_restrict
# 0: 모든 사용자 허용
# 1: 루트만 허용

# 제한 설정
sudo sysctl -w kernel.dmesg_restrict=1
```

---

**지난 글:** [/proc/sys 완전 탐방 — 커널이 열어놓은 가상 파일시스템](/posts/linux-proc-sys-tour/)

**다음 글:** [런레벨과 systemd 타겟 — SysV에서 systemd로의 전환](/posts/linux-runlevels-vs-targets/)

<br>
읽어주셔서 감사합니다. 😊
