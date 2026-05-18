---
title: "iostat — 디스크 I/O 통계와 성능 분석"
description: "iostat 명령으로 디스크 IOPS, 처리량, 지연 시간(await), 사용률(util%)을 측정하고 I/O 병목을 진단하는 방법을 설명합니다. HDD와 SSD의 정상 범위와 진단 흐름을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "iostat", "io", "disk", "performance", "iops", "throughput", "latency"]
featured: false
draft: false
---

[지난 글](/posts/linux-vmstat/)에서 vmstat으로 I/O wait을 감지하는 방법을 배웠습니다. vmstat의 `wa` 값이 높거나 `b` 컬럼이 증가할 때 **어느 디스크가 병목인지 정확히 파악**하는 도구가 `iostat`입니다.

## 설치와 기본 사용법

`iostat`은 `sysstat` 패키지에 포함되어 있습니다.

```bash
# 설치 (Ubuntu/Debian)
apt install sysstat

# CPU 통계 없이 디스크만 (-d), 확장 통계 (-x), 1초 간격 5회
iostat -dx 1 5

# 특정 디스크만
iostat -dx sda nvme0n1 1 3

# 활성 디스크만 표시 (통계가 0인 행 숨김)
iostat -xdz 1
```

## -x 확장 통계 출력 구조

![iostat -x 출력 구조](/assets/posts/linux-iostat-output.svg)

가장 중요한 컬럼은 **await**(지연)과 **util%**(포화도)입니다.

```bash
# 실시간으로 util% 높은 디스크만 필터
iostat -dx 1 | awk 'NR<=3 || $NF+0>20'
```

## 핵심 지표

**r/s, w/s (IOPS)**: 초당 읽기·쓰기 요청 수입니다. HDD는 보통 100~200 IOPS, NVMe SSD는 수십만 IOPS까지 나옵니다.

**rkB/s, wkB/s (Throughput)**: 초당 처리량입니다. SATA SSD는 ~500 MB/s, NVMe는 ~3,500 MB/s가 이론치입니다.

**r_await, w_await (Latency)**: 요청 완료까지 평균 대기 시간(ms)입니다. HDD는 5~20ms가 정상이고, NVMe는 0.05~0.5ms이어야 합니다. 이 값이 급등하면 디스크에 큐가 쌓이고 있습니다.

**util%**: 디스크가 I/O 처리에 바쁜 시간 비율입니다. 100%에 가까울수록 포화 상태로, HDD는 60% 이상이면, NVMe는 30% 이상이면 주의해야 합니다.

## I/O 병목 진단 흐름

![I/O 성능 진단 흐름](/assets/posts/linux-iostat-flow.svg)

## 병목 프로세스 찾기

util%가 높다면 어느 프로세스가 I/O를 일으키는지 확인해야 합니다.

```bash
# iotop으로 I/O 사용량 상위 프로세스 확인
iotop -o -d 1    # -o: 실제 I/O 중인 프로세스만

# lsof로 해당 디스크의 파일 열기 목록
lsof /dev/sda

# blktrace로 블록 레벨 추적 (상세)
blktrace -d /dev/sda -o /tmp/trace &
sleep 10; kill %1
blkparse /tmp/trace.blktrace.0 | head -100
```

## tps와 평균 요청 크기

```bash
# tps(초당 전송 수)와 평균 요청 크기로 I/O 패턴 파악
iostat -d 1 5
# Device  tps  kB_read/s  kB_wrtn/s  kB_dscd/s
# sda     120     4800.0     3400.0        0.0
```

`tps`가 높고 kB_read/s가 작으면 **소규모 랜덤 I/O**, tps가 낮고 처리량이 크면 **대규모 순차 I/O**입니다. HDD는 순차 I/O에 강하고 랜덤 I/O에 취약합니다.

---

**지난 글:** [vmstat — 가상 메모리와 시스템 상태 통계](/posts/linux-vmstat/)

**다음 글:** [mpstat과 sar — CPU별 사용률과 히스토리 수집](/posts/linux-mpstat-sar/)

<br>
읽어주셔서 감사합니다. 😊
