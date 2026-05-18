---
title: "vmstat — 가상 메모리와 시스템 상태 통계"
description: "vmstat 명령으로 프로세스, 메모리, 스왑, I/O, 시스템 인터럽트, CPU 사용률을 한눈에 파악하는 방법을 설명합니다. 출력 컬럼 해석과 병목 패턴 진단법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "vmstat", "memory", "performance", "monitoring", "cpu", "io"]
featured: false
draft: false
---

[지난 글](/posts/linux-uptime-load-average/)에서 load average로 시스템 부하를 읽는 법을 배웠습니다. `vmstat`은 한 발 더 나아가 프로세스 대기열·메모리·스왑·I/O·CPU를 **하나의 행에 압축**해 보여 주는 강력한 개요 도구입니다.

## 기본 사용법

```bash
vmstat            # 부팅 이후 누적 평균
vmstat 1          # 1초 간격으로 계속 출력
vmstat 1 5        # 1초 간격, 5번 출력
vmstat -t 1 5     # 타임스탬프 추가
```

첫 번째 줄은 **부팅 이후 전체 평균**이므로 현재 상태를 보려면 두 번째 줄부터 읽습니다.

## 출력 컬럼 구조

![vmstat 출력 컬럼 설명](/assets/posts/linux-vmstat-columns.svg)

출력은 6개 섹션으로 나뉩니다. `procs`(프로세스), `memory`(메모리), `swap`(스왑), `io`(블록 I/O), `system`(인터럽트·컨텍스트 스위치), `cpu`(CPU 사용률)입니다.

```bash
# 실제 vmstat 출력 예
$ vmstat 1 3
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 2  0      0 512000  24576 819200    0    0    12     8  420 1850 12  3 84  1  0
 1  0      0 510000  24576 820000    0    0     0     4  380 1720  8  2 89  1  0
```

## 핵심 컬럼 해석

`r` 컬럼은 CPU 실행 대기 프로세스 수로, 코어 수보다 지속적으로 크면 CPU 병목입니다. `b` 컬럼은 uninterruptible I/O 대기 프로세스 수이며 높으면 디스크 병목을 의미합니다.

`si`(swap in)와 `so`(swap out)는 정상 시스템에서는 0입니다. 이 값이 지속적으로 증가하면 물리 메모리가 부족해 스왑 영역을 쓰고 있다는 신호입니다.

```bash
# wa(iowait)가 높을 때 어느 디스크가 원인인지 확인
iostat -x 1 5 | grep -v "^$"

# cs(context switch)가 극단적으로 높을 때 원인 프로세스 찾기
pidstat -w 1 5
```

## 병목 패턴 진단

![vmstat 패턴으로 병목 진단](/assets/posts/linux-vmstat-diagnosis.svg)

## 유용한 옵션

```bash
vmstat -d 1 3     # 디스크별 I/O 통계
vmstat -p /dev/sda1 1 3   # 파티션별 I/O
vmstat -s         # 메모리 이벤트 누적 카운터 출력
vmstat -m         # 슬랩 메모리 사용량 (slab)
```

`-s` 옵션의 "pages paged in/out" 값은 vmstat 실행 이후 누적 I/O 페이지 수로 스왑 활동의 전체 규모를 파악할 때 씁니다.

## /proc/meminfo와의 관계

vmstat의 메모리 수치는 `/proc/meminfo`에서 가져옵니다.

```bash
cat /proc/vmstat       # vmstat이 참조하는 원본 카운터
grep -E "pgpgin|pgpgout|pswpin|pswpout" /proc/vmstat
# pgpgin/pgpgout: 페이지 I/O 누적
# pswpin/pswpout: 스왑 I/O 누적
```

---

**지난 글:** [uptime과 load average — 시스템 부하 읽기](/posts/linux-uptime-load-average/)

**다음 글:** [iostat — 디스크 I/O 통계와 성능 분석](/posts/linux-iostat/)

<br>
읽어주셔서 감사합니다. 😊
