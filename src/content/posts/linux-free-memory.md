---
title: "free — 메모리 사용량 정확하게 읽기"
description: "free 명령 출력의 used, buff/cache, available 컬럼 차이를 명확히 설명합니다. 페이지 캐시 개념, 메모리 부족 신호 판단법, /proc/meminfo 심층 분석까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "free", "memory", "cache", "buffer", "swap", "oom", "proc"]
featured: false
draft: false
---

[지난 글](/posts/linux-mpstat-sar/)에서 CPU 성능 분석 도구를 배웠습니다. 성능 문제의 또 다른 주요 원인은 메모리 부족입니다. `free` 명령은 단순해 보이지만 출력을 잘못 읽으면 메모리가 꽉 찼다고 오해하기 쉽습니다.

## free -h 출력 이해

```bash
$ free -h
              total    used    free   shared  buff/cache  available
Mem:          15.5G    4.2G    2.1G    350M        9.2G        10.6G
Swap:          2.0G    0.0G    2.0G
```

![Linux 메모리 구조 — free 명령 기준](/assets/posts/linux-free-memory-layout.svg)

많은 사람이 `free` 컬럼을 보고 "메모리가 2G밖에 안 남았다"고 걱정합니다. 실제로 사용 가능한 메모리는 `available` 컬럼인 **10.6G**입니다.

## buff/cache는 재사용 가능한 메모리

Linux 커널은 빈 메모리를 파일 캐시로 채웁니다. 한번 읽은 파일을 메모리에 캐시해 두면 다음 접근이 수십 배 빨라집니다. `buff/cache`(9.2G)는 언제든 프로세스 요청 시 해제할 수 있는 메모리입니다.

`available`은 `free + 해제 가능한 캐시`의 추정치로, **실제로 새 프로세스에 할당 가능한 메모리**를 나타냅니다.

```bash
# -m: MB 단위, -s: 지속 출력 (3초 간격)
free -m -s 3

# used 컬럼은 buff/cache를 제외한 순수 프로세스 메모리
# 실제 프로세스 메모리 = total - free - buff/cache
```

## 주요 옵션

```bash
free -h      # human-readable (G, M, K)
free -m      # MB 단위
free -g      # GB 단위
free -w      # buff와 cache를 별도 컬럼으로 분리
free -t      # 총계 행 추가
free -s 2    # 2초 간격 반복 출력
free -c 5    # 5회 출력 후 종료
```

`-w` 옵션은 buffer(파일시스템 메타데이터용)와 cache(파일 내용 캐시)를 구분해서 보여 줍니다.

## /proc/meminfo 심층 분석

`free`가 보여 주는 값은 `/proc/meminfo`의 부분 집합입니다.

```bash
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree|Slab|SReclaimable"

# 주요 필드
# MemAvailable: free 명령의 available 값
# SReclaimable: 해제 가능한 slab 메모리 (dentry 캐시 등)
# SUnreclaim: 해제 불가능한 slab (커널 내부 구조체)
# Dirty: 아직 디스크에 쓰지 않은 더티 페이지
```

`Dirty` 값이 수 GB라면 쓰기 버퍼가 쌓이고 있는 것으로, 디스크 쓰기 속도를 초과한 쓰기 요청이 발생 중입니다.

## 메모리 부족 신호와 대응

![메모리 부족 신호와 대응](/assets/posts/linux-free-memory-tips.svg)

```bash
# available이 총 RAM의 5% 이하면 경고
TOTAL=$(free -b | awk '/Mem:/{print $2}')
AVAIL=$(free -b | awk '/Mem:/{print $7}')
awk -v a=$AVAIL -v t=$TOTAL 'BEGIN{ printf "Available: %.1f%%\n", a/t*100 }'

# OOM Killer 발동 확인
dmesg | grep -i "oom\|killed process"
```

---

**지난 글:** [mpstat과 sar — CPU별 사용률과 히스토리 수집](/posts/linux-mpstat-sar/)

**다음 글:** [iotop과 iftop — I/O·네트워크 실시간 모니터링](/posts/linux-iotop-iftop/)

<br>
읽어주셔서 감사합니다. 😊
