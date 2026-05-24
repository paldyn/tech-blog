---
title: "tmpfs·procfs·sysfs — 메모리와 커널이 만드는 가상 파일시스템"
description: "tmpfs로 RAM 기반 고속 임시 저장소를 만들고, procfs로 프로세스 정보를 읽고 커널 파라미터를 조작하고, sysfs로 하드웨어를 제어하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "filesystem", "tmpfs", "procfs", "sysfs", "virtual-filesystem", "kernel", "proc", "sys"]
featured: false
draft: false
---

[지난 글](/posts/linux-symlink-pitfalls/)에서 심볼릭 링크 함정을 살펴봤습니다. 이번에는 디스크 없이 커널이 직접 생성하는 **가상 파일시스템(Virtual Filesystem)** 세 종류를 알아봅니다. `/tmp`, `/proc`, `/sys` — 모두 부팅할 때 메모리에 만들어지고, 재부팅하면 사라집니다.

## 세 파일시스템 한눈에 비교

![tmpfs·procfs·sysfs 비교](/assets/posts/linux-tmpfs-procfs-sysfs-overview.svg)

리눅스 부팅 후 `mount` 명령을 실행하면 디스크 파티션 외에 이 세 가지 파일시스템이 자동으로 마운트되어 있습니다.

```bash
findmnt -t tmpfs,proc,sysfs
# TARGET     SOURCE  FSTYPE  OPTIONS
# /proc      proc    proc    rw,nosuid,nodev,noexec
# /sys       sysfs   sysfs   rw,nosuid,nodev,noexec
# /run       tmpfs   tmpfs   rw,nosuid,nodev,size=10%
# /dev/shm   tmpfs   tmpfs   rw,nosuid,nodev
# /tmp       tmpfs   tmpfs   rw,nosuid,nodev
```

## tmpfs — RAM 기반 임시 저장소

tmpfs는 **메모리를 파일시스템처럼** 쓸 수 있게 합니다. 일반 파일시스템과 동일한 API로 읽고 쓸 수 있지만, 모든 데이터는 RAM(필요시 스왑)에만 저장됩니다.

### 주요 마운트 포인트

| 경로 | 용도 |
|------|------|
| `/tmp` | 프로그램 임시 파일 |
| `/run` | systemd 런타임 파일(PID, 소켓) |
| `/dev/shm` | POSIX 공유 메모리 |
| `/run/user/{uid}` | 사용자별 런타임 디렉터리 |

### tmpfs 직접 마운트

```bash
# 1GB 제한 tmpfs 마운트
sudo mount -t tmpfs -o size=1G tmpfs /mnt/ramdisk

# fstab에 영구 등록 (noexec: 실행 파일 차단)
tmpfs   /tmp   tmpfs   size=2G,mode=1777,noexec,nosuid   0 0

# 현재 사용량 확인
df -h /tmp /run /dev/shm
```

tmpfs는 **실제로 필요한 만큼만 메모리를 사용**합니다. `size=2G`로 설정해도 1MB만 쓰면 1MB만 점유합니다.

### 빌드 속도 개선에 활용

컴파일 중간 파일을 tmpfs에 올리면 I/O 병목을 크게 줄일 수 있습니다.

```bash
# CMake 빌드 디렉터리를 tmpfs에
sudo mount -t tmpfs -o size=4G tmpfs /build
cmake -B /build -S /src
cmake --build /build -j$(nproc)
```

## procfs — 프로세스와 커널의 창

`/proc`는 **커널이 실시간으로 생성하는 프로세스 정보** 및 커널 파라미터를 파일 트리로 보여줍니다. `ps`, `top`, `lsof` 같은 도구들이 실제로 `/proc`를 읽어서 동작합니다.

### 프로세스 디렉터리 구조

```bash
# 각 PID 디렉터리 주요 파일
ls /proc/1234/
# cmdline  cwd  environ  exe  fd/  maps  mem  net/  root  stat  status

# 실행 명령어 확인
cat /proc/1234/cmdline | tr '\0' ' '

# 메모리 맵
cat /proc/1234/maps

# 열린 파일 디스크립터
ls -la /proc/1234/fd/

# 현재 프로세스
cat /proc/self/status | grep -E 'Name|Pid|VmRSS'
```

### 커널 전역 정보

```bash
# CPU 정보
cat /proc/cpuinfo | grep 'model name' | head -1

# 메모리 정보
cat /proc/meminfo | head -10

# 실행 중인 인터럽트 수
cat /proc/interrupts

# 마운트 목록 (findmnt의 원본)
cat /proc/mounts
```

### 커널 파라미터 조작 (/proc/sys)

```bash
# IP 포워딩 활성화 (임시)
echo 1 > /proc/sys/net/ipv4/ip_forward

# sysctl로 동일하게 (권장 방법)
sysctl -w net.ipv4.ip_forward=1

# 영구 적용: /etc/sysctl.conf 또는 /etc/sysctl.d/*.conf
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.d/99-forward.conf
sysctl -p
```

## sysfs — 하드웨어와 드라이버 트리

![가상 파일시스템 사용 명령어](/assets/posts/linux-tmpfs-procfs-sysfs-usage.svg)

`/sys`는 **커널 디바이스 드라이버 모델**을 파일 트리로 노출합니다. procfs가 프로세스 중심이라면 sysfs는 하드웨어 중심입니다. `udev`가 `/sys`의 이벤트를 감지해 `/dev` 노드를 생성합니다.

### 주요 디렉터리

| 경로 | 내용 |
|------|------|
| `/sys/class/net/` | 네트워크 인터페이스 |
| `/sys/class/block/` | 블록 디바이스 |
| `/sys/class/power_supply/` | 배터리·AC 어댑터 |
| `/sys/bus/pci/devices/` | PCI 디바이스 목록 |
| `/sys/devices/system/cpu/` | CPU 정보·주파수 |

### 실전 활용 예시

```bash
# 배터리 잔량
cat /sys/class/power_supply/BAT0/capacity

# 네트워크 인터페이스 MTU 읽기/변경
cat /sys/class/net/eth0/mtu
echo 9000 > /sys/class/net/eth0/mtu  # Jumbo Frame

# CPU 주파수 (kHz)
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq

# 디스크 큐 깊이
cat /sys/block/sda/queue/nr_requests

# LED 제어 (Raspberry Pi 등)
echo 0 > /sys/class/leds/led0/brightness  # LED 끄기
```

## 컨테이너에서의 가상 파일시스템

컨테이너는 네임스페이스로 격리된 **별도의 `/proc` 뷰**를 가집니다. 컨테이너 안에서 `cat /proc/1/cmdline`을 읽으면 호스트의 PID 1이 아니라 컨테이너의 PID 1(보통 앱 프로세스)이 보입니다.

```bash
# 컨테이너 안: 격리된 /proc
docker run --rm alpine cat /proc/1/cmdline
# /bin/sh 또는 컨테이너 진입점

# 호스트: 해당 컨테이너의 실제 PID로 /proc 접근 가능
cat /proc/$(docker inspect --format '{{.State.Pid}}' my_container)/status
```

---

**지난 글:** [심볼릭 링크의 함정 — 깨진 링크와 순환 참조 피하기](/posts/linux-symlink-pitfalls/)

**다음 글:** [NFS 마운트 — 네트워크 파일시스템 공유와 연결](/posts/linux-nfs-mount/)

<br>
읽어주셔서 감사합니다. 😊
