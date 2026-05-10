---
title: "swap — 리눅스 가상 메모리 스왑 완전 정복"
description: "스왑 파티션과 스왑 파일 생성 방법, swapon/swapoff 사용법, swappiness 조정, zswap·zram 개요까지 리눅스 스왑 메모리를 체계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "swap", "swapon", "swapoff", "virtual-memory", "memory"]
featured: false
draft: false
---

[지난 글](/posts/linux-fsck/)에서 파일시스템 검사와 복구를 다뤘습니다. 이번에는 RAM이 부족할 때 디스크 공간을 임시 메모리로 활용하는 **스왑(swap)** 메모리를 완전히 이해합니다.

스왑은 커널의 **페이지 교체(page reclaim)** 메커니즘의 일부입니다. 프로세스가 요구하는 메모리가 물리 RAM을 초과하면 커널은 오랫동안 사용하지 않은 페이지를 스왑 공간으로 내보내고(`swap out`), 다시 필요하면 불러옵니다(`swap in`). 스왑이 없으면 OOM Killer가 프로세스를 강제 종료합니다.

## 스왑 파티션 vs 스왑 파일

![스왑 종류 비교](/assets/posts/linux-swap-types.svg)

```bash
# === 스왑 파티션 ===
# fdisk로 파티션 타입을 82(Linux swap)로 설정 후
sudo mkswap /dev/sdb2
sudo swapon /dev/sdb2

# === 스왑 파일 (클라우드 VM·유연한 크기 조정 권장) ===
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile          # 보안 필수
sudo mkswap /swapfile
sudo swapon /swapfile
```

클라우드 인스턴스나 파티션을 다시 나누기 어려운 환경에서는 스왑 파일이 더 유연합니다. 성능 차이는 SSD 환경에서는 무시할 수준입니다.

## 스왑 상태 확인

![스왑 관리 명령어](/assets/posts/linux-swap-commands.svg)

```bash
# 스왑 사용 현황
swapon --show
free -h

# 출력 예시
# NAME       TYPE  SIZE   USED PRIO
# /swapfile  file  2G     128M  -2

# /proc/meminfo로 상세 확인
grep Swap /proc/meminfo
# SwapTotal:      2097152 kB
# SwapFree:       1968640 kB
# SwapCached:        4096 kB
```

## /etc/fstab에 영구 등록

```bash
# 스왑 파일 fstab 등록
echo '/swapfile  none  swap  sw  0  0' | sudo tee -a /etc/fstab

# 스왑 파티션 fstab 등록 (UUID 방식)
UUID=$(blkid -s UUID -o value /dev/sdb2)
echo "UUID=$UUID  none  swap  sw  0  0" | sudo tee -a /etc/fstab

# 다음 부팅 시 활성화 확인
sudo swapon -a
swapon --show
```

## swappiness — 스왑 적극성 조정

`vm.swappiness`는 0~200 범위의 커널 파라미터로, 값이 낮을수록 RAM을 최대한 활용하고 스왑을 덜 씁니다.

```bash
# 현재 값 확인
cat /proc/sys/vm/swappiness    # 기본: 60

# 즉시 변경 (재부팅 후 초기화)
sudo sysctl vm.swappiness=10

# 영구 적용 (/etc/sysctl.conf 또는 /etc/sysctl.d/ 추가)
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
sudo sysctl -p /etc/sysctl.d/99-swap.conf
```

| 환경 | 권장 값 |
|---|---|
| 데스크톱 | 10~20 |
| 웹/앱 서버 | 10 |
| 데이터베이스 | 1~10 |
| VM 게스트 | 10 |

## 스왑 크기 가이드

| RAM | 권장 스왑 크기 |
|---|---|
| 2GB 이하 | RAM × 2 |
| 2~8GB | RAM × 1 |
| 8~64GB | RAM × 0.5 |
| 64GB 이상 | 32GB 또는 워크로드 기반 |

절전(hibernate)을 지원하려면 스왑이 RAM 크기 이상이어야 합니다.

## zswap과 zram — 압축 스왑

현대 커널은 스왑 공간을 디스크로 내보내기 전에 **압축**하는 기법을 제공합니다.

```bash
# zswap 상태 확인 (커널 빌드 시 포함된 경우)
cat /sys/module/zswap/parameters/enabled

# zram — RAM 내 압축 블록 장치 (Ubuntu/Fedora 기본)
lsblk | grep zram
swapon --show | grep zram

# zram 수동 설정
sudo modprobe zram
echo lz4 | sudo tee /sys/block/zram0/comp_algorithm
echo 2G | sudo tee /sys/block/zram0/disksize
sudo mkswap /dev/zram0
sudo swapon -p 100 /dev/zram0   # 높은 우선순위로 먼저 사용
```

zram은 RAM 내에서 압축 블록 장치를 만들어 디스크보다 훨씬 빠른 스왑을 제공합니다. Raspberry Pi나 메모리가 적은 시스템에서 특히 효과적입니다.

## 스왑 비활성화 및 제거

```bash
# 스왑 비활성화 (페이지를 RAM으로 옮김)
sudo swapoff /swapfile

# 파일 삭제
sudo rm /swapfile

# fstab에서 제거
sudo sed -i '/swapfile/d' /etc/fstab
```

`swapoff`는 스왑된 모든 페이지를 RAM으로 불러오므로 RAM 여유가 충분할 때 실행해야 합니다. RAM이 부족하면 `swapoff`가 멈출 수 있습니다.

## 정리

- 스왑: RAM 부족 시 디스크를 임시 메모리로 활용
- `mkswap 장치/파일` → `swapon` → fstab 등록
- 스왑 파일: `fallocate -l 2G /swapfile && chmod 600 && mkswap && swapon`
- `vm.swappiness=10`: 서버 권장 (스왑 사용 최소화)
- zram: RAM 내 압축 스왑 → 디스크보다 빠름

---

**지난 글:** [fsck — 파일시스템 검사와 손상 복구](/posts/linux-fsck/)

**다음 글:** [LVM 기초 — 유연한 논리 볼륨 관리](/posts/linux-lvm-basics/)

<br>
읽어주셔서 감사합니다. 😊
