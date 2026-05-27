---
title: "/proc/sys 완전 탐방 — 커널이 열어놓은 가상 파일시스템"
description: "/proc 가상 파일시스템의 구조와 프로세스 정보 파일들, /proc/sys 내 kernel·vm·net·fs 네임스페이스의 주요 파라미터를 실습 중심으로 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["Linux", "proc", "procfs", "sysctl", "커널", "가상파일시스템"]
featured: false
draft: false
---

[지난 글](/posts/linux-sysctl/)에서 `sysctl` 명령으로 `/proc/sys` 파일들을 읽고 쓰는 법을 배웠습니다. 이번에는 한 발 더 들어가 `/proc` 가상 파일시스템 전체를 탐방합니다.

## /proc란

`/proc`는 **procfs(Process Filesystem)**로, 디스크에 실제 존재하지 않는 가상 파일시스템입니다. 커널이 내부 상태를 사용자 공간에 파일 인터페이스로 노출하기 위해 마운트합니다.

```bash
# /proc 마운트 확인
mount | grep proc
# proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)

# 디스크 공간 차지 없음
df -h /proc
# Filesystem  Size  Used Avail  Use%  Mounted on
# proc           0     0     0    -   /proc
```

모든 파일은 커널이 요청 시 동적으로 생성하므로 크기가 0으로 표시되지만 실제로 내용은 있습니다.

## 프로세스별 디렉터리

숫자로 된 디렉터리가 각 PID를 나타냅니다.

![/proc 프로세스 정보 구조](/assets/posts/linux-proc-sys-tour-proc.svg)

```bash
# PID 1 (systemd/init) 정보
ls /proc/1/
# cmdline  cwd  environ  exe  fd  maps  mem  net  root  stat  status ...

# 실행 중인 명령어 (null 구분자 → 공백 변환)
cat /proc/1/cmdline | tr '\0' ' '
# /usr/lib/systemd/systemd --system --deserialize=31

# 메모리 사용 요약
cat /proc/$$/status | grep -E 'VmRSS|VmSize'
# VmSize:   16384 kB   (가상 메모리)
# VmRSS:     3072 kB   (실제 RAM 사용)

# 열린 파일 디스크립터
ls -la /proc/$$/fd/
# 0 → /dev/pts/0  (stdin)
# 1 → /dev/pts/0  (stdout)
# 2 → /dev/pts/0  (stderr)
```

## /proc/sys 네임스페이스 탐방

![/proc/sys 디렉터리 구조](/assets/posts/linux-proc-sys-tour-map.svg)

### kernel — 시스템 식별과 보안

```bash
# 호스트명 읽기 (hostname 명령과 동일)
cat /proc/sys/kernel/hostname

# 최대 PID 값 확인
cat /proc/sys/kernel/pid_max
# 4194304

# 주소 공간 무작위화 (ASLR)
# 0=off, 1=부분, 2=완전 무작위
cat /proc/sys/kernel/randomize_va_space
# 2

# Magic SysRq 키 활성화 여부
cat /proc/sys/kernel/sysrq
# 176  (bitmask)
```

### vm — 가상 메모리 정책

```bash
# 스왑 적극성 (기본 60, 낮을수록 RAM 유지)
cat /proc/sys/vm/swappiness

# 페이지 캐시 회수 압력
# 100=기본, 낮추면 캐시 더 오래 유지
cat /proc/sys/vm/vfs_cache_pressure

# 더티 페이지 플러시 임계값
cat /proc/sys/vm/dirty_ratio          # 전체 RAM 대비 % (hard limit)
cat /proc/sys/vm/dirty_background_ratio  # 백그라운드 flush 시작점

# OOM Killer 동작
cat /proc/sys/vm/overcommit_memory
# 0=휴리스틱, 1=항상 허용, 2=엄격
```

### net — 네트워크 스택

```bash
# 연결 큐 최대 크기
cat /proc/sys/net/core/somaxconn
# 4096

# SYN 쿠키 (SYN Flood 방어)
cat /proc/sys/net/ipv4/tcp_syncookies
# 1

# IPv4 포워딩 (컨테이너/VM 호스트 필수)
cat /proc/sys/net/ipv4/ip_forward

# TCP TIME_WAIT 소켓 수
cat /proc/sys/net/ipv4/tcp_max_tw_buckets
```

### fs — 파일시스템 한도

```bash
# 시스템 전체 오픈 파일 수 한도
cat /proc/sys/fs/file-max

# 현재 오픈 파일 수 / 오픈 가능 최대 / file-max
cat /proc/sys/fs/file-nr
# 8384   0   2097152

# inotify 감시 한도
cat /proc/sys/fs/inotify/max_user_watches
```

## /proc 루트의 시스템 파일들

```bash
# CPU 정보
cat /proc/cpuinfo | grep 'model name' | head -1

# 메모리 상세 정보
cat /proc/meminfo | head -10
# MemTotal:       32768 MB
# MemFree:         8192 MB
# MemAvailable:   16384 MB
# Buffers:          512 MB
# Cached:          8192 MB

# 부하 평균 (uptime의 데이터 소스)
cat /proc/loadavg
# 0.52 0.48 0.42 3/312 12345
# 1분  5분  15분  실행중/전체  최근PID

# 커널 버전
cat /proc/version

# 부팅 후 경과 시간 (초)
cat /proc/uptime
```

## /proc/net — 네트워크 상태

```bash
# 열린 TCP 연결 (ss/netstat의 원본 데이터)
cat /proc/net/tcp | head -5

# ARP 테이블
cat /proc/net/arp

# 라우팅 테이블
cat /proc/net/route

# 네트워크 인터페이스 통계
cat /proc/net/dev
```

## 활용 팁

```bash
# 프로세스가 열고 있는 파일 추적 (lsof 대체)
ls -la /proc/$(pgrep nginx)/fd/

# 메모리 누수 의심 프로세스의 매핑 확인
cat /proc/$(pgrep mysqld)/maps | grep -c 'r--p'

# 컨테이너 내 proc 격리 확인
ls /proc/1/ns/
# cgroup  ipc  mnt  net  pid  uts ...
```

`/proc`는 커널 내부를 들여다보는 창입니다. `ps`, `top`, `netstat`, `lsof` 등 모든 시스템 모니터링 도구가 실제로는 이 파일들을 파싱해 동작합니다.

---

**지난 글:** [sysctl — 커널 파라미터를 런타임에 조정하기](/posts/linux-sysctl/)

**다음 글:** [dmesg와 부트 로그 — 커널 링 버퍼 읽기](/posts/linux-dmesg-boot-logs/)

<br>
읽어주셔서 감사합니다. 😊
