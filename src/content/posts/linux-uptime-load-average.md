---
title: "uptime과 load average — 시스템 부하 읽기"
description: "uptime 명령 출력 구조와 load average 개념을 설명합니다. CPU 수 대비 부하 해석, 1분/5분/15분 평균의 의미, /proc/loadavg 파일 구조까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "uptime", "load-average", "performance", "monitoring", "proc"]
featured: false
draft: false
---

[지난 글](/posts/linux-dmesg/)에서 `dmesg`로 커널 링 버퍼를 읽는 방법을 알아봤습니다. 시스템을 처음 점검할 때 가장 먼저 확인하는 명령이 `uptime`입니다. 한 줄 출력이지만 현재 시각, 가동 시간, 사용자 수, 그리고 부하 지표인 **load average**까지 한눈에 보여 줍니다.

## uptime 출력 구조

```bash
$ uptime
 10:32:45 up 5 days, 3:14,  2 users,  load average: 0.52, 0.48, 0.31
```

![uptime 출력 구조](/assets/posts/linux-uptime-anatomy.svg)

출력은 네 영역으로 나뉩니다. 현재 시각(`10:32:45`), 마지막 재부팅 이후 가동 시간(`5 days, 3:14`), 현재 로그인한 사용자 세션 수(`2 users`), 그리고 마지막에 load average 세 값입니다.

`-p` 옵션은 가동 시간을 사람이 읽기 쉬운 형태로 출력하고, `-s`는 부팅한 절대 시각을 보여 줍니다.

```bash
uptime -p    # up 5 weeks, 3 days, 3 hours, 14 minutes
uptime -s    # 2026-05-13 07:18:31
```

## load average란

load average는 **CPU 실행 대기열의 평균 길이**입니다. 정확히는 "runnable 상태 또는 uninterruptible I/O 대기 상태인 프로세스 수"의 지수 이동 평균을 나타냅니다. 세 값은 각각 1분·5분·15분 구간의 평균입니다.

```bash
# /proc/loadavg에서 직접 읽기
cat /proc/loadavg
# 0.52 0.48 0.31 1/312 18734
# 앞 세 값: load average 1m/5m/15m
# 1/312: 실행 중/전체 프로세스
# 18734: 마지막으로 생성된 PID
```

## CPU 수와 부하 해석

load average의 절대값 자체는 의미가 없고, **CPU(코어) 수와의 비율**로 해석해야 합니다.

![Load Average 해석 가이드](/assets/posts/linux-uptime-load-scale.svg)

```bash
# CPU 수 확인
nproc                  # 논리 코어 수
grep -c ^processor /proc/cpuinfo  # 동일 결과
```

예를 들어 4코어 서버에서 load average 4.0은 CPU를 100% 활용하는 정상 포화 상태이고, 8.0이면 각 코어에 두 개씩 대기하는 과부하입니다. 반대로 load average가 낮더라도 특정 코어에 편중되면 병목이 생길 수 있으므로 `mpstat`으로 코어별 분포를 함께 확인합니다.

## 1분 / 5분 / 15분 비교

세 값의 관계에서 트렌드를 읽을 수 있습니다.

| 패턴 | 의미 |
|---|---|
| 1m > 5m > 15m | 부하가 증가 중 |
| 1m < 5m < 15m | 부하가 감소 중 |
| 1m ≈ 5m ≈ 15m | 안정 상태 |
| 1m 급증, 15m 낮음 | 일시적 스파이크 |

```bash
# 5초 간격으로 uptime을 계속 출력
watch -n 5 uptime
```

## I/O wait도 load average에 포함

load average에는 CPU를 기다리는 프로세스뿐 아니라 **디스크 I/O를 기다리는(uninterruptible sleep, D 상태) 프로세스**도 포함됩니다. 따라서 CPU 사용률이 낮은데 load average가 높다면 I/O 병목을 의심해야 합니다.

```bash
# D 상태 프로세스 확인
ps aux | awk '$8 == "D" {print}'

# vmstat으로 I/O wait 확인
vmstat 1 5
# 'wa' 컬럼(iowait)이 높으면 I/O 대기
```

---

**지난 글:** [dmesg — 커널 링 버퍼와 부팅 메시지](/posts/linux-dmesg/)

**다음 글:** [vmstat — 가상 메모리와 시스템 상태 통계](/posts/linux-vmstat/)

<br>
읽어주셔서 감사합니다. 😊
